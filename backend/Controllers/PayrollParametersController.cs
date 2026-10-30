using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController]
[Authorize(Policy = "Accountant")]
[Route("api/payroll-parameters")]
[Route("api/v1/payroll/parameters")]
public sealed class PayrollParametersController(IPayrollParameterService service) : ControllerBase
{
    // =========================================================================
    // 1. ALLOWANCE TYPES
    // =========================================================================

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

    [HttpPost("allowances/{id:guid}/deactivate")]
    public Task<AllowanceTypeDto> DeactivateAllowance(
        Guid id, [FromBody] DeactivateParameterRequest? request, CancellationToken ct)
        => service.DeactivateAllowanceAsync(id, request ?? new DeactivateParameterRequest(), ct);

    // =========================================================================
    // 2. INSURANCE CONFIGS
    // =========================================================================

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

    [HttpPost("insurances/{id:guid}/deactivate")]
    public Task<InsuranceConfigDto> DeactivateInsurance(
        Guid id, [FromBody] DeactivateParameterRequest? request, CancellationToken ct)
        => service.DeactivateInsuranceAsync(id, request ?? new DeactivateParameterRequest(), ct);

    // =========================================================================
    // 3. TAX BRACKETS & POLICY
    // =========================================================================

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

    [HttpPost("tax-brackets/{id:guid}/deactivate")]
    public Task<TaxBracketDto> DeactivateTaxBracket(
        Guid id, [FromBody] DeactivateParameterRequest? request, CancellationToken ct)
        => service.DeactivateTaxBracketAsync(id, request ?? new DeactivateParameterRequest(), ct);

    [HttpGet("tax-deductions")]
    public Task<TaxDeductionPolicyDto> GetTaxDeductionPolicy(CancellationToken ct)
        => service.GetTaxDeductionPolicyAsync(ct);

    [HttpGet("tax-policy")]
    public Task<TaxPolicySummaryDto> GetTaxPolicySummary(CancellationToken ct)
        => service.GetTaxPolicySummaryAsync(ct);

    [HttpPut("tax-policy/flags")]
    public Task<TaxPolicySummaryDto> UpdateTaxPolicyFlags(
        UpdateTaxPolicyFlagsRequest request, CancellationToken ct)
        => service.UpdateTaxPolicyFlagsAsync(request, ct);

    [HttpPost("tax-policy/preview")]
    public Task<TaxCalculationResultDto> PreviewTaxCalculation(
        TaxCalculationPreviewRequest request, CancellationToken ct)
        => service.PreviewTaxCalculationAsync(request, ct);

    // =========================================================================
    // 4. PAYROLL RATE CONFIGS (duty_night, duty_noon, duty_extra_hour, union_fee, standard_working_days)
    // =========================================================================

    [HttpGet("rate-configs")]
    public Task<PayrollRateConfigDto[]> ListRateConfigs(
        [FromQuery] string? code,
        [FromQuery] Guid? positionId,
        [FromQuery] Guid? staffId,
        [FromQuery] string? status,
        [FromQuery] DateOnly? effectiveOn,
        [FromQuery] string? q,
        CancellationToken ct)
        => service.ListRateConfigsAsync(new PayrollRateConfigFilter(code, positionId, staffId, status, effectiveOn, q), ct);

    [HttpGet("rate-configs/{id:guid}")]
    public Task<PayrollRateConfigDto> GetRateConfig(Guid id, CancellationToken ct)
        => service.GetRateConfigAsync(id, ct);

    [HttpPost("rate-configs")]
    public async Task<ActionResult<PayrollRateConfigDto>> CreateRateConfig(
        SavePayrollRateConfigRequest request, CancellationToken ct)
    {
        Guid.TryParse(User.FindFirstValue("sub"), out var creatorId);
        var result = await service.CreateRateConfigAsync(
            request, creatorId == Guid.Empty ? null : creatorId, ct);
        return CreatedAtAction(nameof(GetRateConfig), new { id = result.Id }, result);
    }

    [HttpPut("rate-configs/{id:guid}")]
    public Task<PayrollRateConfigDto> UpdateRateConfig(
        Guid id, SavePayrollRateConfigRequest request, CancellationToken ct)
        => service.UpdateRateConfigAsync(id, request, ct);

