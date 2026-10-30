namespace Vnc.HRMS.DTOs.Payroll;

public sealed record CommissionMatrixCellDto(
    Guid RuleId,
    string ValueType,
    decimal CommissionValue,
    string TimeCondition,
    Guid? PositionId,
    string? PositionName,
    DateOnly EffectiveFrom,
    DateOnly? EffectiveTo,
    string Status);

public sealed record CommissionMatrixRowDto(
    Guid? ServiceId,
    string? ServiceCode,
    string ServiceName,
    string? Category,
    decimal? BasePrice,
    Dictionary<string, CommissionMatrixCellDto?> Cells);

public sealed record CommissionMatrixGroupDto(
    string Category,
    IReadOnlyList<CommissionMatrixRowDto> Rows);

public sealed record CommissionMatrixDto(
    IReadOnlyList<CommissionMatrixGroupDto> Groups);

