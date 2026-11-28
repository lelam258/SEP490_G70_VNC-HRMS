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

    public const int MinWorkingAge = 18;
    public const int MaxWorkingAgeMale = 62;
    public const int MaxWorkingAgeFemale = 60;

    /// <summary>
    /// Tuổi tối đa theo GB-05: nam 62, nữ 60; giới tính khác/chưa cập nhật dùng mức 62.
    /// </summary>
    public static int GetMaxWorkingAge(string? normalizedGender) =>
        normalizedGender == "female" ? MaxWorkingAgeFemale : MaxWorkingAgeMale;

    /// <summary>
    /// Validates date of birth: optional, year >= 1940, aged 18 to the GB-05 maximum (male 62, female 60) as of today in Vietnam.
    /// Pass the already-normalized gender of the saved profile.
    /// </summary>
    public static DateOnly? ValidateDateOfBirth(DateOnly? dateOfBirth, string? normalizedGender)
    {
        if (!dateOfBirth.HasValue) return null;

        var dob = dateOfBirth.Value;
        if (dob.Year < 1940)
        {
            throw new AppException(400, "Năm sinh phải từ năm 1940 trở lại đây.", "dateOfBirth");
        }

        var today = TimeHelper.TodayInVietnam();
        var maxAllowedDob = today.AddYears(-MinWorkingAge);
        if (dob > maxAllowedDob)
        {
            throw new AppException(400, "Nhân viên phải từ đủ 18 tuổi trở lên.", "dateOfBirth");
        }

        // Đủ (max + 1) tuổi tức là đã quá tuổi tối đa; đúng max tuổi vẫn hợp lệ.
        var maxAge = GetMaxWorkingAge(normalizedGender);
        if (dob <= today.AddYears(-(maxAge + 1)))
        {
            var subject = normalizedGender switch { "male" => "Nhân viên nam", "female" => "Nhân viên nữ", _ => "Nhân viên" };
            throw new AppException(400, $"{subject} không được quá {maxAge} tuổi theo quy định độ tuổi lao động.", "dateOfBirth");
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
