using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.DTOs.Organization;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController, Authorize(Policy = "HRManager"), Route("api/departments")]
public sealed class DepartmentsController(IDepartmentService departments) : ControllerBase
{
    [HttpGet] public Task<DepartmentDto[]> List(CancellationToken ct) => departments.ListAsync(ct);
    [HttpGet("{id:guid}")] public Task<DepartmentDto> Get(Guid id, CancellationToken ct) => departments.GetAsync(id, ct);
    [HttpPut("{id:guid}")]
    public Task<DepartmentDto> Update(Guid id, UpdateDepartmentRequest request, CancellationToken ct) => departments.UpdateAsync(id, request, ct);
    [HttpPost]
    public async Task<ActionResult<DepartmentDto>> Create(CreateDepartmentRequest request, CancellationToken ct)
    {
        var department = await departments.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = department.Id }, department);
    }
}
