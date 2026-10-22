using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController]
[Authorize(Roles = "admin,accountant,hr")]
[Route("api/payroll-parameters")]
public sealed class PayrollParametersController(IPayrollParameterService payroll) : ControllerBase
{
    // ==========================================
    // Summary
    // ==========================================
    [HttpGet]
    public Task<PayrollParametersSummaryDto> GetSummary(CancellationToken ct) => payroll.GetSummaryAsync(ct);

    // ==========================================
    // 1. ALLOWANCES
    // ==========================================
    [HttpGet("allowances")]
    public Task<AllowanceTypeDto[]> ListAllowances(CancellationToken ct) => payroll.ListAllowancesAsync(ct);

    [HttpGet("allowances/{id:guid}")]
    public Task<AllowanceTypeDto> GetAllowance(Guid id, CancellationToken ct) => payroll.GetAllowanceAsync(id, ct);

    [HttpPost("allowances")]
    public async Task<ActionResult<AllowanceTypeDto>> CreateAllowance(SaveAllowanceTypeRequest request, CancellationToken ct)
    {
        var result = await payroll.CreateAllowanceAsync(request, ct);
        return CreatedAtAction(nameof(GetAllowance), new { id = result.Id }, result);
    }

    [HttpPut("allowances/{id:guid}")]
    public Task<AllowanceTypeDto> UpdateAllowance(Guid id, SaveAllowanceTypeRequest request, CancellationToken ct)
        => payroll.UpdateAllowanceAsync(id, request, ct);

    // ==========================================
    // 2. INSURANCES
    // ==========================================
    [HttpGet("insurances")]
    public Task<InsuranceConfigDto[]> ListInsurances(CancellationToken ct) => payroll.ListInsurancesAsync(ct);

    [HttpGet("insurances/{id:guid}")]
    public Task<InsuranceConfigDto> GetInsurance(Guid id, CancellationToken ct) => payroll.GetInsuranceAsync(id, ct);

    [HttpPost("insurances")]
    public async Task<ActionResult<InsuranceConfigDto>> CreateInsurance(SaveInsuranceConfigRequest request, CancellationToken ct)
    {
        var result = await payroll.CreateInsuranceAsync(request, ct);
        return CreatedAtAction(nameof(GetInsurance), new { id = result.Id }, result);
    }

    [HttpPut("insurances/{id:guid}")]
    public Task<InsuranceConfigDto> UpdateInsurance(Guid id, SaveInsuranceConfigRequest request, CancellationToken ct)
        => payroll.UpdateInsuranceAsync(id, request, ct);

    // ==========================================
    // 3. TAX BRACKETS
    // ==========================================
    [HttpGet("tax-brackets")]
    public Task<TaxBracketDto[]> ListTaxBrackets(CancellationToken ct) => payroll.ListTaxBracketsAsync(ct);

    [HttpGet("tax-brackets/{id:guid}")]
    public Task<TaxBracketDto> GetTaxBracket(Guid id, CancellationToken ct) => payroll.GetTaxBracketAsync(id, ct);

    [HttpPost("tax-brackets")]
    public async Task<ActionResult<TaxBracketDto>> CreateTaxBracket(SaveTaxBracketRequest request, CancellationToken ct)
    {
        var result = await payroll.CreateTaxBracketAsync(request, ct);
        return CreatedAtAction(nameof(GetTaxBracket), new { id = result.Id }, result);
    }

    [HttpPut("tax-brackets/{id:guid}")]
    public Task<TaxBracketDto> UpdateTaxBracket(Guid id, SaveTaxBracketRequest request, CancellationToken ct)
        => payroll.UpdateTaxBracketAsync(id, request, ct);

    // ==========================================
    // 4. COMMISSION RULES
    // ==========================================
    [HttpGet("commission-rules")]
    public Task<CommissionRuleDto[]> ListCommissionRules(CancellationToken ct) => payroll.ListCommissionRulesAsync(ct);

    [HttpGet("commission-rules/{id:guid}")]
    public Task<CommissionRuleDto> GetCommissionRule(Guid id, CancellationToken ct) => payroll.GetCommissionRuleAsync(id, ct);

    [HttpPost("commission-rules")]
    public async Task<ActionResult<CommissionRuleDto>> CreateCommissionRule(SaveCommissionRuleRequest request, CancellationToken ct)
    {
        Guid.TryParse(User.FindFirstValue("sub"), out var creatorId);
        var result = await payroll.CreateCommissionRuleAsync(request, creatorId == Guid.Empty ? null : creatorId, ct);
        return CreatedAtAction(nameof(GetCommissionRule), new { id = result.Id }, result);
    }

    [HttpPut("commission-rules/{id:guid}")]
    public Task<CommissionRuleDto> UpdateCommissionRule(Guid id, SaveCommissionRuleRequest request, CancellationToken ct)
        => payroll.UpdateCommissionRuleAsync(id, request, ct);
}
