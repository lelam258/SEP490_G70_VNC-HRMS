using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Vnc.HRMS.DTOs.Attendance;
using Vnc.HRMS.Services;

namespace Vnc.HRMS.Controllers;

[ApiController, Authorize, Route("api/attendance/device-mappings")]
public sealed class AttendanceDeviceMappingsController(AttendanceDeviceMappingService mappings) : ControllerBase
{
    [HttpGet, Authorize(Roles = "admin,hr_manager,hr_staff")]
    public Task<AttendanceDeviceMappingList> List(CancellationToken ct) => mappings.List(User, ct);

    [HttpPost("{staffId:guid}"), Authorize(Roles = "hr_staff")]
    public Task<AttendanceDeviceMappingResult> Save(Guid staffId, SaveAttendanceDeviceMappingRequest request, CancellationToken ct)
        => mappings.Save(User, staffId, request, ct);
}
