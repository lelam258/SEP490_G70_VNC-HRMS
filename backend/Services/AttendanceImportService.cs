using System.Data;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Attendance;
using Vnc.HRMS.DTOs.Schedules;
using Vnc.HRMS.Models;
using Vnc.HRMS.Persistence;
using Vnc.HRMS.Services.Interfaces;
using Vnc.HRMS.Services.Rules;

namespace Vnc.HRMS.Services;

public sealed class AttendanceImportService(AppDbContext db, AttendanceAccess access, AttendanceWorkbookParser parser, IAuditLogHelper audit)
{
    public async Task<object> Analyze(ClaimsPrincipal user, string fileName, byte[] content, Guid facilityId,
        string month, string? deviceSource, string? mapping, string? dateOrder,
        string? status, string? errorCode, int page, int pageSize, CancellationToken ct)
    {
        AttendanceAccess.RequireHrStaff(user);
        var name = WorkbookName(fileName);
        var rows = parser.Parse(content, month, mapping, dateOrder);
        var sourceQuality = InspectSourceTimes(rows);
        if (!await db.ScheduleFacilities.AsNoTracking().AnyAsync(x => x.Id == facilityId && x.Status == "active", ct))
            throw new AppException(400, "Cơ sở không tồn tại hoặc đã ngừng hoạt động.");
        var batch = new AttendanceImport { ImportId = Guid.NewGuid(), FileName = name, FacilityId = facilityId,
            PayMonth = month, DeviceSource = AttendanceRules.Text(deviceSource, "Nguồn thiết bị", maximum: 100) };
        // This is a transient inspection: no batch, file, row or audit is inserted into the database.
        await Validate(batch, rows, ct);
        var lockedReason = await access.ImportLockReason(month, ct);
        var sourceMonths = rows.Where(x => x.WorkDate.HasValue).GroupBy(x => x.WorkDate!.Value.ToString("yyyy-MM"))
            .OrderBy(g => g.Key).Select(g => new { month = g.Key, rows = g.Count() }).ToArray();
        var suggestedMonth = sourceMonths.Length == 1 && sourceMonths[0].month != month ? sourceMonths[0].month : null;
        var staffIds = rows.Where(x => x.StaffId.HasValue).Select(x => x.StaffId!.Value).Distinct().ToArray();
        var names = await db.Staff.AsNoTracking().Where(x => staffIds.Contains(x.StaffId)).ToDictionaryAsync(x => x.StaffId, x => x.FullName, ct);
        var identities = rows.GroupBy(x => AttendanceRules.DeviceKey(x.DeviceEnrollId)).Select(group => {
            var ids = group.Where(x => x.StaffId.HasValue).Select(x => x.StaffId!.Value).Distinct().ToArray();
            Guid? staffId = ids.Length == 1 ? ids[0] : null;
            var identityStatus = group.Key.Length == 0 ? "missing" : group.Any(x => x.ErrorCode == "ambiguous_device") ? "ambiguous"
                : staffId.HasValue ? "mapped" : "unknown";
            return new { deviceEnrollId = group.First().DeviceEnrollId, rowCount = group.Count(), status = identityStatus,
                staffId, staffName = staffId.HasValue ? names.GetValueOrDefault(staffId.Value) : null,
                sourceLabels = group.Select(x => x.EmployeeBlock).Where(x => x.Length > 0).Distinct().Take(3).ToArray() };
        }).OrderBy(x => x.deviceEnrollId).ToArray();
        var filtered = rows.Where(x => (string.IsNullOrEmpty(status) || x.ValidationStatus == status
                || (status == "issues" && x.ValidationStatus is "error" or "warning" or "duplicate"))
            && (string.IsNullOrEmpty(errorCode) || x.ErrorCode == errorCode)).ToArray();
        page = Math.Clamp(page, 1, 100000); pageSize = Math.Clamp(pageSize, 1, 100);
        return new {
            fileName = name, payMonth = month, facilityId, batch.DeviceSource, dateOrder = AttendanceWorkbookParser.NormalizeDateOrder(dateOrder),
            totalRows = rows.Length, employeeCodes = identities.Count(x => x.deviceEnrollId.Length > 0),
            dateFrom = rows.Min(x => x.WorkDate), dateTo = rows.Max(x => x.WorkDate), sourceMonths, suggestedMonth,
            lockedReason, canStage = lockedReason is null && suggestedMonth is null,
            identity = new { mappedCodes = identities.Count(x => x.status == "mapped"),
                unresolvedCodes = identities.Count(x => x.status != "mapped"), unresolvedRows = identities.Where(x => x.status != "mapped").Sum(x => x.rowCount), items = identities },
            sourceTimeQuality = sourceQuality.Summary,
            otherErrorRows = rows.Count(x => x.ValidationStatus == "error" && x.ErrorCode is not ("unknown_device" or "ambiguous_device")),
            counts = new { valid = rows.Count(x => x.ValidationStatus == "valid"), warning = rows.Count(x => x.ValidationStatus == "warning"),
                error = rows.Count(x => x.ValidationStatus == "error"), duplicate = rows.Count(x => x.ValidationStatus == "duplicate") },
            total = filtered.Length, page, pageSize,
            items = filtered.Skip((page - 1) * pageSize).Take(pageSize).Select(x => PresentRow(x, names, sourceQuality.Hours.GetValueOrDefault(x.Id))).ToArray()
        };
    }

