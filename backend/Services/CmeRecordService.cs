using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Cme;
using Vnc.HRMS.Models;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Services;

public sealed class CmeRecordService(AppDbContext db, IUnitOfWork unitOfWork) : ICmeRecordService
{
    private const int DefaultCmeAlertThresholdDays = 180;
    private const decimal DefaultRequiredCredits = 1m;

    public async Task<StaffCmeSummaryDto[]> ListStaffSummariesAsync(CancellationToken ct = default)
    {
        var staffItems = await (
            from staff in db.Staff.AsNoTracking()
            join dept in db.Departments.AsNoTracking() on staff.DepartmentId equals dept.DepartmentId into depts
            from dept in depts.DefaultIfEmpty()
            orderby staff.StaffCode
            select new
            {
                staff.StaffId,
                staff.StaffCode,
                staff.FullName,
                staff.DepartmentId,
                DepartmentName = dept != null ? dept.Name : "Chưa phân khoa",
                staff.Email,
                staff.Status,
                staff.AvatarUrl
            }
        ).ToArrayAsync(ct);

        var certificates = await db.Certificates.AsNoTracking()
            .Select(c => new
            {
                c.CertificateId,
                c.StaffId,
                c.CertificateType,
                c.CmeRequiredCredits,
                c.CmeCycleMonths
            })
            .ToArrayAsync(ct);

        var cmeRecords = await db.CmeRecords.AsNoTracking()
            .Select(r => new
            {
                r.CmeId,
                r.CertificateId,
                r.Credits,
                Verified = r.Verified ?? true
            })
            .ToArrayAsync(ct);

        var certByStaff = certificates.ToLookup(c => c.StaffId);
        var recordsByCert = cmeRecords.ToLookup(r => r.CertificateId);

        return staffItems.Select(s =>
        {
            var staffCerts = certByStaff[s.StaffId]
                .Where(c => CertificateCategoryHelper.Parse(c.CertificateType).Category == "certificate")
                .ToArray();

            var cmeCerts = staffCerts
                .Where(c => (c.CmeRequiredCredits ?? 0) > 0 || (c.CmeCycleMonths ?? 0) > 0)
                .ToArray();

            var staffRecords = staffCerts
                .SelectMany(c => recordsByCert[c.CertificateId])
                .ToArray();

            var totalRequired = staffCerts.Sum(c =>
                c.CmeRequiredCredits is > 0 ? c.CmeRequiredCredits.Value : DefaultRequiredCredits);
            var totalEarned = staffRecords.Sum(r => r.Credits);
            var pendingCount = staffRecords.Count(r => !r.Verified);

            return new StaffCmeSummaryDto(
                s.StaffId,
                s.StaffCode,
                s.FullName,
                s.DepartmentId,
                s.DepartmentName,
                s.Email,
                s.Status,
                s.AvatarUrl,
                staffCerts.Length,
                cmeCerts.Length,
                staffRecords.Length,
                pendingCount,
                totalRequired,
                totalEarned,
                totalEarned
            );
        }).ToArray();
    }

    public async Task<CertificateCycleDto[]> ListCertificateCyclesByStaffAsync(Guid staffId, CancellationToken ct = default)
    {
        var rawCerts = await db.Certificates.AsNoTracking()
            .Where(c => c.StaffId == staffId)
            .OrderByDescending(c => c.Status == "active")
            .ThenByDescending(c => c.IssueDate)
            .ToArrayAsync(ct);

        var certs = rawCerts
            .Where(c => CertificateCategoryHelper.Parse(c.CertificateType).Category == "certificate")
            .ToArray();

        if (certs.Length == 0)
            return [];

        var certIds = certs.Select(c => c.CertificateId).ToArray();

        var cycles = await db.CmeCycles.AsNoTracking()
            .Where(cy => certIds.Contains(cy.CertificateId))
            .OrderByDescending(cy => cy.CycleNumber)
            .ToArrayAsync(ct);

        var records = await db.CmeRecords.AsNoTracking()
            .Where(r => certIds.Contains(r.CertificateId))
            .ToArrayAsync(ct);

        var cyclesByCert = cycles.ToLookup(c => c.CertificateId);
        var recordsByCert = records.ToLookup(r => r.CertificateId);
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        var result = new List<CertificateCycleDto>();

        foreach (var cert in certs)
        {
            var certCycles = cyclesByCert[cert.CertificateId]
                .OrderByDescending(cy => cy.CycleNumber)
                .ToArray();
            var certRecords = recordsByCert[cert.CertificateId].ToArray();

            if (certCycles.Length == 0)
            {
                result.Add(BuildCertificateCycleDto(cert, null, certRecords, today, isCurrentCycle: true));
            }
            else
            {
                var maxCycleNumber = certCycles.Max(cy => cy.CycleNumber);
                var minCycleId = certCycles.OrderBy(cy => cy.CycleNumber).First().CycleId;

                foreach (var cy in certCycles)
                {
                    var isCurrent = cy.CycleNumber == maxCycleNumber;
                    var cyRecords = certRecords
                        .Where(r => r.CmeCycleId == cy.CycleId || (r.CmeCycleId == null && cy.CycleId == minCycleId))
                        .ToArray();

                    result.Add(BuildCertificateCycleDto(cert, cy, cyRecords, today, isCurrent));
                }
            }
        }

        return result.ToArray();
    }

