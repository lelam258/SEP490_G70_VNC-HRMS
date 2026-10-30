using System.Text.RegularExpressions;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.Common.Utils;

namespace Vnc.HRMS.Services.Rules;

/// <summary>
/// Pure validation and helper rules for employee profile self-service (UC-11, UC-12).
/// </summary>
public static partial class ProfileRules
{
    private static readonly Regex PhoneRegex = PhoneRegexPattern();
    private static readonly Regex FullNameRegex = FullNameRegexPattern();
    private static readonly Regex IdCardRegex = IdCardRegexPattern();

    [GeneratedRegex(@"^0\d{9}$")]
    private static partial Regex PhoneRegexPattern();

    [GeneratedRegex(@"^[\p{L}\s'\-]+$")]
    private static partial Regex FullNameRegexPattern();

    [GeneratedRegex(@"^\d{12}$")]
    private static partial Regex IdCardRegexPattern();

    private static readonly HashSet<string> ValidGenders = new(StringComparer.OrdinalIgnoreCase)
    {
        "male",
        "female",
        "other"
    };

    /// <summary>
    /// Validates and normalizes full name: required, 2-100 chars, letters/accents/space/'- only.
    /// </summary>
    public static string ValidateAndNormalizeFullName(string? fullName)
    {
        if (string.IsNullOrWhiteSpace(fullName))
        {
            throw new AppException(400, "Họ và tên là bắt buộc.", "fullName");
        }

        var normalized = Regex.Replace(fullName.Trim(), @"\s+", " ");
        if (normalized.Length < 2 || normalized.Length > 100)
        {
            throw new AppException(400, "Họ và tên phải từ 2 đến 100 ký tự.", "fullName");
        }

        if (!FullNameRegex.IsMatch(normalized))
        {
            throw new AppException(400, "Họ và tên chỉ được chứa chữ cái, khoảng trắng, dấu gạch nối và nháy đơn.", "fullName");
        }

        return normalized;
    }

    /// <summary>
    /// Validates date of birth: optional, year >= 1940, at least 18 years old as of today in Vietnam.
    /// </summary>
    public static DateOnly? ValidateDateOfBirth(DateOnly? dateOfBirth)
    {
        if (!dateOfBirth.HasValue) return null;

        var dob = dateOfBirth.Value;
        if (dob.Year < 1940)
        {
            throw new AppException(400, "Năm sinh phải từ năm 1940 trở lại đây.", "dateOfBirth");
        }

        var today = TimeHelper.TodayInVietnam();
        var maxAllowedDob = today.AddYears(-18);
        if (dob > maxAllowedDob)
        {
            throw new AppException(400, "Nhân viên phải từ đủ 18 tuổi trở lên.", "dateOfBirth");
        }

        return dob;
    }

    /// <summary>
    /// Validates and normalizes gender: optional, male | female | other.
    /// </summary>
    public static string? ValidateAndNormalizeGender(string? gender)
    {
        if (string.IsNullOrWhiteSpace(gender)) return null;

        var normalized = gender.Trim().ToLowerInvariant();
        if (!ValidGenders.Contains(normalized))
        {
            throw new AppException(400, "Giới tính không hợp lệ. Vui lòng chọn Nam, Nữ hoặc Khác.", "gender");
        }

        return normalized;
    }

    /// <summary>
    /// Validates citizen ID (CCCD): optional, exactly 12 digits or CLEAR to unset.
    /// </summary>
    public static string? ValidateAndNormalizeIdCardNumber(string? idCardNumber)
    {
        if (idCardNumber is null) return null; // Keep unchanged

        var trimmed = idCardNumber.Trim();
        if (string.IsNullOrEmpty(trimmed)) return null; // Keep unchanged

        if (string.Equals(trimmed, "CLEAR", StringComparison.OrdinalIgnoreCase))
        {
            return "CLEAR";
        }

        if (!IdCardRegex.IsMatch(trimmed))
        {
            throw new AppException(400, "Số CCCD phải gồm đúng 12 chữ số.", "idCardNumber");
        }

        return trimmed;
    }

    /// <summary>
    /// Validates and normalizes phone number: exactly 10 digits starting with 0.
    /// </summary>
    public static string NormalizePhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
        {
            throw new AppException(400, "Số điện thoại là bắt buộc. Vui lòng nhập 10 chữ số bắt đầu bằng 0.", "phone");
        }

        var trimmed = phone.Trim();
        if (!PhoneRegex.IsMatch(trimmed))
        {
            throw new AppException(400, "Số điện thoại không hợp lệ. Vui lòng nhập 10 chữ số bắt đầu bằng 0.", "phone");
        }

        return trimmed;
    }

    /// <summary>
    /// Masks citizen ID number (CCCD), showing only the last 4 digits (e.g., ********1234).
    /// </summary>
    public static string? MaskIdCard(string? idCard)
    {
        if (string.IsNullOrWhiteSpace(idCard)) return null;
        var trimmed = idCard.Trim();
        if (trimmed.Length <= 4) return trimmed;
        return new string('*', trimmed.Length - 4) + trimmed[^4..];
    }
}
