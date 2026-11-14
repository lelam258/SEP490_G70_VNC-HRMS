using System.IO.Compression;
using System.Diagnostics;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Sockets;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Xml.Linq;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.IdentityModel.Tokens;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.Controllers;
using Vnc.HRMS.DTOs.Attendance;
using Vnc.HRMS.DTOs.Users;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Auth;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Models.Organization;
using Vnc.HRMS.Models.Users;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Repositories;
using Vnc.HRMS.Services;
using Vnc.HRMS.Services.Rules;

if (args.Length == 3 && args[0] == "--review-workbook") { AttendanceWorkbookReview.Run(args[1], args[2]); return; }

var checks = 0;
void Check(bool condition, string label) { if (!condition) throw new Exception(label); checks++; Console.WriteLine("PASS " + label); }
async Task Reject(Func<Task> operation, int status, string label) {
    try { await operation(); } catch (AppException error) when (error.StatusCode == status) { Check(true, label); return; }
    throw new Exception("Expected rejection: " + label);
}
var jsonOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);
JsonElement Json(object value) => JsonSerializer.SerializeToElement(value, jsonOptions);
static string Column(int index) { var result = ""; for (var n = index + 1; n > 0; n = (n - 1) / 26) result = (char)('A' + (n - 1) % 26) + result; return result; }
static byte[] Workbook(object?[][] cells) {
    using var stream = new MemoryStream();
    using (var archive = new ZipArchive(stream, ZipArchiveMode.Create, true)) {
        void Write(string name, string content) { using var output = new StreamWriter(archive.CreateEntry(name).Open(), new UTF8Encoding(false)); output.Write(content); }
        Write("[Content_Types].xml", "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/><Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/></Types>");
        Write("_rels/.rels", "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
        Write("xl/workbook.xml", "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><sheets><sheet name=\"Bảng công Nhân viên Nguyễn A\" sheetId=\"1\" r:id=\"rId1\"/></sheets></workbook>");
        Write("xl/_rels/workbook.xml.rels", "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/></Relationships>");
        Write("xl/styles.xml", "<styleSheet xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\"><numFmts count=\"2\"><numFmt numFmtId=\"164\" formatCode=\"yyyy-mm-dd hh:mm:ss\"/><numFmt numFmtId=\"165\" formatCode=\"[h]:mm:ss\"/></numFmts><cellXfs count=\"3\"><xf numFmtId=\"0\"/><xf numFmtId=\"164\" applyNumberFormat=\"1\"/><xf numFmtId=\"165\" applyNumberFormat=\"1\"/></cellXfs></styleSheet>");
        XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        XElement Cell(object? value, int row, int col) {
            var cell = new XElement(ns + "c", new XAttribute("r", Column(col) + (row + 1)));
            if (value is DateTime date) { cell.Add(new XAttribute("s", 1), new XElement(ns + "v", date.ToOADate().ToString("R", System.Globalization.CultureInfo.InvariantCulture))); }
            else if (value is TimeSpan time) { cell.Add(new XAttribute("s", 2), new XElement(ns + "v", time.TotalDays.ToString("R", System.Globalization.CultureInfo.InvariantCulture))); }
            else if (value is double or int or decimal) { cell.Add(new XElement(ns + "v", Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture))); }
            else { cell.Add(new XAttribute("t", "inlineStr"), new XElement(ns + "is", new XElement(ns + "t", Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture) ?? ""))); }
            return cell;
        }
        Write("xl/worksheets/sheet1.xml", new XElement(ns + "worksheet", new XElement(ns + "sheetData", cells.Select((row, r) =>
            new XElement(ns + "row", new XAttribute("r", r + 1), row.Select((cell, c) => Cell(cell, r, c)))))).ToString());
    }
    return stream.ToArray();
}
static byte[] BinaryWorkbook(object?[][] cells) {
    static byte[] Record(ushort id, Action<BinaryWriter> payload) {
        using var data = new MemoryStream(); using (var writer = new BinaryWriter(data, Encoding.Unicode, true)) payload(writer);
        using var result = new MemoryStream(); using var output = new BinaryWriter(result); output.Write(id); output.Write((ushort)data.Length); output.Write(data.ToArray()); return result.ToArray();
    }
    static byte[] Bof(ushort type) => Record(0x0809, writer => { writer.Write((ushort)0x0600); writer.Write(type); writer.Write((ushort)0x0DBB); writer.Write((ushort)0x07CC); writer.Write(0x41u); writer.Write(0x06u); });
    var strings = cells.SelectMany(row => row).Select(value => Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture) ?? "").Distinct().ToArray();
    var indices = strings.Select((value, index) => (value, index)).ToDictionary(x => x.value, x => x.index);
    var sst = Record(0x00FC, writer => { writer.Write((uint)cells.Sum(row => row.Length)); writer.Write((uint)strings.Length); foreach (var text in strings) { writer.Write((ushort)text.Length); writer.Write((byte)1); writer.Write(Encoding.Unicode.GetBytes(text)); } });
    var bof = Bof(0x0005); var codepage = Record(0x0042, writer => writer.Write((ushort)1200)); var eof = Record(0x000A, _ => {});
    const string sheet = "Attendance";
    var offset = bof.Length + codepage.Length + sst.Length + (4 + 8 + sheet.Length * 2) + eof.Length;
    var bounds = Record(0x0085, writer => { writer.Write((uint)offset); writer.Write((byte)0); writer.Write((byte)0); writer.Write((byte)sheet.Length); writer.Write((byte)1); writer.Write(Encoding.Unicode.GetBytes(sheet)); });
    using var stream = new MemoryStream();
    foreach (var part in new[] { bof, codepage, sst, bounds, eof, Bof(0x0010) }) stream.Write(part);
    stream.Write(Record(0x0200, writer => { writer.Write(0u); writer.Write((uint)cells.Length); writer.Write((ushort)0); writer.Write((ushort)cells.Max(row => row.Length)); writer.Write((ushort)0); }));
    for (var row = 0; row < cells.Length; row++) for (var col = 0; col < cells[row].Length; col++) {
        var text = Convert.ToString(cells[row][col], System.Globalization.CultureInfo.InvariantCulture) ?? "";
        stream.Write(Record(0x00FD, writer => { writer.Write((ushort)row); writer.Write((ushort)col); writer.Write((ushort)0); writer.Write((uint)indices[text]); }));
    }
    stream.Write(eof); return stream.ToArray();
}