    public async Task<CertificateCycleDto> UpdateCycleDatesAsync(
        Guid certificateId,
        UpdateCmeCycleDatesRequest request,
        CancellationToken ct = default)
    {
        var cert = await db.Certificates.SingleOrDefaultAsync(c => c.CertificateId == certificateId, ct)
            ?? throw new AppException(404, "Không tìm thấy chứng chỉ.");

        var (cat, _, _) = CertificateCategoryHelper.Parse(cert.CertificateType);
        if (cat == "degree")
            throw new AppException(400, "Không áp dụng chu kỳ CME cho bằng cấp.");

        if (request.CycleEnd <= request.CycleStart)
            throw new AppException(400, "Ngày kết thúc chu kỳ phải lớn hơn ngày bắt đầu (End date must be after start date).");

        CmeCycle? cycle = null;
        if (request.CycleId.HasValue)
        {
            cycle = await db.CmeCycles.SingleOrDefaultAsync(
                c => c.CycleId == request.CycleId.Value && c.CertificateId == certificateId,
                ct);
        }

        cycle ??= await db.CmeCycles
            .OrderByDescending(c => c.CycleNumber)
            .FirstOrDefaultAsync(c => c.CertificateId == certificateId, ct);

        if (cycle is { Status: "locked" })
        {
            throw new AppException(400, "Bảng tiến độ này đã được xác nhận khóa, không thể chỉnh sửa.");
        }

        var hasCmeCredits = cert.CmeRequiredCredits is > 0;
        var requiredCredits = hasCmeCredits
            ? cert.CmeRequiredCredits!.Value
            : DefaultRequiredCredits;

        if (cycle == null)
        {
            var unlinkedRecords = await db.CmeRecords
                .Where(r => r.CertificateId == certificateId && r.CmeCycleId == null)
                .ToListAsync(ct);

            var earnedCredits = hasCmeCredits
                ? unlinkedRecords.Sum(r => r.Credits)
                : (unlinkedRecords.Count > 0 ? 1m : 0m);

            cycle = new CmeCycle
            {
                CycleId = Guid.NewGuid(),
                CertificateId = certificateId,
                CycleNumber = 1,
                CycleStart = request.CycleStart,
                CycleEnd = request.CycleEnd,
                RequiredCredits = requiredCredits,
                EarnedCredits = earnedCredits,
                Status = "active"
            };
            db.CmeCycles.Add(cycle);
            await unitOfWork.SaveChangesAsync(ct);

            if (unlinkedRecords.Count > 0)
            {
                foreach (var rec in unlinkedRecords)
                {
                    rec.CmeCycleId = cycle.CycleId;
                }
                await unitOfWork.SaveChangesAsync(ct);
            }
        }
        else
        {
            var existingRecs = await db.CmeRecords.AsNoTracking()
                .Where(r => r.CmeCycleId == cycle.CycleId)
                .ToListAsync(ct);

            var earnedCredits = hasCmeCredits
                ? existingRecs.Sum(r => r.Credits)
                : (existingRecs.Count > 0 ? 1m : 0m);

            cycle.CycleStart = request.CycleStart;
            cycle.CycleEnd = request.CycleEnd;
            cycle.RequiredCredits = requiredCredits;
            cycle.EarnedCredits = earnedCredits;
            if (!string.Equals(cycle.Status, "locked", StringComparison.OrdinalIgnoreCase))
            {
                cycle.Status = "active";
            }
            await unitOfWork.SaveChangesAsync(ct);
        }

        var cycleRecords = await db.CmeRecords.AsNoTracking()
            .Where(r => r.CmeCycleId == cycle.CycleId)
            .ToArrayAsync(ct);

        var maxCycleNumber = await db.CmeCycles.AsNoTracking()
            .Where(c => c.CertificateId == certificateId)
            .MaxAsync(c => (int?)c.CycleNumber, ct) ?? cycle.CycleNumber;

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        return BuildCertificateCycleDto(cert, cycle, cycleRecords, today, cycle.CycleNumber == maxCycleNumber);
    }

