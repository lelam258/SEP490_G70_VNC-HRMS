using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Certificates;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Security;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController]
[Authorize(Policy = "SelfService")]
[Route("api/me/certificates")]
public sealed class MyCertificatesController(
    ICertificateService certificateService,
    ISelfServiceRepository selfServiceRepository
) : ControllerBase
{
    private Guid GetCurrentUserId()
    {
        var sub = User.FindFirst("sub")?.Value ?? User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(sub, out var userId))
        {
            throw new AppException(401, "Chưa xác thực người dùng.");
        }
        return userId;
    }

    [HttpGet]
    public async Task<ActionResult<CertificateDto[]>> ListMyCertificates(CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        var staff = await selfServiceRepository.FindStaffByUserIdAsync(userId, ct);
        if (staff is null)
        {
            return Ok(Array.Empty<CertificateDto>());
        }

        var list = await certificateService.ListByStaffIdAsync(staff.StaffId, includeInactiveDegrees: true, ct);
        return Ok(list);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CertificateDto>> GetMyCertificate(Guid id, CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        var staff = await selfServiceRepository.FindStaffByUserIdAsync(userId, ct);
        if (staff is null)
        {
            throw new AppException(400, "Tài khoản hiện tại chưa được liên kết với hồ sơ nhân viên.");
        }

        var cert = await certificateService.GetAsync(id, includeInactiveDegrees: true, ct);
        if (cert.StaffId != staff.StaffId)
        {
            throw new AppException(403, "Bạn không có quyền truy cập chứng chỉ này.");
        }

        return Ok(cert);
    }

    [HttpPost]
    public async Task<ActionResult<CertificateDto>> SubmitMyCertificate([FromBody] SaveCertificateRequest request, CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        var staff = await selfServiceRepository.FindStaffByUserIdAsync(userId, ct);
        if (staff is null)
        {
            throw new AppException(400, "Tài khoản hiện tại chưa được liên kết với hồ sơ nhân viên.");
        }

        var isDegree = string.Equals(request.Category, "degree", StringComparison.OrdinalIgnoreCase);

        var safeRequest = request with
        {
            StaffId = staff.StaffId,
            DepartmentId = staff.DepartmentId,
            VerificationStatus = "unverified",
            Status = isDegree ? "unverified" : "pending"
        };

        var created = await certificateService.CreateAsync(safeRequest, userId, ct);
        return CreatedAtAction(nameof(GetMyCertificate), new { id = created.CertificateId }, created);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> RevokeMyCertificate(Guid id, CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        var staff = await selfServiceRepository.FindStaffByUserIdAsync(userId, ct);
        if (staff is null)
        {
            throw new AppException(400, "Tài khoản hiện tại chưa được liên kết với hồ sơ nhân viên.");
        }

        var cert = await certificateService.GetAsync(id, includeInactiveDegrees: true, ct);
        if (cert.StaffId != staff.StaffId)
        {
            throw new AppException(403, "Bạn không có quyền thu hồi chứng chỉ này.");
        }

        var isUnverified = string.Equals(cert.VerificationStatus, "unverified", StringComparison.OrdinalIgnoreCase) ||
                           string.Equals(cert.Status, "pending", StringComparison.OrdinalIgnoreCase) ||
                           string.Equals(cert.Status, "unverified", StringComparison.OrdinalIgnoreCase) ||
                           string.Equals(cert.Status, "rejected", StringComparison.OrdinalIgnoreCase) ||
                           string.Equals(cert.VerificationStatus, "rejected", StringComparison.OrdinalIgnoreCase);

        if (!isUnverified)
        {
            throw new AppException(400, "Chứng chỉ này đã được phòng Nhân sự thẩm định và xác nhận, không thể tự ý thu hồi.");
        }

        await certificateService.DeleteAsync(id, ct);
        return NoContent();
    }

    [HttpPatch("{id:guid}/primary")]
    [Authorize(Roles = AccountRoles.MedicalStaff + "," + AccountRoles.DepartmentManager)]
    public async Task<ActionResult<CertificateDto>> SetMyDegreePrimary(
        Guid id,
        [FromBody] UpdateDegreePrimaryRequest request,
        CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        var staff = await selfServiceRepository.FindStaffByUserIdAsync(userId, ct);
        if (staff is null)
        {
            throw new AppException(400, "Tài khoản hiện tại chưa được liên kết với hồ sơ nhân viên.");
        }

        var updated = await certificateService.SetDegreePrimaryAsync(id, staff.StaffId, request.IsPrimary, ct);
        return Ok(updated);
    }

    [HttpPatch("{id:guid}/active")]
    [Authorize(Roles = AccountRoles.MedicalStaff + "," + AccountRoles.DepartmentManager)]
    public async Task<ActionResult<CertificateDto>> SetMyDegreeActive(
        Guid id,
        [FromBody] UpdateDegreeActiveRequest request,
        CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        var staff = await selfServiceRepository.FindStaffByUserIdAsync(userId, ct);
        if (staff is null)
        {
            throw new AppException(400, "Tài khoản hiện tại chưa được liên kết với hồ sơ nhân viên.");
        }

        var updated = await certificateService.SetDegreeActiveAsync(id, staff.StaffId, request.IsActive, ct);
        return Ok(updated);
    }
}
