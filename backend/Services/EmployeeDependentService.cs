using System.Data;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Employees;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Services.Interfaces;
using Vnc.HRMS.Services.Rules;

namespace Vnc.HRMS.Services;

public sealed class EmployeeDependentService(AppDbContext db) : IEmployeeDependentService
{
    public async Task<EmployeeDependentDto[]> ListByStaffAsync(Guid staffId, CancellationToken ct)
    {
        var staffExists = await db.Staff.AsNoTracking().AnyAsync(s => s.StaffId == staffId, ct);
        if (!staffExists)
            throw new AppException(404, "Không tìm thấy nhân viên.");

        var relations = await db.StaffDependents
            .AsNoTracking()
            .Where(sd => sd.StaffId == staffId)
            .OrderByDescending(sd => sd.IsActive)
            .ThenByDescending(sd => sd.CreatedAt)
            .ToArrayAsync(ct);

        if (relations.Length == 0)
            return [];

        var dependentIds = relations.Select(r => r.DependentId).Distinct().ToArray();
        var relationIds = relations.Select(r => r.StaffDependentId).ToArray();

        var dependents = await db.Dependents
            .AsNoTracking()
            .Where(d => dependentIds.Contains(d.DependentId))
            .ToDictionaryAsync(d => d.DependentId, ct);

        var documents = await db.DependentDocuments
            .AsNoTracking()
            .Where(doc => relationIds.Contains(doc.StaffDependentId))
            .OrderByDescending(doc => doc.UploadedAt)
            .ToArrayAsync(ct);

        var userIds = relations.Select(r => r.RegisteredBy)
            .Concat(documents.Where(d => d.VerifiedBy.HasValue).Select(d => d.VerifiedBy!.Value))
            .Distinct()
            .ToArray();

        var userNames = await db.Users
            .AsNoTracking()
            .Where(u => userIds.Contains(u.UserId))
            .ToDictionaryAsync(u => u.UserId, u => string.IsNullOrWhiteSpace(u.FullName) ? u.Username : u.FullName!, ct);

        var docsByRel = documents
            .GroupBy(d => d.StaffDependentId)
            .ToDictionary(
                g => g.Key,
                g => g.Select(d => new DependentDocumentDto(
                    d.DocumentId,
                    d.StaffDependentId,
                    d.DocumentType,
                    d.FileName,
                    d.FileUrl,
                    d.VerificationStatus,
                    d.UploadedAt,
                    d.VerifiedBy,
                    d.VerifiedBy is Guid vid && userNames.TryGetValue(vid, out var vName) ? vName : null)).ToArray());

        var result = new List<EmployeeDependentDto>(relations.Length);
        foreach (var rel in relations)
        {
            if (!dependents.TryGetValue(rel.DependentId, out var dep))
                continue;

            result.Add(new EmployeeDependentDto(
                rel.StaffDependentId,
                dep.DependentId,
                rel.StaffId,
                rel.RegisteredBy,
                userNames.TryGetValue(rel.RegisteredBy, out var regName) ? regName : null,
                dep.FullName,
                dep.DateOfBirth,
                dep.Gender,
                dep.IdCardNumber,
                dep.TaxCode,
                rel.Relationship,
                rel.IsActive,
                rel.CreatedAt,
                rel.UpdatedAt,
                docsByRel.TryGetValue(rel.StaffDependentId, out var relDocs) ? relDocs : []));
        }

        return [.. result];
    }

