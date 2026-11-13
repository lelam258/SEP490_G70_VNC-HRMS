using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using ExcelDataReader;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Attendance;
using Vnc.HRMS.Models;
using Vnc.HRMS.Services.Rules;

namespace Vnc.HRMS.Services;

public sealed class AttendanceWorkbookParser
{
    public const int MaximumFileBytes = 10 * 1024 * 1024;
    public const int MaximumRows = 10_000;

    public AttendanceImportRow[] Parse(byte[] bytes, string month, string? mappingJson = null, string? dateOrder = null)
    {
        AttendanceRules.Month(month);
        dateOrder = NormalizeDateOrder(dateOrder);
        if (bytes.Length == 0 || bytes.Length > MaximumFileBytes) throw new AppException(400, "Tệp chấm công phải từ 1 byte đến 10 MB.");
        Dictionary<string, int>? mapping = null;
        if (!string.IsNullOrWhiteSpace(mappingJson)) {
            if (mappingJson.Length > 4096) throw new AppException(400, "Ánh xạ cột quá dài.");
            try { mapping = JsonSerializer.Deserialize<Dictionary<string, int>>(mappingJson); }
            catch (JsonException) { throw new AppException(400, "Ánh xạ cột phải là JSON với số cột bắt đầu từ 1."); }
            if (mapping is null) throw new AppException(400, "Ánh xạ cột không hợp lệ.");
            ValidateMapping(mapping);
        }
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        try {
            using var source = new MemoryStream(bytes, false);
            if (bytes.Length >= 2 && bytes[0] == 'P' && bytes[1] == 'K') {
                using (var zip = new ZipArchive(source, ZipArchiveMode.Read, true)) {
                    if (zip.Entries.Count > 2000 || zip.Entries.Sum(x => x.Length) > 100L * 1024 * 1024)
                        throw new AppException(400, "Nội dung giải nén của tệp Excel quá lớn.");
                }
                source.Position = 0;
            }
            using var reader = ExcelReaderFactory.CreateReader(source);
            var result = new List<AttendanceImportRow>();
            var sheets = 0;
            do {
                if (++sheets > 50 || reader.FieldCount > 256) throw new AppException(400, "Tệp có quá nhiều trang tính hoặc cột.");
                IEnumerable<object?[]> Cells() {
                    var count = 0;
                    while (reader.Read()) {
                        if (++count > 50_000) throw new AppException(400, "Trang tính có quá nhiều dòng.");
                        var values = new object[reader.FieldCount];
                        reader.GetValues(values);
                        yield return values;
                    }
                }
                result.AddRange(ParseGrid(Cells(), reader.Name, month, mapping, dateOrder));
                if (result.Count > MaximumRows) throw new AppException(400, "Mỗi lần nhập tối đa 10.000 dòng ngày công.");
            } while (reader.NextResult());
            if (result.Count == 0) throw new AppException(400, "Không tìm thấy dòng ngày công. Kiểm tra cột Ngày, Vào/Ra và các khối Mã nhân viên.");
            return result.ToArray();
        } catch (Exception ex) when (ex is not AppException && ex is not OperationCanceledException
            && (ex is IOException or InvalidDataException or ArgumentException or NotSupportedException
                || ex.GetType().Namespace?.StartsWith("ExcelDataReader", StringComparison.Ordinal) == true)) {
            throw new AppException(400, "Tệp Excel không hợp lệ, bị hỏng hoặc có mật khẩu bảo vệ.");
        }
    }

