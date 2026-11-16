using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Cme;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Controllers;

[ApiController]
[Authorize(Policy = "SelfService")]
[Route("api/me/cme-records")]
public sealed class MyCmeRecordsController(
    ICmeRecordService cmeRecordService,
    ISelfServiceRepository selfServiceRepository,
    AppDbContext db
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

    [HttpGet("cycles")]
    public async Task<ActionResult<CertificateCycleDto[]>> ListMyCycles(CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        var staff = await selfServiceRepository.FindStaffByUserIdAsync(userId, ct);
        if (staff is null)
        {
            return Ok(Array.Empty<CertificateCycleDto>());
        }

        var cycles = await cmeRecordService.ListCertificateCyclesByStaffAsync(staff.StaffId, ct);
        return Ok(cycles);
    }

    [HttpGet]
    public async Task<ActionResult<CmeRecordDto[]>> ListMyRecords(
        [FromQuery] Guid? certificateId,
        CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        var staff = await selfServiceRepository.FindStaffByUserIdAsync(userId, ct);
        if (staff is null)
        {
            return Ok(Array.Empty<CmeRecordDto>());
        }

        if (certificateId.HasValue)
        {
            var cert = await db.Certificates.AsNoTracking()
                .SingleOrDefaultAsync(c => c.CertificateId == certificateId.Value, ct);
            if (cert == null || cert.StaffId != staff.StaffId)
            {
                throw new AppException(403, "Bạn không có quyền truy cập chứng chỉ này.");
            }

            var records = await cmeRecordService.ListByCertificateIdAsync(certificateId.Value, ct);
            return Ok(records);
        }

        var allRecords = await cmeRecordService.ListByStaffIdAsync(staff.StaffId, ct);
        return Ok(allRecords);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<CmeRecordDto>> GetMyRecord(Guid id, CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        var staff = await selfServiceRepository.FindStaffByUserIdAsync(userId, ct);
        if (staff is null)
        {
            throw new AppException(400, "Tài khoản hiện tại chưa được liên kết với hồ sơ nhân viên.");
        }

        var record = await cmeRecordService.GetAsync(id, ct);
        if (record.StaffId != staff.StaffId)
        {
            throw new AppException(403, "Bạn không có quyền truy cập bản ghi CME này.");
        }

        return Ok(record);
    }

    [HttpPost]
    public async Task<ActionResult<CmeRecordDto>> CreateMyRecord(
        [FromBody] SaveCmeRecordRequest request,
        CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        var staff = await selfServiceRepository.FindStaffByUserIdAsync(userId, ct);
        if (staff is null)
        {
            throw new AppException(400, "Tài khoản hiện tại chưa được liên kết với hồ sơ nhân viên.");
        }

        var cert = await db.Certificates.AsNoTracking()
            .SingleOrDefaultAsync(c => c.CertificateId == request.CertificateId, ct);
        if (cert == null || cert.StaffId != staff.StaffId)
        {
            throw new AppException(403, "Bạn không có quyền nộp CME cho chứng chỉ này.");
        }

        // Staff submissions are always pending (Verified = false)
        var staffRequest = request with { Verified = false };
        var created = await cmeRecordService.CreateAsync(staffRequest, userId, ct);
        return CreatedAtAction(nameof(GetMyRecord), new { id = created.CmeId }, created);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteMyRecord(Guid id, CancellationToken ct)
    {
        var userId = GetCurrentUserId();
        var staff = await selfServiceRepository.FindStaffByUserIdAsync(userId, ct);
        if (staff is null)
        {
            throw new AppException(400, "Tài khoản hiện tại chưa được liên kết với hồ sơ nhân viên.");
        }

        var record = await cmeRecordService.GetAsync(id, ct);
        if (record.StaffId != staff.StaffId)
        {
            throw new AppException(403, "Bạn không có quyền thao tác trên bản ghi CME này.");
        }

        if (record.Verified)
        {
            throw new AppException(400, "Bản ghi CME đã được phòng Nhân sự phê duyệt, bạn không thể tự ý xóa. Vui lòng liên hệ HR.");
        }

        await cmeRecordService.DeleteAsync(id, ct);
        return NoContent();
    }
}
