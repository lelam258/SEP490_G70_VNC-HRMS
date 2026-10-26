using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Certificates;
using Vnc.HRMS.Models;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Services;

public static class CertificateCategoryHelper
{
    public static (string Category, string CategoryLabel, string CleanName) Parse(string? rawType)
    {
        if (string.IsNullOrWhiteSpace(rawType))
            return ("certificate", "Chứng chỉ", "");

        rawType = rawType.Trim();
        if (rawType.StartsWith("[Bằng cấp]", StringComparison.OrdinalIgnoreCase))
            return ("degree", "Bằng cấp", rawType[10..].Trim());
        if (rawType.StartsWith("[Giấy hành nghề]", StringComparison.OrdinalIgnoreCase))
            return ("certificate", "Chứng chỉ", rawType[16..].Trim());
        if (rawType.StartsWith("[Chứng chỉ]", StringComparison.OrdinalIgnoreCase))
            return ("certificate", "Chứng chỉ", rawType[11..].Trim());

        // Heuristic fallback if untagged
        var lower = rawType.ToLowerInvariant();
        if (lower.Contains("bằng") || lower.Contains("cử nhân") || lower.Contains("thạc sĩ") || lower.Contains("tiến sĩ") || lower.Contains("bác sĩ"))
            return ("degree", "Bằng cấp", rawType);

        return ("certificate", "Chứng chỉ", rawType);
    }

    public static string Format(string? category, string typeName)
    {
        var clean = typeName?.Trim() ?? "";
        if (clean.StartsWith("[Bằng cấp]", StringComparison.OrdinalIgnoreCase)) clean = clean[10..].Trim();
        else if (clean.StartsWith("[Giấy hành nghề]", StringComparison.OrdinalIgnoreCase)) clean = clean[16..].Trim();
        else if (clean.StartsWith("[Chứng chỉ]", StringComparison.OrdinalIgnoreCase)) clean = clean[11..].Trim();

        var prefix = (category?.Trim().ToLowerInvariant()) switch
        {
            "degree" or "bằng cấp" => "[Bằng cấp]",
            _ => "[Chứng chỉ]"
        };

        var result = $"{prefix} {clean}";
        return result.Length > 100 ? result[..100] : result;
    }
}

public sealed class CertificateService(AppDbContext db, IUnitOfWork unitOfWork) : ICertificateService
{
    private sealed class DegreeMeta
    {
        public string? DegreeType { get; set; }
        public string? Major { get; set; }
        public string? Notes { get; set; }
    }

    private sealed class CertificateMeta
    {
        public string? ProfessionalDegree { get; set; }
        public string? IssuanceMethod { get; set; }
    }

    private static (string? degreeType, string? major, string? verificationStatus, string? notes, string? professionalDegree, string? issuanceMethod)
        ExtractMetadata(string category, string? scopeOfPractice, string? status)
    {
        string? degreeType = null;
        string? major = null;
        string? verificationStatus = null;
        string? notes = null;
        string? professionalDegree = null;
        string? issuanceMethod = null;

        if (category == "degree")
        {
            verificationStatus = status ?? "unverified";
            if (!string.IsNullOrWhiteSpace(scopeOfPractice))
            {
                var trimmed = scopeOfPractice.Trim();
                if (trimmed.StartsWith('{') && trimmed.EndsWith('}'))
                {
                    try
                    {
                        var parsed = JsonSerializer.Deserialize<DegreeMeta>(trimmed);
                        if (parsed != null)
                        {
                            degreeType = parsed.DegreeType;
                            major = parsed.Major;
                            notes = parsed.Notes;
                        }
                    }
                    catch { }
                }
                if (major == null && degreeType == null)
                {
                    major = scopeOfPractice;
                }
            }
        }
        else
        {
            if (!string.IsNullOrWhiteSpace(scopeOfPractice))
            {
                var trimmed = scopeOfPractice.Trim();
                if (trimmed.StartsWith('{') && trimmed.EndsWith('}'))
                {
                    try
                    {
                        var parsed = JsonSerializer.Deserialize<CertificateMeta>(trimmed);
                        if (parsed != null)
                        {
                            professionalDegree = parsed.ProfessionalDegree;
                            issuanceMethod = parsed.IssuanceMethod;
                        }
                    }
                    catch { }
                }
                if (professionalDegree == null)
                {
                    professionalDegree = scopeOfPractice;
                }
            }
        }

        return (degreeType, major, verificationStatus, notes, professionalDegree, issuanceMethod);
    }