    public async Task<object> Stage(ClaimsPrincipal user, string fileName, byte[] content, Guid facilityId,
        string month, string? deviceSource, string? mapping, CancellationToken ct, string? dateOrder = null)
    {
        AttendanceAccess.RequireHrStaff(user);
        var name = WorkbookName(fileName);
        AttendanceRules.Month(month);
        dateOrder = AttendanceWorkbookParser.NormalizeDateOrder(dateOrder);
        var rows = parser.Parse(content, month, mapping, dateOrder);
        var normalizedMapping = string.IsNullOrWhiteSpace(mapping) ? null
            : JsonSerializer.Serialize(JsonSerializer.Deserialize<Dictionary<string, int>>(mapping)!.OrderBy(x => x.Key).ToDictionary(x => x.Key, x => x.Value));
        // Store the parsing choice alongside column configuration without changing the original workbook.
        if (dateOrder != "auto") normalizedMapping = JsonSerializer.Serialize(new { dateOrder, columns = normalizedMapping is null ? null : JsonSerializer.Deserialize<Dictionary<string, int>>(normalizedMapping) });
        var hash = Convert.ToHexString(SHA256.HashData(content));
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        await access.RequireOpenImportMonth(month, ct);
        if (!await db.ScheduleFacilities.AnyAsync(x => x.Id == facilityId && x.Status == "active", ct))
            throw new AppException(400, "Cơ sở không tồn tại hoặc đã ngừng hoạt động.");
        var existing = await db.AttendanceImports.AsNoTracking().FirstOrDefaultAsync(x => x.FacilityId == facilityId && x.PayMonth == month && x.ContentHash == hash && x.ColumnMapping == normalizedMapping, ct);
        if (existing != null) {
            await tx.CommitAsync(ct);
            return new { id = existing.ImportId, reused = true, message = "Tệp này đã có trong lịch sử nhập. Mở lại đợt nhập hiện có." };
        }
        var batch = new AttendanceImport { ImportId = Guid.NewGuid(), FileName = name, FacilityId = facilityId,
            PayMonth = month, DeviceSource = AttendanceRules.Text(deviceSource, "Nguồn thiết bị", maximum: 100),
            ImportedBy = AttendanceAccess.Actor(user), ImportDate = access.Now.UtcDateTime, ContentHash = hash,
            OriginalFile = content, ColumnMapping = normalizedMapping, Status = "staged" };
        foreach (var row in rows) row.ImportId = batch.ImportId;
        db.AttendanceImports.Add(batch); db.AttendanceImportRows.AddRange(rows);
        await Validate(batch, rows, ct);
        Totals(batch, rows);
        audit.Log("stage_import", "AttendanceImport", batch.ImportId, null, Summary(batch));
        await access.RequireOpenImportMonth(month, ct);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new { id = batch.ImportId, reused = false, message = "Đã đọc tệp. Kiểm tra bản xem trước trước khi lưu dòng hợp lệ." };
    }

    public async Task<object> List(string? month, Guid? facilityId, int page, int pageSize, CancellationToken ct)
    {
        var query = db.AttendanceImports.AsNoTracking();
        if (!string.IsNullOrEmpty(month)) { AttendanceRules.Month(month); query = query.Where(x => x.PayMonth == month); }
        if (facilityId.HasValue) query = query.Where(x => x.FacilityId == facilityId);
        page = Math.Clamp(page, 1, 100000); pageSize = Math.Clamp(pageSize, 1, 100);
        return new { total = await query.CountAsync(ct), page, pageSize,
            items = await query.OrderByDescending(x => x.ImportDate).ThenBy(x => x.ImportId).Skip((page - 1) * pageSize).Take(pageSize)
                .Select(x => new { id = x.ImportId, x.FileName, x.PayMonth, x.FacilityId, x.DeviceSource, x.ImportDate, x.TotalRows, x.SuccessRows, x.ErrorRows, x.Status }).ToArrayAsync(ct) };
    }

