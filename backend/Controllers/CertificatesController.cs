using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.DTOs.Certificates;
using Vnc.HRMS.Security;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController, Authorize(Roles = $"{AccountRoles.HrManager},{AccountRoles.Administrator}"), Route("api/certificates")]
public sealed class CertificatesController(ICertificateService certificates) : ControllerBase
{
    [HttpGet("employees")]
    public Task<StaffCertificateSummaryDto[]> ListStaffSummaries(CancellationToken ct) =>
        certificates.ListStaffSummariesAsync(ct);

    [HttpGet("employee/{staffId:guid}")]
    public Task<CertificateDto[]> ListByStaff(Guid staffId, CancellationToken ct) =>
        certificates.ListByStaffIdAsync(staffId, ct);

    [HttpGet("{id:guid}")]
    public Task<CertificateDto> Get(Guid id, CancellationToken ct) =>
        certificates.GetAsync(id, ct);

    [HttpPost]
    public async Task<ActionResult<CertificateDto>> Create([FromBody] SaveCertificateRequest request, CancellationToken ct)
    {
        Guid? currentUserId = Guid.TryParse(User.FindFirstValue("sub"), out var uid) ? uid : null;
        var created = await certificates.CreateAsync(request, currentUserId, ct);
        return CreatedAtAction(nameof(Get), new { id = created.CertificateId }, created);
    }

    [HttpPut("{id:guid}")]
    public Task<CertificateDto> Update(Guid id, [FromBody] UpdateCertificateRequest request, CancellationToken ct) =>
        certificates.UpdateAsync(id, request, ct);

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await certificates.DeleteAsync(id, ct);
        return NoContent();
    }
}