    public async Task<EmployeeDependentDto> CreateAsync(
        Guid staffId,
        CreateEmployeeDependentRequest request,
        Guid currentUserId,
        CancellationToken ct)
    {
        var fullName = DependentRules.ValidateFullName(request.FullName);
        var dob = DependentRules.ValidateDateOfBirth(request.DateOfBirth);
        var gender = DependentRules.ValidateGender(request.Gender);
        var idCard = DependentRules.ValidateIdCardNumber(request.IdCardNumber);
        var taxCode = DependentRules.ValidateTaxCode(request.TaxCode);
        var relationship = DependentRules.ValidateRelationship(request.Relationship);

        var validatedDocs = new List<(string DocumentType, string FileName, string? FileUrl)>();
        if (request.Documents is { Length: > 0 })
        {
            foreach (var doc in request.Documents)
            {
                validatedDocs.Add((
                    DependentRules.ValidateDocumentType(doc.DocumentType),
                    DependentRules.ValidateFileName(doc.FileName),
                    DependentRules.ValidateFileUrl(doc.FileUrl)));
            }
        }

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

        var staff = await db.Staff.FirstOrDefaultAsync(s => s.StaffId == staffId, ct)
            ?? throw new AppException(404, "Không tìm thấy nhân viên.");

        await EnsureUniqueDependentIdentityAsync(idCard, taxCode, null, ct);

        var now = DateTime.UtcNow;
        var dependent = new Dependent
        {
            DependentId = Guid.NewGuid(),
            FullName = fullName,
            DateOfBirth = dob,
            Gender = gender,
            IdCardNumber = idCard,
            TaxCode = taxCode,
            CreatedAt = now
        };

        var relation = new StaffDependent
        {
            StaffDependentId = Guid.NewGuid(),
            RegisteredBy = currentUserId,
            DependentId = dependent.DependentId,
            StaffId = staffId,
            Relationship = relationship,
            IsActive = request.IsActive,
            CreatedAt = now,
            UpdatedAt = now
        };

        db.Dependents.Add(dependent);
        db.StaffDependents.Add(relation);

        foreach (var (docType, fileName, fileUrl) in validatedDocs)
        {
            db.DependentDocuments.Add(new DependentDocument
            {
                DocumentId = Guid.NewGuid(),
                StaffDependentId = relation.StaffDependentId,
                DocumentType = docType,
                FileName = fileName,
                FileUrl = fileUrl,
                VerificationStatus = "pending",
                UploadedAt = now,
                VerifiedBy = null
            });
        }

        await db.SaveChangesAsync(ct);
        await SyncStaffDependentCountAsync(staff, now, ct);
        await transaction.CommitAsync(ct);

        var list = await ListByStaffAsync(staffId, ct);
        return list.First(x => x.StaffDependentId == relation.StaffDependentId);
    }

    public async Task<EmployeeDependentDto> UpdateAsync(
        Guid staffId,
        Guid staffDependentId,
        UpdateEmployeeDependentRequest request,
        CancellationToken ct)
    {
        var fullName = DependentRules.ValidateFullName(request.FullName);
        var dob = DependentRules.ValidateDateOfBirth(request.DateOfBirth);
        var gender = DependentRules.ValidateGender(request.Gender);
        var idCard = DependentRules.ValidateIdCardNumber(request.IdCardNumber);
        var taxCode = DependentRules.ValidateTaxCode(request.TaxCode);
        var relationship = DependentRules.ValidateRelationship(request.Relationship);

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);

        var staff = await db.Staff.FirstOrDefaultAsync(s => s.StaffId == staffId, ct)
            ?? throw new AppException(404, "Không tìm thấy nhân viên.");

        var relation = await db.StaffDependents
            .FirstOrDefaultAsync(sd => sd.StaffDependentId == staffDependentId && sd.StaffId == staffId, ct)
            ?? throw new AppException(404, "Không tìm thấy thông tin quan hệ người phụ thuộc.");

        var dependent = await db.Dependents
            .FirstOrDefaultAsync(d => d.DependentId == relation.DependentId, ct)
            ?? throw new AppException(404, "Không tìm thấy hồ sơ người phụ thuộc.");

        await EnsureUniqueDependentIdentityAsync(idCard, taxCode, dependent.DependentId, ct);

        var now = DateTime.UtcNow;
        dependent.FullName = fullName;
        dependent.DateOfBirth = dob;
        dependent.Gender = gender;
        dependent.IdCardNumber = idCard;
        dependent.TaxCode = taxCode;

        relation.Relationship = relationship;
        relation.IsActive = request.IsActive;
        relation.UpdatedAt = now;

        await db.SaveChangesAsync(ct);
        await SyncStaffDependentCountAsync(staff, now, ct);
        await transaction.CommitAsync(ct);