    public async Task<object> Preview(Guid id, string? status, string? errorCode, int page, int pageSize, CancellationToken ct)
    {
        var batch = await db.AttendanceImports.AsNoTracking().SingleOrDefaultAsync(x => x.ImportId == id, ct) ?? throw new AppException(404, "Không tìm thấy đợt nhập.");
        var all = await db.AttendanceImportRows.AsNoTracking().Where(x => x.ImportId == id).OrderBy(x => x.SheetName).ThenBy(x => x.RowNumber).ToArrayAsync(ct);
        await Validate(batch, all, ct);
        Totals(batch, all);
        var version = BatchVersion(batch, all);
        var lockedReason = await access.ImportLockReason(batch.PayMonth!, ct);
        var staffIds = all.Where(x => x.StaffId.HasValue).Select(x => x.StaffId!.Value).Distinct().ToArray();
        var names = await db.Staff.AsNoTracking().Where(x => staffIds.Contains(x.StaffId)).ToDictionaryAsync(x => x.StaffId, x => x.FullName, ct);
        var query = all.Where(x => (string.IsNullOrEmpty(status) || x.ValidationStatus == status || (status == "issues" && x.ValidationStatus is "error" or "warning" or "duplicate"))
            && (string.IsNullOrEmpty(errorCode) || x.ErrorCode == errorCode
                || (errorCode == "closed_period" && lockedReason is not null && x.AttendanceId is null && x.ValidationStatus != "excluded"))).ToArray();
        page = Math.Clamp(page, 1, 100000); pageSize = Math.Clamp(pageSize, 1, 100);
        return new {
            batch = Summary(batch), version, lockedReason,
            sourceAvailable = batch.OriginalFile != null, employeeBlocks = all.Select(x => x.DeviceEnrollId).Distinct().Count(),
            counts = new { valid = all.Count(x => x.ValidationStatus == "valid"), warning = all.Count(x => x.ValidationStatus == "warning"),
                error = all.Count(x => x.ValidationStatus == "error"), duplicate = all.Count(x => x.ValidationStatus == "duplicate"),
                excluded = all.Count(x => x.ValidationStatus == "excluded"), committed = all.Count(x => x.AttendanceId != null) },
            total = query.Length, page, pageSize,
            items = query.Skip((page - 1) * pageSize).Take(pageSize).Select(x => PresentRow(x, names)).ToArray()
        };
    }

    public async Task<object> Correct(ClaimsPrincipal user, Guid importId, Guid rowId, CorrectImportRowRequest request, CancellationToken ct)
    {
        AttendanceAccess.RequireHrStaff(user);
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var batch = await db.AttendanceImports.SingleOrDefaultAsync(x => x.ImportId == importId, ct) ?? throw new AppException(404, "Không tìm thấy đợt nhập.");
        await access.RequireOpenImportMonth(batch.PayMonth!, ct);
        var rows = await db.AttendanceImportRows.Where(x => x.ImportId == importId).OrderBy(x => x.SheetName).ThenBy(x => x.RowNumber).ToArrayAsync(ct);
        var row = rows.SingleOrDefault(x => x.Id == rowId) ?? throw new AppException(404, "Không tìm thấy dòng nhập.");
        AttendanceRules.RequireVersion(row.Version, request.Version);
        if (row.AttendanceId.HasValue) throw new AppException(409, "Dòng đã được lưu vào chấm công; cần luồng đối chiếu để điều chỉnh.");
        if (!new[] { "main", "noon", "evening" }.Contains(request.ShiftType)) throw new AppException(400, "Ca không hợp lệ.");
        var pairs = AttendanceRules.Pairs(request.WorkDate, request.Pairs);
        var previous = RowSummary(row);
        row.StaffId = request.StaffId; row.WorkDate = request.WorkDate; row.ShiftType = request.ShiftType;
        row.TimePairsJson = JsonSerializer.Serialize(pairs);
        row.CorrectionReason = AttendanceRules.Text(request.Reason, "Lý do điều chỉnh", true);
        row.CorrectedBy = AttendanceAccess.Actor(user); row.CorrectedAt = access.Now.UtcDateTime;
        row.ValidationStatus = "valid"; // An evidenced correction may also restore an explicitly excluded source row.
        await Validate(batch, rows, ct); Totals(batch, rows);
        audit.Log("correct_import_row", "AttendanceImport", batch.ImportId, previous, new {
            batch.FacilityId, batch.PayMonth, row.StaffId, row.WorkDate, status = row.ValidationStatus, row.CorrectionReason, rowId = row.Id,
            pairs = JsonSerializer.Deserialize<AttendanceTimePair[]>(row.TimePairsJson)
        });
        await access.RequireOpenImportMonth(batch.PayMonth!, ct);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new { message = "Đã lưu điều chỉnh và kiểm tra lại. Dữ liệu gốc được giữ trong đợt nhập.", status = row.ValidationStatus };
    }