    private static string? BuildScopeOfPractice(string category, string? degreeType, string? major, string? notes, string? professionalDegree, string? issuanceMethod, string? rawScope)
    {
        if (category == "degree")
        {
            if (!string.IsNullOrWhiteSpace(degreeType) || !string.IsNullOrWhiteSpace(major) || !string.IsNullOrWhiteSpace(notes))
            {
                var json = JsonSerializer.Serialize(new DegreeMeta
                {
                    DegreeType = degreeType?.Trim(),
                    Major = major?.Trim(),
                    Notes = notes?.Trim()
                });
                return json.Length > 200 ? json[..200] : json;
            }
            return string.IsNullOrWhiteSpace(rawScope) ? null : (rawScope.Length > 200 ? rawScope[..200] : rawScope.Trim());
        }
        else
        {
            if (!string.IsNullOrWhiteSpace(professionalDegree) || !string.IsNullOrWhiteSpace(issuanceMethod))
            {
                var json = JsonSerializer.Serialize(new CertificateMeta
                {
                    ProfessionalDegree = professionalDegree?.Trim(),
                    IssuanceMethod = issuanceMethod?.Trim()
                });
                return json.Length > 200 ? json[..200] : json;
            }
            return string.IsNullOrWhiteSpace(rawScope) ? null : (rawScope.Length > 200 ? rawScope[..200] : rawScope.Trim());
        }
    }

    public async Task<StaffCertificateSummaryDto[]> ListStaffSummariesAsync(CancellationToken ct = default)
    {
        var summaries = await (
            from staff in db.Staff.AsNoTracking()
            join dept in db.Departments.AsNoTracking() on staff.DepartmentId equals dept.DepartmentId into depts
            from dept in depts.DefaultIfEmpty()
            select new
            {
                staff.StaffId,
                staff.StaffCode,
                staff.FullName,
                staff.DepartmentId,
                DepartmentName = dept != null ? dept.Name : "Chưa phân khoa",
                staff.Email,
                staff.Status,
                staff.AvatarUrl,
                CertificateCount = db.Certificates.Count(c => c.StaffId == staff.StaffId)
            }
        ).OrderBy(s => s.StaffCode).ToArrayAsync(ct);

        return summaries.Select(s => new StaffCertificateSummaryDto(
            s.StaffId,
            s.StaffCode,
            s.FullName,
            s.DepartmentId,
            s.DepartmentName,
            s.Email,
            s.Status,
            s.AvatarUrl,
            s.CertificateCount
        )).ToArray();
    }

    public async Task<CertificateDto[]> ListByStaffIdAsync(Guid staffId, CancellationToken ct = default)
    {
        var query = await (
            from cert in db.Certificates.AsNoTracking()
            where cert.StaffId == staffId
            join staff in db.Staff.AsNoTracking() on cert.StaffId equals staff.StaffId
            join dept in db.Departments.AsNoTracking() on cert.DepartmentId equals dept.DepartmentId into depts
            from dept in depts.DefaultIfEmpty()
            orderby cert.CreatedAt descending, cert.IssueDate descending
            select new
            {
                cert.CertificateId,
                cert.StaffId,
                staff.StaffCode,
                staff.FullName,
                cert.DepartmentId,
                DepartmentName = dept != null ? dept.Name : null,
                cert.CertificateNumber,
                cert.CertificateType,
                cert.IssuingAuthority,
                cert.IssueDate,
                cert.ExpiryDate,
                cert.ScopeOfPractice,
                cert.CmeCycleMonths,
                cert.CmeRequiredCredits,
                Status = cert.Status ?? "active",
                cert.FileUrl,
                cert.CreatedAt,
                cert.UpdatedAt
            }
        ).ToArrayAsync(ct);

        return query.Select(c =>
        {
            var (cat, catLabel, cleanName) = CertificateCategoryHelper.Parse(c.CertificateType);
            var (degType, major, verStatus, notes, profDeg, method) = ExtractMetadata(cat, c.ScopeOfPractice, c.Status);
            return new CertificateDto(
                c.CertificateId,
                c.StaffId,
                c.StaffCode,
                c.FullName,
                c.DepartmentId,
                c.DepartmentName,
                c.CertificateNumber,
                cat,
                catLabel,
                cleanName,
                c.IssuingAuthority,
                c.IssueDate,
                c.ExpiryDate,
                c.ScopeOfPractice,
                c.CmeCycleMonths,
                c.CmeRequiredCredits,
                c.Status,
                c.FileUrl,
                c.CreatedAt,
                c.UpdatedAt,
                degType,
                major,
                verStatus,
                notes,
                profDeg,
                method
            );
        }).ToArray();
    }