    [HttpPost("rate-configs/{id:guid}/deactivate")]
    public Task<PayrollRateConfigDto> DeactivateRateConfig(
        Guid id, [FromBody] DeactivateParameterRequest? request, CancellationToken ct)
        => service.DeactivateRateConfigAsync(id, request ?? new DeactivateParameterRequest(), ct);

    // =========================================================================
    // 5. COMMISSION RULES
    // =========================================================================

    [HttpGet("commission-rules")]
    public Task<CommissionRuleDto[]> ListCommissionRules(
        [FromQuery] Guid? serviceId,
        [FromQuery] string? serviceCategory,
        [FromQuery] Guid? positionId,
        [FromQuery] string? role,
        [FromQuery] string? timeCondition,
        [FromQuery] string? status,
        [FromQuery] DateOnly? effectiveOn,
        [FromQuery] string? q,
        CancellationToken ct)
        => service.ListCommissionRulesAsync(new CommissionRuleFilter(
            serviceId, serviceCategory, positionId, role, timeCondition, status, effectiveOn, q), ct);

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

    [HttpPost("commission-rules/{id:guid}/deactivate")]
    public Task<CommissionRuleDto> DeactivateCommissionRule(
        Guid id, [FromBody] DeactivateParameterRequest? request, CancellationToken ct)
        => service.DeactivateCommissionRuleAsync(id, request ?? new DeactivateParameterRequest(), ct);

    [HttpGet("commission-matrix")]
    public Task<CommissionMatrixDto> GetCommissionMatrix(CancellationToken ct)
        => service.GetCommissionMatrixAsync(ct);

    // =========================================================================
    // 6. STAFF COMMISSION OVERRIDES
    // =========================================================================

    [HttpGet("commission-overrides")]
    public Task<StaffCommissionOverrideDto[]> ListStaffCommissionOverrides(
        [FromQuery] Guid? staffId,
        [FromQuery] Guid? serviceId,
        [FromQuery] string? serviceCategory,
        [FromQuery] string? role,
        [FromQuery] string? status,
        [FromQuery] DateOnly? effectiveOn,
        [FromQuery] string? q,
        CancellationToken ct)
        => service.ListStaffCommissionOverridesAsync(new StaffCommissionOverrideFilter(
            staffId, serviceId, serviceCategory, role, status, effectiveOn, q), ct);

    [HttpGet("commission-overrides/{id:guid}")]
    public Task<StaffCommissionOverrideDto> GetStaffCommissionOverride(Guid id, CancellationToken ct)
        => service.GetStaffCommissionOverrideAsync(id, ct);

    [HttpPost("commission-overrides")]
    public async Task<ActionResult<StaffCommissionOverrideDto>> CreateStaffCommissionOverride(
        SaveStaffCommissionOverrideRequest request, CancellationToken ct)
    {
        Guid.TryParse(User.FindFirstValue("sub"), out var creatorId);
        var result = await service.CreateStaffCommissionOverrideAsync(
            request, creatorId == Guid.Empty ? null : creatorId, ct);
        return CreatedAtAction(nameof(GetStaffCommissionOverride), new { id = result.Id }, result);
    }

    [HttpPut("commission-overrides/{id:guid}")]
    public Task<StaffCommissionOverrideDto> UpdateStaffCommissionOverride(
        Guid id, SaveStaffCommissionOverrideRequest request, CancellationToken ct)
        => service.UpdateStaffCommissionOverrideAsync(id, request, ct);

    [HttpPost("commission-overrides/{id:guid}/deactivate")]
    public Task<StaffCommissionOverrideDto> DeactivateStaffCommissionOverride(
        Guid id, [FromBody] DeactivateParameterRequest? request, CancellationToken ct)
        => service.DeactivateStaffCommissionOverrideAsync(id, request ?? new DeactivateParameterRequest(), ct);

    // =========================================================================
    // 7. DROPDOWNS & LOOKUPS
    // =========================================================================

    [HttpGet("procedure-services")]
    public Task<ProcedureServiceOptionDto[]> ListActiveProcedureServices(CancellationToken ct)
        => service.ListActiveProcedureServicesAsync(ct);

    [HttpGet("positions")]
    public Task<PositionOptionDto[]> ListPositions(CancellationToken ct)
        => service.ListPositionsAsync(ct);

    [HttpGet("sites")]
    public Task<SiteOptionDto[]> ListSites(CancellationToken ct)
        => service.ListSitesAsync(ct);
}