    public async Task<CertificateCycleDto> CompleteCycleAsync(
        Guid certificateId,
        Guid? cycleId,
        CancellationToken ct = default)
    {
        var cert = await db.Certificates.SingleOrDefaultAsync(c => c.CertificateId == certificateId, ct)
            ?? throw new AppException(404, "Không tìm thấy chứng chỉ.");

        var (cat, _, _) = CertificateCategoryHelper.Parse(cert.CertificateType);
        if (cat == "degree")
            throw new AppException(400, "Không áp dụng chu kỳ CME cho bằng cấp.");

        var hasCmeCredits = cert.CmeRequiredCredits is > 0;
        var requiredCredits = hasCmeCredits
            ? cert.CmeRequiredCredits!.Value
            : DefaultRequiredCredits;

        CmeCycle? cycle = null;
        if (cycleId.HasValue)
        {
            cycle = await db.CmeCycles.SingleOrDefaultAsync(
                c => c.CycleId == cycleId.Value && c.CertificateId == certificateId,
                ct);
        }

        cycle ??= await db.CmeCycles
            .OrderByDescending(c => c.CycleNumber)
            .FirstOrDefaultAsync(c => c.CertificateId == certificateId, ct);

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        if (cycle == null)
        {
            var unlinkedRecords = await db.CmeRecords
                .Where(r => r.CertificateId == certificateId && r.CmeCycleId == null)
                .ToListAsync(ct);

            var earned = hasCmeCredits
                ? unlinkedRecords.Sum(r => r.Credits)
                : (unlinkedRecords.Count > 0 ? 1m : 0m);

            if (earned < requiredCredits)
            {
                throw new AppException(
                    400,
                    $"Chưa đạt đủ chỉ tiêu ({earned}/{requiredCredits}) nên chưa thể xác nhận khóa.");
            }

            var startDate = unlinkedRecords.Count > 0 ? unlinkedRecords.Min(r => r.CompletedDate) : today;
            var endDate = unlinkedRecords.Count > 0 ? unlinkedRecords.Max(r => r.CompletedDate) : today;
            if (endDate < startDate) endDate = startDate;

            cycle = new CmeCycle
            {
                CycleId = Guid.NewGuid(),
                CertificateId = certificateId,
                CycleNumber = 1,
                CycleStart = startDate,
                CycleEnd = endDate,
                RequiredCredits = requiredCredits,
                EarnedCredits = earned,
                Status = "locked"
            };
            db.CmeCycles.Add(cycle);
            await unitOfWork.SaveChangesAsync(ct);

            foreach (var rec in unlinkedRecords)
            {
                rec.CmeCycleId = cycle.CycleId;
            }
            await unitOfWork.SaveChangesAsync(ct);
        }
        else
        {
            var existingRecs = await db.CmeRecords.AsNoTracking()
                .Where(r => r.CmeCycleId == cycle.CycleId)
                .ToListAsync(ct);

            var earned = hasCmeCredits
                ? existingRecs.Sum(r => r.Credits)
                : (existingRecs.Count > 0 ? 1m : 0m);

            if (earned < requiredCredits)
            {
                throw new AppException(
                    400,
                    $"Chưa đạt đủ chỉ tiêu ({earned}/{requiredCredits}) nên chưa thể xác nhận khóa.");
            }

            cycle.EarnedCredits = earned;
            cycle.RequiredCredits = requiredCredits;
            cycle.Status = "locked";
            await unitOfWork.SaveChangesAsync(ct);
        }

        var cycleRecords = await db.CmeRecords.AsNoTracking()
            .Where(r => r.CmeCycleId == cycle.CycleId)
            .ToArrayAsync(ct);

        var maxCycleNumber = await db.CmeCycles.AsNoTracking()
            .Where(c => c.CertificateId == certificateId)
            .MaxAsync(c => (int?)c.CycleNumber, ct) ?? cycle.CycleNumber;

        return BuildCertificateCycleDto(cert, cycle, cycleRecords, today, cycle.CycleNumber == maxCycleNumber);
    }

