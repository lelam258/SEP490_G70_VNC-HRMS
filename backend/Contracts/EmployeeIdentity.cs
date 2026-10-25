namespace Vnc.HRMS.Contracts;

public sealed record AccountEmployeeOption(Guid Id, string Code, string Name, string Department, Guid? DepartmentId, string? Email, string Status);

public interface IEmployeeDirectory
{
    Task<AccountEmployeeOption[]> ListAccountOptionsAsync(CancellationToken ct);
}
