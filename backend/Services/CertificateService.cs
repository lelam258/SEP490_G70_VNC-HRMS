using System.Data;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
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
        if (rawType.StartsWith("[degree]", StringComparison.OrdinalIgnoreCase))
            return ("degree", "Bằng cấp", rawType[8..].Trim());
        if (rawType.StartsWith("[certificate]", StringComparison.OrdinalIgnoreCase))
            return ("certificate", "Chứng chỉ", rawType[13..].Trim());
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
        if (result.Length > 100) throw new AppException(400, "Tên văn bằng/chứng chỉ kèm phân loại tối đa 100 ký tự.", "certificateType");
        return result;
    }

    public static string ResolveCategory(string? category, string typeName)
    {
        if (string.IsNullOrWhiteSpace(category)) return Parse(typeName).Category;
        var normalized = category.Trim().ToLowerInvariant();
        return normalized is "degree" or "certificate" ? normalized
            : throw new AppException(400, "Phân loại chỉ được là degree hoặc certificate.", "category");
    }
}

public sealed class CertificateService(AppDbContext db, IUnitOfWork unitOfWork) : ICertificateService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private sealed class DegreeMeta
    {
        public string? DegreeType { get; set; }
        public string? Major { get; set; }
        public string? Notes { get; set; }
        public string? RejectionReason { get; set; }
    }

    private sealed class CertificateMeta
    {
        public string? ProfessionalDegree { get; set; }
        public string? IssuanceMethod { get; set; }
        public string? Scope { get; set; }
        public string? RejectionReason { get; set; }
    }

    private static (string? degreeType, string? major, string? verificationStatus, string? notes, string? professionalDegree, string? issuanceMethod, string? scope, string? rejectionReason)
        ExtractMetadata(string category, string? scopeOfPractice, string? status)
    {
        string? degreeType = null;
        string? major = null;
        string? verificationStatus = null;
        string? notes = null;
        string? professionalDegree = null;
        string? issuanceMethod = null;
        string? scope = null;
        string? rejectionReason = null;

        if (category == "degree")
        {
            verificationStatus = status ?? "unverified";
            if (!string.IsNullOrWhiteSpace(scopeOfPractice))
            {
                var trimmed = scopeOfPractice.Trim();
                if (trimmed.StartsWith('{'))
                {
                    try
                    {
                        var parsed = JsonSerializer.Deserialize<DegreeMeta>(trimmed, JsonOptions);
                        if (parsed != null)
                        {
                            degreeType = parsed.DegreeType;
                            major = parsed.Major;
                            notes = parsed.Notes;
                            rejectionReason = parsed.RejectionReason;
                        }
                    }
                    catch
                    {
                        var matchMajor = Regex.Match(trimmed, @"""Major""\s*:\s*""([^""]+)""");
                        if (matchMajor.Success) major = matchMajor.Groups[1].Value;
                        var matchDegree = Regex.Match(trimmed, @"""DegreeType""\s*:\s*""([^""]+)""");
                        if (matchDegree.Success) degreeType = matchDegree.Groups[1].Value;
                    }
                }
                else
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
                if (trimmed.StartsWith('{'))
                {
                    try
                    {
                        var parsed = JsonSerializer.Deserialize<CertificateMeta>(trimmed, JsonOptions);
                        if (parsed != null)
                        {
                            var prof = !string.IsNullOrWhiteSpace(parsed.ProfessionalDegree)
                                ? parsed.ProfessionalDegree
                                : parsed.Scope;
                            professionalDegree = prof;
                            scope = prof;
                            issuanceMethod = parsed.IssuanceMethod;
                            rejectionReason = parsed.RejectionReason;
                        }
                    }
                    catch
                    {
                        var matchProf = Regex.Match(trimmed, @"""(?:ProfessionalDegree|Scope)""\s*:\s*""([^""]+)""");
                        if (matchProf.Success)
                        {
                            professionalDegree = matchProf.Groups[1].Value;
                            scope = professionalDegree;
                        }
                        var matchMethod = Regex.Match(trimmed, @"""IssuanceMethod""\s*:\s*""([^""]+)""");
                        if (matchMethod.Success)
                        {
                            issuanceMethod = matchMethod.Groups[1].Value;
                        }
                        var matchReason = Regex.Match(trimmed, @"""RejectionReason""\s*:\s*""([^""]+)""");
                        if (matchReason.Success)
                        {
                            rejectionReason = matchReason.Groups[1].Value;
                        }
                    }
                }
                else
                {
                    professionalDegree = scopeOfPractice;
                    scope = scopeOfPractice;
                }
            }
        }

        return (degreeType, major, verificationStatus, notes, professionalDegree, issuanceMethod, scope, rejectionReason);
    }

    private static string? BuildScopeOfPractice(string category, string? degreeType, string? major, string? notes, string? professionalDegree, string? issuanceMethod, string? rawScope, string? rejectionReason = null)
    {
        if (category == "degree")
        {
            if (!string.IsNullOrWhiteSpace(degreeType) || !string.IsNullOrWhiteSpace(major) || !string.IsNullOrWhiteSpace(notes) || !string.IsNullOrWhiteSpace(rejectionReason))
            {
                var json = JsonSerializer.Serialize(new DegreeMeta
                {
                    DegreeType = degreeType?.Trim(),
                    Major = major?.Trim(),
                    Notes = notes?.Trim(),
                    RejectionReason = rejectionReason?.Trim()
                }, JsonOptions);
                return json;
            }
            return string.IsNullOrWhiteSpace(rawScope) ? null : rawScope.Trim();
        }
        else
        {
            var prof = !string.IsNullOrWhiteSpace(professionalDegree)
                ? professionalDegree.Trim()
                : rawScope?.Trim();

            if (!string.IsNullOrWhiteSpace(prof) || !string.IsNullOrWhiteSpace(issuanceMethod) || !string.IsNullOrWhiteSpace(rejectionReason))
            {
                var json = JsonSerializer.Serialize(new CertificateMeta
                {
                    ProfessionalDegree = prof,
                    Scope = prof,
                    IssuanceMethod = issuanceMethod?.Trim(),
                    RejectionReason = rejectionReason?.Trim()
                }, JsonOptions);
                return json;
            }
            return string.IsNullOrWhiteSpace(prof) ? null : prof;
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
            join staff in db.Staff.AsNoTracking() on cert.StaffId equals staff.StaffId
            join dept in db.Departments.AsNoTracking() on cert.DepartmentId equals dept.DepartmentId into depts
            from dept in depts.DefaultIfEmpty()
            where cert.StaffId == staffId
            orderby cert.IssueDate descending, cert.CreatedAt descending
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
            var (degType, major, verStatus, notes, profDeg, method, scope, rejectionReason) = ExtractMetadata(cat, c.ScopeOfPractice, c.Status);
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
                scope,
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
                method,
                rejectionReason
            );
        }).ToArray();
    }

    public async Task<CertificateDto> GetAsync(Guid id, CancellationToken ct = default)
    {
        var item = await (
            from cert in db.Certificates.AsNoTracking()
            join staff in db.Staff.AsNoTracking() on cert.StaffId equals staff.StaffId
            join dept in db.Departments.AsNoTracking() on cert.DepartmentId equals dept.DepartmentId into depts
            from dept in depts.DefaultIfEmpty()
            where cert.CertificateId == id
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
        var (degType, major, verStatus, notes, profDeg, method, scope, rejectionReason) = ExtractMetadata(cat, item.ScopeOfPractice, item.Status);
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
            scope,
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
            method,
            rejectionReason
        );
    }

    public async Task<CertificateDto> CreateAsync(SaveCertificateRequest request, Guid? currentUserId, CancellationToken ct = default)
    {
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);
        var staff = await db.Staff.AsNoTracking().SingleOrDefaultAsync(s => s.StaffId == request.StaffId, ct)
            ?? throw new AppException(400, "Nhân viên không tồn tại trong hệ thống.");

        if (string.IsNullOrWhiteSpace(request.CertificateType))
            throw new AppException(400, "Tên văn bằng / chứng chỉ là bắt buộc.");

        var cat = CertificateCategoryHelper.ResolveCategory(request.Category, request.CertificateType);

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
            ? (string.IsNullOrWhiteSpace(request.VerificationStatus) ? (request.Status ?? "unverified") : request.VerificationStatus.Trim().ToLowerInvariant())
            : (string.IsNullOrWhiteSpace(request.Status) ? "active" : request.Status.Trim().ToLowerInvariant());

        ValidateFields(cat, status, request.IssueDate, request.CmeCycleMonths, request.CmeRequiredCredits,
            request.IssuingAuthority, request.FileUrl, scopeOfPractice);
        await EnsureDepartmentAsync(request.DepartmentId, ct);

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
        await tx.CommitAsync(ct);

        return await GetAsync(entity.CertificateId, ct);
    }

    public async Task<CertificateDto> UpdateAsync(Guid id, UpdateCertificateRequest request, CancellationToken ct = default)
    {
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);
        var entity = await db.Certificates.SingleOrDefaultAsync(c => c.CertificateId == id, ct)
            ?? throw new AppException(404, "Không tìm thấy chứng chỉ.");

        if (string.IsNullOrWhiteSpace(request.CertificateType))
            throw new AppException(400, "Tên văn bằng / chứng chỉ là bắt buộc.");

        var cat = CertificateCategoryHelper.ResolveCategory(request.Category, request.CertificateType);

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

        ValidateFields(cat, status, request.IssueDate, request.CmeCycleMonths, request.CmeRequiredCredits,
            request.IssuingAuthority, request.FileUrl, scopeOfPractice);
        await EnsureDepartmentAsync(request.DepartmentId, ct);
        var oldCategory = CertificateCategoryHelper.Parse(entity.CertificateType).Category;
        if (isDegree && (await db.CmeRecords.AnyAsync(r => r.CertificateId == id, ct)
            || await db.CmeCycles.AnyAsync(c => c.CertificateId == id, ct)))
            throw new AppException(409, "Chứng chỉ đã có dữ liệu CME, không thể chuyển thành bằng cấp.", "category");
        if ((oldCategory != cat || entity.CmeCycleMonths != request.CmeCycleMonths || entity.CmeRequiredCredits != request.CmeRequiredCredits)
            && await db.CmeCycles.AnyAsync(c => c.CertificateId == id && c.Status == "locked", ct))
            throw new AppException(409, "Không thể đổi phân loại hoặc định mức CME khi đã có chu kỳ khóa.");

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
        await tx.CommitAsync(ct);

        return await GetAsync(id, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);
        var entity = await db.Certificates.SingleOrDefaultAsync(c => c.CertificateId == id, ct)
            ?? throw new AppException(404, "Không tìm thấy chứng chỉ.");
        if (await db.CmeCycles.AnyAsync(c => c.CertificateId == id && c.Status == "locked", ct))
            throw new AppException(409, "Chứng chỉ có chu kỳ CME đã khóa, không thể xóa lịch sử.");

        var records = await db.CmeRecords.Where(r => r.CertificateId == id).ToListAsync(ct);
        if (records.Count > 0)
            db.CmeRecords.RemoveRange(records);

        var cycles = await db.CmeCycles.Where(c => c.CertificateId == id).ToListAsync(ct);
        if (cycles.Count > 0)
            db.CmeCycles.RemoveRange(cycles);

        var scans = await db.ComplianceScans.Where(s => s.CertificateId == id).ToListAsync(ct);
        if (scans.Count > 0)
            db.ComplianceScans.RemoveRange(scans);

        db.Certificates.Remove(entity);
        await unitOfWork.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }

    public async Task<CertificateDto[]> ListPendingCertificatesAsync(CancellationToken ct = default)
    {
        var pendingStatuses = new[] { "unverified", "pending" };
        var query = await (
            from cert in db.Certificates.AsNoTracking()
            join staff in db.Staff.AsNoTracking() on cert.StaffId equals staff.StaffId
            join dept in db.Departments.AsNoTracking() on cert.DepartmentId equals dept.DepartmentId into depts
            from dept in depts.DefaultIfEmpty()
            where pendingStatuses.Contains((cert.Status ?? "active").ToLower())
            orderby cert.CreatedAt descending
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
                Status = cert.Status ?? "unverified",
                cert.FileUrl,
                cert.CreatedAt,
                cert.UpdatedAt
            }
        ).ToArrayAsync(ct);

        return query.Select(c =>
        {
            var (cat, catLabel, cleanName) = CertificateCategoryHelper.Parse(c.CertificateType);
            var (degType, major, verStatus, notes, profDeg, method, scope, rejectionReason) = ExtractMetadata(cat, c.ScopeOfPractice, c.Status);
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
                scope,
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
                method,
                rejectionReason
            );
        }).ToArray();
    }

    public async Task<CertificateDto> ReviewAsync(Guid id, ReviewCertificateRequest request, Guid? reviewerId, CancellationToken ct = default)
    {
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);
        var entity = await db.Certificates.SingleOrDefaultAsync(c => c.CertificateId == id, ct)
            ?? throw new AppException(404, "Không tìm thấy chứng chỉ hoặc bằng cấp.");
        if (entity.Status is not ("pending" or "unverified"))
            throw new AppException(409, "Chỉ thẩm định hồ sơ đang chờ xác minh. Vui lòng tải lại danh sách.");

        var action = request.Action.Trim().ToLowerInvariant();
        if (action != "approve" && action != "reject")
        {
            throw new AppException(400, "Hành động thẩm định không hợp lệ. Chỉ chấp nhận 'approve' hoặc 'reject'.");
        }

        var (cat, _, _) = CertificateCategoryHelper.Parse(entity.CertificateType);
        var isDegree = cat == "degree";

        var (degreeType, major, _, notes, professionalDegree, issuanceMethod, scope, _) =
            ExtractMetadata(cat, entity.ScopeOfPractice, entity.Status);

        if (action == "approve")
        {
            entity.Status = isDegree ? "verified" : "active";
            // Xóa lý do từ chối nếu có
            entity.ScopeOfPractice = BuildScopeOfPractice(
                cat, degreeType, major, notes, professionalDegree, issuanceMethod, scope, null);

            // Nếu là chứng chỉ hành nghề có định mức CME và chưa có chu kỳ nào, tự tạo chu kỳ #1
            if (!isDegree && ((entity.CmeRequiredCredits ?? 0) > 0 || (entity.CmeCycleMonths ?? 0) > 0))
            {
                var hasCycle = await db.CmeCycles.AnyAsync(cy => cy.CertificateId == entity.CertificateId, ct);
                if (!hasCycle)
                {
                    var start = entity.IssueDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
                    var months = entity.CmeCycleMonths is > 0 ? entity.CmeCycleMonths.Value : 24;
                    var end = start.AddMonths(months);
                    var reqCredits = entity.CmeRequiredCredits is > 0 ? entity.CmeRequiredCredits.Value : 24m;

                    var cycle = new CmeCycle
                    {
                        CycleId = Guid.NewGuid(),
                        CertificateId = entity.CertificateId,
                        CycleNumber = 1,
                        CycleStart = start,
                        CycleEnd = end,
                        RequiredCredits = reqCredits,
                        EarnedCredits = 0,
                        Status = "active"
                    };
                    db.CmeCycles.Add(cycle);
                }
            }
        }
        else // reject
        {
            if (string.IsNullOrWhiteSpace(request.RejectionReason))
            {
                throw new AppException(400, "Vui lòng nhập lý do từ chối hồ sơ.");
            }

            entity.Status = "rejected";
            entity.ScopeOfPractice = BuildScopeOfPractice(
                cat, degreeType, major, notes, professionalDegree, issuanceMethod, scope, request.RejectionReason.Trim());
        }

        entity.UpdatedAt = DateTime.UtcNow;
        if (entity.ScopeOfPractice?.Length > 200)
            throw new AppException(400, "Lý do từ chối và thông tin chuyên môn vượt quá giới hạn lưu trữ 200 ký tự.", "rejectionReason");
        await unitOfWork.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return await GetAsync(entity.CertificateId, ct);
    }

    private async Task EnsureDepartmentAsync(Guid? departmentId, CancellationToken ct)
    {
        if (departmentId.HasValue && !await db.Departments.AnyAsync(d => d.DepartmentId == departmentId, ct))
            throw new AppException(400, "Khoa/phòng không tồn tại.", "departmentId");
    }

    private static void ValidateFields(string category, string status, DateOnly? issueDate, int? months,
        decimal? credits, string? authority, string? fileUrl, string? scope)
    {
        string[] statuses = category == "degree" ? ["unverified", "verified", "rejected", "pending"]
            : ["active", "expired", "suspended", "revoked", "pending", "unverified", "rejected"];
        if (!statuses.Contains(status)) throw new AppException(400, "Trạng thái văn bằng/chứng chỉ không hợp lệ.", "status");
        if (category != "degree")
        {
            var start = issueDate ?? DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7));
            var maxMonths = (9999 - start.Year) * 12 + 12 - start.Month;
            if (months.HasValue && (months.Value <= 0 || months.Value > maxMonths))
                throw new AppException(400, "Số tháng chu kỳ CME phải dương và tạo được ngày kết thúc hợp lệ.", "cmeCycleMonths");
            if (credits.HasValue && (credits.Value <= 0 || credits.Value > 9999.99m))
                throw new AppException(400, "Định mức tín chỉ CME phải lớn hơn 0 và tối đa 9999.99.", "cmeRequiredCredits");
        }
        if (authority?.Trim().Length > 200) throw new AppException(400, "Nơi cấp tối đa 200 ký tự.", "issuingAuthority");
        if (fileUrl?.Trim().Length > 500) throw new AppException(400, "Đường dẫn tệp tối đa 500 ký tự.", "fileUrl");
        if (scope?.Length > 200) throw new AppException(400, "Thông tin chuyên môn và ghi chú vượt quá giới hạn lưu trữ 200 ký tự.", "scopeOfPractice");
    }
}
