using System.Data;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Attendance;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Services.Rules;

namespace Vnc.HRMS.Services;

public sealed class AttendanceDeviceMappingService(AppDbContext db, AttendanceAccess access,
    IHttpContextAccessor httpContextAccessor)
{
    private const string AuditAction = "map_attendance_device";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<AttendanceDeviceMappingList> List(ClaimsPrincipal user, CancellationToken ct)
    {
        if (!user.IsInRole("admin") && !user.IsInRole("hr_manager") && !user.IsInRole("hr_staff"))
            throw new AppException(403, "Bạn không có quyền xem liên kết mã máy chấm công.");
        var staff = await db.Staff.AsNoTracking().OrderBy(x => x.StaffCode).ToArrayAsync(ct);
        var departments = await db.Departments.AsNoTracking().ToDictionaryAsync(x => x.DepartmentId, ct);
        var revisions = await db.AuditLogs.AsNoTracking().Where(x => x.Action == AuditAction && x.StaffId != null)
            .GroupBy(x => x.StaffId!.Value).Select(x => new { Id = x.Key, Count = x.Count() })
            .ToDictionaryAsync(x => x.Id, x => x.Count, ct);
        return new(staff.Select(person => {
            var department = person.DepartmentId.HasValue ? departments.GetValueOrDefault(person.DepartmentId.Value) : null;
            return Item(person, department?.Name, department?.Status, revisions.GetValueOrDefault(person.StaffId));
        }).ToArray());
    }

    public async Task<AttendanceDeviceMappingResult> Save(ClaimsPrincipal user, Guid staffId,
        SaveAttendanceDeviceMappingRequest request, CancellationToken ct)
    {
        AttendanceAccess.RequireHrStaff(user);
        var actor = AttendanceAccess.Actor(user);
        var device = AttendanceRules.Text(request.DeviceEnrollId, "Mã máy chấm công", maximum: 50);
        if (device.Any(char.IsControl)) throw new AppException(400, "Mã máy chấm công không được chứa ký tự điều khiển.");
        var next = device.Length == 0 ? null : device;
        var reason = AttendanceRules.Text(request.Reason, "Căn cứ xác nhận liên kết", true);
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        // Lock the complete mapping namespace: differently padded IDs must not race into separate employees.
        var staff = await db.Staff.FromSqlRaw("SELECT * FROM [dbo].[staff] WITH (UPDLOCK, HOLDLOCK)").ToArrayAsync(ct);
        var person = staff.SingleOrDefault(x => x.StaffId == staffId)
            ?? throw new AppException(404, "Hãy chọn nhân viên tồn tại để xác nhận liên kết.");
        var department = person.DepartmentId.HasValue
            ? await db.Departments.AsNoTracking().SingleOrDefaultAsync(x => x.DepartmentId == person.DepartmentId, ct) : null;
        var revision = await db.AuditLogs.CountAsync(x => x.Action == AuditAction && x.StaffId == staffId, ct);
        var current = Item(person, department?.Name, department?.Status, revision);
        if (string.IsNullOrWhiteSpace(request.Version) || !string.Equals(current.Version, request.Version, StringComparison.Ordinal))
            throw new AppException(409, "Liên kết hoặc hồ sơ nhân viên đã thay đổi. Tải lại và xác nhận lại trước khi lưu.");
        // An inactive employee may release an old ID, but cannot receive a new mapping.
        if (next != null && (person.Status != "active" || department?.Status != "active"))
            throw new AppException(400, "Chỉ liên kết mã máy cho nhân viên đang hoạt động và thuộc khoa/phòng đang hoạt động.");
        if (next != null && staff.Any(x => x.StaffId != staffId && !string.IsNullOrWhiteSpace(x.DeviceEnrollId)
            && AttendanceRules.DeviceKey(x.DeviceEnrollId!) == AttendanceRules.DeviceKey(next)))
            throw new AppException(409, "Mã máy đã liên kết với nhân viên khác, kể cả hồ sơ ngừng hoạt động. Cần xác nhận xóa liên kết cũ trước khi chuyển mã.");
        if (string.Equals(person.DeviceEnrollId, next, StringComparison.Ordinal))
            throw new AppException(400, "Liên kết không thay đổi. Hãy kiểm tra nhân viên và mã máy đã chọn.");
        var before = new MappingSnapshot(person.StaffId, person.DepartmentId, person.DeviceEnrollId);
        person.DeviceEnrollId = next;
        person.UpdatedAt = access.Now.UtcDateTime;
        var after = new MappingChange(person.StaffId, person.DepartmentId, next, reason);
        var http = httpContextAccessor.HttpContext;
        db.AuditLogs.Add(new AuditLog {
            LogId = Guid.NewGuid(), UserId = actor, Username = Limit(user.FindFirstValue("name"), 50),
            Action = AuditAction, EntityType = "Staff", EntityId = staffId, StaffId = staffId,
            DepartmentId = person.DepartmentId, Module = "attendance", Result = "success",
            OldValue = JsonSerializer.Serialize(before, JsonOptions), NewValue = JsonSerializer.Serialize(after, JsonOptions),
            CreatedAt = access.Now.UtcDateTime, IpAddress = Limit(http?.Connection.RemoteIpAddress?.ToString(), 45),
            UserAgent = Limit(http?.Request.Headers.UserAgent.ToString(), 300)
        });
        await db.SaveChangesAsync(ct);
        // Reload the database timestamp precision before issuing the next review token.
        await db.Entry(person).ReloadAsync(ct);
        await tx.CommitAsync(ct);
        return new(Item(person, department?.Name, department?.Status, revision + 1), next == null
            ? "Đã xóa liên kết mã máy. Lịch sử và dữ liệu chấm công hiện có được giữ nguyên."
            : "Đã xác nhận liên kết mã máy. Tải lại kết quả nhập để kiểm tra các dòng của nhân viên.");
    }

    private static AttendanceDeviceMappingItem Item(Staff person, string? departmentName, string? departmentStatus, int revision)
        => new(person.StaffId, person.StaffCode, person.FullName, departmentName, person.DeviceEnrollId, person.Status,
            AttendanceRules.Version(new { person.StaffId, person.DeviceEnrollId, person.Status, person.DepartmentId,
                departmentStatus, person.UpdatedAt, revision }));

    private static string? Limit(string? value, int maximum) => value?.Length > maximum ? value[..maximum] : value;
    private sealed record MappingSnapshot(Guid StaffId, Guid? DepartmentId, string? DeviceEnrollId);
    private sealed record MappingChange(Guid StaffId, Guid? DepartmentId, string? DeviceEnrollId, string Reason);
}
