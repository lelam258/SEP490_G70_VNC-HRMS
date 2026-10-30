using System.ComponentModel.DataAnnotations;

namespace Vnc.HRMS.DTOs.Certificates;

public sealed record UpdateCertificateRequest(
    string? CertificateNumber,
    string? Category,
    [Required] string CertificateType,
    string? IssuingAuthority,
    DateOnly? IssueDate,
    DateOnly? ExpiryDate,
    string? ScopeOfPractice,
    int? CmeCycleMonths,
    decimal? CmeRequiredCredits,
    string? Status,
    string? FileUrl,
    Guid? DepartmentId,
    string? DegreeType = null,
    string? Major = null,
    string? VerificationStatus = null,
    string? Notes = null,
    string? ProfessionalDegree = null,
    string? IssuanceMethod = null
);