object?[][] sourceRows = [
    ["BÁO CÁO CHẤM CÔNG", "Tổng giờ đầu bảng 9999 không phải công đã xác nhận"],
    ["Mã nhân viên: 0001", "Họ tên: Nguyễn A"],
    ["Ngày", "Vào 1", "Ra 1", "Vào 2", "Ra 2", "Vào 3", "Ra 3", "Giờ công", "Đi muộn", "Về sớm", "Ký hiệu"],
    ["02/11/2026", "07:00", "11:30", "13:30", "17:00", "", "", "8", "0", "0", "X"],
    ["03/11/2026", "07:00", "", "", "", "", "", "", "0", "0", "X"],
    ["04/11/2026", "11:30", "07:00"],
    ["02/11/2026", "07:00", "11:30", "13:30", "17:00"],
    ["31/10/2026", "07:00", "11:30"],
    ["ngày sai", "07:00", "11:30"],
    ["05/11/2026", "07:00", "11:30", "13:30", "17:00", "", "", "6"],
    ["06/11/2026", "07:00", "09:00", "09:15", "11:30", "13:30", "17:00", "7.75"],
    ["07/11/2026", "07:00", "11:30"],
    ["Mã nhân viên: 999", "Họ tên không được đoán để ánh xạ"],
    ["02/11/2026", "07:00", "11:30"],
    ["Mã nhân viên: 0002"],
    ["02/11/2026", "07:00", "11:30"],
];
var bytes = Workbook(sourceRows);
var parser = new AttendanceWorkbookParser();
var parsed = parser.Parse(bytes, "2026-11");
Check(parsed.Length == 11 && parsed[0].DeviceEnrollId == "0001", "Real XLSX parser reads repeating employee blocks and skips report totals");
var binary = parser.Parse(BinaryWorkbook(sourceRows), "2026-11");
Check(binary.Length == parsed.Length && binary[0].DeviceEnrollId == "0001", "Binary XLS reader preserves the same employee blocks and work-date rows");
Check(JsonSerializer.Deserialize<AttendanceTimePair[]>(parsed.Single(x => x.WorkDate == new DateOnly(2026, 11, 6)).TimePairsJson)!.Length == 3, "Parser retains all three Vào/Ra pairs");
Check(parsed.Any(x => x.WorkDate is null && x.RawDate == "ngày sai"), "Malformed source dates remain visible as row errors");
var numeric = AttendanceWorkbookParser.ParseGrid([["Employee ID", "Date", "In 1", "Out 1"], ["1", 2d, 7d / 24, 11.5d / 24]], "Numeric", "2026-11");
Check(numeric.Length == 1 && numeric[0].WorkDate == new DateOnly(2026, 11, 2), "Parser supports flat employee columns, day numbers and Excel numeric times");
Check(AttendanceRules.DeviceKey("0001") == AttendanceRules.DeviceKey("1"), "Numeric device identifiers normalize without guessing employee names");
await Reject(() => { parser.Parse([1, 2, 3], "2026-11"); return Task.CompletedTask; }, 400, "Corrupt Excel is rejected");
await Reject(() => { parser.Parse(bytes, "2026-11", "{bad"); return Task.CompletedTask; }, 400, "Invalid custom column mapping is rejected");
await Reject(() => { AttendanceRules.Hours([new(new(2026, 11, 2, 8, 0, 0), new(2026, 11, 2, 12, 0, 0)), new(new(2026, 11, 2, 11, 30, 0), new(2026, 11, 2, 17, 0, 0))], new(2026, 11, 2)); return Task.CompletedTask; }, 400, "Overlapping raw time pairs are rejected");
Check(AttendanceRules.Csv("=HYPERLINK(\"bad\")").StartsWith("\"'="), "CSV exports neutralize spreadsheet formulas");
var masked = AuditViewerService.Mask("{\"passwordHash\":\"secret-hash\",\"nested\":[{\"token\":\"secret-token\",\"email\":\"a@example.com\"}],\"role\":\"employee\"}")!.ToJsonString();
Check(!masked.Contains("secret-hash") && !masked.Contains("secret-token") && !masked.Contains("a@example.com") && masked.Contains("employee"), "Audit masking recursively hides credentials and personal contact data");
ImportParserRegression.Run(Check);
var typedWorkbook = parser.Parse(Workbook([["Employee ID", "Date", "In", "Out", "Hours", "Late", "Early"],
    ["1", new DateTime(2026, 11, 2), new DateTime(1899, 12, 30, 7, 0, 0), 11.5d / 24, TimeSpan.FromHours(4.5), TimeSpan.FromMinutes(30), new DateTime(1899, 12, 30, 0, 15, 0)]]), "2026-11");
Check(typedWorkbook[0].ReportedHours == 4.5m && typedWorkbook[0].LateMinutes == 30m && typedWorkbook[0].EarlyMinutes == 15m
    && AttendanceRules.Hours(JsonSerializer.Deserialize<AttendanceTimePair[]>(typedWorkbook[0].TimePairsJson)!, new(2026, 11, 2)) == 4.5m,
    "Real XLSX number formats preserve Excel dates, clock fractions and duration quantities");
if (args.Contains("--parser-only")) { Console.WriteLine($"Passed {checks} parser/rule checks."); return; }

const string prefix = "VNC_Attendance_Test_";
var databaseName = prefix + Guid.NewGuid().ToString("N");
var connection = new SqlConnectionStringBuilder { DataSource = "localhost", InitialCatalog = databaseName, IntegratedSecurity = true, TrustServerCertificate = true, ConnectTimeout = 10 }.ConnectionString;
var options = new DbContextOptionsBuilder<AppDbContext>().UseSqlServer(connection).Options;
var created = false;
var adminId = Guid.NewGuid(); var hrId = Guid.NewGuid(); var managerId = Guid.NewGuid(); var headId = Guid.NewGuid(); var accountantId = Guid.NewGuid();
var user1 = Guid.NewGuid(); var user2 = Guid.NewGuid(); var user3 = Guid.NewGuid();
var staff1 = Guid.NewGuid(); var staff2 = Guid.NewGuid(); var staff3 = Guid.NewGuid(); var headStaff = Guid.NewGuid();
var department1 = Guid.NewGuid(); var department2 = Guid.NewGuid(); var facility1 = Guid.NewGuid(); var facility2 = Guid.NewGuid();
var monday = new DateOnly(2026, 11, 2);
var clock = new TestClock { Now = new(2026, 11, 8, 20, 0, 0, TimeSpan.FromHours(7)) };
var ct = CancellationToken.None;
ClaimsPrincipal Principal(Guid actor, string role) => new(new ClaimsIdentity([new Claim("sub", actor.ToString()), new Claim(ClaimTypes.Role, role), new Claim("name", "test." + role)], "test"));
var hr = Principal(hrId, "hr_staff"); var admin = Principal(adminId, "admin"); var employee = Principal(user1, "employee");
var head = Principal(headId, "department_head"); var manager = Principal(managerId, "hr_manager"); var accountant = Principal(accountantId, "accountant");
async Task<T> Run<T>(ClaimsPrincipal principal, Func<AppDbContext, AttendanceImportService, AttendanceRecordService, OnCallService, AuditViewerService, Task<T>> action) {
    await using var db = new AppDbContext(options);
    var access = new AttendanceAccess(db, clock);
    var audit = new AuditLogHelper(db, new HttpContextAccessor { HttpContext = new DefaultHttpContext { User = principal } });
    var imports = new AttendanceImportService(db, access, parser, audit);
    return await action(db, imports, new AttendanceRecordService(db, access, imports, audit), new OnCallService(db, access, imports, audit), new AuditViewerService(db, access));
}
async Task<object> Import(Func<AttendanceImportService, Task<object>> action, ClaimsPrincipal? principal = null)
    => await Run(principal ?? hr, (_, service, _, _, _) => action(service));
async Task<object> Duty(Func<OnCallService, Task<object>> action, ClaimsPrincipal? principal = null)
    => await Run(principal ?? hr, (_, _, _, service, _) => action(service));
async Task<JsonElement> Preview(Guid id) => Json(await Import(service => service.Preview(id, null, null, 1, 100, ct)));
async Task Execute(Func<AppDbContext, Task> action) { await using var db = new AppDbContext(options); await action(db); }
async Task<T> Read<T>(Func<AppDbContext, Task<T>> action) { await using var db = new AppDbContext(options); return await action(db); }

