using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController]
[Authorize(Policy = "Accountant")]
[Route("api/procedure-services")]
public sealed class ProcedureServicesController(IProcedureServiceCatalogService service) : ControllerBase
{
    [HttpGet]
    public Task<ProcedureServiceListItemDto[]> List(
        [FromQuery] string? q = null,
        [FromQuery] string? category = null,
        [FromQuery] string? status = null,
        CancellationToken ct = default)
        => service.ListAsync(new ProcedureServiceListFilter(q, category, status), ct);

    [HttpGet("categories")]
    public Task<string[]> ListCategories(CancellationToken ct)
        => service.ListCategoriesAsync(ct);

    [HttpGet("{id:guid}")]
    public Task<ProcedureServiceDetailDto> GetDetail(Guid id, CancellationToken ct)
        => service.GetDetailAsync(id, ct);

    [HttpPost]
    public async Task<ActionResult<ProcedureServiceListItemDto>> Create(
        [FromBody] CreateProcedureServiceRequest request, CancellationToken ct)
    {
        var created = await service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetDetail), new { id = created.ServiceId }, created);
    }

    [HttpPut("{id:guid}")]
    public Task<ProcedureServiceListItemDto> Update(
        Guid id, [FromBody] UpdateProcedureServiceRequest request, CancellationToken ct)
        => service.UpdateAsync(id, request, ct);

    [HttpPatch("{id:guid}/status")]
    public Task<ProcedureServiceListItemDto> SetStatus(
        Guid id, [FromBody] ProcedureServiceStatusRequest request, CancellationToken ct)
        => service.SetStatusAsync(id, request.Status, ct);
}
