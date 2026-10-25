namespace Vnc.HRMS.Contracts;

public sealed record EmployeeIdentity(Guid StaffId, string FullName, string? Email, string Status);

public sealed record AccountEmployeeOption(Guid Id, string Code, string Name, string Department, Guid? DepartmentId, string? Email, string Status);

public interface IEmployeeDirectory
{
    Task<AccountEmployeeOption[]> ListAccountOptionsAsync(CancellationToken ct);
    Task<EmployeeIdentity?> FindAsync(Guid id, CancellationToken ct);
}