try {
    await using (var db = new AppDbContext(options)) {
        created = await db.Database.EnsureCreatedAsync();
        if (!created) throw new Exception("Refusing to use an existing database.");
        var legacyAuditId = Guid.NewGuid();
        db.AuditLogs.Add(new AuditLog { LogId = legacyAuditId, Action = "create_account", EntityType = "User", NewValue = "{\"status\":\"active\",\"passwordHash\":\"legacy-secret\"}" });
        await db.SaveChangesAsync();
        await db.Database.OpenConnectionAsync();
        try {
            await db.Database.ExecuteSqlRawAsync("CREATE TABLE [dbo].[__EFMigrationsHistory] ([MigrationId] nvarchar(150) NOT NULL PRIMARY KEY, [ProductVersion] nvarchar(32) NOT NULL)");
            var migrator = db.GetService<IMigrator>();
            foreach (var script in new[] {
                migrator.GenerateScript("20261108085710_AttendanceAndAccountWorkflows", "20261108081158_ScheduleSpecificationCompliance"),
                migrator.GenerateScript("20261108081158_ScheduleSpecificationCompliance", "20261108085710_AttendanceAndAccountWorkflows") })
                foreach (var batch in System.Text.RegularExpressions.Regex.Split(script, @"(?m)^\s*GO\s*$"))
                    if (!string.IsNullOrWhiteSpace(batch)) { await using var command = db.Database.GetDbConnection().CreateCommand(); command.CommandText = batch; await command.ExecuteNonQueryAsync(); }
            db.ChangeTracker.Clear();
            Check(await db.AuditLogs.Where(x => x.LogId == legacyAuditId).Select(x => x.Module).SingleAsync() == "accounts",
                "Migration upgrades the previous schema, preserves existing audit rows and classifies their modules");
        } finally { await db.Database.CloseConnectionAsync(); }
        foreach (var pair in new[] { (adminId, "admin"), (hrId, "hr_staff"), (managerId, "hr_manager"), (headId, "department_head"), (accountantId, "accountant"), (user1, "employee"), (user2, "employee"), (user3, "employee") })
            db.Users.Add(new User { UserId = pair.Item1, Username = pair.Item1.ToString("N"), NormalizedUsername = pair.Item1.ToString("N").ToUpperInvariant(), Role = pair.Item2, IsProvisioned = true });
        db.Departments.AddRange(new Department { DepartmentId = department1, DeptCode = "AT1", Name = "Khoa 1" }, new Department { DepartmentId = department2, DeptCode = "AT2", Name = "Khoa 2" });
        db.Staff.AddRange(new Staff { StaffId = staff1, UserId = user1, StaffCode = "AT001", FullName = "Nguyễn A", DeviceEnrollId = "1", DepartmentId = department1, DateJoined = new(2020, 1, 1) },
            new Staff { StaffId = staff2, UserId = user2, StaffCode = "AT002", FullName = "Trần B", DeviceEnrollId = "2", DepartmentId = department2, DateJoined = new(2020, 1, 1) },
            new Staff { StaffId = staff3, UserId = user3, StaffCode = "AT003", FullName = "Lê C", DeviceEnrollId = "0002", DepartmentId = department2, DateJoined = new(2020, 1, 1) },
            new Staff { StaffId = headStaff, UserId = headId, StaffCode = "ATH01", FullName = "Trưởng khoa 1", DeviceEnrollId = "100", DepartmentId = department1, DateJoined = new(2020, 1, 1) });
        db.ScheduleFacilities.AddRange(new ScheduleFacility { Id = facility1, Name = "Cơ sở 1" }, new ScheduleFacility { Id = facility2, Name = "Cơ sở 2" });
        var coverage = new ScheduleCoverage { Id = Guid.NewGuid(), FacilityId = facility1, DepartmentId = department1, Name = "Khoa 1" };
        var week = new ScheduleWeek { Id = Guid.NewGuid(), DepartmentId = department1, Monday = monday, Published = true };
        db.ScheduleCoverage.Add(coverage); db.ScheduleWeeks.Add(week);
        for (var day = 0; day < 7; day++) foreach (var shift in new[] { "morning", "afternoon", "noon", "evening" })
            db.ScheduleAssignments.Add(new ScheduleAssignment { Id = Guid.NewGuid(), WeekId = week.Id, StaffId = staff1, CoverageId = coverage.Id, Date = monday.AddDays(day), Shift = shift, Reason = "Fixture" });
        db.LeaveRequests.Add(new LeaveRequest { RequestId = Guid.NewGuid(), StaffId = staff1, DepartmentId = department1, LeaveType = "annual", StartDate = monday.AddDays(5), EndDate = monday.AddDays(5), Status = "approved" });
        db.AttendanceRecords.Add(new AttendanceRecord { AttendanceId = Guid.NewGuid(), StaffId = staff2, StaffCode = "AT002", DepartmentId = department2, FacilityId = facility2,
            WorkDate = monday, ShiftType = "main", Source = "manual", ValidationStatus = "confirmed", ConfirmedBy = hrId, ConfirmedAt = clock.Now.UtcDateTime, CheckIn = monday.ToDateTime(new(7, 0)), CheckOut = monday.ToDateTime(new(17, 0)), ActualHours = 8 });
        await db.SaveChangesAsync();
    }

    await Reject(async () => { await Import(service => service.Stage(employee, "test.xlsx", bytes, facility1, "2026-11", null, null, ct), employee); }, 403, "Employee cannot stage attendance imports");
    await Reject(async () => { await Import(service => service.Stage(hr, "test.exe", bytes, facility1, "2026-11", null, null, ct)); }, 400, "File extension restrictions are enforced on the server");
    var inspectionBytes = Workbook(ImportParserRegression.DeviceExportLayout());
    var historicalAnalysis = Json(await Import(service => service.Analyze(hr, "inspect.xlsx", inspectionBytes, facility1, "2026-08", null, null, "auto", null, null, 1, 20, ct)));
    Check(historicalAnalysis.GetProperty("lockedReason").GetString() is { Length: > 0 } && !historicalAnalysis.GetProperty("canStage").GetBoolean()
        && historicalAnalysis.GetProperty("counts").GetProperty("warning").GetInt32() == 2 && historicalAnalysis.GetProperty("counts").GetProperty("error").GetInt32() == 2,
        "Locked-month file analysis preserves time-quality warnings and errors without staging");
    Check(await Read(db => db.AttendanceImports.CountAsync()) == 0 && await Read(db => db.AttendanceImportRows.CountAsync()) == 0,
        "Read-only workbook inspection never creates an import batch or staging rows");
    var monthSuggestion = Json(await Import(service => service.Analyze(hr, "inspect.xlsx", inspectionBytes, facility1, "2026-11", null, null, "auto", null, null, 1, 20, ct)));
    Check(monthSuggestion.GetProperty("suggestedMonth").GetString() == "2026-08" && !monthSuggestion.GetProperty("canStage").GetBoolean(),
        "Inspection detects the actual work-date month and prevents staging against an accidental default month");
    var filteredAnalysis = Json(await Import(service => service.Analyze(hr, "inspect.xlsx", inspectionBytes, facility1, "2026-08", null, null, "auto", "error", null, 1, 1, ct)));
    Check(filteredAnalysis.GetProperty("total").GetInt32() == 2 && filteredAnalysis.GetProperty("items").GetArrayLength() == 1,
        "Read-only file analysis filters and paginates independently from lock status");
    var unresolvedFile = Workbook([["Employee ID", "Date", "In", "Out", "Hours"],
        ["0777", "2026-11-02", "07:00", "11:00", 4], ["777", "2026-11-03", "07:00", "11:00", 4]]);
    var unresolvedAnalysis = Json(await Import(service => service.Analyze(hr, "unmapped.xlsx", unresolvedFile, facility1, "2026-11", null, null, "auto", null, null, 1, 20, ct)));
    Check(unresolvedAnalysis.GetProperty("employeeCodes").GetInt32() == 1
        && unresolvedAnalysis.GetProperty("identity").GetProperty("unresolvedCodes").GetInt32() == 1
        && unresolvedAnalysis.GetProperty("identity").GetProperty("unresolvedRows").GetInt32() == 2,
        "Repeated unmapped identities are grouped into one action rather than independent daily errors");
    Check(unresolvedAnalysis.GetProperty("sourceTimeQuality").GetProperty("completeRows").GetInt32() == 2
        && unresolvedAnalysis.GetProperty("otherErrorRows").GetInt32() == 0
        && unresolvedAnalysis.GetProperty("items")[0].GetProperty("sourceHours").GetDecimal() == 4m
        && unresolvedAnalysis.GetProperty("items")[0].GetProperty("staffId").ValueKind == JsonValueKind.Null,
        "Time-source diagnostics remain visible without inventing or approving an employee identity");
    Check(historicalAnalysis.GetProperty("sourceTimeQuality").GetProperty("completeRows").GetInt32() == 2
        && historicalAnalysis.GetProperty("sourceTimeQuality").GetProperty("missingTimeRows").GetInt32() == 1
        && historicalAnalysis.GetProperty("sourceTimeQuality").GetProperty("noPunchRows").GetInt32() == 1,
        "Source-quality categories explain missing and empty punches separately from identity and period locks");
    var staged = Json(await Import(service => service.Stage(hr, "machine.xlsx", bytes, facility1, "2026-11", "Máy số 1", null, ct)));
    var batchId = staged.GetProperty("id").GetGuid();
    Check(await Read(db => db.AttendanceRecords.CountAsync(x => x.StaffId == staff1)) == 0, "Staging never writes attendance or payable data");
    var repeated = Json(await Import(service => service.Stage(hr, "machine.xlsx", bytes, facility1, "2026-11", null, null, ct)));
    Check(repeated.GetProperty("reused").GetBoolean() && repeated.GetProperty("id").GetGuid() == batchId, "Identical file/facility/month uploads reuse the staged batch");
    var preview = await Preview(batchId);
    var duplicateRows = preview.GetProperty("items").EnumerateArray().Where(x => x.GetProperty("workDate").GetString() == "2026-11-02"
        && x.GetProperty("staffId").ValueKind != JsonValueKind.Null && x.GetProperty("staffId").GetGuid() == staff1).ToArray();
    Check(duplicateRows.Length == 2 && duplicateRows.All(x => x.GetProperty("validationStatus").GetString() == "duplicate"), "All conflicting source rows remain unresolved instead of automatically accepting the first row");
    var extraRow = duplicateRows.Single(x => x.GetProperty("rowNumber").GetInt32() == 7);
    var extraRowId = extraRow.GetProperty("id").GetGuid(); var extraVersion = extraRow.GetProperty("version").GetString()!;
    await Reject(async () => { await Import(service => service.Exclude(hr, batchId, extraRowId, new(" ", extraVersion), ct)); }, 400, "Excluding a source row requires an explicit reason");
    await Reject(async () => { await Import(service => service.Exclude(employee, batchId, extraRowId, new("Not allowed", extraVersion), ct), employee); }, 403, "Employees cannot exclude import rows");
    await Import(service => service.Exclude(hr, batchId, extraRowId, new("Dòng lặp trong báo cáo gốc, giữ dòng 4", extraVersion), ct));
    await Reject(async () => { await Import(service => service.Exclude(hr, batchId, extraRowId, new("Old view", extraVersion), ct)); }, 409, "Excluding a source row requires its latest version");
    preview = await Preview(batchId);
    Check(preview.GetProperty("counts").GetProperty("excluded").GetInt32() == 1 && preview.GetProperty("items").EnumerateArray()
        .Single(x => x.GetProperty("id").GetGuid() == duplicateRows.Single(x => x.GetProperty("rowNumber").GetInt32() == 4).GetProperty("id").GetGuid()).GetProperty("validationStatus").GetString() == "valid",
        "Excluding a duplicate preserves it and revalidates the remaining original row");
    Check(preview.GetProperty("counts").GetProperty("valid").GetInt32() == 2 && preview.GetProperty("counts").GetProperty("warning").GetInt32() == 1, "Preview separates valid rows and reported-hour discrepancies");
    var issues = preview.GetProperty("items").EnumerateArray().Select(x => x.GetProperty("errorCode").GetString()).ToArray();
    foreach (var code in new[] { "invalid_time", "cross_month", "malformed_date", "leave_conflict", "unknown_device", "ambiguous_device" }) Check(issues.Contains(code), "Preview retains " + code + " with corrective guidance");
    var source = await Run(hr, async (_, service, _, _, _) => await service.Source(batchId, ct));
    Check(source.Bytes.SequenceEqual(bytes), "The original source workbook is preserved byte-for-byte");
    var csv = await Run(hr, async (_, service, _, _, _) => await service.ErrorCsv(batchId, ct));
    Check(!csv.Contains("Nguyễn") && !csv.Contains("999") && !csv.Contains("0001") && csv.Contains("Sheet 1"), "Error export omits employee blocks, identifiers and identifying sheet names");

    var changedCoverage = Guid.NewGuid();
    var reviewedVersion = preview.GetProperty("version").GetString()!;
    await Execute(async db => {
        db.ScheduleCoverage.Add(new ScheduleCoverage { Id = changedCoverage, FacilityId = facility2, DepartmentId = department1, Name = "Khoa 1 - Cơ sở 2" });
        (await db.ScheduleAssignments.SingleAsync(x => x.StaffId == staff1 && x.Date == monday && x.Shift == "morning")).CoverageId = changedCoverage;
        await db.SaveChangesAsync();
    });
    var updatedPreview = await Preview(batchId);
    Check(updatedPreview.GetProperty("items").EnumerateArray().Single(x => x.GetProperty("rowNumber").GetInt32() == 4).GetProperty("errorCode").GetString() == "facility_conflict",
        "Preview matches the facility for the actual working shift rather than any shift on the same date");
    Check(await Read(db => db.AttendanceImportRows.Where(x => x.ImportId == batchId && x.RowNumber == 4).Select(x => x.ValidationStatus).SingleAsync()) == "valid",
        "Refreshing live validation does not rewrite staged source evidence");
    await Reject(async () => { await Import(service => service.Commit(hr, batchId, reviewedVersion, false, ct)); }, 409, "A roster change after review requires a new preview before commit");
    Check(await Read(db => db.AttendanceRecords.CountAsync(x => x.StaffId == staff1)) == 0, "A changed-preview rejection rolls back the entire attendance commit");
    Check((await Run(hr, async (_, service, _, _, _) => await service.ErrorCsv(batchId, ct))).Contains("facility_conflict"), "Error exports use current validation results");
    await Execute(async db => {
        var morning = await db.ScheduleAssignments.SingleAsync(x => x.StaffId == staff1 && x.Date == monday && x.Shift == "morning");
        morning.CoverageId = await db.ScheduleCoverage.Where(x => x.FacilityId == facility1 && x.DepartmentId == department1).Select(x => x.Id).SingleAsync(); await db.SaveChangesAsync();
    });
    preview = await Preview(batchId);

    var identityBatch = Json(await Import(service => service.Stage(hr, "identity-change.xlsx", Workbook([["Employee ID", "Date", "In", "Out"], ["100", "2026-11-04", "07:00", "11:30"]]), facility1, "2026-11", null, null, ct))).GetProperty("id").GetGuid();
    var identityPreview = await Preview(identityBatch);
    await Execute(async db => { (await db.Staff.FindAsync(headStaff))!.DeviceEnrollId = null; (await db.Staff.FindAsync(staff2))!.DeviceEnrollId = "100"; await db.SaveChangesAsync(); });
    var remappedPreview = await Preview(identityBatch);
    Check(identityPreview.GetProperty("items")[0].GetProperty("validationStatus").GetString() == "warning"
        && remappedPreview.GetProperty("items")[0].GetProperty("validationStatus").GetString() == "warning"
        && remappedPreview.GetProperty("items")[0].GetProperty("staffId").GetGuid() == staff2,
        "Preview refreshes changed device identities even when the validation status stays the same");
    await Reject(async () => { await Import(service => service.Commit(hr, identityBatch, identityPreview.GetProperty("version").GetString()!, true, ct)); }, 409,
        "A changed employee mapping cannot be committed using an older review with the same status");
    await Execute(async db => { (await db.Staff.FindAsync(headStaff))!.DeviceEnrollId = "100"; (await db.Staff.FindAsync(staff2))!.DeviceEnrollId = "2"; await db.SaveChangesAsync(); });
    identityPreview = await Preview(identityBatch);
    var identityRow = identityPreview.GetProperty("items")[0];
    await Import(service => service.Exclude(hr, identityBatch, identityRow.GetProperty("id").GetGuid(), new("Chờ đối chiếu bản nguồn", identityRow.GetProperty("version").GetString()!), ct));
    var excludedPreview = await Preview(identityBatch);
    Check(excludedPreview.GetProperty("batch").GetProperty("status").GetString() == "excluded", "An entirely excluded batch is not presented as successfully imported");
    await Import(service => service.Correct(hr, identityBatch, identityRow.GetProperty("id").GetGuid(), new(headStaff, new(2026, 11, 4), "main", [new("07:00", "11:30")], "Đã đối chiếu, khôi phục dòng nguồn", excludedPreview.GetProperty("items")[0].GetProperty("version").GetString()!), ct));
    Check((await Preview(identityBatch)).GetProperty("counts").GetProperty("excluded").GetInt32() == 0,
        "An excluded row can be restored only through an evidenced correction and full revalidation");
    var wrongShiftBatch = Json(await Import(service => service.Stage(hr, "wrong-shift.xlsx", Workbook([["Employee ID", "Date", "Shift", "In", "Out"], ["1", "2026-11-04", "noon", "07:00", "11:30"]]), facility1, "2026-11", null, null, ct))).GetProperty("id").GetGuid();
    var wrongShiftPreview = await Preview(wrongShiftBatch);
    Check(wrongShiftPreview.GetProperty("items")[0].GetProperty("errorCode").GetString() == "shift_conflict"
        && wrongShiftPreview.GetProperty("counts").GetProperty("valid").GetInt32() == 0,
        "Morning punches classified as noon duty cannot be automatically accepted as valid");

    var committed = Json(await Import(service => service.Commit(hr, batchId, preview.GetProperty("version").GetString()!, false, ct)));
    Check(committed.GetProperty("created").GetInt32() == 2, "Commit saves only valid rows by default");
    Check(await Read(db => db.AttendanceRecords.Where(x => x.StaffId == staff1).AllAsync(x => x.ValidationStatus == "imported" && x.ConfirmedBy == null)), "Imported rows remain unconfirmed and excluded from verified workdays");
    await Reject(async () => { await Import(service => service.Commit(hr, batchId, preview.GetProperty("version").GetString()!, false, ct)); }, 409, "Stale import preview cannot be committed twice");
    Check(await Read(db => db.AttendanceRecords.CountAsync(x => x.StaffId == staff1)) == 2, "Repeated commit cannot duplicate attendance records");
    var savedRow = (await Preview(batchId)).GetProperty("items").EnumerateArray().First(x => x.GetProperty("attendanceId").ValueKind != JsonValueKind.Null);
    await Reject(async () => { await Import(service => service.Exclude(hr, batchId, savedRow.GetProperty("id").GetGuid(), new("Already committed", savedRow.GetProperty("version").GetString()!), ct)); }, 409, "Exclusion cannot remove already committed attendance");
    preview = await Preview(batchId);
    var missing = preview.GetProperty("items").EnumerateArray().Single(x => x.GetProperty("workDate").GetString() == "2026-11-03");
    var rowId = missing.GetProperty("id").GetGuid(); var rowVersion = missing.GetProperty("version").GetString()!;
    var correction = new CorrectImportRowRequest(staff1, monday.AddDays(1), "main", [new("07:00", "11:30"), new("13:30", "17:00")], "Đối chiếu phiếu chấm công gốc", rowVersion);
    await Reject(async () => { await Import(service => service.Correct(hr, batchId, rowId, correction with { Reason = " " }, ct)); }, 400, "Import corrections require an evidence reason");
    await Import(service => service.Correct(hr, batchId, rowId, correction, ct));
    await Reject(async () => { await Import(service => service.Correct(hr, batchId, rowId, correction, ct)); }, 409, "Concurrent row corrections require a fresh version");
    var originalRow = await Read(db => db.AttendanceImportRows.AsNoTracking().SingleAsync(x => x.Id == rowId));
    Check(originalRow.RawValuesJson.Contains("07:00") && originalRow.CorrectedBy == hrId && originalRow.CorrectionReason != null, "Correction retains original values, actor, timestamp and reason");
    preview = await Preview(batchId);
    await Import(service => service.Commit(hr, batchId, preview.GetProperty("version").GetString()!, true, ct));
    Check(await Read(db => db.AttendanceRecords.AnyAsync(x => x.StaffId == staff1 && x.WorkDate == monday.AddDays(3) && x.ValidationStatus == "flagged")), "Explicit warning commit creates flagged unconfirmed attendance");
    Check(await Read(db => db.AttendanceRecords.AnyAsync(x => x.StaffId == staff1 && x.WorkDate == monday.AddDays(1) && x.Source == "manual")), "Corrected source rows are labeled as manual evidence");

    var alternateFile = Workbook([["Mã nhân viên: 1"], ["Ngày", "Vào", "Ra"], ["2026-11-04", "07:00", "11:30"]]);
    var crossSiteBatch = Json(await Import(service => service.Stage(hr, "other-site.xlsx", alternateFile, facility2, "2026-11", null, null, ct)));
    var crossSitePreview = await Preview(crossSiteBatch.GetProperty("id").GetGuid());
    Check(crossSitePreview.GetProperty("items")[0].GetProperty("errorCode").GetString() == "facility_conflict", "Machine imports flag attendance at a facility outside the published roster");
    await Execute(async db => { (await db.ScheduleFacilities.FindAsync(facility2))!.Status = "inactive"; await db.SaveChangesAsync(); });
    await Reject(async () => { await Import(service => service.Stage(hr, "inactive.xlsx", bytes, facility2, "2026-11", null, null, ct)); }, 400, "Inactive facilities cannot receive uploaded attendance batches");
    await Execute(async db => { (await db.ScheduleFacilities.FindAsync(facility2))!.Status = "active"; await db.SaveChangesAsync(); });

    var novemberClock = clock.Now;
    try {
        clock.Now = new(2026, 8, 31, 22, 0, 0, TimeSpan.FromHours(7));
        var deviceWorkbook = Workbook(ImportParserRegression.DeviceExportLayout());
        var deviceBatch = Json(await Import(service => service.Stage(hr, "device-layout.xlsx", deviceWorkbook, facility1, "2026-08", "Máy thử", null, ct))).GetProperty("id").GetGuid();
        var devicePreview = await Preview(deviceBatch);
        Check(devicePreview.GetProperty("total").GetInt32() == 4 && devicePreview.GetProperty("counts").GetProperty("valid").GetInt32() == 0
            && devicePreview.GetProperty("counts").GetProperty("warning").GetInt32() == 2 && devicePreview.GetProperty("counts").GetProperty("error").GetInt32() == 2,
            "The supplied machine layout stages complete repeated punches as warnings and missing/empty punches as errors");
        var repeatedPunch = devicePreview.GetProperty("items").EnumerateArray().Single(x => x.GetProperty("workDate").GetString() == "2026-08-01");
        Check(repeatedPunch.GetProperty("pairs").GetArrayLength() == 3 && repeatedPunch.GetProperty("actualHours").GetDecimal() == 10m
            && repeatedPunch.GetProperty("reportedHours").GetDecimal() == 24m && repeatedPunch.GetProperty("errorCode").GetString() == "repeated_time_pairs",
            "Preview preserves all machine pairs and reported totals while counting repeated elapsed hours only once");
        var noWarnings = Json(await Import(service => service.Commit(hr, deviceBatch, devicePreview.GetProperty("version").GetString()!, false, ct)));
        Check(noWarnings.GetProperty("created").GetInt32() == 0, "Repeated machine punches are never committed by the default valid-only action");
        devicePreview = await Preview(deviceBatch);
        var acceptedWarnings = Json(await Import(service => service.Commit(hr, deviceBatch, devicePreview.GetProperty("version").GetString()!, true, ct)));
        Check(acceptedWarnings.GetProperty("created").GetInt32() == 2 && await Read(db => db.AttendanceRecords.Where(x => x.ImportId == deviceBatch)
            .AllAsync(x => x.ValidationStatus == "flagged" && x.ConfirmedAt == null && x.ActualHours == 10m)),
            "Explicitly accepted machine warnings remain flagged, unconfirmed and do not multiply work hours");
        var retainedSource = await Run(hr, async (_, service, _, _, _) => await service.Source(deviceBatch, ct));
        Check(retainedSource.Bytes.SequenceEqual(deviceWorkbook), "Normalizing repeated-hour calculations never rewrites the source workbook");
        var explicitBatch = Json(await Import(service => service.Stage(hr, "device-layout.xlsx", deviceWorkbook, facility1, "2026-08", "Máy thử", null, ct, "mdy")));
        var explicitAgain = Json(await Import(service => service.Stage(hr, "device-layout.xlsx", deviceWorkbook, facility1, "2026-08", "Máy thử", null, ct, "MDY")));
        Check(explicitBatch.GetProperty("id").GetGuid() != deviceBatch && explicitAgain.GetProperty("reused").GetBoolean()
            && explicitBatch.GetProperty("id").GetGuid() == explicitAgain.GetProperty("id").GetGuid(),
            "Date-order configuration is retained and participates in canonical file-import idempotence");
        Check((await Preview(explicitBatch.GetProperty("id").GetGuid())).GetProperty("batch").GetProperty("dateOrder").GetString() == "mdy",
            "Preview reports the explicitly chosen machine date order");
        await Reject(async () => { await Import(service => service.Stage(hr, "device-layout.xlsx", deviceWorkbook, facility1, "2026-08", null, null, ct, "guess")); }, 400,
            "The import API service rejects unsupported date-order values");
    } finally { clock.Now = novemberClock; }

    await Execute(async db => {
        db.AttendanceRecords.Add(new AttendanceRecord { AttendanceId = Guid.NewGuid(), StaffId = staff1, StaffCode = "AT001", DepartmentId = department2,
            FacilityId = facility2, WorkDate = new(2026, 11, 1), ShiftType = "main", Source = "manual", ValidationStatus = "confirmed" });
        db.OnCallShifts.Add(new OnCallShift { ShiftId = Guid.NewGuid(), StaffId = staff1, DepartmentId = department2, FacilityId = facility2,
            ShiftDate = new(2026, 11, 1), ShiftCategory = "noon", ShiftStart = new(2026, 11, 1, 11, 30, 0), ShiftEnd = new(2026, 11, 1, 13, 30, 0), RecordedBy = hrId, Status = "confirmed" });
        db.AuditLogs.Add(new AuditLog { LogId = Guid.NewGuid(), UserId = hrId, Action = "create_on_call", Module = "on_call", EntityType = "OnCallShift",
            DepartmentId = department2, StaffId = staff1, WorkDate = new(2026, 11, 1), NewValue = "{\"status\":\"confirmed\"}" });
        await db.SaveChangesAsync();
    });
    var employeeRows = Json(await Run(employee, (_, _, service, _, _) => service.List(employee, new AttendanceFilter { Month = "2026-11" }, ct)));
    Check(employeeRows.GetProperty("items").EnumerateArray().All(x => x.GetProperty("staffId").GetGuid() == staff1), "Employees only see their own attendance records");
    var headRows = Json(await Run(head, (_, _, service, _, _) => service.List(head, new AttendanceFilter { Month = "2026-11" }, ct)));
    Check(headRows.GetProperty("items").EnumerateArray().All(x => x.GetProperty("departmentId").GetGuid() == department1), "Department managers only see attendance within their department");
    var headDuties = Json(await Duty(service => service.List(head, new AttendanceFilter { Month = "2026-11" }, ct), head));
    Check(headDuties.GetProperty("items").GetArrayLength() == 0, "A staff transfer does not expose historical duties from another department");
    var otherRecord = await Read(db => db.AttendanceRecords.Where(x => x.StaffId == staff2).Select(x => x.AttendanceId).SingleAsync());
    await Reject(async () => { await Run(employee, (_, _, service, _, _) => service.Detail(employee, otherRecord, ct)); }, 403, "Knowing another employee's attendance ID does not grant access");
    var ownRecord = await Read(db => db.AttendanceRecords.Where(x => x.StaffId == staff1 && x.WorkDate == monday.AddDays(4)).Select(x => x.AttendanceId).SingleAsync());
    var ownDetail = Json(await Run(employee, (_, _, service, _, _) => service.Detail(employee, ownRecord, ct)));
    Check(ownDetail.GetProperty("pairs").GetArrayLength() == 3 && ownDetail.GetProperty("batch").GetProperty("fileName").GetString() == "machine.xlsx", "Attendance details expose full punch pairs and source batch information");

    SaveOnCallRequest DutyInput(string category = "noon", string start = "11:30", string end = "13:30") => new(staff1, facility1, monday.AddDays(4), category, start, end, "Theo phiếu trực", null, null, ownRecord, null);
    await Reject(async () => { await Duty(service => service.Save(manager, null, DutyInput(), ct), manager); }, 403, "HR Manager cannot create on-call duty through the write service");
    await Reject(async () => { await Duty(service => service.Save(hr, null, DutyInput() with { Date = monday.AddDays(7) }, ct)); }, 400, "Future actual duties are rejected");
    await Reject(async () => { await Duty(service => service.Save(hr, null, DutyInput(start: "13:30", end: "11:30"), ct)); }, 400, "On-call end must be after start");
    await Reject(async () => { await Duty(service => service.Save(hr, null, DutyInput("evening", "07:00", "09:00") with { StaffId = staff2, AttendanceEvidenceId = null, DeviationReason = "Exception", SupervisorEvidence = "Manager reference" }, ct)); }, 400, "Special authorization cannot classify morning work as evening duty");
    var dutyResult = Json(await Duty(service => service.Save(hr, null, DutyInput(), ct)));
    var dutyId = dutyResult.GetProperty("id").GetGuid();
    var dutyDetail = Json(await Duty(service => service.Detail(hr, dutyId, ct)));
    Check(dutyDetail.GetProperty("item").GetProperty("status").GetString() == "pending", "On-call creation always starts pending independent confirmation");
    Check(dutyDetail.GetProperty("item").GetProperty("reviewNote").GetString()!.Contains("Vào/Ra"), "An outer punch span cannot hide a gap in actual attendance evidence");
    await Reject(async () => { await Duty(service => service.Save(hr, null, DutyInput(), ct)); }, 400, "Duplicate on-call categories cannot be counted twice");
    var dutyVersion = dutyDetail.GetProperty("item").GetProperty("version").GetString()!;
    await Reject(async () => { await Duty(service => service.Save(hr, dutyId, DutyInput() with { Version = dutyVersion }, ct)); }, 400, "Editing a pending duty requires a correction reason");
    await Duty(service => service.Save(hr, dutyId, DutyInput() with { Version = dutyVersion, Note = "Ghi chú sau khi đối chiếu", DeviationReason = "Bổ sung đối chiếu giờ thực tế" }, ct));
    var noteAudit = await Read(db => db.AuditLogs.SingleAsync(x => x.EntityId == dutyId && x.Action == "edit_on_call"));
    Check(JsonDocument.Parse(noteAudit.OldValue!).RootElement.GetProperty("note").GetString() == "Theo phiếu trực"
        && JsonDocument.Parse(noteAudit.NewValue!).RootElement.GetProperty("note").GetString() == "Ghi chú sau khi đối chiếu",
        "On-call edits preserve the previous and revised note in audit history");
    await Reject(async () => { await Duty(service => service.Save(hr, dutyId, DutyInput() with { Version = dutyVersion, DeviationReason = "Old view" }, ct)); }, 409, "Stale on-call edits are rejected");
    var evening = Json(await Duty(service => service.Save(hr, null, DutyInput("evening", "17:00", "18:00") with { DeviationReason = "Kết thúc sớm do thiếu bệnh nhân" }, ct)));
    var eveningId = evening.GetProperty("id").GetGuid();
    Check(evening.GetProperty("reviewNote").GetString()!.Contains("quản lý"), "Early-ended evening duty remains pending supervisor review");
    var transfer = Json(await Duty(service => service.Save(hr, null, DutyInput(start: "12:00", end: "13:00") with { Date = monday.AddDays(1), FacilityId = facility2,
        AttendanceEvidenceId = null, DeviationReason = "Điều chuyển thực tế, 30 phút di chuyển mỗi lượt", SupervisorEvidence = "Quản lý xác nhận và nhân viên đồng ý điều chuyển" }, ct)));
    Check(transfer.GetProperty("id").GetGuid() != Guid.Empty, "Documented actual duty may differ from the scheduled facility without rewriting the roster");
    await Reject(async () => { await Duty(service => service.Save(hr, null, DutyInput() with { StaffId = staff2, AttendanceEvidenceId = null }, ct)); }, 400, "Unscheduled duty requires documented special authorization");
    await Reject(async () => { await Duty(service => service.Save(hr, null, DutyInput() with { Date = monday.AddDays(5), AttendanceEvidenceId = null }, ct)); }, 400, "Approved leave blocks on-call recording");
    await Execute(async db => { var duty = await db.OnCallShifts.FindAsync(dutyId); duty!.Status = "confirmed"; duty.ConfirmedBy = hrId; duty.ConfirmedAt = clock.Now.UtcDateTime; await db.SaveChangesAsync(); });
    dutyDetail = Json(await Duty(service => service.Detail(hr, dutyId, ct)));
    await Reject(async () => { await Duty(service => service.Save(hr, dutyId, DutyInput() with { Version = dutyDetail.GetProperty("item").GetProperty("version").GetString(), DeviationReason = "Cannot overwrite confirmed duty" }, ct)); }, 400, "Confirmed duties cannot be edited directly");

    var periodId = Guid.NewGuid();
    var validationBeforeLock = (await Preview(batchId)).GetProperty("items").EnumerateArray()
        .ToDictionary(x => x.GetProperty("id").GetGuid(), x => x.GetProperty("errorCode").GetRawText());
    await Execute(async db => { db.PayrollLocks.Add(new PayrollLock { LockId = periodId, PayMonth = "2026-11", Status = "locked" }); await db.SaveChangesAsync(); });
    preview = await Preview(batchId);
    Check(preview.GetProperty("lockedReason").GetString() is { Length: > 0 } && preview.GetProperty("items").EnumerateArray()
        .All(x => x.GetProperty("errorCode").GetRawText() == validationBeforeLock[x.GetProperty("id").GetGuid()]),
        "A locked batch keeps original row classifications and reports the period lock separately");
    await Reject(async () => { await Import(service => service.Commit(hr, batchId, preview.GetProperty("version").GetString()!, true, ct)); }, 400, "A period locked after preview blocks commit");
    var eveningDetail = Json(await Duty(service => service.Detail(hr, eveningId, ct)));
    await Reject(async () => { await Duty(service => service.Save(hr, eveningId, DutyInput("evening", "17:00", "19:00") with { Version = eveningDetail.GetProperty("item").GetProperty("version").GetString(), DeviationReason = "Locked" }, ct)); }, 400, "Locked periods block on-call corrections");
    await Execute(async db => { (await db.PayrollLocks.FindAsync(periodId))!.Status = "open"; await db.SaveChangesAsync(); });
    clock.Now = new(2026, 12, 6, 0, 0, 0, TimeSpan.FromHours(7));
    await Reject(async () => { await Import(service => service.Commit(hr, batchId, preview.GetProperty("version").GetString()!, true, ct)); }, 400, "Routine changes close at the end of day 5 of the following month");
    await Execute(async db => { (await db.PayrollLocks.FindAsync(periodId))!.Status = "draft"; await db.SaveChangesAsync(); });
    await Reject(async () => { await using var db = new AppDbContext(options); await new AttendanceAccess(db, clock).RequireOpenImportMonth("2026-11", ct); }, 400,
        "A draft payroll period without an Accountant reopen cannot bypass the attendance deadline");
    var failedReopenId = Guid.NewGuid();
    await Execute(async db => {
        db.AuditLogs.Add(new AuditLog { LogId = failedReopenId, UserId = accountantId, EntityType = "PayrollLock", EntityId = periodId,
            Action = "reopen", Result = "failure", Module = "payroll" }); await db.SaveChangesAsync();
        await db.AuditLogs.Where(x => x.LogId == failedReopenId).ExecuteUpdateAsync(set => set.SetProperty(x => x.CreatedAt, clock.Now.UtcDateTime));
    });
    await Reject(async () => { await using var db = new AppDbContext(options); await new AttendanceAccess(db, clock).RequireOpenImportMonth("2026-11", ct); }, 400,
        "A failed reopen audit never authorizes changes to a draft period");
    await Execute(async db => { var auditId = Guid.NewGuid(); (await db.PayrollLocks.FindAsync(periodId))!.Status = "reopened"; db.AuditLogs.Add(new AuditLog { LogId = auditId, UserId = accountantId, Action = "reopen", EntityType = "PayrollLock", EntityId = periodId, Module = "payroll", NewValue = "{\"payMonth\":\"2026-11\",\"status\":\"reopened\"}", WorkDate = monday }); await db.SaveChangesAsync(); await db.AuditLogs.Where(x => x.LogId == auditId).ExecuteUpdateAsync(set => set.SetProperty(x => x.CreatedAt, clock.Now.UtcDateTime)); });
    await Run(hr, async (_, _, _, _, _) => { await using var db = new AppDbContext(options); await new AttendanceAccess(db, clock).RequireOpenMonth("2026-11", ct); return true; });
    Check(true, "An audited Accountant reopen permits the defined unpaid correction window");
    await Execute(async db => { (await db.PayrollLocks.FindAsync(periodId))!.Status = "draft"; await db.SaveChangesAsync(); });
    await Run(hr, async (db, _, _, _, _) => { await new AttendanceAccess(db, clock).RequireOpenImportMonth("2026-11", ct); return true; });
    Check(true, "Payroll's audited draft reopen permits attendance during the authorized correction window");
    clock.Now = new(2026, 12, 13, 0, 0, 0, TimeSpan.FromHours(7));
    await Reject(async () => { await using var db = new AppDbContext(options); await new AttendanceAccess(db, clock).RequireOpenMonth("2026-11", ct); }, 400, "Correction window ends after day 12");
    clock.Now = new(2026, 11, 8, 20, 0, 0, TimeSpan.FromHours(7));
    await Execute(async db => { (await db.PayrollLocks.FindAsync(periodId))!.Status = "open"; await db.SaveChangesAsync(); });

    async Task<AccountDto> UserAction(Func<UserService, Task<AccountDto>> action) {
        await using var db = new AppDbContext(options);
        var logger = new AuditLogHelper(db, new HttpContextAccessor { HttpContext = new DefaultHttpContext { User = admin } });
        return await action(new UserService(new UserRepository(db), new EmployeeRepository(db), new AuthRepository(db), new UnitOfWork(db), new PasswordHasher<User>(), logger));
    }
    var createdAccount = await UserAction(service => service.CreateAsync(new(null, "attendance.test", null, "New user", "employee", "active", "Test@2026", null), false, ct));
    var refreshId = Guid.NewGuid();
    await Execute(async db => { db.RefreshTokens.Add(new RefreshToken { TokenId = refreshId, UserId = createdAccount.Id, TokenHash = new string('a', 64), ExpiresAt = DateTime.UtcNow.AddDays(1) }); await db.SaveChangesAsync(); });
    SaveAccountRequest AccountInput(AccountDto value, string role, string status) => new(value.EmployeeId, value.Username, value.Email, value.FullName, role, status, null, value.Version);
    var deactivated = await UserAction(service => service.UpdateAsync(createdAccount.Id, AccountInput(createdAccount, "employee", "inactive"), adminId, ct));
    Check(deactivated.Status == "inactive" && await Read(db => db.RefreshTokens.Where(x => x.TokenId == refreshId).Select(x => x.Revoked).SingleAsync()), "Deactivation retains the account and revokes existing sessions");
    await Reject(async () => { await UserAction(service => service.UpdateAsync(createdAccount.Id, AccountInput(createdAccount, "employee", "active"), adminId, ct)); }, 409, "Account status changes require the latest row version");
    var active = await UserAction(service => service.UpdateAsync(deactivated.Id, AccountInput(deactivated, "employee", "active"), adminId, ct));
    var assigned = await UserAction(service => service.UpdateAsync(active.Id, AccountInput(active, "hr_staff", "active"), adminId, ct));
    Check(assigned.Role == "hr_staff" && await Read(db => db.AuditLogs.AnyAsync(x => x.EntityId == assigned.Id && x.Action == "assign_role" && x.Module == "accounts")), "Role changes preserve the fixed catalog and create auditable assignments");
    var adminAccount = await UserAction(service => service.GetAsync(adminId, ct));
    await Reject(async () => { await UserAction(service => service.UpdateAsync(adminId, AccountInput(adminAccount, "employee", "active"), adminId, ct)); }, 400, "An Administrator cannot demote their own account");
    await Reject(async () => { await UserAction(service => service.UpdateAsync(adminId, AccountInput(adminAccount, "admin", "inactive"), Guid.NewGuid(), ct)); }, 409, "The last active Administrator is protected");
    await Reject(async () => { await UserAction(service => service.UpdateAsync(assigned.Id, AccountInput(assigned, "invented-role", "active"), adminId, ct)); }, 400, "Arbitrary role names cannot be assigned");
    Check(RolesController.Catalog.Length == 6 && RolesController.Catalog.All(x => x.Areas.Length > 0), "Role catalog contains six fixed roles and their functional areas");

    await Reject(async () => { await Run(manager, (_, _, _, _, service) => service.List(manager, new AuditFilter(), false, ct)); }, 403, "General audit viewing is denied without explicit Administrator permission");
    var auditPage = Json(await Run(admin, (_, _, _, _, service) => service.List(admin, new AuditFilter(Module: "accounts", PageSize: 2), false, ct)));
    Check(auditPage.GetProperty("items").GetArrayLength() == 2 && auditPage.GetProperty("total").GetInt32() >= 4, "Audit filters and pagination return recorded account changes");
    var history = Json(await Run(hr, (_, _, _, _, service) => service.List(hr, new AuditFilter(Month: "2026-11", PageSize: 100), true, ct)));
    Check(history.GetProperty("items").EnumerateArray().Any(x => x.GetProperty("action").GetString() == "edit_on_call"), "Attendance history includes old/new pending-duty revisions");
    var historyHead = Json(await Run(head, (_, _, _, _, service) => service.List(head, new AuditFilter(Month: "2026-11", PageSize: 100), true, ct)));
    Check(historyHead.GetProperty("items").EnumerateArray().All(x => x.GetProperty("departmentId").ValueKind == JsonValueKind.Null || x.GetProperty("departmentId").GetGuid() == department1), "Department history remains scoped to the assigned department");
    await Reject(async () => { await Run(employee, (_, _, _, _, service) => service.List(employee, new AuditFilter(), true, ct)); }, 403, "Employees cannot browse the operational audit history");

    await DeviceMappingRegression.Run(options, hrId, adminId, department1, Check, ct);
    await AttendanceReconcileVerifyMonthlyRegression.Run(options, clock, next => clock.Now = next, hrId, managerId, accountantId, facility1, facility2, department1, Check, ct);

    // Exercise the real HTTP pipeline, including Swagger, multipart binding and SQL-backed sessions.
    const string signingKey = "attendance-integration-test-signing-key-never-used-for-real-accounts";
    async Task<string> Session(Guid userId, string role) {
        await using var db = new AppDbContext(options);
        var sessionId = Guid.NewGuid();
        var version = await db.Users.Where(x => x.UserId == userId).Select(x => x.SecurityVersion).SingleAsync();
        db.RefreshTokens.Add(new RefreshToken { TokenId = sessionId, UserId = userId, AccountVersion = version, TokenHash = Guid.NewGuid().ToString("N") + Guid.NewGuid().ToString("N"), ExpiresAt = DateTime.UtcNow.AddHours(1) });
        await db.SaveChangesAsync();
        return new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken("attendance-test", "attendance-test", [new("sub", userId.ToString()), new("jti", sessionId.ToString()), new("role", role), new("name", "http." + role)],
            expires: DateTime.UtcNow.AddMinutes(15), signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)), SecurityAlgorithms.HmacSha256)));
    }
    var adminToken = await Session(adminId, "admin"); var hrToken = await Session(hrId, "hr_staff"); var employeeToken = await Session(user1, "employee");
    var forgedRoleToken = await Session(hrId, "admin"); var assignedUserToken = await Session(assigned.Id, "hr_staff");
    var listener = new TcpListener(IPAddress.Loopback, 0); listener.Start(); var port = ((IPEndPoint)listener.LocalEndpoint).Port; listener.Stop();
    var startInfo = new ProcessStartInfo("dotnet") { WorkingDirectory = Path.GetFullPath("backend"), UseShellExecute = false,
        CreateNoWindow = true, WindowStyle = ProcessWindowStyle.Hidden, RedirectStandardOutput = true, RedirectStandardError = true };
    foreach (var argument in new[] { Path.GetFullPath("backend/bin/Release/net8.0/Backend.dll"), "--urls", $"http://127.0.0.1:{port}", "--OpenBrowser=false",
        "--ConnectionStrings:DefaultConnection", connection, "--Jwt:Issuer", "attendance-test", "--Jwt:Audience", "attendance-test", "--Jwt:SigningKey", signingKey }) startInfo.ArgumentList.Add(argument);
    startInfo.Environment["ASPNETCORE_ENVIRONMENT"] = "Development";
    startInfo.Environment["DOTNET_ENVIRONMENT"] = "Development";
    using var server = Process.Start(startInfo) ?? throw new Exception("Could not start HTTP test server.");
    var serverOutput = new System.Collections.Concurrent.ConcurrentQueue<string>();
    server.OutputDataReceived += (_, args) => { if (args.Data != null) serverOutput.Enqueue(args.Data); };
    server.ErrorDataReceived += (_, args) => { if (args.Data != null) serverOutput.Enqueue(args.Data); };
    server.BeginOutputReadLine(); server.BeginErrorReadLine();
    try {
        using var http = new HttpClient { BaseAddress = new Uri($"http://127.0.0.1:{port}"), Timeout = TimeSpan.FromSeconds(20) };
        var ready = false;
        for (var attempt = 0; attempt < 80; attempt++) {
            try { using var response = await http.GetAsync("/swagger/v1/swagger.json"); if (response.StatusCode == HttpStatusCode.OK) { ready = true; break; } }
            catch (HttpRequestException) { }
            if (server.HasExited) break;
            await Task.Delay(100);
        }
        Check(ready, "Application starts and Swagger describes the multipart attendance API");
        async Task<HttpResponseMessage> Get(string path, string token) { using var request = new HttpRequestMessage(HttpMethod.Get, path); request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token); return await http.SendAsync(request); }
        using (var response = await Get("/api/roles", adminToken)) Check(response.IsSuccessStatusCode, "HTTP Administrator can inspect the role catalog");
        using (var response = await Get("/api/roles", hrToken)) Check(response.StatusCode == HttpStatusCode.Forbidden, "HTTP role management rejects HR Staff");
        using (var response = await Get("/api/roles", forgedRoleToken)) Check(response.StatusCode == HttpStatusCode.Forbidden, "SQL session role overrides a stale or elevated JWT role claim");
        using (var response = await Get("/api/audit-logs?module=accounts&userId=&facilityId=", adminToken)) Check(response.IsSuccessStatusCode, "HTTP audit filters bind empty optional identifiers correctly");
        using (var response = await Get("/api/audit-logs", employeeToken)) Check(response.StatusCode == HttpStatusCode.Forbidden, "HTTP employees cannot access audit events");
        using (var request = new HttpRequestMessage(HttpMethod.Delete, $"/api/audit-logs/{Guid.NewGuid()}")) {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
            using var response = await http.SendAsync(request); Check(response.StatusCode == HttpStatusCode.MethodNotAllowed, "Audit API exposes no deletion action even to Administrator");
        }
        using (var response = await Get("/api/attendance/records?month=2026-11&facilityId=&departmentId=&staffId=&status=&source=&page=1&pageSize=20", employeeToken)) {
            var body = await response.Content.ReadAsStringAsync();
            Check(response.IsSuccessStatusCode && JsonDocument.Parse(body).RootElement.GetProperty("items").EnumerateArray().All(x => x.GetProperty("staffId").GetGuid() == staff1), "HTTP attendance filters preserve employee scope");
        }
        using (var response = await Get($"/api/attendance/records/{otherRecord}", employeeToken)) Check(response.StatusCode == HttpStatusCode.Forbidden, "HTTP attendance details deny another employee's record");
        using (var response = await Get("/api/attendance/on-call-shifts?month=2026-11", hrToken)) Check(response.IsSuccessStatusCode, "HTTP on-call list materializes its full projection");
        using (var response = await Get("/api/attendance/monthly-timesheets/2026-11", hrToken)) Check(response.IsSuccessStatusCode, "HTTP monthly timesheet consolidation endpoint returns clinic-wide summary");
        using (var response = await Get("/api/attendance/monthly-timesheets/2026-11", employeeToken)) Check(response.StatusCode == HttpStatusCode.Forbidden, "HTTP monthly timesheet consolidation rejects ordinary employees");
        using (var response = await Get("/api/attendance/history?month=2026-11&from=&to=&staffId=&facilityId=&page=1&pageSize=20", hrToken)) Check(response.IsSuccessStatusCode, "HTTP history query binding and pagination work");
        using (var request = new HttpRequestMessage(HttpMethod.Post, "/api/attendance/imports")) {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", hrToken);
            var form = new MultipartFormDataContent(); form.Add(new ByteArrayContent(bytes), "file", "machine.xlsx"); form.Add(new StringContent("2026-11"), "month"); form.Add(new StringContent(facility1.ToString()), "facilityId"); request.Content = form;
            using var response = await http.SendAsync(request); var body = await response.Content.ReadAsStringAsync();
            Check(response.IsSuccessStatusCode && JsonDocument.Parse(body).RootElement.GetProperty("reused").GetBoolean(), "HTTP multipart uploads bind and safely reuse existing imports");
        }
        using (var request = new HttpRequestMessage(HttpMethod.Post, "/api/attendance/imports")) {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", hrToken);
            var form = new MultipartFormDataContent(); form.Add(new ByteArrayContent(bytes), "file", "machine.xlsx"); form.Add(new StringContent("2026-11"), "month"); form.Add(new StringContent(facility1.ToString()), "facilityId"); form.Add(new StringContent("guess"), "dateOrder"); request.Content = form;
            using var response = await http.SendAsync(request);
            Check(response.StatusCode == HttpStatusCode.BadRequest && (await response.Content.ReadAsStringAsync()).Contains("mdy"), "HTTP multipart binds and validates date-order choices");
        }
        if (args.Length == 3 && args[0] == "--live-import-workbook") {
            var accountantToken = await Session(accountantId, "accountant");
            await AttendanceLiveBrowser.Run(options, $"http://127.0.0.1:{port}", args[1], args[2], hrId, hrToken,
                accountantId, accountantToken, headStaff, facility1, Check, ct, Workbook);
        }
        using (var request = new HttpRequestMessage(HttpMethod.Post, $"/api/users/{assigned.Id}/status")) {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken);
            request.Content = JsonContent.Create(new { status = "inactive", version = "stale" });
            using var response = await http.SendAsync(request); Check(response.StatusCode == HttpStatusCode.Conflict, "HTTP account status actions reject a stale version");
        }
        using (var request = new HttpRequestMessage(HttpMethod.Post, $"/api/users/{assigned.Id}/status")) {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", adminToken); request.Content = JsonContent.Create(new { status = "inactive", version = assigned.Version });
            using var response = await http.SendAsync(request); Check(response.IsSuccessStatusCode, "HTTP Administrator confirms account deactivation with its current version");
        }
        using (var response = await Get("/api/attendance/options", assignedUserToken)) Check(response.StatusCode == HttpStatusCode.Unauthorized, "Deactivated accounts immediately lose their existing authenticated session");
    } catch { Console.WriteLine(string.Join(Environment.NewLine, serverOutput.TakeLast(40))); throw; }
    finally { if (!server.HasExited) { server.Kill(true); await server.WaitForExitAsync(); } }
    Console.WriteLine($"Passed {checks} attendance/account workflow checks.");
    Directory.CreateDirectory(".local");
    await File.WriteAllBytesAsync(Path.Combine(".local", "attendance-workflow-fixture.xlsx"), bytes);
}
finally {
    if (created && databaseName.StartsWith(prefix, StringComparison.Ordinal) && databaseName.Length == prefix.Length + 32) {
        await using var cleanup = new AppDbContext(options); await cleanup.Database.EnsureDeletedAsync(); Console.WriteLine("Removed owned attendance test database.");
    }
}

sealed class TestClock : TimeProvider
{
    public DateTimeOffset Now { get; set; }
    public override DateTimeOffset GetUtcNow() => Now.ToUniversalTime();
}