    public async Task<CertificateCycleDto> CreateNewCycleAsync(
        Guid certificateId,
        CreateNewCmeCycleRequest? request,
        CancellationToken ct = default)
    {
        var cert = await db.Certificates.SingleOrDefaultAsync(c => c.CertificateId == certificateId, ct)
            ?? throw new AppException(404, "Không tìm thấy chứng chỉ.");

        var (cat, _, _) = CertificateCategoryHelper.Parse(cert.CertificateType);
        if (cat == "degree")
            throw new AppException(400, "Không áp dụng chu kỳ CME cho bằng cấp.");

        if (request?.CycleStart is not null && request.CycleEnd is not null && request.CycleEnd <= request.CycleStart)
            throw new AppException(400, "Ngày kết thúc chu kỳ phải lớn hơn ngày bắt đầu.");

        var hasCmeCredits = cert.CmeRequiredCredits is > 0;
        var requiredCredits = hasCmeCredits
            ? cert.CmeRequiredCredits!.Value
            : DefaultRequiredCredits;

        var existingCycles = await db.CmeCycles
            .Where(c => c.CertificateId == certificateId)
            .OrderBy(c => c.CycleNumber)
            .ToListAsync(ct);

        var unlinkedRecords = await db.CmeRecords
            .Where(r => r.CertificateId == certificateId && r.CmeCycleId == null)
            .ToListAsync(ct);

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));

        if (existingCycles.Count == 0 && unlinkedRecords.Count > 0)
        {
            var firstStart = unlinkedRecords.Min(r => r.CompletedDate);
            var firstEnd = unlinkedRecords.Max(r => r.CompletedDate);
            if (firstEnd < firstStart) firstEnd = firstStart;

            var archivedEarned = hasCmeCredits
                ? unlinkedRecords.Sum(r => r.Credits)
                : 1m;
            var cycle1 = new CmeCycle
            {
                CycleId = Guid.NewGuid(),
                CertificateId = certificateId,
                CycleNumber = 1,
                CycleStart = firstStart,
                CycleEnd = firstEnd,
                RequiredCredits = requiredCredits,
                EarnedCredits = archivedEarned,
                Status = "locked"
            };
            db.CmeCycles.Add(cycle1);
            await unitOfWork.SaveChangesAsync(ct);

            foreach (var rec in unlinkedRecords)
            {
                rec.CmeCycleId = cycle1.CycleId;
            }
            await unitOfWork.SaveChangesAsync(ct);
            existingCycles.Add(cycle1);
        }
        else if (existingCycles.Count > 0 && unlinkedRecords.Count > 0)
        {
            var firstCycle = existingCycles[0];
            foreach (var rec in unlinkedRecords)
            {
                rec.CmeCycleId = firstCycle.CycleId;
            }
            await unitOfWork.SaveChangesAsync(ct);
            await RecalculateCycleCreditsAsync(firstCycle.CycleId, ct);
        }

        // Lock previous cycles when starting a new table
        foreach (var prev in existingCycles)
        {
            prev.Status = "locked";
        }

        var nextCycleNumber = existingCycles.Count > 0
            ? existingCycles.Max(c => c.CycleNumber) + 1
            : 1;

        var startDate = request?.CycleStart ?? today;
        var months = cert.CmeCycleMonths is > 0 ? cert.CmeCycleMonths.Value : 24;
        var endDate = request?.CycleEnd ?? startDate.AddMonths(months);
        if (endDate <= startDate)
            endDate = startDate.AddMonths(months);

        var newCycle = new CmeCycle
        {
            CycleId = Guid.NewGuid(),
            CertificateId = certificateId,
            CycleNumber = nextCycleNumber,
            CycleStart = startDate,
            CycleEnd = endDate,
            RequiredCredits = requiredCredits,
            EarnedCredits = 0m,
            Status = "active"
        };

        db.CmeCycles.Add(newCycle);
        await unitOfWork.SaveChangesAsync(ct);

        return BuildCertificateCycleDto(cert, newCycle, [], today, isCurrentCycle: true);
    }

    private static CertificateCycleDto BuildCertificateCycleDto(
        Certificate cert,
        CmeCycle? cycle,
        IEnumerable<CmeRecord> cycleRecords,
        DateOnly today,
        bool isCurrentCycle)
    {
        var (_, _, cleanName) = CertificateCategoryHelper.Parse(cert.CertificateType);
        var hasExpiry = cert.ExpiryDate.HasValue;

        DateOnly? cycleStart = cycle?.CycleStart;
        DateOnly? cycleEnd = cycle?.CycleEnd;

        var hasCmeCreditsRequirement = cert.CmeRequiredCredits is > 0;
        var required = hasCmeCreditsRequirement
            ? cert.CmeRequiredCredits!.Value
            : DefaultRequiredCredits;

        var recArray = cycleRecords as CmeRecord[] ?? cycleRecords.ToArray();
        var earned = hasCmeCreditsRequirement
            ? recArray.Sum(r => r.Credits)
            : (recArray.Length > 0 ? 1m : 0m);
        var remaining = Math.Max(0m, required - earned);

        int? daysLeft = null;
        if (cycleEnd.HasValue)
        {
            daysLeft = cycleEnd.Value.DayNumber - today.DayNumber;
        }

        var isAtRisk = remaining > 0 && daysLeft.HasValue && daysLeft.Value <= DefaultCmeAlertThresholdDays;
        var statusBadge = isAtRisk ? "At risk" : "On track";

        // Only explicitly "locked" status locks the current cycle; never auto-lock when earned >= required.
        var effectiveStatus = isCurrentCycle
            ? (string.Equals(cycle?.Status, "locked", StringComparison.OrdinalIgnoreCase) ? "locked" : "active")
            : "locked";

        return new CertificateCycleDto(
            cert.CertificateId,
            cert.CertificateNumber,
            string.IsNullOrWhiteSpace(cleanName) ? cert.CertificateType : cleanName,
            cert.IssueDate,
            cert.ExpiryDate,
            hasExpiry,
            cycle?.CycleId,
            cycle?.CycleNumber ?? 1,
            cycleStart,
            cycleEnd,
            required,
            earned,
            remaining,
            daysLeft,
            statusBadge,
            DefaultCmeAlertThresholdDays,
            cert.Status ?? "active",
            effectiveStatus,
            isCurrentCycle,
            hasCmeCreditsRequirement
        );
    }

    public async Task<CmeRecordDto[]> ListByStaffIdAsync(Guid staffId, CancellationToken ct = default)
    {
        var query = await (
            from rec in db.CmeRecords.AsNoTracking()
            join cert in db.Certificates.AsNoTracking() on rec.CertificateId equals cert.CertificateId
            where cert.StaffId == staffId
            join staff in db.Staff.AsNoTracking() on cert.StaffId equals staff.StaffId
            join dept in db.Departments.AsNoTracking() on staff.DepartmentId equals dept.DepartmentId into depts
            from dept in depts.DefaultIfEmpty()
            join cycle in db.CmeCycles.AsNoTracking() on rec.CmeCycleId equals cycle.CycleId into cycles
            from cycle in cycles.DefaultIfEmpty()
            join verifier in db.Users.AsNoTracking() on rec.VerifiedBy equals verifier.UserId into verifiers
            from verifier in verifiers.DefaultIfEmpty()
            orderby rec.CompletedDate descending, rec.CreatedAt descending
            select new
            {
                rec.CmeId,
                rec.CertificateId,
                cert.CertificateType,
                cert.CertificateNumber,
                cert.CmeCycleMonths,
                cert.CmeRequiredCredits,
                staff.StaffId,
                staff.StaffCode,
                staff.FullName,
                staff.DepartmentId,
                DepartmentName = dept != null ? dept.Name : null,
                rec.CmeCycleId,
                CycleNumber = cycle != null ? (int?)cycle.CycleNumber : null,
                rec.CourseName,
                rec.Provider,
                rec.CompletedDate,
                rec.Credits,
                rec.FileUrl,
                Verified = rec.Verified ?? true,
                rec.VerifiedBy,
                VerifiedByName = verifier != null ? verifier.FullName : null,
                rec.VerifiedAt,
                rec.CreatedAt
            }
        ).ToArrayAsync(ct);

        return query.Select(x =>
        {
            var (_, _, cleanCertName) = CertificateCategoryHelper.Parse(x.CertificateType);
            return new CmeRecordDto(
                x.CmeId,
                x.CertificateId,
                string.IsNullOrWhiteSpace(cleanCertName) ? x.CertificateType : cleanCertName,
                x.CertificateNumber,
                x.CmeCycleMonths,
                x.CmeRequiredCredits,
                x.StaffId,
                x.StaffCode,
                x.FullName,
                x.DepartmentId,
                x.DepartmentName,
                x.CmeCycleId,
                x.CycleNumber,
                x.CourseName,
                x.Provider,
                x.CompletedDate,
                x.Credits,
                x.FileUrl,
                x.Verified,
                x.VerifiedBy,
                x.VerifiedByName,
                x.VerifiedAt,
                x.CreatedAt
            );
        }).ToArray();
    }

    public async Task<CmeRecordDto[]> ListByCertificateIdAsync(Guid certificateId, CancellationToken ct = default)
    {
        var query = await (
            from rec in db.CmeRecords.AsNoTracking()
            where rec.CertificateId == certificateId
            join cert in db.Certificates.AsNoTracking() on rec.CertificateId equals cert.CertificateId
            join staff in db.Staff.AsNoTracking() on cert.StaffId equals staff.StaffId
            join dept in db.Departments.AsNoTracking() on staff.DepartmentId equals dept.DepartmentId into depts
            from dept in depts.DefaultIfEmpty()
            join cycle in db.CmeCycles.AsNoTracking() on rec.CmeCycleId equals cycle.CycleId into cycles
            from cycle in cycles.DefaultIfEmpty()
            join verifier in db.Users.AsNoTracking() on rec.VerifiedBy equals verifier.UserId into verifiers
            from verifier in verifiers.DefaultIfEmpty()
            orderby rec.CompletedDate descending, rec.CreatedAt descending
            select new
            {
                rec.CmeId,
                rec.CertificateId,
                cert.CertificateType,
                cert.CertificateNumber,
                cert.CmeCycleMonths,
                cert.CmeRequiredCredits,
                staff.StaffId,
                staff.StaffCode,
                staff.FullName,
                staff.DepartmentId,
                DepartmentName = dept != null ? dept.Name : null,
                rec.CmeCycleId,
                CycleNumber = cycle != null ? (int?)cycle.CycleNumber : null,
                rec.CourseName,
                rec.Provider,
                rec.CompletedDate,
                rec.Credits,
                rec.FileUrl,
                Verified = rec.Verified ?? true,
                rec.VerifiedBy,
                VerifiedByName = verifier != null ? verifier.FullName : null,
                rec.VerifiedAt,
                rec.CreatedAt
            }
        ).ToArrayAsync(ct);

        return query.Select(x =>
        {
            var (_, _, cleanCertName) = CertificateCategoryHelper.Parse(x.CertificateType);
            return new CmeRecordDto(
                x.CmeId,
                x.CertificateId,
                string.IsNullOrWhiteSpace(cleanCertName) ? x.CertificateType : cleanCertName,
                x.CertificateNumber,
                x.CmeCycleMonths,
                x.CmeRequiredCredits,
                x.StaffId,
                x.StaffCode,
                x.FullName,
                x.DepartmentId,
                x.DepartmentName,
                x.CmeCycleId,
                x.CycleNumber,
                x.CourseName,
                x.Provider,
                x.CompletedDate,
                x.Credits,
                x.FileUrl,
                x.Verified,
                x.VerifiedBy,
                x.VerifiedByName,
                x.VerifiedAt,
                x.CreatedAt
            );
        }).ToArray();
    }

    public async Task<CmeRecordDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var x = await (
            from rec in db.CmeRecords.AsNoTracking()
            where rec.CmeId == id
            join cert in db.Certificates.AsNoTracking() on rec.CertificateId equals cert.CertificateId
            join staff in db.Staff.AsNoTracking() on cert.StaffId equals staff.StaffId
            join dept in db.Departments.AsNoTracking() on staff.DepartmentId equals dept.DepartmentId into depts
            from dept in depts.DefaultIfEmpty()
            join cycle in db.CmeCycles.AsNoTracking() on rec.CmeCycleId equals cycle.CycleId into cycles
            from cycle in cycles.DefaultIfEmpty()
            join verifier in db.Users.AsNoTracking() on rec.VerifiedBy equals verifier.UserId into verifiers
            from verifier in verifiers.DefaultIfEmpty()
            select new
            {
                rec.CmeId,
                rec.CertificateId,
                cert.CertificateType,
                cert.CertificateNumber,
                cert.CmeCycleMonths,
                cert.CmeRequiredCredits,
                staff.StaffId,
                staff.StaffCode,
                staff.FullName,
                staff.DepartmentId,
                DepartmentName = dept != null ? dept.Name : null,
                rec.CmeCycleId,
                CycleNumber = cycle != null ? (int?)cycle.CycleNumber : null,
                rec.CourseName,
                rec.Provider,
                rec.CompletedDate,
                rec.Credits,
                rec.FileUrl,
                Verified = rec.Verified ?? true,
                rec.VerifiedBy,
                VerifiedByName = verifier != null ? verifier.FullName : null,
                rec.VerifiedAt,
                rec.CreatedAt
            }
        ).SingleOrDefaultAsync(ct) ?? throw new AppException(404, "Không tìm thấy bản ghi CME.");

        var (_, _, cleanCertName) = CertificateCategoryHelper.Parse(x.CertificateType);
        return new CmeRecordDto(
            x.CmeId,
            x.CertificateId,
            string.IsNullOrWhiteSpace(cleanCertName) ? x.CertificateType : cleanCertName,
            x.CertificateNumber,
            x.CmeCycleMonths,
            x.CmeRequiredCredits,
            x.StaffId,
            x.StaffCode,
            x.FullName,
            x.DepartmentId,
            x.DepartmentName,
            x.CmeCycleId,
            x.CycleNumber,
            x.CourseName,
            x.Provider,
            x.CompletedDate,
            x.Credits,
            x.FileUrl,
            x.Verified,
            x.VerifiedBy,
            x.VerifiedByName,
            x.VerifiedAt,
            x.CreatedAt
        );
    }

    private static void ValidateCmeFields(string courseName, string? provider, DateOnly completedDate, decimal credits, bool hasCmeCredits)
    {
        if (string.IsNullOrWhiteSpace(courseName))
            throw new AppException(400, "Tên khóa học (Course name) là bắt buộc.");

        if (courseName.Trim().Length > 150)
            throw new AppException(400, "Tên khóa học tối đa 150 ký tự.");

        if (!string.IsNullOrWhiteSpace(provider) && provider.Trim().Length > 100)
            throw new AppException(400, "Đơn vị tổ chức (Organizer) tối đa 100 ký tự.");

        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
        if (completedDate > today)
            throw new AppException(400, "MSG-C07: Ngày hoàn thành không được lớn hơn ngày hiện tại (Completed date cannot be in the future).");

        if (hasCmeCredits && (credits <= 0 || credits > 999.5m || (credits * 2m) != Math.Floor(credits * 2m)))
            throw new AppException(400, "MSG-C08: Số tín chỉ (Credits) phải lớn hơn 0 và có bước nhảy 0.5.");
    }

    public async Task<CmeRecordDto> CreateAsync(SaveCmeRecordRequest request, Guid? currentUserId, CancellationToken ct = default)
    {
        var cert = await db.Certificates.AsNoTracking()
            .SingleOrDefaultAsync(c => c.CertificateId == request.CertificateId, ct)
            ?? throw new AppException(400, "Chứng chỉ không tồn tại trong hệ thống.");

        var (cat, _, _) = CertificateCategoryHelper.Parse(cert.CertificateType);
        if (cat == "degree")
            throw new AppException(400, "Không thể gắn bản ghi CME vào Bằng cấp. Vui lòng chọn Chứng chỉ chuyên môn.");

        var hasCmeCredits = cert.CmeRequiredCredits is > 0;
        var effectiveCredits = hasCmeCredits ? Math.Round(request.Credits, 2) : 1m;

        ValidateCmeFields(request.CourseName, request.Provider, request.CompletedDate, effectiveCredits, hasCmeCredits);

        var cycle = await ResolveCycleAsync(cert, request.CmeCycleId, request.CompletedDate, ct);
        if (cycle is { Status: "locked" })
        {
            throw new AppException(400, "Bảng tiến độ này đã được xác nhận khóa, không thể thêm mới. Hãy bấm '+ New record' để tạo bảng tiến độ mới.");
        }

        await EnsureCreditsNotExceedRequiredAsync(cert, cycle, effectiveCredits, null, ct);

        var now = DateTime.UtcNow;

        var entity = new CmeRecord
        {
            CmeId = Guid.NewGuid(),
            CertificateId = request.CertificateId,
            CmeCycleId = cycle?.CycleId,
            CourseName = request.CourseName.Trim(),
            Provider = string.IsNullOrWhiteSpace(request.Provider) ? null : request.Provider.Trim(),
            CompletedDate = request.CompletedDate,
            Credits = effectiveCredits,
            FileUrl = string.IsNullOrWhiteSpace(request.FileUrl) ? null : request.FileUrl.Trim(),
            Verified = request.Verified,
            VerifiedBy = request.Verified ? currentUserId : null,
            VerifiedAt = request.Verified ? now : null,
            CreatedAt = now
        };

        db.CmeRecords.Add(entity);
        await unitOfWork.SaveChangesAsync(ct);

        if (cycle != null)
        {
            await RecalculateCycleCreditsAsync(cycle.CycleId, ct);
        }

        return await GetAsync(entity.CmeId, ct);
    }

    public async Task<CmeRecordDto> UpdateAsync(Guid id, UpdateCmeRecordRequest request, Guid? currentUserId, CancellationToken ct = default)
    {
        var entity = await db.CmeRecords.SingleOrDefaultAsync(r => r.CmeId == id, ct)
            ?? throw new AppException(404, "Không tìm thấy bản ghi CME.");

        var cert = await db.Certificates.AsNoTracking()
            .SingleOrDefaultAsync(c => c.CertificateId == request.CertificateId, ct)
            ?? throw new AppException(400, "Chứng chỉ không tồn tại trong hệ thống.");

        var (cat, _, _) = CertificateCategoryHelper.Parse(cert.CertificateType);
        if (cat == "degree")
            throw new AppException(400, "Không thể gắn bản ghi CME vào Bằng cấp. Vui lòng chọn Chứng chỉ chuyên môn.");

        var hasCmeCredits = cert.CmeRequiredCredits is > 0;
        var effectiveCredits = hasCmeCredits ? Math.Round(request.Credits, 2) : 1m;

        ValidateCmeFields(request.CourseName, request.Provider, request.CompletedDate, effectiveCredits, hasCmeCredits);

        var oldCycleId = entity.CmeCycleId;
        var targetCycleId = request.CmeCycleId ?? entity.CmeCycleId;
        var newCycle = await ResolveCycleAsync(cert, targetCycleId, request.CompletedDate, ct);
        if (newCycle is { Status: "locked" })
        {
            throw new AppException(400, "Bảng tiến độ này đã được xác nhận khóa, không thể chỉnh sửa.");
        }

        await EnsureCreditsNotExceedRequiredAsync(cert, newCycle, effectiveCredits, id, ct);

        entity.CertificateId = request.CertificateId;
        entity.CmeCycleId = newCycle?.CycleId;
        entity.CourseName = request.CourseName.Trim();
        entity.Provider = string.IsNullOrWhiteSpace(request.Provider) ? null : request.Provider.Trim();
        entity.CompletedDate = request.CompletedDate;
        entity.Credits = effectiveCredits;
        entity.FileUrl = string.IsNullOrWhiteSpace(request.FileUrl) ? null : request.FileUrl.Trim();

        if (request.Verified.HasValue)
        {
            var wasVerified = entity.Verified ?? true;
            entity.Verified = request.Verified.Value;
            if (request.Verified.Value && !wasVerified)
            {
                entity.VerifiedBy = currentUserId;
                entity.VerifiedAt = DateTime.UtcNow;
            }
            else if (!request.Verified.Value)
            {
                entity.VerifiedBy = null;
                entity.VerifiedAt = null;
            }
        }

        await unitOfWork.SaveChangesAsync(ct);

        if (oldCycleId.HasValue)
            await RecalculateCycleCreditsAsync(oldCycleId.Value, ct);
        if (entity.CmeCycleId.HasValue && entity.CmeCycleId != oldCycleId)
            await RecalculateCycleCreditsAsync(entity.CmeCycleId.Value, ct);

        return await GetAsync(id, ct);
    }

    public async Task<CmeRecordDto> VerifyAsync(Guid id, bool verified, Guid? currentUserId, CancellationToken ct = default)
    {
        var entity = await db.CmeRecords.SingleOrDefaultAsync(r => r.CmeId == id, ct)
            ?? throw new AppException(404, "Không tìm thấy bản ghi CME.");

        entity.Verified = verified;
        if (verified)
        {
            entity.VerifiedBy = currentUserId;
            entity.VerifiedAt = DateTime.UtcNow;
        }
        else
        {
            entity.VerifiedBy = null;
            entity.VerifiedAt = null;
        }

        await unitOfWork.SaveChangesAsync(ct);

        if (entity.CmeCycleId.HasValue)
            await RecalculateCycleCreditsAsync(entity.CmeCycleId.Value, ct);

        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await db.CmeRecords.SingleOrDefaultAsync(r => r.CmeId == id, ct)
            ?? throw new AppException(404, "Không tìm thấy bản ghi CME.");

        if (entity.CmeCycleId.HasValue)
        {
            var cycle = await db.CmeCycles.AsNoTracking().SingleOrDefaultAsync(c => c.CycleId == entity.CmeCycleId.Value, ct);
            if (cycle is { Status: "locked" })
            {
                throw new AppException(400, "Bảng tiến độ này đã được xác nhận khóa, không thể xóa bản ghi.");
            }
        }

        var cycleId = entity.CmeCycleId;
        db.CmeRecords.Remove(entity);
        await unitOfWork.SaveChangesAsync(ct);

        if (cycleId.HasValue)
            await RecalculateCycleCreditsAsync(cycleId.Value, ct);
    }

    private async Task<CmeCycle?> ResolveCycleAsync(
        Certificate cert,
        Guid? explicitCycleId,
        DateOnly completedDate,
        CancellationToken ct)
    {
        if (explicitCycleId.HasValue)
        {
            var explicitCycle = await db.CmeCycles
                .SingleOrDefaultAsync(c => c.CycleId == explicitCycleId.Value && c.CertificateId == cert.CertificateId, ct);
            if (explicitCycle != null)
                return explicitCycle;
        }

        var cycles = await db.CmeCycles
            .Where(c => c.CertificateId == cert.CertificateId)
            .OrderByDescending(c => c.CycleNumber)
            .ToListAsync(ct);

        if (cycles.Count > 0)
            return cycles[0];

        return null;
    }

    private async Task EnsureCreditsNotExceedRequiredAsync(
        Certificate cert,
        CmeCycle? cycle,
        decimal newCredits,
        Guid? excludeCmeId,
        CancellationToken ct)
    {
        var hasCmeCredits = cert.CmeRequiredCredits is > 0;
        var required = hasCmeCredits
            ? cert.CmeRequiredCredits!.Value
            : DefaultRequiredCredits;

        var query = db.CmeRecords.AsNoTracking().Where(r => r.CertificateId == cert.CertificateId);
        if (cycle != null)
        {
            query = query.Where(r => r.CmeCycleId == cycle.CycleId);
        }
        else
        {
            query = query.Where(r => r.CmeCycleId == null);
        }

        if (excludeCmeId.HasValue)
        {
            query = query.Where(r => r.CmeId != excludeCmeId.Value);
        }

        if (!hasCmeCredits)
        {
            var existingCount = await query.CountAsync(ct);
            if (existingCount >= 1)
            {
                throw new AppException(
                    400,
                    "Bảng tiến độ hiện tại đã hoàn thành đủ chỉ tiêu (1/1). Hãy bấm 'Xác nhận khóa' để khóa bảng này hoặc '+ New record' để tạo bảng tiến độ mới.");
            }
            return;
        }

        var completedCredits = await query.SumAsync(r => (decimal?)r.Credits, ct) ?? 0m;
        var remainingCredits = Math.Max(0m, required - completedCredits);

        if (completedCredits + newCredits > required)
        {
            if (remainingCredits <= 0)
            {
                throw new AppException(
                    400,
                    $"Bảng tiến độ hiện tại đã hoàn thành đủ {completedCredits}/{required} tín chỉ yêu cầu. Hãy bấm 'Xác nhận khóa' để khóa bảng này hoặc '+ New record' để tạo bảng tiến độ mới.");
            }

            throw new AppException(
                400,
                $"Số tín chỉ nhập vào ({newCredits}) vượt quá số tín chỉ còn lại của bảng tiến độ hiện tại. Đã hoàn thành: {completedCredits}/{required} tín chỉ, chỉ được nhập tối đa {remainingCredits} tín chỉ.");
        }
    }

    private async Task RecalculateCycleCreditsAsync(Guid cycleId, CancellationToken ct)
    {
        var cycle = await db.CmeCycles.SingleOrDefaultAsync(c => c.CycleId == cycleId, ct);
        if (cycle == null) return;

        var cert = await db.Certificates.AsNoTracking()
            .SingleOrDefaultAsync(c => c.CertificateId == cycle.CertificateId, ct);
        var hasCmeCredits = cert?.CmeRequiredCredits is > 0;

        var existingRecs = await db.CmeRecords.AsNoTracking()
            .Where(r => r.CmeCycleId == cycleId)
            .ToListAsync(ct);

        var totalCredits = hasCmeCredits
            ? existingRecs.Sum(r => r.Credits)
            : (existingRecs.Count > 0 ? 1m : 0m);

        cycle.EarnedCredits = Math.Max(0m, totalCredits);
        // Never auto-lock here; HR Manager explicitly clicks "Xác nhận khóa" to lock the table.
        if (!string.Equals(cycle.Status, "locked", StringComparison.OrdinalIgnoreCase))
        {
            cycle.Status = "active";
        }
        await unitOfWork.SaveChangesAsync(ct);
    }
}
