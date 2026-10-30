namespace Vnc.HRMS.DTOs.Cme;

public sealed record CmeRecordDto(
    Guid CmeId,
    Guid CertificateId,
    string CertificateType,
    string? CertificateNumber,
    int? CmeCycleMonths,
    decimal? CmeRequiredCredits,
    Guid StaffId,
    string StaffCode,
    string StaffName,
    Guid? DepartmentId,
    string? DepartmentName,
    Guid? CmeCycleId,
    int? CycleNumber,
    string CourseName,
    string? Provider,
    DateOnly CompletedDate,
    decimal Credits,
    string? FileUrl,
    bool Verified,
    Guid? VerifiedBy,
    string? VerifiedByName,
    DateTime? VerifiedAt,
    DateTime? CreatedAt
);
