using System.ComponentModel.DataAnnotations;

namespace Vnc.HRMS.DTOs.Cme;

public sealed record CertificateCycleDto(
    Guid CertificateId,
    string? CertificateNumber,
    string CertificateType,
    DateOnly? IssueDate,
    DateOnly? ExpiryDate,
    bool HasExpiryDate,
    Guid? CycleId,
    int CycleNumber,
    DateOnly? CycleStart,
    DateOnly? CycleEnd,
    decimal RequiredCredits,
    decimal EarnedCredits,
    decimal RemainingCredits,
    int? DaysLeft,
    string StatusBadge,
    int AlertThresholdDays,
    string CertificateStatus,
    string CycleStatus = "active",
    bool IsCurrentCycle = true,
    bool HasCmeCreditsRequirement = false
);

public sealed record UpdateCmeCycleDatesRequest(
    [Required] DateOnly CycleStart,
    [Required] DateOnly CycleEnd,
    Guid? CycleId = null
);

public sealed record CreateNewCmeCycleRequest(
    DateOnly? CycleStart = null,
    DateOnly? CycleEnd = null
);
