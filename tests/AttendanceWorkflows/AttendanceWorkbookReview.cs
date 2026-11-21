using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using ExcelDataReader;
using Vnc.HRMS.DTOs.Attendance;
using Vnc.HRMS.Services;
using Vnc.HRMS.Services.Rules;

internal static class AttendanceWorkbookReview
{
    // Read the supplied source in place. Output aggregates only, never employee names or enrollment IDs.
    public static void Run(string path, string month)
    {
        using var file = File.Open(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
        using var memory = new MemoryStream(); file.CopyTo(memory);
        var bytes = memory.ToArray();
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
        using var source = new MemoryStream(bytes);
        using var reader = ExcelReaderFactory.CreateReader(source);
        var sourceDays = 0; var sourceBlocks = 0; var headers = new HashSet<string>();
        do {
            while (reader.Read()) {
                var cells = Enumerable.Range(0, reader.FieldCount).Select(i => Convert.ToString(reader.GetValue(i), CultureInfo.InvariantCulture)?.Trim() ?? "").ToArray();
                if (cells.Any(value => AttendanceRules.Fold(value).StartsWith("ma nhan vien", StringComparison.Ordinal))) sourceBlocks++;
                if (cells.Any(value => value == "Ngày")) headers.Add(string.Join(" | ", cells));
                if (cells.Length > 0 && Regex.IsMatch(cells[0], @"^\d{1,2}/\d{1,2}/\d{4}$")) sourceDays++;
            }
        } while (reader.NextResult());
        var rows = new AttendanceWorkbookParser().Parse(bytes, month);
        var hardTimeErrors = 0; var noPunches = 0; var incomplete = 0; var overlaps = 0; var repeated = 0; var hoursMismatch = 0; var repeatedPairWarnings = 0;
        var weekdayChecks = 0; var weekdayMismatches = 0;
        var weekdays = new Dictionary<string, DayOfWeek> { ["cn"] = DayOfWeek.Sunday, ["hai"] = DayOfWeek.Monday, ["ba"] = DayOfWeek.Tuesday,
            ["tu"] = DayOfWeek.Wednesday, ["nam"] = DayOfWeek.Thursday, ["sau"] = DayOfWeek.Friday, ["bay"] = DayOfWeek.Saturday };
        foreach (var row in rows) {
            var pairs = JsonSerializer.Deserialize<AttendanceTimePair[]>(row.TimePairsJson)!;
            if (pairs.Length == 0) noPunches++;
            if (pairs.Any(pair => pair.In is null || pair.Out is null)) incomplete++;
            if (pairs.Length > pairs.Distinct().Count()) repeated++;
            if (pairs.Zip(pairs.Skip(1)).Any(pair => pair.First.Out > pair.Second.In)) overlaps++;
            if (row.WorkDate.HasValue) {
                var raw = JsonSerializer.Deserialize<string[]>(row.RawValuesJson)!;
                if (raw.Length > 1 && weekdays.TryGetValue(AttendanceRules.Fold(raw[1]), out var weekday)) {
                    weekdayChecks++; if (row.WorkDate.Value.DayOfWeek != weekday) weekdayMismatches++;
                }
                try { var calculation = AttendanceRules.ImportHours(pairs, row.WorkDate.Value); if (calculation.RepeatedPairs) repeatedPairWarnings++;
                    if (row.ReportedHours.HasValue && Math.Abs(calculation.Hours - row.ReportedHours.Value) > .05m) hoursMismatch++; }
                catch (Vnc.HRMS.Common.Exceptions.AppException) { hardTimeErrors++; }
            }
        }
        var summary = new {
            sourceBlocks, sourceDays, parsedRows = rows.Length, missingDeviceIds = rows.Count(row => row.DeviceEnrollId.Length == 0),
            uniqueDeviceIds = rows.Select(row => row.DeviceEnrollId).Distinct().Count(),
            dates = rows.GroupBy(row => row.WorkDate?.ToString("yyyy-MM") ?? "invalid").ToDictionary(group => group.Key, group => group.Count()),
            firstDate = rows.Min(row => row.WorkDate), lastDate = rows.Max(row => row.WorkDate),
            pairs = rows.GroupBy(row => JsonSerializer.Deserialize<AttendanceTimePair[]>(row.TimePairsJson)!.Length).ToDictionary(group => group.Key, group => group.Count()),
            hardTimeErrors, noPunches, incomplete, overlaps, repeated, hoursMismatch, repeatedPairWarnings, weekdayChecks, weekdayMismatches,
            nonzeroLateRows = rows.Count(row => row.LateMinutes > 0), nonzeroEarlyRows = rows.Count(row => row.EarlyMinutes > 0),
            symbols = rows.GroupBy(row => row.AttendanceSymbol).ToDictionary(group => group.Key ?? "", group => group.Count()), headers
        };
        Console.WriteLine(JsonSerializer.Serialize(summary, new JsonSerializerOptions { WriteIndented = true }));
        if (sourceDays != rows.Length || rows.Any(row => row.WorkDate is null || row.WorkDate.Value.ToString("yyyy-MM") != month) || rows.Any(row => row.DeviceEnrollId.Length == 0) || weekdayMismatches > 0)
            throw new InvalidOperationException("Source coverage, date normalization or employee-block parsing did not match the supplied workbook.");
    }
}
