using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.Contracts;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Models.Employees;
namespace Vnc.HRMS.Controllers;
[ApiController, ApiExplorerSettings(IgnoreApi = true), Route("internal/employees")]
public sealed class InternalEmployeesController(IEmployeeRepository employees) : ControllerBase
{
    [HttpGet("account-options")]
    public Task<AccountEmployeeOption[]> AccountOptions(CancellationToken ct) => employees.ListAccountOptionsAsync(ct);
    private IActionResult Result(Staff? staff) => staff is null ? NotFound() : Ok(new EmployeeIdentity(staff.StaffId, staff.FullName, staff.Email, staff.Status));
    [HttpGet("{id:guid}")] public async Task<IActionResult> Get(Guid id, CancellationToken ct) => Result(await employees.FindAsync(id, ct));
    [HttpPost("registration-lookup")] public async Task<IActionResult> Lookup(RegistrationLookup request, CancellationToken ct) => Result(await employees.FindForRegistrationAsync(request.Code, request.Email, ct));
}
