namespace Vnc.HRMS.DTOs.Cme;

public sealed record StaffCmeSummaryDto(
    Guid StaffId,
    string StaffCode,
    string FullName,
    Guid? DepartmentId,
    string DepartmentName,
    string? Email,
    string Status,
    string? AvatarUrl,
    int CertificateCount,
    int CmeCertificateCount,
    int CmeRecordCount,
    int PendingVerifyCount,
    decimal TotalRequiredCredits,
    decimal TotalEarnedCredits,
    decimal VerifiedCredits
);
