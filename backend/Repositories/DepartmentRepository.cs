using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Organization;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Models.Organization;
using Vnc.HRMS.Models.Users;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Security;

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

        var managerIds = depts
            .Where(d => d.ManagerId.HasValue)
            .Select(d => d.ManagerId!.Value)
            .Distinct()
            .ToList();

        var managerMap = managerIds.Count > 0
            ? await db.Staff.AsNoTracking()
                .Where(s => managerIds.Contains(s.StaffId))
                .ToDictionaryAsync(s => s.StaffId, s => (s.FullName, s.StaffCode), ct)
            : new Dictionary<Guid, (string FullName, string StaffCode)>();

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
            string? managerName = null;
            string? managerCode = null;
            if (d.ManagerId.HasValue && managerMap.TryGetValue(d.ManagerId.Value, out var mgr))
            {
                managerName = mgr.FullName;
                managerCode = mgr.StaffCode;
            }
            return new DepartmentDto(
                d.DepartmentId,
                d.DeptCode,
                d.Name,
                d.Status,
                assignedIds,
                label,
                d.ManagerId,
                managerName,
                managerCode);
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

    public async Task<DepartmentManagerOptionDto[]> ListManagerOptionsAsync(CancellationToken ct)
    {
        var raw = await (
            from s in db.Staff.AsNoTracking()
            where s.Status == "active" && s.DepartmentId != null
            join d in db.Departments.AsNoTracking() on s.DepartmentId equals d.DepartmentId
            join u in db.Users.AsNoTracking() on s.UserId equals u.UserId
            orderby s.FullName, s.StaffCode
            select new
            {
                s.StaffId,
                s.StaffCode,
                s.FullName,
                s.DepartmentId,
                DepartmentName = d.Name,
                u.Role,
                u.IsProvisioned,
                u.AccountStatus,
                IsCurrentDeptManager = d.ManagerId == s.StaffId
            }).ToArrayAsync(ct);

        return raw
            .Select(x => new
            {
                x.StaffId,
                x.StaffCode,
                x.FullName,
                x.DepartmentId,
                x.DepartmentName,
                NormalizedRole = AccountRoles.Normalize(x.Role),
                IsEligibleAccount = x.IsProvisioned &&
                    string.Equals(x.AccountStatus, "active", StringComparison.OrdinalIgnoreCase),
                x.IsCurrentDeptManager
            })
            .Where(x =>
                (x.IsEligibleAccount &&
                 string.Equals(x.NormalizedRole, AccountRoles.MedicalStaff, StringComparison.OrdinalIgnoreCase)) ||
                x.IsCurrentDeptManager)
            .Select(x => new DepartmentManagerOptionDto(
                x.StaffId,
                x.StaffCode,
                x.FullName,
                x.DepartmentId,
                x.DepartmentName,
                x.NormalizedRole))
            .ToArray();
    }

    public Task<Staff?> FindStaffAsync(Guid staffId, CancellationToken ct)
        => db.Staff.AsNoTracking().SingleOrDefaultAsync(s => s.StaffId == staffId, ct);

    public async Task<User?> FindUserByStaffIdAsync(Guid staffId, CancellationToken ct)
    {
        var staff = await db.Staff.AsNoTracking().SingleOrDefaultAsync(s => s.StaffId == staffId, ct);
        if (staff is null) return null;
        return await db.Users.SingleOrDefaultAsync(u => u.UserId == staff.UserId, ct);
    }

    public Task<string?> FindOtherManagedDepartmentNameAsync(Guid managerId, Guid excludeDepartmentId, CancellationToken ct)
        => db.Departments.AsNoTracking()
            .Where(d => d.DepartmentId != excludeDepartmentId && d.Status == "active" && d.ManagerId == managerId)
            .Select(d => d.Name)
            .FirstOrDefaultAsync(ct);

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
