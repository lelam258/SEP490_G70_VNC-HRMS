using System.Globalization;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using Vnc.HRMS.DTOs.Payroll;

namespace Vnc.HRMS.Services.Helpers;

/// <summary>
/// Tạo file PDF khổ A4 cho phiếu lương đã chốt của nhân viên (SRS 6.13).
/// </summary>
public static class PayslipPdfGenerator
{
    private static readonly CultureInfo ViCulture = CultureInfo.GetCultureInfo("vi-VN");

    static PayslipPdfGenerator()
    {
        QuestPDF.Settings.License = LicenseType.Community;
        QuestPDF.Settings.UseSystemFonts = true;
    }

    public static byte[] Generate(PayslipDetailDto detail)
    {
        var totalDeductions = detail.InsuranceDeduction
            + detail.UnionFeeDeduction
            + detail.TaxDeduction
            + detail.OtherDeduction;

        var monthLabel = FormatMonthLabel(detail.PayMonth);
        var exportedAt = TimeZoneInfo.ConvertTimeFromUtc(
            DateTime.UtcNow,
            TimeZoneInfo.CreateCustomTimeZone("VN", TimeSpan.FromHours(7), "Vietnam", "Vietnam"));

        var regularAllowances = detail.Allowances
            .Where(a => !a.Name.Contains("thai sản", StringComparison.OrdinalIgnoreCase))
            .ToList();
        var maternityAllowances = detail.Allowances
            .Where(a => a.Name.Contains("thai sản", StringComparison.OrdinalIgnoreCase))
            .ToList();

        var doc = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.Margin(28);
                page.PageColor(Colors.White);
                page.DefaultTextStyle(x => x.FontFamily("Arial").FontSize(9.5f).FontColor("#0F172A"));

                page.Header().Column(col =>
                {
                    col.Item().Row(row =>
                    {
                        row.RelativeItem().Column(left =>
                        {
                            left.Item().Text("PHÒNG KHÁM ĐA KHOA VIỆT NHẬT — VNC HRMS")
                                .FontSize(8.5f).SemiBold().FontColor("#0F766E");
                            left.Item().PaddingTop(2).Text($"PHIẾU LƯƠNG {monthLabel.ToUpper(ViCulture)}")
                                .FontSize(16).Bold().FontColor("#0F172A");
                        });

                        row.AutoItem().AlignRight().AlignMiddle()
                            .Background("#ECFDF5").Border(1).BorderColor("#A7F3D0")
                            .PaddingVertical(4).PaddingHorizontal(10)
                            .Text("ĐÃ CHỐT CHÍNH THỨC")
                            .FontSize(8.5f).SemiBold().FontColor("#047857");
                    });

                    col.Item().PaddingTop(8).LineHorizontal(1).LineColor("#CBD5E1");
                });

                page.Content().PaddingTop(10).Column(col =>
                {
                    col.Spacing(10);

                    // 1. Thông tin nhân viên & Hợp đồng
                    col.Item().Background("#F8FAFC").Border(1).BorderColor("#E2E8F0").Padding(10).Row(row =>
                    {
                        row.RelativeItem().Column(left =>
                        {
                            left.Spacing(4);
                            InfoLine(left, "Họ và tên:", detail.StaffName ?? "—", true);
                            InfoLine(left, "Mã nhân viên:", detail.StaffCode ?? "—", true);
                            InfoLine(left, "Khoa / Phòng:", detail.DepartmentName ?? "—");
                            InfoLine(left, "Chức vụ:", detail.PositionName ?? "—");
                        });

                        row.ConstantItem(16);

                        row.RelativeItem().Column(right =>
                        {
                            right.Spacing(4);
                            var salaryTypeLabel = string.Equals(detail.SalaryType, "daily", StringComparison.OrdinalIgnoreCase)
                                ? "Lương ngày"
                                : "Lương tháng";
                            InfoLine(right, "Hợp đồng:", $"{detail.ContractCode ?? "—"} ({salaryTypeLabel})");

                            var salaryBasis = string.Equals(detail.SalaryType, "daily", StringComparison.OrdinalIgnoreCase)
                                ? $"{FormatVnd(detail.DailyRate)} /ngày"
                                : $"{FormatVnd(detail.MonthlySalary ?? 0m)} /tháng ({FormatNum(detail.StandardWorkingDays)} công chuẩn)";
                            InfoLine(right, "Căn cứ lương:", salaryBasis, true);

                            var insLabel = detail.IsInsuranceEligible ? FormatVnd(detail.InsuranceSalaryBase) : "Không đóng";
                            InfoLine(right, "Lương đóng BHXH:", insLabel);

                            var workParts = new List<string> { $"{FormatNum(detail.WorkDays)} công" };
                            if (detail.NoonDutyCount > 0) workParts.Add($"{FormatNum(detail.NoonDutyCount)} trực trưa");
                            if (detail.EveningDutyCount > 0) workParts.Add($"{FormatNum(detail.EveningDutyCount)} trực tối");
                            if (detail.OvertimeHours > 0) workParts.Add($"{FormatNum(detail.OvertimeHours)}h ngoài giờ");
                            InfoLine(right, "Công & Ca trực:", string.Join(" · ", workParts));
                        });
                    });

                    // 2. Ba thẻ tổng quan Gross / Khấu trừ / Net
                    col.Item().Row(row =>
                    {
                        row.Spacing(8);
                        SummaryBox(row.RelativeItem(), "Tổng thu nhập (Gross)", FormatVnd(detail.GrossPay), "#FFFFFF", "#CBD5E1", "#0F172A");
                        SummaryBox(row.RelativeItem(), "Tổng khấu trừ", $"-{FormatVnd(totalDeductions)}", "#FFFFFF", "#CBD5E1", "#BE123C");
                        SummaryBox(row.RelativeItem(), "Thực lĩnh (Net Pay)", FormatVnd(detail.NetPay), "#F0FDFA", "#99F6E4", "#0F766E");
                    });

                    // 3. Bảng 1: Các khoản thu nhập & Phụ cấp
                    col.Item().Border(1).BorderColor("#E2E8F0").Column(box =>
                    {
                        box.Item().Background("#F1F5F9").PaddingVertical(5).PaddingHorizontal(10)
                            .Text("1. CÁC KHOẢN THU NHẬP & PHỤ CẤP").FontSize(9).Bold().FontColor("#334155");

                        box.Item().Padding(10).Column(list =>
                        {
                            list.Spacing(4);
                            AmountRow(list, $"Lương theo ngày công ({FormatNum(detail.WorkDays)} công)", FormatVnd(detail.BasePay), true);

                            if (detail.NoonDutyPay > 0)
                                AmountRow(list, $"Tiền trực trưa ({FormatNum(detail.NoonDutyCount)} buổi)", FormatVnd(detail.NoonDutyPay));
                            if (detail.EveningDutyPay > 0)
                                AmountRow(list, $"Tiền trực tối ({FormatNum(detail.EveningDutyCount)} buổi)", FormatVnd(detail.EveningDutyPay));
                            if (detail.OvertimePay > 0)
                                AmountRow(list, $"Tiền trực ngoài giờ ({FormatNum(detail.OvertimeHours)} giờ)", FormatVnd(detail.OvertimePay));
                            if (detail.OnCallPay > 0)
                                AmountRow(list, $"Tiền trực chuyên môn ({FormatNum(detail.OnCallDays)} ca)", FormatVnd(detail.OnCallPay));

                            foreach (var a in regularAllowances)
                            {
                                AmountRow(list, $"Phụ cấp: {a.Name}", FormatVnd(a.Amount));
                            }

                            foreach (var m in maternityAllowances)
                            {
                                list.Item().Background("#F0F9FF").PaddingVertical(3).PaddingHorizontal(6).Row(r =>
                                {
                                    r.RelativeItem().Text(m.Name).FontColor("#0369A1").SemiBold();
                                    r.AutoItem().Text(FormatVnd(m.Amount)).FontColor("#0369A1").Bold();
                                });
                            }

                            AmountRow(list, "Hoa hồng thủ thuật & CLS", FormatVnd(detail.CommissionTotal), true);
                        });

                        box.Item().Background("#F8FAFC").BorderTop(1).BorderColor("#E2E8F0")
                            .PaddingVertical(6).PaddingHorizontal(10).Row(r =>
                            {
                                r.RelativeItem().Text("Tổng thu nhập (Gross)").Bold();
                                r.AutoItem().Text(FormatVnd(detail.GrossPay)).FontSize(10.5f).Bold();
                            });
                    });

                    // 4. Bảng 2: Các khoản khấu trừ & Thuế TNCN
                    col.Item().Border(1).BorderColor("#E2E8F0").Column(box =>
                    {
                        box.Item().Background("#F1F5F9").PaddingVertical(5).PaddingHorizontal(10)
                            .Text("2. CÁC KHOẢN KHẤU TRỪ & THUẾ TNCN").FontSize(9).Bold().FontColor("#334155");

                        box.Item().Padding(10).Column(list =>
                        {
                            list.Spacing(4);

                            if (detail.Deductions.Count > 0)
                            {
                                foreach (var d in detail.Deductions)
                                {
                                    var label = d.RatePercent.HasValue
                                        ? $"{d.DeductionName} ({FormatNum(d.RatePercent.Value)}%)"
                                        : d.DeductionName;
                                    AmountRow(list, label, $"-{FormatVnd(d.Amount)}", false, "#BE123C");
                                }
                            }
                            else
                            {
                                AmountRow(list, "BHXH, BHYT, BHTN (NLĐ đóng)",
                                    detail.InsuranceDeduction > 0 ? $"-{FormatVnd(detail.InsuranceDeduction)}" : "0 ₫",
                                    false, detail.InsuranceDeduction > 0 ? "#BE123C" : "#334155");
                                if (detail.UnionFeeDeduction > 0)
                                    AmountRow(list, "Đoàn phí công đoàn", $"-{FormatVnd(detail.UnionFeeDeduction)}", false, "#BE123C");
                                if (detail.OtherDeduction > 0)
                                    AmountRow(list, "Khấu trừ khác", $"-{FormatVnd(detail.OtherDeduction)}", false, "#BE123C");
                            }

                            list.Item().PaddingTop(4).LineHorizontal(0.5f).LineColor("#E2E8F0");
                            AmountRow(list, "Thuế thu nhập cá nhân (TNCN)",
                                detail.TaxDeduction > 0 ? $"-{FormatVnd(detail.TaxDeduction)}" : "0 ₫",
                                true, detail.TaxDeduction > 0 ? "#BE123C" : "#334155");

                            list.Item().Background("#F8FAFC").Border(1).BorderColor("#E2E8F0").Padding(7).Column(tax =>
                            {
                                tax.Spacing(2.5f);
                                AmountRow(tax, "Giảm trừ bản thân:", FormatVnd(detail.PersonalDeduction), false, "#334155", 8.5f);
                                AmountRow(tax, $"Giảm trừ người phụ thuộc ({detail.DependentCount} người):", FormatVnd(detail.DependentDeduction), false, "#334155", 8.5f);
                                AmountRow(tax, "Thu nhập tính thuế:", FormatVnd(detail.TaxableIncome), true, "#0F172A", 8.5f);

                                if (detail.TaxDeduction > 0 && detail.TaxBrackets.Count > 0)
                                {
                                    tax.Item().PaddingTop(3).LineHorizontal(0.5f).LineColor("#E2E8F0");
                                    foreach (var b in detail.TaxBrackets)
                                    {
                                        AmountRow(tax,
                                            $"Bậc {b.BracketIndex} ({FormatNum(b.RatePercent)}% × {FormatVnd(b.TaxableAmount)}):",
                                            FormatVnd(b.TaxAmount), false, "#334155", 8.5f);
                                    }
                                }
                            });
                        });

                        box.Item().Background("#F8FAFC").BorderTop(1).BorderColor("#E2E8F0")
                            .PaddingVertical(6).PaddingHorizontal(10).Row(r =>
                            {
                                r.RelativeItem().Text("Tổng các khoản khấu trừ").Bold();
                                r.AutoItem().Text($"-{FormatVnd(totalDeductions)}").FontSize(10.5f).Bold().FontColor("#BE123C");
                            });
                    });

                    // 5. Thanh tổng Thực lĩnh nổi bật
                    col.Item().Background("#0F766E").PaddingVertical(10).PaddingHorizontal(14).Row(r =>
                    {
                        r.RelativeItem().AlignMiddle().Text("SỐ TIỀN THỰC LĨNH (NET PAY)")
                            .FontSize(10.5f).Bold().FontColor(Colors.White);
                        r.AutoItem().AlignMiddle().Text(FormatVnd(detail.NetPay))
                            .FontSize(15).Bold().FontColor(Colors.White);
                    });
                });

                page.Footer().PaddingTop(8).BorderTop(0.5f).BorderColor("#E2E8F0").PaddingTop(5).Row(r =>
                {
                    r.RelativeItem().Text("Phiếu lương điện tử được xuất từ hệ thống VNC HRMS (bản chỉ đọc).")
                        .FontSize(8).FontColor("#64748B");
                    r.AutoItem().Text($"Ngày xuất: {exportedAt:dd/MM/yyyy HH:mm}")
                        .FontSize(8).FontColor("#64748B");
                });
            });
        });

        return doc.GeneratePdf();
    }

    private static void InfoLine(ColumnDescriptor col, string label, string value, bool boldValue = false)
    {
        col.Item().Row(r =>
        {
            r.ConstantItem(96).Text(label).FontSize(9).FontColor("#64748B");
            var valText = r.RelativeItem().AlignRight().Text(value).FontSize(9);
            if (boldValue) valText.SemiBold().FontColor("#0F172A");
            else valText.FontColor("#1E293B");
        });
    }

    private static void SummaryBox(
        IContainer container, string label, string value, string bg, string border, string valueColor)
    {
        container.Background(bg).Border(1).BorderColor(border).PaddingVertical(7).PaddingHorizontal(10).Column(c =>
        {
            c.Item().Text(label).FontSize(8.5f).FontColor("#64748B");
            c.Item().PaddingTop(2).Text(value).FontSize(12).Bold().FontColor(valueColor);
        });
    }

    private static void AmountRow(
        ColumnDescriptor col,
        string label,
        string amount,
        bool bold = false,
        string amountColor = "#0F172A",
        float fontSize = 9.5f)
    {
        col.Item().Row(r =>
        {
            var left = r.RelativeItem().Text(label).FontSize(fontSize).FontColor("#334155");
            var right = r.AutoItem().Text(amount).FontSize(fontSize).FontColor(amountColor);
            if (bold)
            {
                left.SemiBold().FontColor("#0F172A");
                right.Bold();
            }
        });
    }

    private static string FormatVnd(decimal amount)
        => $"{Math.Round(amount, 0, MidpointRounding.AwayFromZero).ToString("#,##0", ViCulture)} ₫";

    private static string FormatNum(decimal value)
        => value == Math.Truncate(value)
            ? ((long)value).ToString(ViCulture)
            : value.ToString("0.##", ViCulture);

    private static string FormatMonthLabel(string payMonth)
    {
        var parts = payMonth.Split('-');
        return parts.Length == 2 && int.TryParse(parts[1], out var m)
            ? $"Tháng {m}/{parts[0]}"
            : payMonth;
    }
}