    public static AttendanceImportRow[] ParseGrid(IEnumerable<object?[]> grid, string sheet, string month,
        Dictionary<string, int>? mapping = null, string? dateOrder = null)
    {
        var (monthStart, _) = AttendanceRules.Month(month);
        dateOrder = NormalizeDateOrder(dateOrder);
        if (mapping is not null) ValidateMapping(mapping);
        var result = new List<AttendanceImportRow>();
        var pending = new List<(AttendanceImportRow Row, object? Date, (object? In, object? Out)[] Pairs)>();
        var columns = mapping?.ToDictionary(p => p.Key, p => p.Value - 1) ?? new Dictionary<string, int>();
        var device = "";
        var block = "";
        var preamble = false;
        var number = 0;
        foreach (var cells in grid) {
            number++;
            var text = cells.Select(CellText).ToArray();
            if (text.All(string.IsNullOrWhiteSpace)) continue;
            var keys = text.Select(AttendanceRules.Key).ToArray();
            var dateColumn = Array.FindIndex(keys, k => k is "ngay" or "ngaycong" or "ngaylamviec" or "date" or "workdate");
            var inColumns = keys.Select((key, index) => (key, index)).Where(p => Regex.IsMatch(p.key, "^(vao|in|checkin)[0-9]*$" )).ToArray();
            var outColumns = keys.Select((key, index) => (key, index)).Where(p => Regex.IsMatch(p.key, "^(ra|out|checkout)[0-9]*$" )).ToArray();
            if (dateColumn >= 0 || inColumns.Length > 0 || outColumns.Length > 0) {
                if (mapping is null) {
                    if (dateColumn >= 0) { columns.Clear(); columns["date"] = dateColumn; }
                    AddTimes("in", inColumns);
                    AddTimes("out", outColumns);
                    Add("device", ["manhanvien", "manv", "employeeid", "deviceid", "enrollid", "idchamcong"]);
                    Add("shift", ["ca", "calamviec", "shift"]);
                    Add("hours", ["gio", "giocong", "giolam", "tonggio", "workedhours", "hours", "tgcong"]);
                    Add("late", ["dimuon", "ditre", "muon", "tre", "late"]);
                    Add("early", ["vesom", "som", "early"]);
                    Add("symbol", ["kyhieu", "symbol", "kyhieucong"]);
                }
                preamble = false;
                continue;
            }
            var blockIndex = Array.FindIndex(text, value => Regex.IsMatch(AttendanceRules.Fold(value), @"^(ma nhan vien|ma nv|employee id|enroll id)\b"));
            if (blockIndex >= 0) {
                block = string.Join(" · ", text.Where(t => t.Length > 0));
                var label = AttendanceRules.Fold(text[blockIndex]);
                var match = Regex.Match(label, @"(?:ma nhan vien|ma nv|employee id|enroll id)\s*[:=#]?\s*([a-z0-9._-]+)");
                device = match.Success ? match.Groups[1].Value : text.Skip(blockIndex + 1).FirstOrDefault(t => t.Length > 0) ?? "";
                device = device.Trim();
                // A repeating employee section supplies its own ID, even after a flat-list sheet header.
                if (mapping is null) columns.Remove("device");
                preamble = true;
                continue;
            }
            if (!columns.TryGetValue("date", out var dateIndex)) continue;
            var rawDate = dateIndex < cells.Length ? cells[dateIndex] : null;
            var dateText = CellText(rawDate);
            // The machine repeats numeric totals between the employee heading and its date table.
            // Those cells can occupy the old IN/OUT columns; they are not malformed attendance rows.
            if (preamble) {
                if (ParseDate(rawDate, monthStart, "dmy") is null && ParseDate(rawDate, monthStart, "mdy") is null
                    && !Regex.IsMatch(dateText, @"^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$")) continue;
                preamble = false;
            }
            if (AttendanceRules.Fold(dateText).StartsWith("tong", StringComparison.Ordinal)
                || AttendanceRules.Key(dateText) is "total" or "summary") continue;
            var pairs = new List<(object? In, object? Out)>();
            for (var i = 1; i <= 3; i++) {
                var rawIn = Value($"in{i}");
                var rawOut = Value($"out{i}");
                if (string.IsNullOrWhiteSpace(CellText(rawIn)) && string.IsNullOrWhiteSpace(CellText(rawOut))) continue;
                pairs.Add((rawIn, rawOut));
            }
            var symbol = CellText(Value("symbol"));
            if (dateText.Length == 0 && pairs.Count == 0 && symbol.Length == 0) continue;
            if (!dateText.Any(char.IsDigit) && pairs.Count == 0) continue;
            var rowDevice = columns.ContainsKey("device") ? CellText(Value("device")) : device;
            var shiftText = AttendanceRules.Key(CellText(Value("shift")));
            var shift = shiftText switch {
                "noon" or "trua" or "tructrua" => "noon",
                "evening" or "night" or "toi" or "tructoi" => "evening",
                "" or "main" or "chinh" or "cangay" or "sang" or "chieu" => "main",
                _ => "unknown"
            };
            var row = new AttendanceImportRow {
                Id = Guid.NewGuid(), SheetName = sheet[..Math.Min(128, sheet.Length)], RowNumber = number,
                EmployeeBlock = block[..Math.Min(500, block.Length)], DeviceEnrollId = rowDevice.Length <= 50 ? rowDevice : "",
                RawDate = dateText[..Math.Min(100, dateText.Length)], RawValuesJson = JsonSerializer.Serialize(text),
                ShiftType = shift,
                ReportedHours = Quantity(Value("hours")), LateMinutes = Quantity(Value("late"), minutes: true), EarlyMinutes = Quantity(Value("early"), minutes: true),
                AttendanceSymbol = symbol[..Math.Min(100, symbol.Length)]
            };
            result.Add(row);
            pending.Add((row, rawDate, pairs.ToArray()));
            if (result.Count > MaximumRows) throw new AppException(400, "Mỗi lần nhập tối đa 10.000 dòng ngày công.");

            object? Value(string key) => columns.TryGetValue(key, out var index) && index < cells.Length ? cells[index] : null;
            void Add(string key, string[] aliases) {
                var index = Array.FindIndex(keys, aliases.Contains);
                if (index >= 0) columns[key] = index;
            }
            void AddTimes(string prefix, (string key, int index)[] headers) {
                var slots = new HashSet<int>();
                for (var i = 0; i < headers.Length; i++) {
                    var suffix = Regex.Match(headers[i].key, "[0-9]+$").Value;
                    var slot = suffix.Length == 0 ? i + 1 : int.TryParse(suffix, out var parsedSlot) ? parsedSlot : 0;
                    if (slot is < 1 or > 3 || !slots.Add(slot))
                        throw new AppException(400, $"Trang {sheet}, dòng {number}: chỉ hỗ trợ ba cặp Vào/Ra có số thứ tự duy nhất. Hãy kiểm tra tiêu đề hoặc chọn cột thủ công.");
                    columns[$"{prefix}{slot}"] = headers[i].index;
                }
            }
        }
        var effectiveOrder = dateOrder == "auto" ? InferDateOrder(pending.Select(x => x.Date), monthStart) : dateOrder;
        foreach (var item in pending) {
            item.Row.WorkDate = ParseDate(item.Date, monthStart, effectiveOrder);
            var anchor = item.Row.WorkDate ?? monthStart;
            item.Row.TimePairsJson = JsonSerializer.Serialize(item.Pairs.Select(pair => new AttendanceTimePair(ParseTime(pair.In, anchor), ParseTime(pair.Out, anchor))));
        }
        return result.ToArray();
    }

