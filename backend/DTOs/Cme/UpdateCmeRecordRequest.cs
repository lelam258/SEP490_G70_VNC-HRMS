using System.ComponentModel.DataAnnotations;

namespace Vnc.HRMS.DTOs.Cme;

public sealed record UpdateCmeRecordRequest(
    [Required] Guid CertificateId,
    [Required] string CourseName,
    string? Provider,
    [Required] DateOnly CompletedDate,
    [Range(0.01, 999.99)] decimal Credits,
    string? FileUrl,
    bool? Verified = null
);
