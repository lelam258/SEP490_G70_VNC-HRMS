using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Vnc.HRMS.Models;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Services;

public sealed class AuditLogHelper(
    AppDbContext db,
    IHttpContextAccessor httpContextAccessor) : IAuditLogHelper
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public void Log(string action, string entityType, Guid? entityId, object? oldValue, object? newValue)
    {
        var httpContext = httpContextAccessor.HttpContext;
        var user = httpContext?.User;

        Guid? userId = null;
        var sub = user?.FindFirst("sub")?.Value ?? user?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (Guid.TryParse(sub, out var parsedId))
        {
            userId = parsedId;
        }

        var username = user?.FindFirst("name")?.Value ?? user?.Identity?.Name ?? sub;
        var ipAddress = httpContext?.Connection?.RemoteIpAddress?.ToString();
        var userAgent = httpContext?.Request?.Headers?.UserAgent.ToString();

        if (username is { Length: > 50 })
        {
            username = username[..50];
        }

        if (action.Length > 100)
        {
            action = action[..100];
        }

        if (entityType.Length > 50)
        {
            entityType = entityType[..50];
        }

        if (ipAddress is { Length: > 45 })
        {
            ipAddress = ipAddress[..45];
        }

        if (userAgent is { Length: > 300 })
        {
            userAgent = userAgent[..300];
        }

        var log = new AuditLog
        {
            LogId = Guid.NewGuid(),
            UserId = userId,
            Username = username,
            Action = action.ToLowerInvariant(),
            EntityType = entityType,
            EntityId = entityId,
            OldValue = oldValue is not null ? JsonSerializer.Serialize(oldValue, JsonOptions) : null,
            NewValue = newValue is not null ? JsonSerializer.Serialize(newValue, JsonOptions) : null,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            CreatedAt = DateTime.UtcNow
        };

        log.Module = entityType switch {
            "User" or "Account" => "accounts", "AttendanceImport" or "AttendanceRecord" => "attendance",
            "OnCallShift" => "on_call", "ScheduleWeek" or "ScheduleAssignment" => "schedules",
            "PayrollLock" or "MonthlyTimesheet" => "payroll", _ => "system"
        };
        if (newValue is not null || oldValue is not null) {
            var snapshot = JsonSerializer.SerializeToElement(newValue ?? oldValue, JsonOptions);
            if (snapshot.ValueKind == JsonValueKind.Object) {
                Guid? Id(string key) => snapshot.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String
                    && Guid.TryParse(value.GetString(), out var id) ? id : null;
                log.FacilityId = Id("facilityId"); log.DepartmentId = Id("departmentId");
                log.StaffId = Id("staffId") ?? Id("employeeId");
                foreach (var key in new[] { "workDate", "shiftDate", "date", "payMonth" }) {
                    if (!snapshot.TryGetProperty(key, out var value) || value.ValueKind != JsonValueKind.String) continue;
                    var text = value.GetString();
                    if (text?.Length == 7) text += "-01";
                    if (DateOnly.TryParse(text, out var date)) { log.WorkDate = date; break; }
                }
            }
        }

        db.AuditLogs.Add(log);
    }
}