        var list = await ListByStaffAsync(staffId, ct);
        return list.First(x => x.StaffDependentId == relation.StaffDependentId);
    }

    public async Task<DependentDocumentDto> AddDocumentAsync(
        Guid staffId,
        Guid staffDependentId,
        CreateDependentDocumentRequest request,
        CancellationToken ct)
    {
        var docType = DependentRules.ValidateDocumentType(request.DocumentType);
        var fileName = DependentRules.ValidateFileName(request.FileName);
        var fileUrl = DependentRules.ValidateFileUrl(request.FileUrl);

        var relationExists = await db.StaffDependents
            .AsNoTracking()
            .AnyAsync(sd => sd.StaffDependentId == staffDependentId && sd.StaffId == staffId, ct);

        if (!relationExists)
            throw new AppException(404, "Không tìm thấy thông tin quan hệ người phụ thuộc.");

        var doc = new DependentDocument
        {
            DocumentId = Guid.NewGuid(),
            StaffDependentId = staffDependentId,
            DocumentType = docType,
            FileName = fileName,
            FileUrl = fileUrl,
            VerificationStatus = "pending",
            UploadedAt = DateTime.UtcNow,
            VerifiedBy = null
        };

        db.DependentDocuments.Add(doc);
        await db.SaveChangesAsync(ct);

        return new DependentDocumentDto(
            doc.DocumentId,
            doc.StaffDependentId,
            doc.DocumentType,
            doc.FileName,
            doc.FileUrl,
            doc.VerificationStatus,
            doc.UploadedAt,
            doc.VerifiedBy,
            null);
    }

    public async Task<DependentDocumentDto> VerifyDocumentAsync(
        Guid staffId,
        Guid staffDependentId,
        Guid documentId,
        VerifyDependentDocumentRequest request,
        Guid currentUserId,
        CancellationToken ct)
    {
        var status = DependentRules.ValidateVerificationStatus(request.VerificationStatus);

        var relationExists = await db.StaffDependents
            .AsNoTracking()
            .AnyAsync(sd => sd.StaffDependentId == staffDependentId && sd.StaffId == staffId, ct);

        if (!relationExists)
            throw new AppException(404, "Không tìm thấy thông tin quan hệ người phụ thuộc.");

        var doc = await db.DependentDocuments
            .FirstOrDefaultAsync(d => d.DocumentId == documentId && d.StaffDependentId == staffDependentId, ct)
            ?? throw new AppException(404, "Không tìm thấy hồ sơ minh chứng.");

        doc.VerificationStatus = status;
        doc.VerifiedBy = status == "pending" ? null : currentUserId;
        await db.SaveChangesAsync(ct);

        string? verifiedByName = null;
        if (doc.VerifiedBy is Guid verifierId)
        {
            var user = await db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.UserId == verifierId, ct);
            verifiedByName = user is null ? null : (string.IsNullOrWhiteSpace(user.FullName) ? user.Username : user.FullName);
        }

        return new DependentDocumentDto(
            doc.DocumentId,
            doc.StaffDependentId,
            doc.DocumentType,
            doc.FileName,
            doc.FileUrl,
            doc.VerificationStatus,
            doc.UploadedAt,
            doc.VerifiedBy,
            verifiedByName);
    }

    public async Task DeleteDocumentAsync(Guid staffId, Guid staffDependentId, Guid documentId, CancellationToken ct)
    {
        var relationExists = await db.StaffDependents
            .AsNoTracking()
            .AnyAsync(sd => sd.StaffDependentId == staffDependentId && sd.StaffId == staffId, ct);

        if (!relationExists)
            throw new AppException(404, "Không tìm thấy thông tin quan hệ người phụ thuộc.");

        var doc = await db.DependentDocuments
            .FirstOrDefaultAsync(d => d.DocumentId == documentId && d.StaffDependentId == staffDependentId, ct)
            ?? throw new AppException(404, "Không tìm thấy hồ sơ minh chứng.");

        db.DependentDocuments.Remove(doc);
        await db.SaveChangesAsync(ct);
    }

    private async Task EnsureUniqueDependentIdentityAsync(string? idCard, string? taxCode, Guid? excludeDependentId, CancellationToken ct)
    {
        if (idCard is not null)
        {
            var existsIdCard = await db.Dependents.AnyAsync(
                d => d.IdCardNumber == idCard && (!excludeDependentId.HasValue || d.DependentId != excludeDependentId.Value),
                ct);
            if (existsIdCard)
                throw new AppException(409, "Số CCCD này đã được đăng ký cho một người phụ thuộc khác.", "idCardNumber");
        }

        if (taxCode is not null)
        {
            var existsTaxCode = await db.Dependents.AnyAsync(
                d => d.TaxCode == taxCode && (!excludeDependentId.HasValue || d.DependentId != excludeDependentId.Value),
                ct);
            if (existsTaxCode)
                throw new AppException(409, "Mã số thuế này đã được đăng ký cho một người phụ thuộc khác.", "taxCode");
        }
    }

    private async Task SyncStaffDependentCountAsync(Staff staff, DateTime now, CancellationToken ct)
    {
        var activeCount = await db.StaffDependents.CountAsync(sd => sd.StaffId == staff.StaffId && sd.IsActive, ct);
        staff.DependentCount = activeCount;
        staff.UpdatedAt = now;
        await db.SaveChangesAsync(ct);
    }
}
