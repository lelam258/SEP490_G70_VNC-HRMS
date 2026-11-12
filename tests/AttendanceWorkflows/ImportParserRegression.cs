using System.Text.Json;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Attendance;
using Vnc.HRMS.Services;
using Vnc.HRMS.Services.Rules;

internal static class ImportParserRegression
{
    public static void Run(Action<bool, string> check)
    {
        const string month = "2026-11";
        static AttendanceTimePair[] Pairs(Vnc.HRMS.Models.AttendanceImportRow row)
            => JsonSerializer.Deserialize<AttendanceTimePair[]>(row.TimePairsJson)!;
        static bool Rejected(Action action) {
            try { action(); return false; } catch (AppException error) when (error.StatusCode == 400) { return true; }
        }
        var quantities = AttendanceWorkbookParser.ParseGrid([
            ["Mã nhân viên: 1"], ["Ngày", "Vào", "Ra", "Giờ công", "Đi muộn", "Về sớm"],
            ["2026-11-02", "07:00", "11:30", "04:30", "00:30", "00:15"],
            ["2026-11-03", "07:00", "11:30", TimeSpan.FromHours(4.5), TimeSpan.FromMinutes(30), new DateTime(1899, 12, 30, 0, 15, 0)],
            ["2026-11-04", "07:00", "11:30", 4.5, 30d, 15d]
        ], "Durations", month);
        check(quantities.All(x => x.ReportedHours == 4.5m && x.LateMinutes == 30m && x.EarlyMinutes == 15m),
            "Duration cells keep reported hours in hours and late/early values in minutes");

        var blocks = AttendanceWorkbookParser.ParseGrid([
            ["Ngày", "Mã nhân viên", "Vào 1", "Ra 1", "Vào 2", "Ra 2", "Giờ công"],
            ["2026-11-02", "1", "07:00", "11:30", "13:30", "17:00", 8],
            ["Mã nhân viên: 2"], ["Ngày", "Vào 1", "Ra 1"], ["2026-11-03", "08:00", "12:00"]
        ], "Changing headers", month);
        check(blocks.Length == 2 && blocks[1].DeviceEnrollId == "2" && Pairs(blocks[1]).Length == 1 && blocks[1].ReportedHours is null,
            "New employee headers replace old device, time and summary column mappings");

        var sparse = AttendanceWorkbookParser.ParseGrid([
            ["Mã nhân viên: 1"], ["Ngày", "Vào 1", "Ra 1", "Ra 2", "Vào 3", "Ra 3"],
            ["2026-11-02", "07:00", "09:00", "11:30", "13:30", "17:00"]
        ], "Missing input column", month);
        check(Pairs(sparse[0]).Length == 3 && Pairs(sparse[0])[1].In is null && Pairs(sparse[0])[1].Out?.Hour == 11
            && Pairs(sparse[0])[2].In?.Hour == 13, "Numbered IN/OUT headers keep their pair number when an input column is missing");

        var overnight = AttendanceWorkbookParser.ParseGrid([
            ["Mã nhân viên: 1"], ["Ngày", "Vào", "Ra"],
            ["2026-11-02", new DateTime(2026, 11, 2, 17, 0, 0), new DateTime(2026, 11, 3, 18, 0, 0)]
        ], "Full timestamps", month);
        check(Pairs(overnight[0])[0].Out?.Day == 3 && Rejected(() => AttendanceRules.Hours(Pairs(overnight[0]), new(2026, 11, 2))),
            "Full timestamps preserve the source date so overnight punches cannot become same-day attendance");
        var integerTime = AttendanceWorkbookParser.ParseGrid([
            ["Employee ID", "Date", "In", "Out"], ["1", 2d, 0d, 1d]
        ], "Excel serial boundary", month);
        check(Pairs(integerTime[0])[0].Out is null, "Excel serial 1 is not silently guessed to mean 01:00");
        check(Rejected(() => AttendanceWorkbookParser.ParseGrid([["Ngày", "Vào", "Ra"], ["02/11/2026", "07:00", "11:30"]], "Mapping", month,
                new() { ["date"] = 1, ["in1"] = 2, ["out1"] = 2 })), "Manual mappings cannot reuse one source column for different fields");
        check(Rejected(() => AttendanceWorkbookParser.ParseGrid([["Ngày", "Vào 1", "Ra 1", "Vào 4", "Ra 4"]], "Extra pair", month)),
            "Unsupported fourth IN/OUT pairs are reported instead of silently discarded");
        var longId = new string('1', 51);
        var longDevice = AttendanceWorkbookParser.ParseGrid([["Employee ID", "Date", "In", "Out"], [longId, "02/11/2026", "07:00", "11:30"]], "Long ID", month);
        check(longDevice[0].DeviceEnrollId.Length == 0 && longDevice[0].RawValuesJson.Contains(longId),
            "Overlong device IDs retain raw evidence without matching a truncated identity");

        var export = AttendanceWorkbookParser.ParseGrid(DeviceExportLayout(), "Machine export", "2026-08");
        check(export.Length == 4 && export.All(x => x.WorkDate?.Month == 8) && export[0].WorkDate == new DateOnly(2026, 8, 1),
            "The real machine's two-line header and M/D/YYYY dates yield only work-date rows, without repeated summary rows");
        check(export[0].LateMinutes == 20m && export[0].EarlyMinutes == 2m && export[0].ReportedHours == 24m && export[0].AttendanceSymbol == "XXX",
            "Machine headers Trễ, Sớm, Giờ and Ký hiệu map their own columns across both header lines");
        check(export[3].DeviceEnrollId == "100" && Pairs(export[0]).Length == 3 && Pairs(export[3]).Length == 2,
            "Repeating employee blocks retain both enrollment IDs and all original repeated punches");
        var ambiguous = AttendanceWorkbookParser.ParseGrid([["Employee ID", "Date", "In", "Out"], ["1", "8/1/2026", "07:00", "17:00"]], "Ambiguous dates", "2026-08");
        check(ambiguous[0].WorkDate is null, "Auto detection does not guess ambiguous day/month order from the selected payroll month");
        var explicitMdy = AttendanceWorkbookParser.ParseGrid([["Employee ID", "Date", "In", "Out"], ["1", "8/1/2026", "07:00", "17:00"]], "Explicit dates", "2026-08", dateOrder: "mdy");
        var explicitDmy = AttendanceWorkbookParser.ParseGrid([["Employee ID", "Date", "In", "Out"], ["1", "8/1/2026", "07:00", "17:00"]], "Explicit dates", "2026-08", dateOrder: "dmy");
        check(explicitMdy[0].WorkDate == new DateOnly(2026, 8, 1) && explicitDmy[0].WorkDate == new DateOnly(2026, 1, 8),
            "An explicit date-order choice is respected without clamping dates into the selected month");
        check(Rejected(() => AttendanceWorkbookParser.NormalizeDateOrder("guess")), "Unknown date-order settings are rejected");
        var repeatedHours = AttendanceRules.ImportHours(Pairs(export[0]), new(2026, 8, 1));
        check(repeatedHours.RepeatedPairs && repeatedHours.Hours == 10m && Pairs(export[0]).Length == 3,
            "Exact repeated punches count each elapsed interval once while preserving raw pairs and a warning flag");
        check(Rejected(() => AttendanceRules.ImportHours(Pairs(export[1]), new(2026, 8, 13))), "Repeated but incomplete punches remain hard errors");
        check(Rejected(() => AttendanceRules.ImportHours([new(new(2026, 8, 1, 7, 0, 0), new(2026, 8, 1, 12, 0, 0)), new(new(2026, 8, 1, 11, 0, 0), new(2026, 8, 1, 17, 0, 0))], new(2026, 8, 1))),
            "Different overlapping intervals are never normalized as identical machine duplicates");
    }

