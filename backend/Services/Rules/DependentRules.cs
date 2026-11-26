using System.Text.RegularExpressions;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.Common.Utils;

namespace Vnc.HRMS.Services.Rules;

public static partial class DependentRules
{
    private static readonly Regex Digits12Regex = Digits12Pattern();
    private static readonly Regex TaxCodeRegex = TaxCodePattern();

    [GeneratedRegex(@"^\d{12}$")]
    private static partial Regex Digits12Pattern();

    [GeneratedRegex(@"^(\d{10}|\d{13})$")]
    private static partial Regex TaxCodePattern();

    private static readonly HashSet<string> ValidGenders = new(StringComparer.OrdinalIgnoreCase)
    {
        "male", "female", "other"
    };

    private static readonly HashSet<string> ValidRelationships = new(StringComparer.OrdinalIgnoreCase)
    {
        "father", "mother", "child", "spouse", "other"
    };

    private static readonly HashSet<string> ValidDocumentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "birth_certificate", "id_card", "marriage_certificate", "student_confirmation", "disability_certificate", "other"
    };

    private static readonly HashSet<string> ValidVerificationStatuses = new(StringComparer.OrdinalIgnoreCase)
    {
        "pending", "verified", "rejected", "expired"
    };

    public static string ValidateFullName(string? fullName)
        => ProfileRules.ValidateAndNormalizeFullName(fullName);

    public static DateOnly ValidateDateOfBirth(DateOnly dateOfBirth)
    {
        if (dateOfBirth.Year < 1900)
            throw new AppException(400, "Năm sinh người phụ thuộc phải từ năm 1900 trở lại đây.", "dateOfBirth");

        var today = TimeHelper.TodayInVietnam();
        if (dateOfBirth > today)
            throw new AppException(400, "Ngày sinh người phụ thuộc không được lớn hơn ngày hiện tại.", "dateOfBirth");

        return dateOfBirth;
    }

    public static string ValidateGender(string? gender)
    {
        if (string.IsNullOrWhiteSpace(gender))
            throw new AppException(400, "Vui lòng chọn giới tính người phụ thuộc.", "gender");

        var normalized = gender.Trim().ToLowerInvariant();
        if (!ValidGenders.Contains(normalized))
            throw new AppException(400, "Giới tính không hợp lệ. Vui lòng chọn Nam, Nữ hoặc Khác.", "gender");

        return normalized;
    }

    public static string ValidateRelationship(string? relationship)
    {
        if (string.IsNullOrWhiteSpace(relationship))
            throw new AppException(400, "Vui lòng chọn mối quan hệ với nhân viên.", "relationship");

        var normalized = relationship.Trim().ToLowerInvariant();
        if (!ValidRelationships.Contains(normalized))
            throw new AppException(400, "Mối quan hệ không hợp lệ (chỉ chấp nhận Cha, Mẹ, Con, Vợ/Chồng hoặc Người thân khác).", "relationship");

        return normalized;
    }

    public static string? ValidateIdCardNumber(string? idCardNumber)
    {
        if (string.IsNullOrEmpty(idCardNumber))
            return null;

        if (idCardNumber.Any(char.IsWhiteSpace))
            throw new AppException(400, "Số CCCD không được chứa khoảng trắng.", "idCardNumber");

        if (!Digits12Regex.IsMatch(idCardNumber))
            throw new AppException(400, "Số CCCD chỉ được gồm đúng 12 chữ số (không chứa số âm, chữ cái hay ký tự đặc biệt).", "idCardNumber");

        return idCardNumber;
    }

    public static string? ValidateTaxCode(string? taxCode)
    {
        if (string.IsNullOrEmpty(taxCode))
            return null;

        if (taxCode.Any(char.IsWhiteSpace))
            throw new AppException(400, "Mã số thuế không được chứa khoảng trắng.", "taxCode");

        if (!TaxCodeRegex.IsMatch(taxCode))
            throw new AppException(400, "Mã số thuế chỉ được gồm 10 hoặc 13 chữ số (không chứa số âm, khoảng trắng hay ký tự đặc biệt).", "taxCode");

        return taxCode;
    }

    public static string ValidateDocumentType(string? documentType)
    {
        if (string.IsNullOrWhiteSpace(documentType))
            throw new AppException(400, "Vui lòng chọn loại giấy tờ minh chứng.", "documentType");

        var normalized = documentType.Trim().ToLowerInvariant();
        if (!ValidDocumentTypes.Contains(normalized))
            throw new AppException(400, "Loại giấy tờ minh chứng không hợp lệ.", "documentType");

        return normalized;
    }

    public static string ValidateFileName(string? fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
            throw new AppException(400, "Tên tài liệu minh chứng là bắt buộc.", "fileName");

        var trimmed = fileName.Trim();
        if (trimmed.Length > 255)
            throw new AppException(400, "Tên tài liệu minh chứng tối đa 255 ký tự.", "fileName");

        return trimmed;
    }

    public static string? ValidateFileUrl(string? fileUrl)
    {
        if (string.IsNullOrEmpty(fileUrl))
            return null;

        if (fileUrl.Any(char.IsWhiteSpace))
            throw new AppException(400, "Đường dẫn tài liệu không được chứa khoảng trắng.", "fileUrl");

        if (fileUrl.Length > 500)
            throw new AppException(400, "Đường dẫn tài liệu tối đa 500 ký tự.", "fileUrl");

        return fileUrl;
    }

    public static string ValidateVerificationStatus(string? status)
    {
        if (string.IsNullOrWhiteSpace(status))
            throw new AppException(400, "Trạng thái kiểm tra là bắt buộc.", "verificationStatus");

        var normalized = status.Trim().ToLowerInvariant();
        if (!ValidVerificationStatuses.Contains(normalized))
            throw new AppException(400, "Trạng thái kiểm tra không hợp lệ.", "verificationStatus");

        return normalized;
    }
}
