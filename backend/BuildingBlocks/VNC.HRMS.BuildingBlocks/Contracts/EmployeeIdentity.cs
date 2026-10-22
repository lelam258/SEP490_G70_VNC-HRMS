namespace Vnc.HRMS.Contracts;
public sealed record EmployeeIdentity(Guid StaffId, string FullName, string? Email, string Status);
public sealed record RegistrationLookup(string Code, string Email);
// Minimal directory fields needed to link an account; no personal profile documents or identifiers.
public sealed record AccountEmployeeOption(Guid Id, string Code, string Name, string Department, Guid? DepartmentId, string? Email, string Status);
public interface IEmployeeDirectory
{
    Task<EmployeeIdentity?> FindAsync(Guid id, CancellationToken ct);
    Task<EmployeeIdentity?> FindForRegistrationAsync(string code, string email, CancellationToken ct);
    Task<AccountEmployeeOption[]> ListAccountOptionsAsync(CancellationToken ct);
}
public interface ISessionInspector
{
    Task<Vnc.HRMS.DTOs.Auth.SessionIdentityDto?> InspectAsync(Guid id, CancellationToken ct);
}
