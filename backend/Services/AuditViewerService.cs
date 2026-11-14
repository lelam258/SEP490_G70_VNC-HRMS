using System.Security.Claims;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Attendance;
using Vnc.HRMS.Models;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Services.Rules;

namespace Vnc.HRMS.Services;

public sealed class AuditViewerService(AppDbContext db, AttendanceAccess access)
{
    private async Task<(IQueryable<AuditLog> Logs, IQueryable<ScheduleChange> Changes)> Queries(ClaimsPrincipal user, AuditFilter filter, bool history, CancellationToken ct)
    {
        if (!history && !user.IsInRole("admin")) throw new AppException(403, "Chỉ Administrator được xem nhật ký hệ thống.");
        if (history && !new[] { "admin", "hr_manager", "hr_staff", "department_head", "accountant" }.Any(user.IsInRole))
            throw new AppException(403, "Bạn không có quyền xem lịch sử nghiệp vụ.");
        var logs = db.AuditLogs.AsNoTracking();
        var changes = db.ScheduleChanges.AsNoTracking().Where(x => !db.AuditLogs.Any(a => a.LogId == x.Id));
        if (history) logs = logs.Where(x => x.Module == "attendance" || x.Module == "on_call" || x.Module == "schedules"
            || x.EntityType == "AttendanceImport" || x.EntityType == "AttendanceRecord" || x.EntityType == "OnCallShift" || x.EntityType == "MonthlyTimesheet"
            || (x.EntityType == "PayrollLock" && (x.Action == "lock" || x.Action == "reopen" || x.Action == "confirm_attendance")));
        if (history && user.IsInRole("department_head")) {
            var staff = await access.StaffScope(user, ct, true);
            var actor = AttendanceAccess.Actor(user);
            var department = await db.Staff.AsNoTracking().Where(x => x.UserId == actor).Select(x => x.DepartmentId).SingleOrDefaultAsync(ct);
            logs = logs.Where(x => (department.HasValue && x.DepartmentId == department)
                || (x.DepartmentId == null && x.StaffId.HasValue && staff.Any(s => s.StaffId == x.StaffId)));
            changes = changes.Where(x => department.HasValue && db.ScheduleWeeks.Any(w => w.Id == x.WeekId && w.DepartmentId == department));
        }
        if (filter.From.HasValue) {
            var from = new DateTimeOffset(filter.From.Value.ToDateTime(TimeOnly.MinValue), TimeSpan.FromHours(7)).UtcDateTime;
            logs = logs.Where(x => x.CreatedAt >= from); changes = changes.Where(x => x.At >= from);
        }
        if (filter.To.HasValue) {
            if (filter.To.Value == DateOnly.MaxValue) throw new AppException(400, "Ngày kết thúc ngoài khoảng cho phép.");
            var to = new DateTimeOffset(filter.To.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.FromHours(7)).UtcDateTime;
            logs = logs.Where(x => x.CreatedAt < to); changes = changes.Where(x => x.At < to);
        }
        if (filter.From > filter.To) throw new AppException(400, "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
        if (!string.IsNullOrWhiteSpace(filter.Module)) {
            logs = logs.Where(x => x.Module == filter.Module);
            if (filter.Module != "schedules") changes = changes.Where(_ => false);
        }
        if (filter.UserId.HasValue) { logs = logs.Where(x => x.UserId == filter.UserId); changes = changes.Where(x => x.ActorId == filter.UserId); }
        if (!string.IsNullOrWhiteSpace(filter.Action)) {
            logs = logs.Where(x => x.Action == filter.Action);
            changes = filter.Action switch {
                "assign" => changes.Where(x => x.Detail.StartsWith("Tạo ")), "edit_assignment" => changes.Where(x => x.Detail.StartsWith("Sửa ")),
                "cancel_assignment" => changes.Where(x => x.Detail.StartsWith("Hủy ")), "publish_schedule" => changes.Where(x => x.Detail.StartsWith("HR Staff chốt")),
                "reopen_schedule" => changes.Where(x => x.Detail.StartsWith(ScheduleRules.ReopenAuditPrefix)), _ => changes.Where(_ => false)
            };
        }
        if (filter.FacilityId.HasValue) {
            var key = filter.FacilityId.Value.ToString(); logs = logs.Where(x => x.FacilityId == filter.FacilityId);
            changes = changes.Where(x => x.Detail.Contains(key));
        }
        if (filter.DepartmentId.HasValue) {
            logs = logs.Where(x => x.DepartmentId == filter.DepartmentId);
            changes = changes.Where(x => db.ScheduleWeeks.Any(w => w.Id == x.WeekId && w.DepartmentId == filter.DepartmentId));
        }
        if (filter.StaffId.HasValue) {
            var key = filter.StaffId.Value.ToString(); logs = logs.Where(x => x.StaffId == filter.StaffId);
            changes = changes.Where(x => x.Detail.Contains(key));
        }
        if (!string.IsNullOrEmpty(filter.Month)) {
            var (start, end) = AttendanceRules.Month(filter.Month);
            logs = logs.Where(x => x.WorkDate >= start && x.WorkDate <= end);
            changes = changes.Where(x => db.ScheduleWeeks.Any(w => w.Id == x.WeekId && w.Monday <= end && w.Monday >= start.AddDays(-6)));
        }
        return (logs, changes);
    }

    public async Task<object> List(ClaimsPrincipal user, AuditFilter filter, bool history, CancellationToken ct)
    {
        var (logs, changes) = await Queries(user, filter, history, ct);
        var total = await logs.CountAsync(ct) + await changes.CountAsync(ct);
        var pageSize = Math.Clamp(filter.PageSize, 1, 100);
        var page = Math.Clamp(filter.Page, 1, Math.Max(1, (total + pageSize - 1) / pageSize));
        var take = page * pageSize;
        var events = (await logs.OrderByDescending(x => x.CreatedAt).ThenBy(x => x.LogId).Take(take).ToArrayAsync(ct)).ToList();
        var legacy = await changes.OrderByDescending(x => x.At).ThenBy(x => x.Id).Take(take).ToArrayAsync(ct);
        if (legacy.Length > 0) {
            var weekIds = legacy.Select(x => x.WeekId).Distinct().ToArray();
            var weeks = await db.ScheduleWeeks.AsNoTracking().Where(x => weekIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
            events.AddRange(legacy.Select(x => Legacy(x, weeks[x.WeekId])));
        }
        var selected = events.OrderByDescending(x => x.CreatedAt).ThenBy(x => x.LogId).Skip((page - 1) * pageSize).Take(pageSize).ToArray();
        var actorIds = selected.Where(x => x.UserId.HasValue).Select(x => x.UserId!.Value).Distinct().ToArray();
        var actors = await db.Users.AsNoTracking().Where(x => actorIds.Contains(x.UserId)).ToDictionaryAsync(x => x.UserId, x => x.FullName ?? x.Username, ct);
        return new { total, page, pageSize, items = selected.Select(x => Display(x, actors, user, history)).ToArray() };
    }

    public async Task<object> Detail(ClaimsPrincipal user, Guid id, bool history, CancellationToken ct)
    {
        var (logs, changes) = await Queries(user, new AuditFilter(), history, ct);
        var entry = await logs.SingleOrDefaultAsync(x => x.LogId == id, ct);
        if (entry is null) {
            var change = await changes.SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw new AppException(404, "Sự kiện không tồn tại hoặc ngoài phạm vi được phép.");
            entry = Legacy(change, await db.ScheduleWeeks.AsNoTracking().SingleAsync(x => x.Id == change.WeekId, ct));
        }
        var actors = await db.Users.AsNoTracking().Where(x => x.UserId == entry.UserId).ToDictionaryAsync(x => x.UserId, x => x.FullName ?? x.Username, ct);
        return Display(entry, actors, user, history);
    }

    public async Task<object> Options(ClaimsPrincipal user, bool history, CancellationToken ct)
    {
        var (logs, changes) = await Queries(user, new AuditFilter(), history, ct);
        var ids = await logs.Where(x => x.UserId != null).Select(x => x.UserId!.Value).Concat(changes.Select(x => x.ActorId)).Distinct().ToArrayAsync(ct);
        return new {
            users = await db.Users.AsNoTracking().Where(x => ids.Contains(x.UserId)).Select(x => new { id = x.UserId, name = x.FullName ?? x.Username }).ToArrayAsync(ct),
            actions = (await logs.Select(x => x.Action).Distinct().ToArrayAsync(ct)).Concat(new[] { "assign", "edit_assignment", "cancel_assignment", "publish_schedule", "reopen_schedule" }).Distinct().Order().ToArray(),
            modules = history ? new[] { "attendance", "on_call", "schedules", "payroll" } : new[] { "accounts", "system", "attendance", "on_call", "schedules", "payroll" },
            facilities = await db.ScheduleFacilities.AsNoTracking().OrderBy(x => x.Name).Select(x => new { x.Id, x.Name }).ToArrayAsync(ct)
        };
    }

    public async Task<string> HistoryCsv(ClaimsPrincipal user, AuditFilter filter, CancellationToken ct)
    {
        if (!new[] { "admin", "hr_staff", "hr_manager", "accountant" }.Any(user.IsInRole)) throw new AppException(403, "Bạn không có quyền xuất lịch sử.");
        var (logs, changes) = await Queries(user, filter, true, ct);
        const int limit = 10_000;
        if (await logs.CountAsync(ct) + await changes.CountAsync(ct) > limit) throw new AppException(400, "Tối đa 10.000 sự kiện mỗi lần xuất. Thu hẹp bộ lọc.");
        var records = await logs.OrderByDescending(x => x.CreatedAt).ToArrayAsync(ct);
        var legacy = await changes.OrderByDescending(x => x.At).ToArrayAsync(ct);
        var weeks = await db.ScheduleWeeks.AsNoTracking().ToDictionaryAsync(x => x.Id, ct);
        return "Timestamp,Actor,Action,Record,Facility,Old status,New status\r\n" + string.Join("\r\n", records.Concat(legacy.Select(x => Legacy(x, weeks[x.WeekId])))
            .OrderByDescending(x => x.CreatedAt).Select(x => string.Join(",", new[] { x.CreatedAt?.ToString("O"), x.Username ?? x.UserId?.ToString(),
                x.Action, x.EntityId?.ToString(), x.FacilityId?.ToString(), Status(x.OldValue), Status(x.NewValue) }.Select(AttendanceRules.Csv))));
    }

    private static object Display(AuditLog entry, Dictionary<Guid, string> actors, ClaimsPrincipal user, bool history)
    {
        var sourceUrl = entry.EntityType switch {
            "AttendanceRecord" when !user.IsInRole("accountant") => $"/attendance/records/{entry.EntityId}",
            "OnCallShift" when !user.IsInRole("accountant") => $"/attendance/on-call/{entry.EntityId}",
            "AttendanceImport" when user.IsInRole("hr_staff") || user.IsInRole("hr_manager") || user.IsInRole("admin") => $"/attendance/imports/{entry.EntityId}/preview",
            "MonthlyTimesheet" => "/attendance/monthly" + (entry.WorkDate.HasValue ? $"?month={entry.WorkDate:yyyy-MM}" : ""),
            "ScheduleWeek" or "ScheduleAssignment" => "/schedules" + (entry.WorkDate.HasValue ? $"?date={entry.WorkDate:yyyy-MM-dd}" : ""),
            "User" when !history && user.IsInRole("admin") => $"/accounts/{entry.EntityId}", _ => null
        };
        return new { id = entry.LogId, entry.CreatedAt, entry.UserId, actor = entry.UserId.HasValue ? actors.GetValueOrDefault(entry.UserId.Value) ?? entry.Username : entry.Username,
            entry.Action, entry.Module, entry.EntityType, entry.EntityId, entry.FacilityId, entry.DepartmentId, entry.StaffId,
            entry.WorkDate, entry.Result, oldStatus = Status(entry.OldValue), newStatus = Status(entry.NewValue),
            oldValue = Mask(entry.OldValue), newValue = Mask(entry.NewValue), sourceUrl };
    }

    private static AuditLog Legacy(ScheduleChange change, ScheduleWeek week)
    {
        var action = change.Detail.StartsWith("Tạo ", StringComparison.Ordinal) ? "assign" : change.Detail.StartsWith("Sửa ", StringComparison.Ordinal) ? "edit_assignment"
            : change.Detail.StartsWith("Hủy ", StringComparison.Ordinal) ? "cancel_assignment"
            : change.Detail.StartsWith(ScheduleRules.ReopenAuditPrefix, StringComparison.Ordinal) ? "reopen_schedule"
            : change.Detail.StartsWith("HR Staff chốt", StringComparison.Ordinal) ? "publish_schedule" : "record_duty";
        return new AuditLog { LogId = change.Id, UserId = change.ActorId, CreatedAt = change.At, Action = action,
            Module = "schedules", EntityType = "ScheduleWeek", EntityId = week.Id, DepartmentId = week.DepartmentId, WorkDate = week.Monday,
            NewValue = JsonSerializer.Serialize(new { detail = change.Detail, status = action == "publish_schedule" ? "published" : action == "cancel_assignment" ? "cancelled" : "draft" }) };
    }
    private static string? Status(string? json)
    {
        if (json is null) return null;
        try {
            var element = JsonSerializer.Deserialize<JsonElement>(json);
            if (element.ValueKind != JsonValueKind.Object) return null;
            foreach (var property in element.EnumerateObject())
                if (property.Name.Equals("status", StringComparison.OrdinalIgnoreCase) || property.Name.Equals("validationStatus", StringComparison.OrdinalIgnoreCase)) return property.Value.ToString();
        } catch (JsonException) { }
        return null;
    }
    public static JsonNode? Mask(string? json)
    {
        if (json is null) return null;
        try { return Clean(JsonNode.Parse(json)); }
        catch (JsonException) { return JsonValue.Create(MaskText(json)); }
    }
    private static JsonNode? Clean(JsonNode? node)
    {
        if (node is JsonObject obj) {
            var output = new JsonObject();
            foreach (var pair in obj) {
                var key = AttendanceRules.Key(pair.Key);
                output[pair.Key] = new[] { "password", "hash", "token", "otp", "secret", "patient", "bank", "idcard", "email", "phone", "originalfile", "fileurl", "salary", "basepay", "grosspay", "netpay", "commission" }.Any(key.Contains)
                    ? JsonValue.Create("[Đã ẩn]") : Clean(pair.Value);
            }
            return output;
        }
        if (node is JsonArray array) return new JsonArray(array.Select(Clean).ToArray());
        if (node is JsonValue value && value.TryGetValue<string>(out var text)) return JsonValue.Create(MaskText(text));
        return node?.DeepClone();
    }
    private static string MaskText(string text)
    {
        var value = text.Length > 8000 ? text[..8000] + "…" : text;
        if (Regex.IsMatch(value, "password|token|otp|secret|signingkey|credential", RegexOptions.IgnoreCase)) return "[Nội dung nhạy cảm đã ẩn]";
        value = Regex.Replace(value, @"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}", "[Email đã ẩn]");
        value = Regex.Replace(value, @"(?i)(password|token|otp|secret)\s*[:=]\s*[^\s,;]+", "$1=[Đã ẩn]");
        return Regex.Replace(value, @"(?<!\d)\d{9,12}(?!\d)", "[Số cá nhân đã ẩn]");
    }
}
