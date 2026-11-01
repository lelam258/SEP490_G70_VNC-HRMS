using System.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.SelfService;
using Vnc.HRMS.Models;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;
using Vnc.HRMS.Services.Rules;

namespace Vnc.HRMS.Services;

public sealed class LeaveRequestService(
    ISelfServiceRepository repository,
    IUnitOfWork unitOfWork,
    IFileService fileService,
    IAuditLogHelper auditHelper) : ILeaveRequestService
{
    private const string NotFoundStaffMessage = "Tài khoản chưa liên kết hồ sơ nhân viên. Vui lòng liên hệ bộ phận nhân sự.";
    private const string Msg14 = "Tệp đính kèm không hợp lệ. Vui lòng chọn tệp PDF, JPG hoặc PNG và dung lượng không vượt quá 10 MB.";

    public async Task<IReadOnlyList<LeaveTypeDto>> GetLeaveTypesAsync(CancellationToken ct)
        => await repository.GetActiveLeaveTypesAsync(ct);

    public async Task<List<LeaveRequestSummaryDto>> ListMyLeaveRequestsAsync(Guid userId, string? status, CancellationToken ct)
    {
        var staff = await repository.FindStaffByUserIdAsync(userId, ct)
            ?? throw new AppException(404, NotFoundStaffMessage);

        return await repository.ListLeaveRequestsAsync(staff.StaffId, status, ct);
    }

    public async Task<LeaveRequestDetailDto> GetLeaveRequestDetailAsync(Guid userId, Guid requestId, CancellationToken ct)
    {
        var staff = await repository.FindStaffByUserIdAsync(userId, ct)
            ?? throw new AppException(404, NotFoundStaffMessage);

        var leaveRequest = await repository.FindLeaveRequestByIdAsync(requestId, ct);
        if (leaveRequest is null || leaveRequest.StaffId != staff.StaffId)
        {
            throw new AppException(404, "Không tìm thấy đơn nghỉ phép.");
        }

        var detail = await repository.GetLeaveRequestDetailAsync(requestId, ct);
        return detail ?? throw new AppException(404, "Không tìm thấy đơn nghỉ phép.");
    }

    public async Task<LeaveRequestDetailDto> CreateLeaveRequestAsync(Guid userId, CreateLeaveRequestInput input, CancellationToken ct)
    {
        var staff = await repository.FindStaffByUserIdAsync(userId, ct)
            ?? throw new AppException(404, NotFoundStaffMessage);

        // Requirement 5: Only active staff can create leave request
        if (!string.Equals(staff.Status, "active", StringComparison.OrdinalIgnoreCase))
        {
            throw new AppException(400, "Nhân viên không ở trạng thái hoạt động nên không thể tạo đơn nghỉ phép.");
        }

        if (!staff.DepartmentId.HasValue)
        {
            throw new AppException(400, "Nhân viên chưa được phân bổ khoa/phòng để duyệt đơn.");
        }

        if (!await repository.IsValidLeaveTypeAsync(input.LeaveType, ct))
        {
            throw new AppException(400, "Loại nghỉ phép không hợp lệ.");
        }

        var totalDays = LeaveRules.CountWorkingDays(input.StartDate, input.EndDate);
        var reason = LeaveRules.ValidateAndNormalizeReason(input.Reason);

        var attachmentUrl = await UploadAttachmentAsync(input.Attachment, ct);

        // Requirement 6: Serializable transaction for overlap check + insert
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var hasOverlap = await repository.HasOverlappingLeaveAsync(staff.StaffId, input.StartDate, input.EndDate, null, ct);
        if (hasOverlap)
        {
            throw new AppException(409, "Bạn đã có đơn nghỉ phép trong khoảng thời gian này.");
        }

        var leaveRequest = new LeaveRequest
        {
            RequestId = Guid.NewGuid(),
            StaffId = staff.StaffId,
            DepartmentId = staff.DepartmentId.Value,
            LeaveType = input.LeaveType.Trim().ToLowerInvariant(),
            StartDate = input.StartDate,
            EndDate = input.EndDate,
            TotalDays = totalDays,
            Reason = reason,
            AttachmentUrl = attachmentUrl,
            Status = "pending",
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        repository.AddLeaveRequest(leaveRequest);

        var newSnapshot = new
        {
            leaveRequest.RequestId,
            leaveRequest.StaffId,
            leaveRequest.DepartmentId,
            leaveRequest.LeaveType,
            leaveRequest.StartDate,
            leaveRequest.EndDate,
            leaveRequest.TotalDays,
            leaveRequest.Reason,
            leaveRequest.Status
        };
        auditHelper.Log("create", "LeaveRequest", leaveRequest.RequestId, null, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);
        await tx.CommitAsync(ct);

        var result = await repository.GetLeaveRequestDetailAsync(leaveRequest.RequestId, ct);
        return result!;
    }

    public async Task<LeaveRequestDetailDto> UpdateLeaveRequestAsync(
        Guid userId, Guid requestId, UpdateLeaveRequestInput input, CancellationToken ct)
    {
        var staff = await repository.FindStaffByUserIdAsync(userId, ct)
            ?? throw new AppException(404, NotFoundStaffMessage);

        if (!string.Equals(staff.Status, "active", StringComparison.OrdinalIgnoreCase))
        {
            throw new AppException(400, "Nhân viên không ở trạng thái hoạt động nên không thể sửa đơn nghỉ phép.");
        }

        // Same field rules as creating a request.
        if (!await repository.IsValidLeaveTypeAsync(input.LeaveType, ct))
        {
            throw new AppException(400, "Loại nghỉ phép không hợp lệ.");
        }
        var leaveType = input.LeaveType.Trim().ToLowerInvariant();
        var totalDays = LeaveRules.CountWorkingDays(input.StartDate, input.EndDate);
        var reason = LeaveRules.ValidateAndNormalizeReason(input.Reason);

        // Serializable from the read on, so an approval cannot slip in between the pending check and the save.
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);

        var leaveRequest = await repository.FindLeaveRequestByIdAsync(requestId, ct);
        if (leaveRequest is null || leaveRequest.StaffId != staff.StaffId)
        {
            throw new AppException(404, "Không tìm thấy đơn nghỉ phép.");
        }

        if (!string.Equals(leaveRequest.Status, "pending", StringComparison.OrdinalIgnoreCase))
        {
            throw new AppException(409, "Chỉ có thể sửa đơn ở trạng thái chờ duyệt.");
        }

        var hasOverlap = await repository.HasOverlappingLeaveAsync(staff.StaffId, input.StartDate, input.EndDate, requestId, ct);
        if (hasOverlap)
        {
            throw new AppException(409, "Bạn đã có đơn nghỉ phép trong khoảng thời gian này.");
        }

        var attachmentUrl = input.Attachment is { Length: > 0 }
            ? await UploadAttachmentAsync(input.Attachment, ct)
            : input.RemoveAttachment ? null : leaveRequest.AttachmentUrl;

        var oldSnapshot = new
        {
            leaveRequest.LeaveType,
            leaveRequest.StartDate,
            leaveRequest.EndDate,
            leaveRequest.TotalDays,
            leaveRequest.Reason,
            leaveRequest.AttachmentUrl
        };

        var changed = leaveRequest.LeaveType != leaveType
            || leaveRequest.StartDate != input.StartDate
            || leaveRequest.EndDate != input.EndDate
            || leaveRequest.TotalDays != totalDays
            || leaveRequest.Reason != reason
            || leaveRequest.AttachmentUrl != attachmentUrl;

        if (changed)
        {
            leaveRequest.LeaveType = leaveType;
            leaveRequest.StartDate = input.StartDate;
            leaveRequest.EndDate = input.EndDate;
            leaveRequest.TotalDays = totalDays;
            leaveRequest.Reason = reason;
            leaveRequest.AttachmentUrl = attachmentUrl;
            leaveRequest.UpdatedAt = DateTime.UtcNow;

            var newSnapshot = new
            {
                leaveRequest.LeaveType,
                leaveRequest.StartDate,
                leaveRequest.EndDate,
                leaveRequest.TotalDays,
                leaveRequest.Reason,
                leaveRequest.AttachmentUrl
            };
            auditHelper.Log("update", "LeaveRequest", leaveRequest.RequestId, oldSnapshot, newSnapshot);

            await SaveChangesWithDeadlockHandlingAsync(ct);
        }
        await tx.CommitAsync(ct);

        var result = await repository.GetLeaveRequestDetailAsync(requestId, ct);
        return result!;
    }

    public async Task<LeaveRequestDetailDto> WithdrawLeaveRequestAsync(Guid userId, Guid requestId, CancellationToken ct)
    {
        var staff = await repository.FindStaffByUserIdAsync(userId, ct)
            ?? throw new AppException(404, NotFoundStaffMessage);

        var leaveRequest = await repository.FindLeaveRequestByIdAsync(requestId, ct);
        if (leaveRequest is null || leaveRequest.StaffId != staff.StaffId)
        {
            throw new AppException(404, "Không tìm thấy đơn nghỉ phép.");
        }

        if (!string.Equals(leaveRequest.Status, "pending", StringComparison.OrdinalIgnoreCase))
        {
            throw new AppException(409, "Chỉ có thể thu hồi đơn ở trạng thái chờ duyệt.");
        }

        var oldSnapshot = new { leaveRequest.Status };
        leaveRequest.Status = "withdrawn";
        leaveRequest.UpdatedAt = DateTime.UtcNow;
        var newSnapshot = new { Status = "withdrawn" };

        auditHelper.Log("update", "LeaveRequest", leaveRequest.RequestId, oldSnapshot, newSnapshot);

        await SaveChangesWithDeadlockHandlingAsync(ct);

        var result = await repository.GetLeaveRequestDetailAsync(requestId, ct);
        return result!;
    }

    /// <summary>Uploads an optional attachment and returns its URL; any invalid file is reported as MSG14.</summary>
    private async Task<string?> UploadAttachmentAsync(IFormFile? attachment, CancellationToken ct)
    {
        if (attachment is null || attachment.Length == 0) return null;

        // Requirement 7: Block > 10 MB or catch AppException from FileService and re-throw MSG14
        if (attachment.Length > 10 * 1024 * 1024)
        {
            throw new AppException(400, Msg14);
        }

        try
        {
            await using var stream = attachment.OpenReadStream();
            var uploadResult = await fileService.UploadAsync(
                stream, attachment.FileName, attachment.ContentType, attachment.Length, ct);
            return uploadResult.Url;
        }
        catch (AppException)
        {
            throw new AppException(400, Msg14);
        }
    }

    private async Task SaveChangesWithDeadlockHandlingAsync(CancellationToken ct)
    {
        try
        {
            await unitOfWork.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql && sql.Number == 1205)
        {
            throw new AppException(409, "Dữ liệu đang được cập nhật đồng thời. Vui lòng thử lại.");
        }
        catch (SqlException sql) when (sql.Number == 1205)
        {
            throw new AppException(409, "Dữ liệu đang được cập nhật đồng thời. Vui lòng thử lại.");
        }
    }
}