    public async Task<object> Exclude(ClaimsPrincipal user, Guid importId, Guid rowId, ExcludeImportRowRequest request, CancellationToken ct)
    {
        AttendanceAccess.RequireHrStaff(user);
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var batch = await db.AttendanceImports.SingleOrDefaultAsync(x => x.ImportId == importId, ct) ?? throw new AppException(404, "Không tìm thấy đợt nhập.");
        await access.RequireOpenImportMonth(batch.PayMonth!, ct);
        var rows = await db.AttendanceImportRows.Where(x => x.ImportId == importId).OrderBy(x => x.SheetName).ThenBy(x => x.RowNumber).ToArrayAsync(ct);
        var row = rows.SingleOrDefault(x => x.Id == rowId) ?? throw new AppException(404, "Không tìm thấy dòng nhập.");
        AttendanceRules.RequireVersion(row.Version, request.Version);
        if (row.AttendanceId.HasValue) throw new AppException(409, "Không thể loại bản ghi đã lưu vào chấm công.");
        var previous = RowSummary(row);
        row.CorrectionReason = AttendanceRules.Text(request.Reason, "Lý do loại khỏi đợt nhập", true);
        row.CorrectedBy = AttendanceAccess.Actor(user); row.CorrectedAt = access.Now.UtcDateTime;
        row.ValidationStatus = "excluded"; row.ErrorCode = null;
        row.ValidationNote = "Đã chủ động loại khỏi đợt nhập: " + row.CorrectionReason;
        await Validate(batch, rows, ct); Totals(batch, rows);
        audit.Log("exclude_import_row", "AttendanceImport", batch.ImportId, previous,
            new { batch.FacilityId, batch.PayMonth, row.StaffId, row.WorkDate, rowId = row.Id, status = row.ValidationStatus, row.CorrectionReason });
        await access.RequireOpenImportMonth(batch.PayMonth!, ct);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new { message = "Đã loại dòng khỏi đợt nhập và kiểm tra lại các dòng còn lại. Dữ liệu gốc được giữ nguyên." };
    }

    public async Task<object> Commit(ClaimsPrincipal user, Guid id, string version, bool includeWarnings, CancellationToken ct)
    {
        AttendanceAccess.RequireHrStaff(user);
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var batch = await db.AttendanceImports.SingleOrDefaultAsync(x => x.ImportId == id, ct) ?? throw new AppException(404, "Không tìm thấy đợt nhập.");
        await access.RequireOpenImportMonth(batch.PayMonth!, ct);
        var rows = await db.AttendanceImportRows.Where(x => x.ImportId == id).OrderBy(x => x.SheetName).ThenBy(x => x.RowNumber).ToArrayAsync(ct);
        await Validate(batch, rows, ct);
        Totals(batch, rows);
        if (version != BatchVersion(batch, rows)) throw new AppException(409, "Dữ liệu hoặc kết quả đối chiếu đã thay đổi. Tải lại bản xem trước và xác nhận lại trước khi lưu.");
        var created = 0;
        var staffIds = rows.Where(x => x.StaffId.HasValue).Select(x => x.StaffId!.Value).Distinct().ToArray();
        var employees = await db.Staff.AsNoTracking().Where(x => staffIds.Contains(x.StaffId)).ToDictionaryAsync(x => x.StaffId, ct);
        foreach (var row in rows.Where(x => x.AttendanceId is null && (x.ValidationStatus == "valid" || (includeWarnings && x.ValidationStatus == "warning")))) {
            var staff = employees[row.StaffId!.Value];
            var pairs = JsonSerializer.Deserialize<AttendanceTimePair[]>(row.TimePairsJson)!;
            var record = new AttendanceRecord { AttendanceId = Guid.NewGuid(), StaffId = staff.StaffId, StaffCode = staff.StaffCode,
                DepartmentId = staff.DepartmentId, FacilityId = batch.FacilityId, DeviceEnrollId = row.DeviceEnrollId,
                ImportId = batch.ImportId, WorkDate = row.WorkDate!.Value, ShiftType = row.ShiftType,
                CheckIn = pairs.Min(x => x.In), CheckOut = pairs.Max(x => x.Out), TimePairsJson = row.TimePairsJson, ActualHours = row.ActualHours,
                Source = row.CorrectionReason is null ? "machine" : "manual", ValidationStatus = row.ValidationStatus == "warning" ? "flagged" : "imported",
                Note = row.ValidationNote, ReconcileNote = row.CorrectionReason };
            db.AttendanceRecords.Add(record);
            row.AttendanceId = record.AttendanceId; row.ValidationStatus = "committed";
            audit.Log("import_record", "AttendanceRecord", record.AttendanceId, null, new { record.StaffId, record.DepartmentId, record.FacilityId,
                record.WorkDate, status = record.ValidationStatus, record.ImportId, record.ActualHours, reason = row.CorrectionReason });
            created++;
        }
        Totals(batch, rows);
        audit.Log("commit_import", "AttendanceImport", batch.ImportId, null, Summary(batch));
        await access.RequireOpenImportMonth(batch.PayMonth!, ct);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new { created, message = created > 0 ? $"Đã lưu {created} dòng vào hàng chờ xác nhận. Chưa dùng để tính lương." : "Không có dòng mới đủ điều kiện. Tải lại kết quả để xem các xung đột hiện tại." };
    }

