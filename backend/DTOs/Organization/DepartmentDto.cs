namespace Vnc.HRMS.DTOs.Organization;

public sealed record FacilityOptionDto(Guid Id, string Name, string Status);

public sealed record DepartmentManagerOptionDto(
    Guid StaffId,
    string StaffCode,
    string FullName,
    Guid? DepartmentId,
    string? DepartmentName,
    string? AccountRole);

public sealed record DepartmentDto(
    Guid Id,
    string Code,
    string Name,
    string Status,
    IReadOnlyList<Guid>? FacilityIds = null,
    string? FacilityLabel = null,
    Guid? ManagerId = null,
    string? ManagerName = null,
    string? ManagerCode = null);

public sealed record AssignDepartmentFacilitiesRequest(IReadOnlyList<Guid> FacilityIds);

public sealed record AssignDepartmentManagerRequest(Guid? ManagerId);
