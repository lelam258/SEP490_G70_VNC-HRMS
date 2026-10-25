using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.DTOs.Users;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController, Authorize(Policy = "Admin"), Route("api/users")]
public sealed class UsersController(IUserService users, Vnc.HRMS.Contracts.IEmployeeDirectory employees) : ControllerBase
{
    [HttpGet("employee-options")]
    public Task<Vnc.HRMS.Contracts.AccountEmployeeOption[]> EmployeeOptions(CancellationToken ct) => employees.ListAccountOptionsAsync(ct);
    [HttpGet] public Task<AccountDto[]> List(CancellationToken ct) => users.ListAsync(ct);
}