    public async Task<(byte[] Bytes, string Name)> Source(Guid id, CancellationToken ct)
    {
        var batch = await db.AttendanceImports.AsNoTracking().SingleOrDefaultAsync(x => x.ImportId == id, ct) ?? throw new AppException(404, "Không tìm thấy đợt nhập.");
        return (batch.OriginalFile ?? throw new AppException(404, "Tệp gốc không còn sẵn có."), batch.FileName);
    }
    public async Task<string> ErrorCsv(Guid id, CancellationToken ct)
    {
        var batch = await db.AttendanceImports.AsNoTracking().SingleOrDefaultAsync(x => x.ImportId == id, ct) ?? throw new AppException(404, "Không tìm thấy đợt nhập.");
        var locked = await access.ImportLockReason(batch.PayMonth!, ct);
        var all = await db.AttendanceImportRows.AsNoTracking().Where(x => x.ImportId == id)
            .OrderBy(x => x.SheetName).ThenBy(x => x.RowNumber).ToArrayAsync(ct);
        await Validate(batch, all, ct);
        var rows = all.Where(x => x.AttendanceId is null && x.ValidationStatus != "excluded"
            && (locked != null || x.ValidationStatus != "valid")).ToArray();
        var sheetNumbers = rows.Select(x => x.SheetName).Distinct().Select((name, index) => (name, index)).ToDictionary(x => x.name, x => $"Sheet {x.index + 1}");
        return "Sheet,Row,Date,Issue,Message\r\n" + string.Join("\r\n", rows.Select(x => string.Join(",", new[] { sheetNumbers[x.SheetName],
            x.RowNumber.ToString(), x.WorkDate?.ToString("yyyy-MM-dd"), x.ErrorCode ?? (locked is null ? null : "closed_period"),
            locked is null ? x.ValidationNote : (x.ValidationNote is null ? locked : x.ValidationNote + " Trạng thái kỳ: " + locked) }.Select(AttendanceRules.Csv))));
    }

