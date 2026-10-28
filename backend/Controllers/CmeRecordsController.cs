using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.DTOs.Cme;
using Vnc.HRMS.Security;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController, Authorize(Roles = $"{AccountRoles.HrManager},{AccountRoles.Administrator}"), Route("api/cme-records")]
public sealed class CmeRecordsController(ICmeRecordService cmeRecords) : ControllerBase
{
    [HttpGet("employees")]
    public Task<StaffCmeSummaryDto[]> ListStaffSummaries(CancellationToken ct) =>
        cmeRecords.ListStaffSummariesAsync(ct);

    [HttpGet("employee/{staffId:guid}/cycles")]
    public Task<CertificateCycleDto[]> ListCertificateCyclesByStaff(Guid staffId, CancellationToken ct) =>
        cmeRecords.ListCertificateCyclesByStaffAsync(staffId, ct);

    [HttpPut("certificate/{certificateId:guid}/cycle-dates")]
    public Task<CertificateCycleDto> UpdateCycleDates(
        Guid certificateId,
        [FromBody] UpdateCmeCycleDatesRequest request,
        CancellationToken ct) =>
        cmeRecords.UpdateCycleDatesAsync(certificateId, request, ct);

    [HttpPost("certificate/{certificateId:guid}/new-cycle")]
    public Task<CertificateCycleDto> CreateNewCycle(
        Guid certificateId,
        [FromBody] CreateNewCmeCycleRequest? request,
        CancellationToken ct) =>
        cmeRecords.CreateNewCycleAsync(certificateId, request, ct);

    [HttpPost("certificate/{certificateId:guid}/complete-cycle")]
    public Task<CertificateCycleDto> CompleteCycle(
        Guid certificateId,
        [FromQuery] Guid? cycleId,
        CancellationToken ct) =>
        cmeRecords.CompleteCycleAsync(certificateId, cycleId, ct);

    [HttpGet("employee/{staffId:guid}")]
    public Task<CmeRecordDto[]> ListByStaff(Guid staffId, CancellationToken ct) =>
        cmeRecords.ListByStaffIdAsync(staffId, ct);

    [HttpGet("certificate/{certificateId:guid}")]
    public Task<CmeRecordDto[]> ListByCertificate(Guid certificateId, CancellationToken ct) =>
        cmeRecords.ListByCertificateIdAsync(certificateId, ct);

    [HttpGet("{id:guid}")]
    public Task<CmeRecordDto> Get(Guid id, CancellationToken ct) =>
        cmeRecords.GetAsync(id, ct);

    [HttpPost]
    public async Task<ActionResult<CmeRecordDto>> Create([FromBody] SaveCmeRecordRequest request, CancellationToken ct)
    {
        Guid? currentUserId = Guid.TryParse(User.FindFirstValue("sub"), out var uid) ? uid : null;
        var created = await cmeRecords.CreateAsync(request, currentUserId, ct);
        return CreatedAtAction(nameof(Get), new { id = created.CmeId }, created);
    }

    [HttpPut("{id:guid}")]
    public Task<CmeRecordDto> Update(Guid id, [FromBody] UpdateCmeRecordRequest request, CancellationToken ct)
    {
        Guid? currentUserId = Guid.TryParse(User.FindFirstValue("sub"), out var uid) ? uid : null;
        return cmeRecords.UpdateAsync(id, request, currentUserId, ct);
    }

    [HttpPatch("{id:guid}/verify")]
    public Task<CmeRecordDto> Verify(Guid id, [FromBody] VerifyCmeRecordRequest request, CancellationToken ct)
    {
        Guid? currentUserId = Guid.TryParse(User.FindFirstValue("sub"), out var uid) ? uid : null;
        return cmeRecords.VerifyAsync(id, request.Verified, currentUserId, ct);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await cmeRecords.DeleteAsync(id, ct);
        return NoContent();
    }
}
