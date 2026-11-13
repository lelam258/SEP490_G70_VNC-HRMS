using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Attendance;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Models.Users;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Services;

internal static class DeviceMappingRegression
{
    public static async Task Run(DbContextOptions<AppDbContext> options, Guid hrId, Guid adminId,
        Guid departmentId, Action<bool, string> check, CancellationToken ct)
    {
        var first = Guid.NewGuid(); var second = Guid.NewGuid();
        var firstUser = Guid.NewGuid(); var secondUser = Guid.NewGuid();
        ClaimsPrincipal Actor(Guid id, string role) => new(new ClaimsIdentity([new("sub", id.ToString()), new(ClaimTypes.Role, role)], "test"));
        var hr = Actor(hrId, "hr_staff"); var admin = Actor(adminId, "admin");
        async Task<T> Call<T>(Func<AttendanceDeviceMappingService, Task<T>> operation) {
            await using var db = new AppDbContext(options);
            return await operation(new(db, new(db), new HttpContextAccessor { HttpContext = new DefaultHttpContext { User = hr } }));
        }
        async Task<AttendanceDeviceMappingItem> Item(Guid id) => (await Call(x => x.List(hr, ct))).Items.Single(x => x.StaffId == id);
        async Task Reject(Func<Task> operation, int expected, string label) {
            try { await operation(); }
            catch (AppException error) when (error.StatusCode == expected) { check(true, label); return; }
            throw new Exception("Expected mapping rejection: " + label);
        }
        await using (var db = new AppDbContext(options)) {
            if (!db.Database.GetDbConnection().Database.StartsWith("VNC_Attendance_Test_", StringComparison.Ordinal))
                throw new InvalidOperationException("Mapping regression requires the owned disposable test database.");
            db.Users.AddRange(new User { UserId = firstUser, Username = firstUser.ToString("N"), NormalizedUsername = firstUser.ToString("N").ToUpperInvariant(), Role = "employee" },
                new User { UserId = secondUser, Username = secondUser.ToString("N"), NormalizedUsername = secondUser.ToString("N").ToUpperInvariant(), Role = "employee" });
            await db.SaveChangesAsync(ct);
            db.Staff.AddRange(new Staff { StaffId = first, UserId = firstUser, StaffCode = "MAP" + first.ToString("N")[..10], FullName = "Mapping test A", DepartmentId = departmentId, DateJoined = new(2020, 1, 1) },
                new Staff { StaffId = second, UserId = secondUser, StaffCode = "MAP" + second.ToString("N")[..10], FullName = "Mapping test B", DepartmentId = departmentId, DateJoined = new(2020, 1, 1) });
            await db.SaveChangesAsync(ct);
        }
        try {
            var initial = await Item(first);
            check(initial.DeviceEnrollId is null, "Reading profiles never guesses or creates device identity mappings");
            await Reject(() => Call(x => x.Save(admin, first, new("00987", "Checked source", initial.Version), ct)), 403, "Administrator cannot perform HR device mapping through the write service");
            await Reject(() => Call(x => x.List(Actor(hrId, "employee"), ct)), 403, "Employee cannot enumerate device mappings");
            await Reject(() => Call(x => x.Save(hr, first, new("00987", " ", initial.Version), ct)), 400, "Device mapping requires an evidence reason");
            var mapped = await Call(x => x.Save(hr, first, new(" 00987 ", "Verified enrollment sheet", initial.Version), ct));
            check(mapped.Item.DeviceEnrollId == "00987", "Explicit HR assignment preserves the reviewed device identifier");
            await Reject(() => Call(x => x.Save(hr, first, new("988", "Old tab", initial.Version), ct)), 409, "Device mapping rejects stale review versions");
            var other = await Item(second);
            await Reject(() => Call(x => x.Save(hr, second, new("987", "Same numeric identity", other.Version), ct)), 409, "Padded and unpadded device IDs cannot belong to separate staff");
            var cleared = await Call(x => x.Save(hr, first, new(null, "Release enrollment", mapped.Item.Version), ct));
            check(cleared.Item.DeviceEnrollId is null, "HR can explicitly release a mapped enrollment without deleting staff");
            var reassigned = await Call(x => x.Save(hr, first, new("00987", "Verified again", cleared.Item.Version), ct));
            await Reject(() => Call(x => x.Save(hr, first, new("988", "Older same value", mapped.Item.Version), ct)), 409, "Mapping audit revisions prevent stale versions after a clear-and-restore cycle");
            await using (var db = new AppDbContext(options)) { (await db.Staff.FindAsync(first))!.Status = "inactive"; await db.SaveChangesAsync(ct); }
            var inactive = await Item(first);
            await Reject(() => Call(x => x.Save(hr, first, new("988", "Inactive profile", inactive.Version), ct)), 400, "Inactive staff cannot receive a device assignment");
            await Call(x => x.Save(hr, first, new(null, "Release inactive enrollment", inactive.Version), ct));
            var currentOther = await Item(second);
            var moved = await Call(x => x.Save(hr, second, new("987", "Reviewed transfer", currentOther.Version), ct));
            check(moved.Item.DeviceEnrollId == "987", "A reviewed release allows another active employee to acquire the enrollment");
            await using var auditDb = new AppDbContext(options);
            check(await auditDb.AuditLogs.CountAsync(x => x.StaffId == first && x.Action == "map_attendance_device" && x.Module == "attendance" && x.UserId == hrId) == 4,
                "Every mapping change retains typed before/after evidence and the HR actor");
        }
        finally {
            await using var db = new AppDbContext(options);
            await db.AuditLogs.Where(x => x.StaffId == first || x.StaffId == second).ExecuteDeleteAsync(ct);
            await db.Staff.Where(x => x.StaffId == first || x.StaffId == second).ExecuteDeleteAsync(ct);
            await db.Users.Where(x => x.UserId == firstUser || x.UserId == secondUser).ExecuteDeleteAsync(ct);
        }
    }
}
