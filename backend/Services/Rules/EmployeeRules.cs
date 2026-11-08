using System.ComponentModel.DataAnnotations;
using Vnc.HRMS.Common.Exceptions;

namespace Vnc.HRMS.Services.Rules;

public static class EmployeeRules
{
    public static string? NormalizeEmail(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var email = value.Trim().ToLowerInvariant();
        if (email.Length > 100 || !new EmailAddressAttribute().IsValid(email))
            throw new AppException(400, "Email không hợp lệ hoặc vượt quá 100 ký tự.", "email");
        return email;
    }

    public static void EnsureEmploymentDates(DateOnly joined, DateOnly? left, DateOnly? birth = null)
    {
        if (joined == default)
            throw new AppException(400, "Ngày vào làm không hợp lệ.", "dateJoined");
        if (birth.HasValue && joined <= birth.Value)
            throw new AppException(400, "Ngày vào làm phải sau ngày sinh.", "dateJoined");
        if (left.HasValue && left.Value < joined)
            throw new AppException(400, "Ngày nghỉ việc phải sau hoặc bằng ngày vào làm.", "dateLeft");
    }

    public static void EnsureWorkingPeriod(DateOnly from, DateOnly to, DateOnly joined, DateOnly? left)
    {
        if (from < joined || (left.HasValue && to > left.Value))
            throw new AppException(400, "Khoảng ngày phải nằm trong thời gian công tác của nhân viên.");
    }
}
