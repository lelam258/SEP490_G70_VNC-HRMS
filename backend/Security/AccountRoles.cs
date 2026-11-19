namespace Vnc.HRMS.Security;

public static class AccountRoles
{
    public const string Administrator = "admin";
    public const string HrManager = "hr_manager";
    public const string HrStaff = "hr_staff";
    public const string Accountant = "accountant";
    public const string DepartmentManager = "department_head";
    public const string MedicalStaff = "employee";
    public static readonly IReadOnlyList<string> All = Array.AsReadOnly(new[] {
        Administrator, HrManager, HrStaff, Accountant, DepartmentManager, MedicalStaff
    });

    // Chuẩn hóa mã vai trò cũ (medical_staff -> employee) trực tiếp ở tầng ứng dụng
    public static string Normalize(string? role)
    {
        if (string.IsNullOrWhiteSpace(role)) return MedicalStaff;
        var trimmed = role.Trim();
        return string.Equals(trimmed, "medical_staff", StringComparison.OrdinalIgnoreCase)
            ? MedicalStaff
            : trimmed;
    }
}
