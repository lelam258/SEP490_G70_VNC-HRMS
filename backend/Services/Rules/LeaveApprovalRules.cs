using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.Security;

namespace Vnc.HRMS.Services.Rules;

public static class LeaveApprovalRules
{
    public const decimal DefaultAnnualLeaveEntitlement = 12.0m;

    /// <summary>
    /// GB-47 & MSG31: Chỉ đơn nghỉ phép đang chờ duyệt (Pending) mới được phép phê duyệt hoặc từ chối.
    /// </summary>
    public static void EnsurePendingStatus(string? status)
    {
        if (!string.Equals(status, "pending", StringComparison.OrdinalIgnoreCase))
        {
            throw new AppException(400, "Chỉ có thể phê duyệt hoặc từ chối đơn nghỉ phép đang ở trạng thái chờ duyệt (MSG31).");
        }
    }

    /// <summary>
    /// GB-41 & MSG38: Kiểm tra quyền xem chi tiết đơn theo khoa/phòng.
    /// Admin và HR Manager có quyền xem đơn toàn viện để theo dõi (check status).
    /// Trưởng khoa (Department Manager) chỉ được xem đơn của nhân viên thuộc khoa phòng mình.
    /// </summary>
    public static void EnsureDepartmentAuthority(
        string userRole,
        Guid? userDepartmentId,
        Guid staffDepartmentId)
    {
        // Admin and HR Manager have organization-wide view authority
        if (string.Equals(userRole, AccountRoles.Administrator, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(userRole, AccountRoles.HrManager, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        if (string.Equals(userRole, AccountRoles.DepartmentManager, StringComparison.OrdinalIgnoreCase))
        {
            if (!userDepartmentId.HasValue || userDepartmentId.Value != staffDepartmentId)
            {
                throw new AppException(403, "Bạn không có quyền thao tác với đơn nghỉ phép của khoa/phòng khác (MSG38).");
            }
            return;
        }

        throw new AppException(403, "Tài khoản của bạn không có quyền thao tác với đơn nghỉ phép.");
    }

    /// <summary>
    /// UC-7.7 / Task 84: Thẩm quyền quyết định phê duyệt / từ chối đơn nghỉ phép.
    /// Theo tài liệu SRS (UC-7.6 & UC-7.7):
    /// - Primary Actor: Trưởng khoa/phòng (Department Manager) là người duy nhất duyệt/từ chối đơn cho nhân viên khoa mình.
    /// - HR Manager: Chỉ nhận thông báo và rà soát/theo dõi trạng thái toàn viện, không được duyệt đơn thường xuyên.
    /// </summary>
    public static void EnsureApprovalAuthority(
        string userRole,
        Guid? userDepartmentId,
        Guid staffDepartmentId)
    {
        if (string.Equals(userRole, AccountRoles.DepartmentManager, StringComparison.OrdinalIgnoreCase))
        {
            if (!userDepartmentId.HasValue || userDepartmentId.Value != staffDepartmentId)
            {
                throw new AppException(403, "Bạn không có quyền phê duyệt đơn nghỉ phép của nhân viên thuộc khoa/phòng khác (MSG38).");
            }
            return;
        }

        if (string.Equals(userRole, AccountRoles.Administrator, StringComparison.OrdinalIgnoreCase))
        {
            return;
        }

        if (string.Equals(userRole, AccountRoles.HrManager, StringComparison.OrdinalIgnoreCase))
        {
            throw new AppException(403, "Nhân sự (HR Manager) chỉ có quyền theo dõi và rà soát trạng thái. Thẩm quyền phê duyệt hoặc từ chối thuộc về Trưởng khoa/phòng quản lý trực tiếp nhân viên.");
        }

        throw new AppException(403, "Tài khoản của bạn không có quyền phê duyệt hoặc từ chối đơn nghỉ phép.");
    }

    /// <summary>
    /// MSG02: Lý do từ chối là bắt buộc khi quản lý từ chối đơn.
    /// </summary>
    public static string ValidateAndNormalizeRejectReason(string? reason)
    {
        var trimmed = reason?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(trimmed) || trimmed.Length < 5)
        {
            throw new AppException(400, "Vui lòng nhập lý do từ chối cụ thể (tối thiểu 5 ký tự) (MSG02).");
        }

        if (trimmed.Length > 500)
        {
            throw new AppException(400, "Lý do từ chối không được vượt quá 500 ký tự.");
        }

        return trimmed;
    }

    /// <summary>
    /// GB-17: Tính toán số dư phép năm còn lại.
    /// </summary>
    public static (decimal Entitlement, decimal Used, decimal Remaining) ComputeAnnualLeave(
        decimal usedDays,
        decimal? customEntitlement = null)
    {
        var entitlement = customEntitlement ?? DefaultAnnualLeaveEntitlement;
        var remaining = Math.Max(0m, entitlement - usedDays);
        return (entitlement, usedDays, remaining);
    }
}