    private async Task Validate(AttendanceImport batch, AttendanceImportRow[] rows, CancellationToken ct)
    {
        var (start, end) = AttendanceRules.Month(batch.PayMonth);
        var staff = await db.Staff.AsNoTracking().ToArrayAsync(ct);
        var employees = staff.ToDictionary(x => x.StaffId);
        var devices = staff.Where(x => !string.IsNullOrWhiteSpace(x.DeviceEnrollId)).GroupBy(x => AttendanceRules.DeviceKey(x.DeviceEnrollId!))
            .ToDictionary(g => g.Key, g => g.ToArray());
        var departments = (await db.Departments.AsNoTracking().Where(x => x.Status == "active").Select(x => x.DepartmentId).ToArrayAsync(ct)).ToHashSet();
        var records = await db.AttendanceRecords.AsNoTracking().Where(x => x.WorkDate >= start && x.WorkDate <= end)
            .Select(x => new { x.StaffId, x.WorkDate, x.ShiftType }).ToArrayAsync(ct);
        var existing = records.Select(x => (x.StaffId, x.WorkDate, x.ShiftType)).ToHashSet();
        var leave = await db.LeaveRequests.AsNoTracking().Where(x => x.Status == "approved" && x.StartDate <= end && x.EndDate >= start).ToArrayAsync(ct);
        var plans = await PublishedPlans(start, end, ct);
        var plansByDay = plans.ToLookup(x => (x.StaffId, x.Date));
        var leaveByStaff = leave.ToLookup(x => x.StaffId);
        var facilityActive = await db.ScheduleFacilities.AnyAsync(x => x.Id == batch.FacilityId && x.Status == "active", ct);
        var pending = rows.Where(x => x.AttendanceId is null && x.ValidationStatus != "excluded").ToArray();
        foreach (var row in pending.Where(x => x.CorrectedBy is null)) {
            var matches = devices.GetValueOrDefault(AttendanceRules.DeviceKey(row.DeviceEnrollId)) ?? [];
            row.StaffId = matches.Length == 1 ? matches[0].StaffId : null;
        }
        var duplicates = pending.Where(x => x.StaffId.HasValue && x.WorkDate.HasValue)
            .GroupBy(x => (x.StaffId!.Value, x.WorkDate!.Value, x.ShiftType)).Where(g => g.Count() > 1).Select(g => g.Key).ToHashSet();
        foreach (var row in rows) {
            if (row.AttendanceId.HasValue || row.ValidationStatus == "excluded") continue;
            row.ValidationStatus = "valid"; row.ErrorCode = null; row.ValidationNote = null; row.ActualHours = null;
            if (row.CorrectedBy is null) {
                var matches = devices.GetValueOrDefault(AttendanceRules.DeviceKey(row.DeviceEnrollId)) ?? [];
                if (matches.Length != 1) { Error(matches.Length == 0 ? "unknown_device" : "ambiguous_device", "Mã máy chưa khớp duy nhất với nhân viên. Chọn nhân viên và ghi căn cứ xác nhận."); continue; }
            }
            if (!row.StaffId.HasValue || !employees.TryGetValue(row.StaffId.Value, out var person) || person.Status != "active" || !person.DepartmentId.HasValue || !departments.Contains(person.DepartmentId.Value)) {
                Error("inactive_staff", "Nhân viên hoặc khoa/phòng không tồn tại, chưa phân khoa hoặc đã ngừng hoạt động."); continue;
            }
            if (!facilityActive) { Error("inactive_facility", "Cơ sở đã ngừng hoạt động."); continue; }
            if (row.WorkDate is not DateOnly date) { Error("malformed_date", "Ngày công không hợp lệ hoặc chưa rõ thứ tự ngày/tháng. Chọn đúng định dạng khi nhập lại hoặc điều chỉnh ngày có căn cứ."); continue; }
            if (date < start || date > end) { Error("cross_month", "Ngày công nằm ngoài tháng nhập đã chọn."); continue; }
            if (date > access.Today) { Error("future_date", "Chưa thể ghi nhận ngày công trong tương lai."); continue; }
            if (date < person.DateJoined || (person.DateLeft.HasValue && date > person.DateLeft)) { Error("employment_dates", "Ngày công nằm ngoài thời gian công tác của nhân viên."); continue; }
            if (row.ShiftType is not ("main" or "noon" or "evening")) { Error("invalid_shift", "Loại ca không hợp lệ. Cần chọn ca chính, trực trưa hoặc trực tối."); continue; }
            var pairs = JsonSerializer.Deserialize<AttendanceTimePair[]>(row.TimePairsJson) ?? [];
            bool repeatedPairs;
            try { (row.ActualHours, repeatedPairs) = AttendanceRules.ImportHours(pairs, date); }
            catch (AppException error) { Error("invalid_time", error.Message); continue; }
            if (pairs.Max(x => x.Out) > access.Now.ToOffset(TimeSpan.FromHours(7)).DateTime) { Error("future_time", "Giờ chấm công thực tế chưa diễn ra."); continue; }
            if (existing.Contains((person.StaffId, date, row.ShiftType))) { Error("existing_record", "Ngày và ca đã có bản ghi. Dùng luồng đối chiếu; không ghi đè dữ liệu hiện có.", "duplicate"); continue; }
            if (leaveByStaff[person.StaffId].Any(x => x.StartDate <= date && x.EndDate >= date)) { Error("leave_conflict", "Ngày công trùng nghỉ phép đã được duyệt; cần đối chiếu với quản lý."); continue; }
            if (duplicates.Contains((person.StaffId, date, row.ShiftType))) { Error("duplicate_file", "Có nhiều dòng cho cùng nhân viên, ngày và ca. Đối chiếu nguồn rồi chủ động loại dòng thừa; hệ thống không tự chọn dòng đầu tiên.", "duplicate"); continue; }
            var dayPlans = plansByDay[(person.StaffId, date)].ToArray();
            var candidateShifts = row.ShiftType == "main" ? new[] { "morning", "afternoon" } : [row.ShiftType];
            var workedShifts = candidateShifts.Where(shift => {
                var (from, to) = ScheduleRules.Hours(date, shift);
                return pairs.Any(pair => pair.In < date.ToDateTime(to) && pair.Out > date.ToDateTime(from));
            }).ToArray();
            var relevantPlans = dayPlans.Where(x => workedShifts.Contains(x.Shift)).ToArray();
            if (relevantPlans.Any(x => x.FacilityId != batch.FacilityId)
                || (dayPlans.Length > 0 && !dayPlans.Any(x => x.FacilityId == batch.FacilityId))) {
                Error("facility_conflict", "Cơ sở trong tệp không khớp lịch đã công bố cho ca có giờ chấm công. Cần đối chiếu cơ sở và bằng chứng."); continue;
            }
            var warnings = new List<string>();
            if (repeatedPairs) warnings.Add("Máy xuất lặp cặp Vào/Ra giống hệt nhau. Giữ nguyên các cặp nguồn, tổng giờ chỉ tính mỗi khoảng duy nhất một lần; cần đối chiếu trước khi xác nhận");
            if (dayPlans.Length == 0) warnings.Add("Chưa có lịch đã công bố để đối chiếu");
            var shiftConflict = workedShifts.Length == 0 || (dayPlans.Length > 0 && workedShifts.Any(shift => !relevantPlans.Any(x => x.Shift == shift)));
            if (shiftConflict) warnings.Add("Ca và giờ trong tệp chưa khớp ca làm việc đã công bố");
            if (row.ReportedHours.HasValue && Math.Abs(row.ReportedHours.Value - row.ActualHours!.Value) > 0.05m) warnings.Add("Tổng giờ máy báo khác tổng các cặp Vào/Ra");
            if (warnings.Count > 0) { row.ValidationStatus = "warning"; row.ErrorCode = repeatedPairs ? "repeated_time_pairs" : shiftConflict ? "shift_conflict" : "needs_reconciliation"; row.ValidationNote = string.Join(". ", warnings) + ". Chỉ được lưu vào hàng chờ đối chiếu, chưa được tính lương."; }

            void Error(string code, string message, string status = "error") { row.ErrorCode = code; row.ValidationNote = message; row.ValidationStatus = status; }
        }
    }

