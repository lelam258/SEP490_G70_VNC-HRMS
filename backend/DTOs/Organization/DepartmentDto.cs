namespace Vnc.HRMS.DTOs.Organization;

public sealed record FacilityOptionDto(Guid Id, string Name, string Status);

public sealed record DepartmentDto(
    Guid Id,
    string Code,
    string Name,
    string Status,
    IReadOnlyList<Guid>? FacilityIds = null,
    string? FacilityLabel = null);

public sealed record AssignDepartmentFacilitiesRequest(IReadOnlyList<Guid> FacilityIds);
