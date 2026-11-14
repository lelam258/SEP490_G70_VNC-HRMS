using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController]
[Authorize(Roles = "employee,department_head,hr_manager,hr_staff,accountant")]
[Route("api/procedure-slips")]
public sealed class ProcedureSlipsController(IProcedureSlipService procedureSlipService) : ControllerBase
{
    private (Guid UserId, string Role) GetCurrentIdentity()
    {
        var sub = User.FindFirst("sub")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(sub, out var userId))
        {
            throw new AppException(401, "Chưa xác thực người dùng.");
        }

        var role = User.FindFirst("role")?.Value ?? User.FindFirst(ClaimTypes.Role)?.Value ?? "employee";
        return (userId, role);
    }

    [HttpGet("lookups")]
    public Task<ProcedureLookupsDto> GetLookups(CancellationToken ct)
    {
        var (userId, _) = GetCurrentIdentity();
        return procedureSlipService.GetLookupsAsync(userId, ct);
    }

    [HttpGet("staff-availability")]
    public Task<IReadOnlyList<ProcedureStaffAvailabilityDto>> GetStaffAvailability(
        [FromQuery] DateOnly procedureDate,
        [FromQuery] Guid? departmentId = null,
        [FromQuery] Guid? facilityId = null,
        [FromQuery] string? startTime = null,
        [FromQuery] string? endTime = null,
        [FromQuery] Guid? excludeSlipId = null,
        CancellationToken ct = default)
    {
        _ = GetCurrentIdentity();
        return procedureSlipService.GetStaffAvailabilityAsync(
            procedureDate, departmentId, facilityId, startTime, endTime, excludeSlipId, ct);
    }

    [HttpGet]
    public Task<ProcedureSlipListResponseDto> ListSlips(
        [FromQuery] string? periodType = null,
        [FromQuery] int? year = null,
        [FromQuery] int? month = null,
        [FromQuery] int? quarter = null,
        [FromQuery] DateOnly? fromDate = null,
        [FromQuery] DateOnly? toDate = null,
        [FromQuery] Guid? departmentId = null,
        [FromQuery] Guid? serviceId = null,
        [FromQuery] Guid? staffId = null,
        [FromQuery] string? status = null,
        [FromQuery] bool? isAfterHours = null,
        [FromQuery] string? q = null,
        [FromQuery] string? scope = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 25,
        CancellationToken ct = default)
    {
        var (userId, role) = GetCurrentIdentity();
        var filter = new ProcedureSlipListFilter(
            periodType, year, month, quarter, fromDate, toDate,
            departmentId, serviceId, staffId, status, isAfterHours, q, scope, page, pageSize);
        return procedureSlipService.ListSlipsAsync(userId, role, filter, ct);
    }

    [HttpGet("{id:guid}")]
    public Task<ProcedureSlipDetailDto> GetSlipDetail(Guid id, CancellationToken ct)
    {
        var (userId, role) = GetCurrentIdentity();
        return procedureSlipService.GetSlipDetailAsync(userId, role, id, ct);
    }

    [HttpPost("preview-commission")]
    public Task<IReadOnlyList<PreviewAssignmentCommissionDto>> PreviewCommission(
        [FromBody] PreviewProcedureCommissionRequest request, CancellationToken ct)
        => procedureSlipService.PreviewCommissionAsync(request, ct);

    [HttpPost]
    public async Task<ActionResult<ProcedureSlipDetailDto>> CreateSlip(
        [FromBody] SaveProcedureSlipRequest request, CancellationToken ct)
    {
        var (userId, role) = GetCurrentIdentity();
        var result = await procedureSlipService.CreateSlipAsync(userId, role, request, ct);
        return CreatedAtAction(nameof(GetSlipDetail), new { id = result.SlipId }, result);
    }

    [HttpPut("{id:guid}")]
    public Task<ProcedureSlipDetailDto> UpdateSlip(
        Guid id, [FromBody] SaveProcedureSlipRequest request, CancellationToken ct)
    {
        var (userId, role) = GetCurrentIdentity();
        return procedureSlipService.UpdateSlipAsync(userId, role, id, request, ct);
    }

    [HttpPost("{id:guid}/hr-check")]
    [Authorize(Roles = "hr_staff")]
    public Task<ProcedureSlipDetailDto> HrCheckSlip(
        Guid id, [FromBody] ReviewProcedureSlipRequest request, CancellationToken ct)
    {
        var (userId, role) = GetCurrentIdentity();
        return procedureSlipService.HrCheckSlipAsync(userId, role, id, request, ct);
    }

    [HttpPost("{id:guid}/verify")]
    [Authorize(Roles = "accountant")]
    public Task<ProcedureSlipDetailDto> VerifySlip(
        Guid id, [FromBody] ReviewProcedureSlipRequest request, CancellationToken ct)
    {
        var (userId, role) = GetCurrentIdentity();
        return procedureSlipService.VerifySlipAsync(userId, role, id, request, ct);
    }

    [HttpPost("{id:guid}/complete")]
    public Task<ProcedureSlipDetailDto> CompleteSlip(
        Guid id, [FromBody] CompleteProcedureSlipRequest request, CancellationToken ct)
    {
        var (userId, role) = GetCurrentIdentity();
        return procedureSlipService.CompleteSlipAsync(userId, role, id, request, ct);
    }

    [HttpPost("calculate-monthly-commission")]
    [Authorize(Roles = "accountant")]
    public Task<CalculateMonthlyCommissionResultDto> CalculateMonthlyCommission(
        [FromBody] CalculateMonthlyCommissionRequest request, CancellationToken ct)
    {
        var (userId, _) = GetCurrentIdentity();
        return procedureSlipService.CalculateMonthlyCommissionAsync(userId, request, ct);
    }

    [HttpGet("commission-results")]
    [Authorize(Roles = "accountant,department_head")]
    public Task<CommissionResultsResponseDto> GetCommissionResults(
        [FromQuery] string payMonth,
        [FromQuery] Guid? departmentId = null,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default)
    {
        var (userId, role) = GetCurrentIdentity();
        var filter = new GetCommissionResultsFilter(payMonth, departmentId, search, page, pageSize);
        return procedureSlipService.GetCommissionResultsAsync(userId, role, filter, ct);
    }

    [HttpGet("commission-results/staff/{staffId:guid}")]
    [Authorize(Roles = "accountant,department_head")]
    public Task<StaffCommissionDetailResponseDto> GetStaffCommissionDetail(
        Guid staffId,
        [FromQuery] string payMonth,
        CancellationToken ct = default)
    {
        var (userId, role) = GetCurrentIdentity();
        return procedureSlipService.GetStaffCommissionDetailAsync(userId, role, staffId, payMonth, ct);
    }
}