    private static string CellText(object? value) => value switch {
        null => "", DateTime time => time.ToString("yyyy-MM-dd HH:mm:ss", CultureInfo.InvariantCulture),
        IFormattable formatted => formatted.ToString(null, CultureInfo.InvariantCulture)?.Trim() ?? "", _ => value.ToString()?.Trim() ?? ""
    };
    private static void ValidateMapping(Dictionary<string, int> mapping)
    {
        if (!mapping.ContainsKey("date") || mapping.Any(p => p.Value is < 1 or > 256)
            || !mapping.Keys.Any(k => Regex.IsMatch(k, "^(in|out)[123]$"))
            || !mapping.Keys.All(k => new[] { "date", "device", "shift", "in1", "out1", "in2", "out2", "in3", "out3", "hours", "late", "early", "symbol" }.Contains(k))
            || mapping.Values.Distinct().Count() != mapping.Count)
            throw new AppException(400, "Ánh xạ cần cột Ngày và cột Vào/Ra. Mỗi trường phải dùng một cột riêng, từ 1 đến 256.");
    }
    private static decimal? Quantity(object? value, bool minutes = false)
    {
        decimal Duration(TimeSpan span) => (decimal)(minutes ? span.TotalMinutes : span.TotalHours);
        if (value is DateTime date) return Duration(date.TimeOfDay);
        if (value is TimeSpan time) return time >= TimeSpan.Zero ? Duration(time) : null;
        var text = CellText(value);
        if (TimeSpan.TryParseExact(text, [@"h\:mm", @"hh\:mm", @"h\:mm\:ss", @"hh\:mm\:ss"], CultureInfo.InvariantCulture, out var duration)) return Duration(duration);
        return decimal.TryParse(text.Replace(',', '.'), NumberStyles.Number, CultureInfo.InvariantCulture, out var number) && number is >= 0 and <= 100000 ? number : null;
    }
    public static string NormalizeDateOrder(string? value)
    {
        var order = string.IsNullOrWhiteSpace(value) ? "auto" : value.Trim().ToLowerInvariant();
        return order is "auto" or "dmy" or "mdy" ? order : throw new AppException(400, "Định dạng ngày phải là auto, dmy hoặc mdy.");
    }
    private static string InferDateOrder(IEnumerable<object?> dates, DateOnly month)
    {
        var dmy = false; var mdy = false;
        foreach (var value in dates) {
            if (value is not string) continue;
            var first = ParseDate(value, month, "dmy");
            var second = ParseDate(value, month, "mdy");
            if (first.HasValue && !second.HasValue) dmy = true;
            if (second.HasValue && !first.HasValue) mdy = true;
        }
        return dmy == mdy ? "ambiguous" : dmy ? "dmy" : "mdy";
    }
    private static DateOnly? ParseDate(object? value, DateOnly month, string order)
    {
        if (value is DateTime date) return DateOnly.FromDateTime(date);
        var text = CellText(value);
        if (int.TryParse(text, out var day) && day >= 1 && day <= DateTime.DaysInMonth(month.Year, month.Month)) return new(month.Year, month.Month, day);
        if (value is double serial && serial > 1000 && serial < 2_958_465) return DateOnly.FromDateTime(DateTime.FromOADate(serial));
        if (DateOnly.TryParseExact(text, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var iso)) return iso;
        DateOnly? InOrder(string selected) {
            var formats = selected == "dmy" ? new[] { "dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "d-M-yyyy" }
                : ["MM/dd/yyyy", "M/d/yyyy", "MM-dd-yyyy", "M-d-yyyy"];
            if (DateOnly.TryParseExact(text, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var full)) return full;
            if (DateOnly.TryParseExact(text + "/" + month.Year, formats[..2], CultureInfo.InvariantCulture, DateTimeStyles.None, out var shortDate)) return shortDate;
            return null;
        }
        if (order is "dmy" or "mdy") return InOrder(order);
        var first = InOrder("dmy"); var second = InOrder("mdy");
        return first is null ? second : second is null || first == second ? first : null;
    }
    private static DateTime? ParseTime(object? value, DateOnly date)
    {
        if (value is DateTime time) return time.Year <= 1904 ? date.ToDateTime(TimeOnly.FromDateTime(time)) : time;
        if (value is TimeSpan span && span >= TimeSpan.Zero && span < TimeSpan.FromDays(1)) return date.ToDateTime(TimeOnly.FromTimeSpan(span));
        if (value is double number && number is >= 0 and < 1)
            return date.ToDateTime(TimeOnly.FromTimeSpan(TimeSpan.FromDays(number)));
        if (value is double serial && serial > 1000 && serial < 2_958_465) return DateTime.FromOADate(serial);
        return TimeOnly.TryParseExact(CellText(value), ["HH:mm", "H:mm", "HH:mm:ss", "H:mm:ss"], CultureInfo.InvariantCulture,
            DateTimeStyles.None, out var parsed) ? date.ToDateTime(parsed) : null;
    }
}
