using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController]
[Authorize(Policy = "Accountant")]
[Route("api/compensation")]
public sealed class CompensationController(ICompensationService service) : ControllerBase
{
    // ---------- 1. CONTRACTS ----------

    [HttpGet("contracts")]
    public Task<ContractSummaryDto[]> ListContracts(
        [FromQuery] string? q, [FromQuery] string? status, CancellationToken ct)
        => service.ListContractsAsync(q, status, ct);

    [HttpGet("contracts/{id:guid}")]
    public Task<ContractCompensationDto> GetContractCompensation(Guid id, CancellationToken ct)
        => service.GetContractCompensationAsync(id, ct);

    [HttpPut("contracts/{id:guid}")]
    public Task<ContractCompensationDto> UpdateContractCompensation(
        Guid id, UpdateContractCompensationRequest request, CancellationToken ct)
        => service.UpdateContractCompensationAsync(id, request, ct);

    // ---------- 2. STAFF ALLOWANCES ----------

    [HttpGet("contracts/{id:guid}/allowances")]
    public Task<StaffAllowanceDto[]> ListStaffAllowances(Guid id, CancellationToken ct)
        => service.ListStaffAllowancesAsync(id, ct);

    [HttpPost("contracts/{id:guid}/allowances")]
    public async Task<ActionResult<StaffAllowanceDto>> CreateStaffAllowance(
        Guid id, SaveStaffAllowanceRequest request, CancellationToken ct)
    {
        Guid.TryParse(User.FindFirstValue("sub"), out var approverId);
        var result = await service.CreateStaffAllowanceAsync(
            id, request, approverId == Guid.Empty ? null : approverId, ct);
        return Ok(result);
    }

    [HttpPut("contracts/{id:guid}/allowances/{staffAllowanceId:guid}")]
    public Task<StaffAllowanceDto> UpdateStaffAllowance(
        Guid id, Guid staffAllowanceId, SaveStaffAllowanceRequest request, CancellationToken ct)
    {
        Guid.TryParse(User.FindFirstValue("sub"), out var approverId);
        return service.UpdateStaffAllowanceAsync(
            id, staffAllowanceId, request, approverId == Guid.Empty ? null : approverId, ct);
    }
}
