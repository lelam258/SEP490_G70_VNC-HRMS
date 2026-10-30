namespace Vnc.HRMS.DTOs.Certificates;

public sealed record StaffCertificateSummaryDto(
    Guid StaffId,
    string StaffCode,
    string FullName,
    Guid? DepartmentId,
    string DepartmentName,
    string? Email,
    string Status,
    string? AvatarUrl,
    int CertificateCount
);
