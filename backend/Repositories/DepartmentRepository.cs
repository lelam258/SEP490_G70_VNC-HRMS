using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Organization;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Organization;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories.Interfaces;

namespace Vnc.HRMS.Repositories;

public sealed class DepartmentRepository(AppDbContext db) : IDepartmentRepository
{
    public const string DeptFacilityPolicyPrefix = "DEPT_FACILITIES:";

    public async Task<DepartmentDto[]> ListAsync(CancellationToken ct)
    {
        var depts = await db.Departments.AsNoTracking().OrderBy(x => x.Name).ToListAsync(ct);
        if (depts.Count == 0) return [];

        var facilities = await db.ScheduleFacilities.AsNoTracking()
            .Where(x => x.Status == "active")
            .OrderBy(x => x.Name)
            .ToListAsync(ct);

        var policies = await db.SystemPolicies.AsNoTracking()
            .Where(p => p.PolicyKey.StartsWith(DeptFacilityPolicyPrefix))
            .ToListAsync(ct);

        var coverages = await db.ScheduleCoverage.AsNoTracking().ToListAsync(ct);

        var policyMap = new Dictionary<Guid, List<Guid>>();
        foreach (var p in policies)
        {
            var rawId = p.PolicyKey.Substring(DeptFacilityPolicyPrefix.Length);
            if (Guid.TryParse(rawId, out var deptId) && !string.IsNullOrWhiteSpace(p.PolicyValue))
            {
                try
                {
                    var ids = JsonSerializer.Deserialize<List<Guid>>(p.PolicyValue);
                    if (ids != null && ids.Count > 0)
                    {
                        policyMap[deptId] = ids;
                    }
                }
                catch
                {
                    // Ignore malformed policy JSON
                }
            }
        }

        var coverageMap = coverages
            .GroupBy(c => c.DepartmentId)
            .ToDictionary(g => g.Key, g => g.Select(x => x.FacilityId).Distinct().ToList());

        var allFacilityIds = facilities.Select(f => f.Id).ToList();
        var facilityNameMap = facilities.ToDictionary(f => f.Id, f => f.Name);

        return depts.Select(d =>
        {
            IReadOnlyList<Guid> assignedIds;
            if (policyMap.TryGetValue(d.DepartmentId, out var pIds))
            {
                var valid = pIds.Where(facilityNameMap.ContainsKey).Distinct().ToList();
                assignedIds = valid.Count > 0 ? valid : allFacilityIds;
            }
            else if (coverageMap.TryGetValue(d.DepartmentId, out var cIds))
            {
                var valid = cIds.Where(facilityNameMap.ContainsKey).Distinct().ToList();
                assignedIds = valid.Count > 0 ? valid : allFacilityIds;
            }
            else
            {
                assignedIds = allFacilityIds;
            }

            var label = BuildFacilityLabel(assignedIds, facilities);
            return new DepartmentDto(d.DepartmentId, d.DeptCode, d.Name, d.Status, assignedIds, label);
        }).ToArray();
    }

    public async Task<DepartmentDto?> GetDtoAsync(Guid id, CancellationToken ct)
    {
        var all = await ListAsync(ct);
        return all.FirstOrDefault(x => x.Id == id);
    }

    public Task<FacilityOptionDto[]> ListFacilitiesAsync(CancellationToken ct)
        => db.ScheduleFacilities.AsNoTracking()
            .Where(x => x.Status == "active")
            .OrderBy(x => x.Name)
            .Select(x => new FacilityOptionDto(x.Id, x.Name, x.Status))
            .ToArrayAsync(ct);

    public async Task AssignFacilitiesAsync(
        Guid departmentId,
        string departmentName,
        IReadOnlyList<Guid> facilityIds,
        CancellationToken ct)
    {
        var activeFacilities = await db.ScheduleFacilities.AsNoTracking()
            .Where(x => x.Status == "active")
            .OrderBy(x => x.Name)
            .ToListAsync(ct);

        var activeSet = activeFacilities.Select(f => f.Id).ToHashSet();
        var validIds = (facilityIds ?? [])
            .Where(activeSet.Contains)
            .Distinct()
            .ToList();

        if (validIds.Count == 0)
        {
            throw new AppException(400, "Vui lòng chọn ít nhất một cơ sở hoạt động cho khoa/phòng.");
        }

        var policyKey = $"{DeptFacilityPolicyPrefix}{departmentId}";
        var existingPolicy = await db.SystemPolicies
            .FirstOrDefaultAsync(p => p.PolicyKey == policyKey, ct);

        var serialized = JsonSerializer.Serialize(validIds);
        if (existingPolicy != null)
        {
            existingPolicy.PolicyValue = serialized;
            existingPolicy.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            db.SystemPolicies.Add(new SystemPolicy
            {
                PolicyId = Guid.NewGuid(),
                PolicyKey = policyKey,
                PolicyValue = serialized,
                ValueType = "json",
                Description = $"Cơ sở trực thuộc của khoa/phòng {departmentName}",
                UpdatedAt = DateTime.UtcNow
            });
        }

        // Ensure ScheduleCoverage rows exist for each assigned facility and remove unused ones not in validIds
        var existingCoverages = await db.ScheduleCoverage
            .Where(c => c.DepartmentId == departmentId)
            .ToListAsync(ct);

        var existingCovIds = existingCoverages.Select(c => c.Id).ToList();
        var usedCoverageIds = existingCovIds.Count > 0
            ? (await db.ScheduleAssignments.AsNoTracking()
                .Where(a => existingCovIds.Contains(a.CoverageId))
                .Select(a => a.CoverageId)
                .Distinct()
                .ToListAsync(ct)).ToHashSet()
            : new HashSet<Guid>();

        foreach (var cov in existingCoverages)
        {
            if (!validIds.Contains(cov.FacilityId) && !usedCoverageIds.Contains(cov.Id))
            {
                db.ScheduleCoverage.Remove(cov);
            }
        }

        foreach (var facId in validIds)
        {
            if (!existingCoverages.Any(c => c.FacilityId == facId))
            {
                db.ScheduleCoverage.Add(new ScheduleCoverage
                {
                    Id = Guid.NewGuid(),
                    DepartmentId = departmentId,
                    FacilityId = facId,
                    Name = departmentName
                });
            }
        }
    }

    private static string BuildFacilityLabel(IReadOnlyList<Guid> assignedIds, List<ScheduleFacility> activeFacilities)
    {
        if (activeFacilities.Count == 0 || assignedIds.Count == 0)
            return "Chưa phân cơ sở";

        var names = activeFacilities
            .Where(f => assignedIds.Contains(f.Id))
            .Select(f => f.Name)
            .ToList();

        if (names.Count == 0)
            return "Chưa phân cơ sở";

        if (activeFacilities.Count >= 2 && names.Count == activeFacilities.Count)
            return $"Cả hai ({string.Join(", ", names)})";

        return string.Join(", ", names);
    }

    public Task<Department?> FindAsync(Guid id, CancellationToken ct) => db.Departments.SingleOrDefaultAsync(x => x.DepartmentId == id, ct);
    public Task<bool> CodeExistsAsync(string code, Guid? excludeId, CancellationToken ct)
        => db.Departments.AnyAsync(x => x.DepartmentId != excludeId && x.DeptCode == code, ct);
    public Task<bool> NameExistsAsync(string name, Guid? excludeId, CancellationToken ct)
        => db.Departments.AnyAsync(x => x.DepartmentId != excludeId && x.Name == name, ct);
    public void Add(Department department) => db.Departments.Add(department);
}
