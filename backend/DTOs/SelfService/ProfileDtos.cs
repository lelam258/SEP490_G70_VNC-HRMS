namespace Vnc.HRMS.DTOs.SelfService;

public sealed record UserProfileDto(
    Guid StaffId,
    string StaffCode,
    string FullName,
    DateOnly? DateOfBirth,
    string? Gender,
    string? Phone,
    string? Email,
    string? IdCardNumber,
    string? AvatarUrl,
    string? DepartmentName,
    string? PositionName,
    DateOnly DateJoined,
    string? ScopeOfPractice,
    int DependentCount,
    string Status);

public sealed record UpdateProfileRequest(
    string FullName,
    DateOnly? DateOfBirth,
    string? Gender,
    string? IdCardNumber,
    string? Phone);
