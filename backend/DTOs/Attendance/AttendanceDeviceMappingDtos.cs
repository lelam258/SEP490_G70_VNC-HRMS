using System.ComponentModel.DataAnnotations;

namespace Vnc.HRMS.DTOs.Attendance;

public sealed record AttendanceDeviceMappingItem(Guid StaffId, string StaffCode, string StaffName,
    string? DepartmentName, string? DeviceEnrollId, string Status, string Version);

public sealed record AttendanceDeviceMappingList(AttendanceDeviceMappingItem[] Items);

public sealed record SaveAttendanceDeviceMappingRequest(
    [StringLength(50)] string? DeviceEnrollId,
    [Required, StringLength(1000)] string Reason,
    [Required] string Version);

public sealed record AttendanceDeviceMappingResult(AttendanceDeviceMappingItem Item, string Message);
