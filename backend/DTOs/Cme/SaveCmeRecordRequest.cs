using System.ComponentModel.DataAnnotations;

namespace Vnc.HRMS.DTOs.Cme;

public sealed record SaveCmeRecordRequest(
    [Required] Guid CertificateId,
    [Required, MaxLength(150)] string CourseName,
    [MaxLength(100)] string? Provider,
    [Required] DateOnly CompletedDate,
    [Range(0.5, 999.5)] decimal Credits,
    string? FileUrl,
    bool Verified = true,
    Guid? CmeCycleId = null
);
