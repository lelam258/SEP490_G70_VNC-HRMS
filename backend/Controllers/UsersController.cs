using System.Security.Claims;
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
    [HttpGet("{id:guid}")] public Task<AccountDto> Get(Guid id, CancellationToken ct) => users.GetAsync(id, ct);
    [HttpPost]
    public async Task<ActionResult<AccountDto>> Create(SaveAccountRequest request, CancellationToken ct)
    {
        var account = await users.CreateAsync(request, false, ct);
        return CreatedAtAction(nameof(Get), new { id = account.Id }, account);
    }
    [HttpPut("{id:guid}")]
    public Task<AccountDto> Update(Guid id, SaveAccountRequest request, CancellationToken ct)
        => users.UpdateAsync(id, request, Guid.Parse(User.FindFirstValue("sub")!), ct);
}
