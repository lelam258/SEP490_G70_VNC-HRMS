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
}