    // Synthetic identities and values; the two-line layout matches the supplied machine export.
    public static object?[][] DeviceExportLayout() => [
        ["Mã nhân viên: 1", "Tên nhân viên: Người thử A"],
        ["Tổng giờ", null, 100], ["Tổng công", null, 10], ["Tăng ca", null, 12d, 1d],
        ["Chi tiết"],
        ["Ngày", "Thứ", 1, null, 2, null, 3, null, "Trễ", "Sớm", "Về trễ", "Giờ", "Công", "T.Ca1", "T.Ca2", "T.Ca3", "T.Ca4", "Ký hiệu"],
        [null, null, "Vào", "Ra", "Vào", "Ra", "Vào", "Ra"],
        ["8/1/2026", "Bảy", "07:00", "17:00", "07:00", "17:00", "07:00", "17:00", 20, 2, 0, 24, 3, 0, 0, 0, 0, "XXX"],
        ["8/13/2026", "Năm", "07:00", null, "07:00", null, "07:00", null, 0, 0, 0, 0, 0, 0, 0, 0, 0, "OOO"],
        ["8/14/2026", "Sáu", null, null, null, null, null, null, 0, 0, 0, 0, 0, 0, 0, 0, 0, "VVV"],
        ["Mã nhân viên: 100", "Tên nhân viên: Người thử B"],
        ["Tổng giờ", null, 100], ["Tổng công", null, 10], ["Tăng ca", null, 12d, 1d],
        ["Chi tiết"],
        ["Ngày", "Thứ", 1, null, 2, null, 3, null, "Trễ", "Sớm", "Về trễ", "Giờ", "Công", "T.Ca1", "T.Ca2", "T.Ca3", "T.Ca4", "Ký hiệu"],
        [null, null, "Vào", "Ra", "Vào", "Ra", "Vào", "Ra"],
        ["8/31/2026", "Hai", "07:00", "17:00", "07:00", "17:00", null, null, 0, 0, 0, 16, 2, 0, 0, 0, 0, "XX"]
    ];
}
