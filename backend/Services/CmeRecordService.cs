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
                Verified = r.Verified ?? false
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

            var totalRequired = staffCerts.Sum(c => c.CmeRequiredCredits ?? 0m);
            var totalEarned = staffRecords.Sum(r => r.Credits);
            var verifiedCredits = staffRecords.Where(r => r.Verified).Sum(r => r.Credits);
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
                verifiedCredits
            );
        }).ToArray();
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
                Verified = rec.Verified ?? false,
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
                Verified = rec.Verified ?? false,
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
                Verified = rec.Verified ?? false,
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

    public async Task<CmeRecordDto> CreateAsync(SaveCmeRecordRequest request, Guid? currentUserId, CancellationToken ct = default)
    {
        var cert = await db.Certificates.AsNoTracking()
            .SingleOrDefaultAsync(c => c.CertificateId == request.CertificateId, ct)
            ?? throw new AppException(400, "Chứng chỉ không tồn tại trong hệ thống.");

        var (cat, _, _) = CertificateCategoryHelper.Parse(cert.CertificateType);
        if (cat == "degree")
            throw new AppException(400, "Không thể gắn bản ghi CME vào Bằng cấp. Vui lòng chọn Chứng chỉ chuyên môn.");

        if (string.IsNullOrWhiteSpace(request.CourseName))
            throw new AppException(400, "Tên khóa đào tạo CME là bắt buộc.");

        if (request.Credits <= 0 || request.Credits > 999.99m)
            throw new AppException(400, "Số tín chỉ CME phải lớn hơn 0 và nhỏ hơn 1000.");

        var now = DateTime.UtcNow;
        var cycle = await EnsureOrGetActiveCycleAsync(cert, request.CompletedDate, ct);

        var entity = new CmeRecord
        {
            CmeId = Guid.NewGuid(),
            CertificateId = request.CertificateId,
            CmeCycleId = cycle?.CycleId,
            CourseName = request.CourseName.Trim().Length > 200 ? request.CourseName.Trim()[..200] : request.CourseName.Trim(),
            Provider = string.IsNullOrWhiteSpace(request.Provider)
                ? null
                : (request.Provider.Trim().Length > 200 ? request.Provider.Trim()[..200] : request.Provider.Trim()),
            CompletedDate = request.CompletedDate,
            Credits = Math.Round(request.Credits, 2),
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

        if (string.IsNullOrWhiteSpace(request.CourseName))
            throw new AppException(400, "Tên khóa đào tạo CME là bắt buộc.");

        if (request.Credits <= 0 || request.Credits > 999.99m)
            throw new AppException(400, "Số tín chỉ CME phải lớn hơn 0 và nhỏ hơn 1000.");

        var oldCycleId = entity.CmeCycleId;
        var certChanged = entity.CertificateId != request.CertificateId;

        entity.CertificateId = request.CertificateId;
        entity.CourseName = request.CourseName.Trim().Length > 200 ? request.CourseName.Trim()[..200] : request.CourseName.Trim();
        entity.Provider = string.IsNullOrWhiteSpace(request.Provider)
            ? null
            : (request.Provider.Trim().Length > 200 ? request.Provider.Trim()[..200] : request.Provider.Trim());
        entity.CompletedDate = request.CompletedDate;
        entity.Credits = Math.Round(request.Credits, 2);
        entity.FileUrl = string.IsNullOrWhiteSpace(request.FileUrl) ? null : request.FileUrl.Trim();

        if (certChanged)
        {
            var newCycle = await EnsureOrGetActiveCycleAsync(cert, request.CompletedDate, ct);
            entity.CmeCycleId = newCycle?.CycleId;
        }

        if (request.Verified.HasValue)
        {
            var wasVerified = entity.Verified ?? false;
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

        var cycleId = entity.CmeCycleId;
        db.CmeRecords.Remove(entity);
        await unitOfWork.SaveChangesAsync(ct);

        if (cycleId.HasValue)
            await RecalculateCycleCreditsAsync(cycleId.Value, ct);
    }

    private async Task<CmeCycle?> EnsureOrGetActiveCycleAsync(Certificate cert, DateOnly completedDate, CancellationToken ct)
    {
        var existingCycle = await db.CmeCycles
            .OrderByDescending(c => c.CycleNumber)
            .FirstOrDefaultAsync(c => c.CertificateId == cert.CertificateId, ct);

        if (existingCycle != null)
            return existingCycle;

        if ((cert.CmeRequiredCredits ?? 0) <= 0 && (cert.CmeCycleMonths ?? 0) <= 0)
            return null;

        var startDate = cert.IssueDate ?? completedDate;
        var months = cert.CmeCycleMonths is > 0 ? cert.CmeCycleMonths.Value : 24;
        var endDate = startDate.AddMonths(months);

        var newCycle = new CmeCycle
        {
            CycleId = Guid.NewGuid(),
            CertificateId = cert.CertificateId,
            CycleNumber = 1,
            CycleStart = startDate,
            CycleEnd = endDate,
            RequiredCredits = Math.Max(0, cert.CmeRequiredCredits ?? 0m),
            EarnedCredits = 0m,
            Status = "active"
        };

        db.CmeCycles.Add(newCycle);
        await unitOfWork.SaveChangesAsync(ct);
        return newCycle;
    }

    private async Task RecalculateCycleCreditsAsync(Guid cycleId, CancellationToken ct)
    {
        var cycle = await db.CmeCycles.SingleOrDefaultAsync(c => c.CycleId == cycleId, ct);
        if (cycle == null) return;

        var totalCredits = await db.CmeRecords
            .Where(r => r.CmeCycleId == cycleId)
            .SumAsync(r => (decimal?)r.Credits, ct) ?? 0m;

        cycle.EarnedCredits = Math.Max(0m, totalCredits);
        if (cycle.RequiredCredits > 0 && cycle.EarnedCredits >= cycle.RequiredCredits)
        {
            cycle.Status = "completed";
        }
        else
        {
            cycle.Status = "active";
        }

        await unitOfWork.SaveChangesAsync(ct);
    }
}
