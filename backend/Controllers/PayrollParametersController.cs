using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController]
[Authorize(Policy = "Accountant")]
[Route("api/payroll-parameters")]
public sealed class PayrollParametersController(IPayrollParameterService service) : ControllerBase
{
    // ---------- 1. ALLOWANCE TYPES ----------

    [HttpGet("allowances")]
    public Task<AllowanceTypeDto[]> ListAllowances(
        [FromQuery] string? status, [FromQuery] string? q, CancellationToken ct)
        => service.ListAllowancesAsync(new PayrollParameterFilter(status, null, q), ct);

    [HttpGet("allowances/{id:guid}")]
    public Task<AllowanceTypeDto> GetAllowance(Guid id, CancellationToken ct)
        => service.GetAllowanceAsync(id, ct);

    [HttpPost("allowances")]
    public async Task<ActionResult<AllowanceTypeDto>> CreateAllowance(
        SaveAllowanceTypeRequest request, CancellationToken ct)
    {
        var result = await service.CreateAllowanceAsync(request, ct);
        return CreatedAtAction(nameof(GetAllowance), new { id = result.Id }, result);
    }

    [HttpPut("allowances/{id:guid}")]
    public Task<AllowanceTypeDto> UpdateAllowance(
        Guid id, SaveAllowanceTypeRequest request, CancellationToken ct)
        => service.UpdateAllowanceAsync(id, request, ct);

    // ---------- 2. INSURANCE CONFIGS ----------

    [HttpGet("insurances")]
    public Task<InsuranceConfigDto[]> ListInsurances(
        [FromQuery] string? status, [FromQuery] DateOnly? effectiveOn, [FromQuery] string? q, CancellationToken ct)
        => service.ListInsurancesAsync(new PayrollParameterFilter(status, effectiveOn, q), ct);

    [HttpGet("insurances/{id:guid}")]
    public Task<InsuranceConfigDto> GetInsurance(Guid id, CancellationToken ct)
        => service.GetInsuranceAsync(id, ct);

    [HttpPost("insurances")]
    public async Task<ActionResult<InsuranceConfigDto>> CreateInsurance(
        SaveInsuranceConfigRequest request, CancellationToken ct)
    {
        var result = await service.CreateInsuranceAsync(request, ct);
        return CreatedAtAction(nameof(GetInsurance), new { id = result.Id }, result);
    }

    [HttpPut("insurances/{id:guid}")]
    public Task<InsuranceConfigDto> UpdateInsurance(
        Guid id, SaveInsuranceConfigRequest request, CancellationToken ct)
        => service.UpdateInsuranceAsync(id, request, ct);

    // ---------- 3. TAX BRACKETS & POLICY ----------

    [HttpGet("tax-brackets")]
    public Task<TaxBracketDto[]> ListTaxBrackets(
        [FromQuery] string? status, [FromQuery] DateOnly? effectiveOn, CancellationToken ct)
        => service.ListTaxBracketsAsync(new PayrollParameterFilter(status, effectiveOn, null), ct);

    [HttpGet("tax-brackets/{id:guid}")]
    public Task<TaxBracketDto> GetTaxBracket(Guid id, CancellationToken ct)
        => service.GetTaxBracketAsync(id, ct);

    [HttpPost("tax-brackets")]
    public async Task<ActionResult<TaxBracketDto>> CreateTaxBracket(
        SaveTaxBracketRequest request, CancellationToken ct)
    {
        var result = await service.CreateTaxBracketAsync(request, ct);
        return CreatedAtAction(nameof(GetTaxBracket), new { id = result.Id }, result);
    }

    [HttpPut("tax-brackets/{id:guid}")]
    public Task<TaxBracketDto> UpdateTaxBracket(
        Guid id, SaveTaxBracketRequest request, CancellationToken ct)
        => service.UpdateTaxBracketAsync(id, request, ct);

    [HttpGet("tax-deductions")]
    public Task<TaxDeductionPolicyDto> GetTaxDeductionPolicy(CancellationToken ct)
        => service.GetTaxDeductionPolicyAsync(ct);

    // ---------- 4. COMMISSION RULES ----------

    [HttpGet("commission-rules")]
    public Task<CommissionRuleDto[]> ListCommissionRules(
        [FromQuery] string? status, [FromQuery] DateOnly? effectiveOn, [FromQuery] string? q, CancellationToken ct)
        => service.ListCommissionRulesAsync(new PayrollParameterFilter(status, effectiveOn, q), ct);

    [HttpGet("commission-rules/{id:guid}")]
    public Task<CommissionRuleDto> GetCommissionRule(Guid id, CancellationToken ct)
        => service.GetCommissionRuleAsync(id, ct);

    [HttpPost("commission-rules")]
    public async Task<ActionResult<CommissionRuleDto>> CreateCommissionRule(
        SaveCommissionRuleRequest request, CancellationToken ct)
    {
        Guid.TryParse(User.FindFirstValue("sub"), out var creatorId);
        var result = await service.CreateCommissionRuleAsync(
            request, creatorId == Guid.Empty ? null : creatorId, ct);
        return CreatedAtAction(nameof(GetCommissionRule), new { id = result.Id }, result);
    }

    [HttpPut("commission-rules/{id:guid}")]
    public Task<CommissionRuleDto> UpdateCommissionRule(
        Guid id, SaveCommissionRuleRequest request, CancellationToken ct)
        => service.UpdateCommissionRuleAsync(id, request, ct);

    // ---------- 5. PROCEDURE SERVICES DROPDOWN ----------

    [HttpGet("procedure-services")]
    public Task<ProcedureServiceOptionDto[]> ListActiveProcedureServices(CancellationToken ct)
        => service.ListActiveProcedureServicesAsync(ct);
}
