namespace Vnc.HRMS.DTOs.Employees;

public sealed record DependentDocumentDto(
    Guid DocumentId,
    Guid StaffDependentId,
    string DocumentType,
    string FileName,
    string? FileUrl,
    string VerificationStatus,
    DateTime UploadedAt,
    Guid? VerifiedBy,
    string? VerifiedByName);

public sealed record EmployeeDependentDto(
    Guid StaffDependentId,
    Guid DependentId,
    Guid StaffId,
    Guid RegisteredBy,
    string? RegisteredByName,
    string FullName,
    DateOnly DateOfBirth,
    string Gender,
    string? IdCardNumber,
    string? TaxCode,
    string Relationship,
    bool IsActive,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    DependentDocumentDto[] Documents);

public sealed record CreateDependentDocumentRequest(
    string DocumentType,
    string FileName,
    string? FileUrl);

public sealed record CreateEmployeeDependentRequest(
    string FullName,
    DateOnly DateOfBirth,
    string Gender,
    string? IdCardNumber,
    string? TaxCode,
    string Relationship,
    bool IsActive = true,
    CreateDependentDocumentRequest[]? Documents = null);

public sealed record UpdateEmployeeDependentRequest(
    string FullName,
    DateOnly DateOfBirth,
    string Gender,
    string? IdCardNumber,
    string? TaxCode,
    string Relationship,
    bool IsActive);

public sealed record VerifyDependentDocumentRequest(
    string VerificationStatus);