    internal async Task<(Guid Id, Guid StaffId, Guid FacilityId, DateOnly Date, string Shift)[]> PublishedPlans(DateOnly start, DateOnly end, CancellationToken ct)
    {
        var live = await (from a in db.ScheduleAssignments.AsNoTracking() join w in db.ScheduleWeeks on a.WeekId equals w.Id
            join c in db.ScheduleCoverage on a.CoverageId equals c.Id
            where w.Published && !a.Cancelled && a.Date >= start && a.Date <= end
            select new { a.Id, a.StaffId, c.FacilityId, a.Date, a.Shift }).ToArrayAsync(ct);
        var snapshots = await db.ScheduleWeeks.AsNoTracking().Where(w => !w.Published && w.PublishedSnapshot != null
            && w.Monday <= end && w.Monday >= start.AddDays(-6)).Select(w => w.PublishedSnapshot!).ToArrayAsync(ct);
        return live.Select(a => (a.Id, a.StaffId, a.FacilityId, a.Date, a.Shift)).Concat(snapshots
            .SelectMany(json => JsonSerializer.Deserialize<ScheduleRosterRow[]>(json) ?? [])
            .Where(x => !x.Assignment.Cancelled && x.Assignment.Date >= start && x.Assignment.Date <= end)
            .Select(x => (x.Assignment.Id, x.Assignment.StaffId, x.FacilityId, x.Assignment.Date, x.Assignment.Shift))).ToArray();
    }
    private static object Summary(AttendanceImport batch) => new { id = batch.ImportId, batch.FileName, batch.PayMonth, batch.FacilityId,
        batch.DeviceSource, batch.ImportedBy, batch.ImportDate, batch.TotalRows, batch.SuccessRows, batch.ErrorRows, batch.Status, dateOrder = ConfiguredDateOrder(batch.ColumnMapping) };
    private static string WorkbookName(string fileName)
    {
        var name = Path.GetFileName(fileName);
        if (name.Length > 255 || !new[] { ".xlsx", ".xls" }.Contains(Path.GetExtension(name).ToLowerInvariant()))
            throw new AppException(400, "Chỉ hỗ trợ tệp chấm công .xlsx hoặc .xls, tên tối đa 255 ký tự.");
        return name;
    }
    private static object PresentRow(AttendanceImportRow row, IReadOnlyDictionary<Guid, string> names, decimal? sourceHours = null) => new {
        row.Id, row.SheetName, row.RowNumber, row.EmployeeBlock, row.DeviceEnrollId, row.StaffId,
        staffName = row.StaffId.HasValue ? names.GetValueOrDefault(row.StaffId.Value) : null,
        row.RawDate, rawValues = JsonSerializer.Deserialize<string[]>(row.RawValuesJson), row.WorkDate, row.ShiftType,
        pairs = JsonSerializer.Deserialize<AttendanceTimePair[]>(row.TimePairsJson), row.ActualHours, row.ReportedHours, sourceHours,
        row.LateMinutes, row.EarlyMinutes, row.AttendanceSymbol, row.ValidationStatus, row.ErrorCode, row.ValidationNote,
        row.CorrectionReason, row.CorrectedBy, row.CorrectedAt, row.AttendanceId, version = Convert.ToBase64String(row.Version)
    };
    private static (object Summary, Dictionary<Guid, decimal?> Hours) InspectSourceTimes(AttendanceImportRow[] rows)
    {
        var hours = new Dictionary<Guid, decimal?>();
        var complete = 0; var missing = 0; var empty = 0; var invalid = 0; var invalidDates = 0; var repeated = 0; var discrepancy = 0;
        foreach (var row in rows) {
            if (row.WorkDate is not DateOnly date) { invalidDates++; continue; }
            var pairs = JsonSerializer.Deserialize<AttendanceTimePair[]>(row.TimePairsJson) ?? [];
            if (pairs.Length == 0) { empty++; continue; }
            if (pairs.Any(x => x.In is null || x.Out is null)) { missing++; continue; }
            try {
                var result = AttendanceRules.ImportHours(pairs, date);
                hours[row.Id] = result.Hours; complete++;
                if (result.RepeatedPairs) repeated++;
                if (row.ReportedHours.HasValue && Math.Abs(row.ReportedHours.Value - result.Hours) > .05m) discrepancy++;
            }
            catch (AppException) { invalid++; }
        }
        return (new { completeRows = complete, missingTimeRows = missing, noPunchRows = empty, invalidTimeRows = invalid,
            invalidDateRows = invalidDates, repeatedPairRows = repeated, reportedHourMismatchRows = discrepancy }, hours);
    }
    private static string ConfiguredDateOrder(string? mapping)
    {
        if (mapping is null) return "auto";
        using var json = JsonDocument.Parse(mapping);
        return json.RootElement.TryGetProperty("dateOrder", out var order) && order.ValueKind == JsonValueKind.String ? order.GetString()! : "auto";
    }
    private static object RowSummary(AttendanceImportRow row) => new { row.StaffId, row.WorkDate, row.ShiftType, row.ValidationStatus, row.TimePairsJson, row.CorrectionReason };
    private static string BatchVersion(AttendanceImport batch, IEnumerable<AttendanceImportRow> rows)
        => AttendanceRules.Version(new { batch.ImportId, batch.Status, rows = rows.OrderBy(x => x.Id).Select(x => new {
            x.Id, version = Convert.ToBase64String(x.Version), x.StaffId, x.WorkDate, x.ShiftType, x.TimePairsJson,
            x.ActualHours, x.ValidationStatus, x.ErrorCode, x.ValidationNote, x.AttendanceId }) });
    private static void Totals(AttendanceImport batch, AttendanceImportRow[] rows)
    {
        batch.TotalRows = rows.Length; batch.SuccessRows = rows.Count(x => x.AttendanceId != null);
        batch.ErrorRows = rows.Count(x => x.ValidationStatus is "error" or "duplicate");
        batch.Status = rows.All(x => x.ValidationStatus == "excluded") ? "excluded"
            : rows.All(x => x.AttendanceId != null || x.ValidationStatus == "excluded") ? "committed"
            : rows.Any(x => x.AttendanceId != null) ? "partial" : "staged";
        batch.ErrorLog = JsonSerializer.Serialize(new { errors = batch.ErrorRows, warnings = rows.Count(x => x.ValidationStatus == "warning"), excluded = rows.Count(x => x.ValidationStatus == "excluded") });
    }
}