    public async Task<CertificateDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var item = await (
            from cert in db.Certificates.AsNoTracking()
            where cert.CertificateId == id
            join staff in db.Staff.AsNoTracking() on cert.StaffId equals staff.StaffId
            join dept in db.Departments.AsNoTracking() on cert.DepartmentId equals dept.DepartmentId into depts
            from dept in depts.DefaultIfEmpty()
            select new
            {
                cert.CertificateId,
                cert.StaffId,
                staff.StaffCode,
                staff.FullName,
                cert.DepartmentId,
                DepartmentName = dept != null ? dept.Name : null,
                cert.CertificateNumber,
                cert.CertificateType,
                cert.IssuingAuthority,
                cert.IssueDate,
                cert.ExpiryDate,
                cert.ScopeOfPractice,
                cert.CmeCycleMonths,
                cert.CmeRequiredCredits,
                Status = cert.Status ?? "active",
                cert.FileUrl,
                cert.CreatedAt,
                cert.UpdatedAt
            }
        ).SingleOrDefaultAsync(ct) ?? throw new AppException(404, "Không tìm thấy chứng chỉ.");

        var (cat, catLabel, cleanName) = CertificateCategoryHelper.Parse(item.CertificateType);
        var (degType, major, verStatus, notes, profDeg, method) = ExtractMetadata(cat, item.ScopeOfPractice, item.Status);
        return new CertificateDto(
            item.CertificateId,
            item.StaffId,
            item.StaffCode,
            item.FullName,
            item.DepartmentId,
            item.DepartmentName,
            item.CertificateNumber,
            cat,
            catLabel,
            cleanName,
            item.IssuingAuthority,
            item.IssueDate,
            item.ExpiryDate,
            item.ScopeOfPractice,
            item.CmeCycleMonths,
            item.CmeRequiredCredits,
            item.Status,
            item.FileUrl,
            item.CreatedAt,
            item.UpdatedAt,
            degType,
            major,
            verStatus,
            notes,
            profDeg,
            method
        );
    }

    public async Task<CertificateDto> CreateAsync(SaveCertificateRequest request, Guid? currentUserId, CancellationToken ct = default)
    {
        var staff = await db.Staff.AsNoTracking().SingleOrDefaultAsync(s => s.StaffId == request.StaffId, ct)
            ?? throw new AppException(400, "Nhân viên không tồn tại trong hệ thống.");

        if (string.IsNullOrWhiteSpace(request.CertificateType))
            throw new AppException(400, "Tên văn bằng / chứng chỉ là bắt buộc.");

        var (cat, _, _) = CertificateCategoryHelper.Parse(
            !string.IsNullOrWhiteSpace(request.Category) ? $"[{request.Category}] {request.CertificateType}" : request.CertificateType);

        var isDegree = cat == "degree";

        if (!isDegree && request.IssueDate.HasValue && request.ExpiryDate.HasValue && request.ExpiryDate < request.IssueDate)
            throw new AppException(400, "Ngày hết hạn phải lớn hơn hoặc bằng ngày cấp.");

        // Bỏ số hiệu chứng chỉ theo yêu cầu
        string? certNumber = null;
        if (!isDegree && !string.IsNullOrWhiteSpace(request.CertificateNumber))
        {
            certNumber = request.CertificateNumber.Trim();
            var exists = await db.Certificates.AnyAsync(c => c.CertificateNumber == certNumber, ct);
            if (exists)
                throw new AppException(400, $"Số hiệu '{certNumber}' đã tồn tại trong hệ thống.");
        }

        var formattedType = CertificateCategoryHelper.Format(cat, request.CertificateType);
        var scopeOfPractice = BuildScopeOfPractice(
            cat,
            request.DegreeType,
            request.Major,
            request.Notes,
            request.ProfessionalDegree,
            request.IssuanceMethod,
            request.ScopeOfPractice
        );

        var status = isDegree
            ? (string.IsNullOrWhiteSpace(request.VerificationStatus) ? (request.Status ?? "unverified") : request.VerificationStatus.Trim().ToLowerInvariant())
            : (string.IsNullOrWhiteSpace(request.Status) ? "active" : request.Status.Trim().ToLowerInvariant());

        var now = DateTime.UtcNow;
        var entity = new Certificate
        {
            CertificateId = Guid.NewGuid(),
            StaffId = request.StaffId,
            DepartmentId = request.DepartmentId ?? staff.DepartmentId,
            CertificateNumber = certNumber,
            CertificateType = formattedType,
            IssuingAuthority = string.IsNullOrWhiteSpace(request.IssuingAuthority) ? null : request.IssuingAuthority.Trim(),
            IssueDate = request.IssueDate,
            ExpiryDate = isDegree ? null : request.ExpiryDate,
            ScopeOfPractice = scopeOfPractice,
            CmeCycleMonths = isDegree ? null : request.CmeCycleMonths,
            CmeRequiredCredits = isDegree ? null : request.CmeRequiredCredits,
            Status = status,
            FileUrl = string.IsNullOrWhiteSpace(request.FileUrl) ? null : request.FileUrl.Trim(),
            UploadedBy = currentUserId,
            CreatedAt = now,
            UpdatedAt = now
        };

        db.Certificates.Add(entity);
        await unitOfWork.SaveChangesAsync(ct);

        return await GetAsync(entity.CertificateId, ct);
    }

    public async Task<CertificateDto> UpdateAsync(Guid id, UpdateCertificateRequest request, CancellationToken ct = default)
    {
        var entity = await db.Certificates.SingleOrDefaultAsync(c => c.CertificateId == id, ct)
            ?? throw new AppException(404, "Không tìm thấy chứng chỉ.");

        if (string.IsNullOrWhiteSpace(request.CertificateType))
            throw new AppException(400, "Tên văn bằng / chứng chỉ là bắt buộc.");

        var (cat, _, _) = CertificateCategoryHelper.Parse(
            !string.IsNullOrWhiteSpace(request.Category) ? $"[{request.Category}] {request.CertificateType}" : request.CertificateType);

        var isDegree = cat == "degree";

        if (!isDegree && request.IssueDate.HasValue && request.ExpiryDate.HasValue && request.ExpiryDate < request.IssueDate)
            throw new AppException(400, "Ngày hết hạn phải lớn hơn hoặc bằng ngày cấp.");

        // Bỏ số hiệu chứng chỉ theo yêu cầu
        string? certNumber = null;
        if (!isDegree && !string.IsNullOrWhiteSpace(request.CertificateNumber))
        {
            certNumber = request.CertificateNumber.Trim();
            var exists = await db.Certificates.AnyAsync(c => c.CertificateNumber == certNumber && c.CertificateId != id, ct);
            if (exists)
                throw new AppException(400, $"Số hiệu '{certNumber}' đã được sử dụng.");
        }

        var formattedType = CertificateCategoryHelper.Format(cat, request.CertificateType);
        var scopeOfPractice = BuildScopeOfPractice(
            cat,
            request.DegreeType,
            request.Major,
            request.Notes,
            request.ProfessionalDegree,
            request.IssuanceMethod,
            request.ScopeOfPractice
        );

        var status = isDegree
            ? (string.IsNullOrWhiteSpace(request.VerificationStatus) ? (request.Status ?? entity.Status ?? "unverified") : request.VerificationStatus.Trim().ToLowerInvariant())
            : (string.IsNullOrWhiteSpace(request.Status) ? entity.Status ?? "active" : request.Status.Trim().ToLowerInvariant());

        entity.CertificateNumber = certNumber;
        entity.CertificateType = formattedType;
        entity.IssuingAuthority = string.IsNullOrWhiteSpace(request.IssuingAuthority) ? null : request.IssuingAuthority.Trim();
        entity.IssueDate = request.IssueDate;
        entity.ExpiryDate = isDegree ? null : request.ExpiryDate;
        entity.ScopeOfPractice = scopeOfPractice;
        entity.CmeCycleMonths = isDegree ? null : request.CmeCycleMonths;
        entity.CmeRequiredCredits = isDegree ? null : request.CmeRequiredCredits;
        entity.Status = status;
        entity.FileUrl = string.IsNullOrWhiteSpace(request.FileUrl) ? null : request.FileUrl.Trim();
        if (request.DepartmentId.HasValue)
            entity.DepartmentId = request.DepartmentId;
        entity.UpdatedAt = DateTime.UtcNow;

        await unitOfWork.SaveChangesAsync(ct);

        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await db.Certificates.SingleOrDefaultAsync(c => c.CertificateId == id, ct)
            ?? throw new AppException(404, "Không tìm thấy chứng chỉ.");

        db.Certificates.Remove(entity);
        await unitOfWork.SaveChangesAsync(ct);
    }
}
