using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.DTOs.Employees;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController, Authorize(Policy = "HRManager"), Route("api/employees")]
public sealed class EmployeesController(IEmployeeService employees) : ControllerBase
{
    [HttpGet] public Task<EmployeeDto[]> List(CancellationToken ct) => employees.ListAsync(ct);
    [HttpGet("{id:guid}")] public Task<EmployeeDto> Get(Guid id, CancellationToken ct) => employees.GetAsync(id, ct);
    [HttpPost]
    public async Task<ActionResult<EmployeeDto>> Create(CreateEmployeeRequest request, CancellationToken ct)
    {
        var employee = await employees.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = employee.Id }, employee);
    }
}
