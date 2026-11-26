using System.Data;
using System.Text.RegularExpressions;
using Vnc.HRMS.Common.Exceptions;
using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Repositories;
using Vnc.HRMS.Repositories.Interfaces;
using Vnc.HRMS.Services.Interfaces;

namespace Vnc.HRMS.Services;

public sealed partial class PayrollInquiryService(
    IPayrollInquiryRepository repository,
    IPayrollPeriodRepository periodRepository,
    IUnitOfWork unitOfWork,
    IAuditLogHelper auditHelper) : IPayrollInquiryService
{
    private static readonly HashSet<string> AllowedInquiryTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "attendance",
        "procedure_commission",
        "payslip_salary",
        "other"
    };

    private static readonly string[] AllowedAttachmentExtensions = [".pdf", ".jpg", ".jpeg", ".png"];
    private static readonly Regex MonthRegex = MonthPattern();

    [GeneratedRegex(@"^\d{4}-(0[1-9]|1[0-2])$")]
    private static partial Regex MonthPattern();

    public async Task<PayrollInquiryFormOptionsDto> GetMyFormOptionsAsync(Guid currentUserId, CancellationToken ct)
    {
        var staff = await RequireStaffByUserIdAsync(currentUserId, ct);
        var payslips = await periodRepository.ListFinalizedPayslipsByStaffAsync(staff.StaffId, null, ct);
        var defaultMonth = payslips.Count > 0
            ? payslips[0].PayMonth
            : DateTime.UtcNow.AddHours(7).ToString("yyyy-MM");
        return new PayrollInquiryFormOptionsDto(defaultMonth, payslips);
    }

    public async Task<List<PayrollInquiryListItemDto>> ListMyInquiriesAsync(
        Guid currentUserId, MyPayrollInquiryFilter filter, CancellationToken ct)
    {
        var staff = await RequireStaffByUserIdAsync(currentUserId, ct);
        return await repository.ListMyInquiriesAsync(staff.StaffId, filter, ct);
    }

    public async Task<PayrollInquiryDetailDto> GetMyInquiryDetailAsync(
        Guid currentUserId, Guid complaintId, CancellationToken ct)
    {
        var staff = await RequireStaffByUserIdAsync(currentUserId, ct);
        var complaint = await repository.FindByIdAsync(complaintId, ct)
            ?? throw new AppException(404, "Bản ghi yêu cầu không tồn tại hoặc không khả dụng.");

        if (complaint.StaffId != staff.StaffId)
            throw new AppException(403, "Bạn không có quyền truy cập chức năng hoặc bản ghi này.");

        return await BuildDetailDtoAsync(complaint, isAccountantView: false, ct);
    }

    public async Task<PayrollInquiryDetailDto> SubmitMyInquiryAsync(
        Guid currentUserId, CreatePayrollInquiryRequest request, CancellationToken ct)
    {
        var staff = await RequireStaffByUserIdAsync(currentUserId, ct);

        var inquiryType = request.InquiryType?.Trim().ToLowerInvariant() ?? string.Empty;
        if (!AllowedInquiryTypes.Contains(inquiryType))
            throw new AppException(400, "Vui lòng chọn phân loại thắc mắc hợp lệ.");

        var subject = request.Subject?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(subject))
            throw new AppException(400, "Tiêu đề thắc mắc là bắt buộc.");
        if (subject.Length > 200)
            throw new AppException(400, "Tiêu đề thắc mắc tối đa 200 ký tự.");

        var description = request.Description?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(description))
            throw new AppException(400, "Nội dung mô tả thắc mắc là bắt buộc.");
        if (description.Length > 4000)
            throw new AppException(400, "Nội dung mô tả tối đa 4000 ký tự.");

        var payMonth = request.PayMonth?.Trim() ?? string.Empty;
        if (!MonthRegex.IsMatch(payMonth))
            throw new AppException(400, "Định dạng tháng lương không hợp lệ (YYYY-MM).");

        if (request.PayslipId.HasValue)
        {
            var payslip = await repository.FindPayslipByIdAsync(request.PayslipId.Value, ct)
                ?? throw new AppException(404, "Không tìm thấy phiếu lương được chọn.");

            if (payslip.StaffId != staff.StaffId)
                throw new AppException(403, "Bạn không có quyền truy cập chức năng hoặc bản ghi này.");

            var period = await repository.FindPeriodByMonthAsync(payslip.PayMonth, ct);
            if (!PayrollInquiryRepository.IsFinalizedStatus(period?.Status) ||
                (!payslip.IsLocked.GetValueOrDefault() && !PayrollInquiryRepository.IsFinalizedStatus(payslip.Status)))
            {
                throw new AppException(400, "Bảng tổng hợp lương tháng chưa được xác nhận.");
            }

            payMonth = payslip.PayMonth;
        }
        else if (string.Equals(inquiryType, "payslip_salary", StringComparison.OrdinalIgnoreCase))
        {
            var period = await repository.FindPeriodByMonthAsync(payMonth, ct);
            var existingPayslip = await repository.FindPayslipByStaffAndMonthAsync(staff.StaffId, payMonth, ct);
            if (existingPayslip is not null && !PayrollInquiryRepository.IsFinalizedStatus(period?.Status))
            {
                throw new AppException(400, "Bảng tổng hợp lương tháng chưa được xác nhận.");
            }
        }

        var validatedAttachments = ValidateAttachments(request.Attachments);
        var now = DateTime.UtcNow;

        var complaint = new Complaint
        {
            ComplaintId = Guid.NewGuid(),
            StaffId = staff.StaffId,
            DepartmentId = staff.DepartmentId,
            PayslipId = request.PayslipId,
            PayMonth = payMonth,
            InquiryType = inquiryType,
            Subject = subject,
            Description = description,
            Status = "submitted",
            SubmittedAt = now
        };

        var attachmentEntities = validatedAttachments.Select(a => new ComplaintAttachment
        {
            AttachmentId = Guid.NewGuid(),
            ComplaintId = complaint.ComplaintId,
            FileUrl = a.FileUrl.Trim(),
            FileName = string.IsNullOrWhiteSpace(a.FileName) ? null : a.FileName.Trim(),
            UploadedBy = currentUserId,
            UploadedAt = now
        }).ToList();

        var accountants = await repository.GetActiveAccountantsAsync(ct);
        var code = PayrollInquiryRepository.BuildInquiryCode(complaint.ComplaintId, now);
        var notifications = accountants.Select(acc => new Notification
        {
            NotificationId = Guid.NewGuid(),
            RecipientId = acc.UserId,
            SenderService = "PayrollInquiry",
            Type = "payroll_inquiry_submitted",
            Title = $"Thắc mắc lương mới ({code})",
            Body = $"{staff.FullName} ({staff.StaffCode}) đã gửi thắc mắc kỳ {payMonth}: {subject}.",
            ActionUrl = $"/payroll/inquiries/{complaint.ComplaintId}",
            EntityType = "Complaint",
            EntityId = complaint.ComplaintId,
            Channel = "in_app",
            IsRead = false,
            CreatedAt = now
        }).ToList();

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.ReadCommitted);
        repository.AddComplaint(complaint);
        if (attachmentEntities.Count > 0) repository.AddAttachments(attachmentEntities);
        if (notifications.Count > 0) repository.AddNotifications(notifications);

        auditHelper.Log(
            action: "submit_payroll_inquiry",
            entityType: "Complaint",
            entityId: complaint.ComplaintId,
            oldValue: null,
            newValue: new
            {
                code,
                complaint.StaffId,
                complaint.PayMonth,
                complaint.PayslipId,
                complaint.InquiryType,
                complaint.Subject,
                complaint.Status,
                AttachmentCount = attachmentEntities.Count
            });

        await unitOfWork.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return await BuildDetailDtoAsync(complaint, isAccountantView: false, ct);
    }

    public Task<PayrollInquiryQueueResponseDto> ListQueueAsync(PayrollInquiryQueueFilter filter, CancellationToken ct)
        => repository.ListQueueAsync(filter, ct);

    public async Task<PayrollInquiryDetailDto> GetAccountantDetailAsync(Guid complaintId, CancellationToken ct)
    {
        var complaint = await repository.FindByIdAsync(complaintId, ct)
            ?? throw new AppException(404, "Bản ghi yêu cầu không tồn tại hoặc không khả dụng.");

        return await BuildDetailDtoAsync(complaint, isAccountantView: true, ct);
    }

    public async Task<PayrollInquiryDetailDto> StartReviewAsync(
        Guid accountantUserId, Guid complaintId, CancellationToken ct)
    {
        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);
        var complaint = await repository.FindByIdTrackedAsync(complaintId, ct)
            ?? throw new AppException(404, "Bản ghi yêu cầu không tồn tại hoặc không khả dụng.");

        var currentStatus = PayrollInquiryRepository.NormalizeStatus(complaint.Status);
        if (currentStatus is "resolved" or "rejected")
            throw new AppException(400, "Thắc mắc này đã được đóng và chỉ cho phép xem.");

        if (currentStatus != "in_review")
        {
            var now = DateTime.UtcNow;
            var oldSnapshot = new { complaint.Status, complaint.RepliedBy, complaint.RepliedAt };

            complaint.Status = "in_review";
            complaint.RepliedBy = accountantUserId;
            complaint.RepliedAt = now;

            auditHelper.Log(
                action: "start_review_payroll_inquiry",
                entityType: "Complaint",
                entityId: complaint.ComplaintId,
                oldValue: oldSnapshot,
                newValue: new { complaint.Status, complaint.RepliedBy, complaint.RepliedAt });

            await unitOfWork.SaveChangesAsync(ct);
        }

        await tx.CommitAsync(ct);
        return await BuildDetailDtoAsync(complaint, isAccountantView: true, ct);
    }

    public async Task<PayrollInquiryDetailDto> ResolveAsync(
        Guid accountantUserId, Guid complaintId, ResolvePayrollInquiryRequest request, CancellationToken ct)
    {
        var decision = request.Decision?.Trim().ToLowerInvariant() ?? string.Empty;
        if (decision is not ("resolved" or "rejected"))
            throw new AppException(400, "Vui lòng chọn kết quả xử lý (Đã giải quyết hoặc Từ chối).");

        var responseText = request.Response?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(responseText))
            throw new AppException(400, "Nội dung phản hồi / giải trình là bắt buộc.");
        if (responseText.Length > 4000)
            throw new AppException(400, "Nội dung phản hồi tối đa 4000 ký tự.");

        await using var tx = await unitOfWork.BeginTransactionAsync(ct, IsolationLevel.Serializable);
        var complaint = await repository.FindByIdTrackedAsync(complaintId, ct)
            ?? throw new AppException(404, "Bản ghi yêu cầu không tồn tại hoặc không khả dụng.");

        var currentStatus = PayrollInquiryRepository.NormalizeStatus(complaint.Status);

        // Kiểm tra tranh chấp cập nhật đồng thời (Flow A5 - MSG22)
        if (!string.IsNullOrWhiteSpace(request.ExpectedStatus) &&
            !string.Equals(currentStatus, PayrollInquiryRepository.NormalizeStatus(request.ExpectedStatus), StringComparison.OrdinalIgnoreCase))
        {
            throw new AppException(409, "Dữ liệu vừa được người khác cập nhật. Hãy tải lại danh sách và thử lại.");
        }

        if (request.ExpectedRepliedAt.HasValue && complaint.RepliedAt.HasValue &&
            Math.Abs((request.ExpectedRepliedAt.Value - complaint.RepliedAt.Value).TotalSeconds) > 1)
        {
            throw new AppException(409, "Dữ liệu vừa được người khác cập nhật. Hãy tải lại danh sách và thử lại.");
        }

        if (currentStatus is "resolved" or "rejected")
            throw new AppException(400, "Thắc mắc này đã được đóng, không thể xử lý lại.");

        var now = DateTime.UtcNow;
        var oldSnapshot = new
        {
            complaint.Status,
            complaint.Response,
            complaint.RepliedBy,
            complaint.RepliedAt,
            complaint.ResolvedAt
        };

        complaint.Status = decision;
        complaint.Response = responseText;
        complaint.RepliedBy = accountantUserId;
        complaint.RepliedAt = now;
        complaint.ResolvedAt = now;

        var staff = await repository.FindStaffByIdAsync(complaint.StaffId, ct);
        var code = PayrollInquiryRepository.BuildInquiryCode(complaint.ComplaintId, complaint.SubmittedAt);

        if (staff is not null && staff.UserId != Guid.Empty)
        {
            var statusLabel = decision == "resolved" ? "đã được giải quyết" : "đã bị từ chối";
            repository.AddNotifications([
                new Notification
                {
                    NotificationId = Guid.NewGuid(),
                    RecipientId = staff.UserId,
                    SenderService = "PayrollInquiry",
                    Type = decision == "resolved" ? "payroll_inquiry_resolved" : "payroll_inquiry_rejected",
                    Title = $"Thắc mắc lương {code} {statusLabel}",
                    Body = $"Kế toán đã phản hồi thắc mắc \"{complaint.Subject}\": {(responseText.Length <= 140 ? responseText : responseText[..137] + "...")}",
                    ActionUrl = $"/me/payroll-inquiries/{complaint.ComplaintId}",
                    EntityType = "Complaint",
                    EntityId = complaint.ComplaintId,
                    Channel = "in_app",
                    IsRead = false,
                    CreatedAt = now
                }
            ]);
        }

        auditHelper.Log(
            action: decision == "resolved" ? "resolve_payroll_inquiry" : "reject_payroll_inquiry",
            entityType: "Complaint",
            entityId: complaint.ComplaintId,
            oldValue: oldSnapshot,
            newValue: new
            {
                complaint.Status,
                complaint.Response,
                complaint.RepliedBy,
                complaint.RepliedAt,
                complaint.ResolvedAt
            });

        await unitOfWork.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return await BuildDetailDtoAsync(complaint, isAccountantView: true, ct);
    }

    private async Task<Staff> RequireStaffByUserIdAsync(Guid userId, CancellationToken ct)
        => await repository.FindStaffByUserIdAsync(userId, ct)
            ?? throw new AppException(403, "Tài khoản hiện tại chưa được liên kết với hồ sơ nhân viên.");

    private async Task<PayrollInquiryDetailDto> BuildDetailDtoAsync(
        Complaint complaint, bool isAccountantView, CancellationToken ct)
    {
        var staff = await repository.FindStaffByIdAsync(complaint.StaffId, ct);
        var dept = await repository.FindDepartmentByIdAsync(complaint.DepartmentId ?? staff?.DepartmentId, ct);
        var attachments = await repository.GetAttachmentsByComplaintIdAsync(complaint.ComplaintId, ct);

        var payslip = complaint.PayslipId.HasValue
            ? await repository.FindPayslipByIdAsync(complaint.PayslipId.Value, ct)
            : null;
        var payMonth = complaint.PayMonth ?? payslip?.PayMonth;
        if (payslip is null && !string.IsNullOrWhiteSpace(payMonth))
        {
            payslip = await repository.FindPayslipByStaffAndMonthAsync(complaint.StaffId, payMonth, ct);
        }

        var period = !string.IsNullOrWhiteSpace(payMonth)
            ? await repository.FindPeriodByMonthAsync(payMonth, ct)
            : null;
        var isFinalized = PayrollInquiryRepository.IsFinalizedStatus(period?.Status);

        var (attendanceStatus, attendanceConfirmed, verifiedProc, unverifiedProc) =
            await repository.GetSourceVerificationStateAsync(complaint.StaffId, payMonth, ct);

        var userIds = attachments.Select(a => a.UploadedBy).ToList();
        if (complaint.RepliedBy.HasValue) userIds.Add(complaint.RepliedBy.Value);
        var userNames = await repository.GetUserNamesByIdsAsync(userIds, ct);

        var status = PayrollInquiryRepository.NormalizeStatus(complaint.Status);

        // Nhân viên chỉ được thấy số tiền phiếu lương khi kỳ lương đã chính thức chốt (SRS 7.9 A3, 7.10 A4, GB-16)
        var canExposeSalary = isAccountantView || isFinalized;
        var sourceContext = new PayrollInquirySourceContextDto(
            PayMonth: payMonth,
            IsPeriodFinalized: isFinalized,
            PeriodStatus: period?.Status,
            AttendanceStatus: attendanceStatus,
            AttendanceConfirmed: attendanceConfirmed,
            VerifiedProcedureCount: verifiedProc,
            UnverifiedProcedureCount: unverifiedProc,
            FinalizedWorkDays: canExposeSalary ? payslip?.WorkDays : null,
            FinalizedGrossPay: canExposeSalary ? payslip?.GrossPay : null,
            FinalizedNetPay: canExposeSalary ? payslip?.NetPay : null,
            SalaryMaskedReason: canExposeSalary ? null : "Bảng tổng hợp lương tháng chưa được xác nhận."
        );

        var attachmentDtos = attachments.Select(a => new PayrollInquiryAttachmentDto(
            AttachmentId: a.AttachmentId,
            FileUrl: a.FileUrl,
            FileName: a.FileName,
            UploadedBy: a.UploadedBy,
            UploadedByName: userNames.GetValueOrDefault(a.UploadedBy),
            UploadedAt: a.UploadedAt
        )).ToList();

        return new PayrollInquiryDetailDto(
            ComplaintId: complaint.ComplaintId,
            InquiryCode: PayrollInquiryRepository.BuildInquiryCode(complaint.ComplaintId, complaint.SubmittedAt),
            StaffId: complaint.StaffId,
            StaffCode: staff?.StaffCode ?? string.Empty,
            StaffName: staff?.FullName ?? string.Empty,
            DepartmentId: dept?.DepartmentId ?? complaint.DepartmentId,
            DepartmentName: dept?.Name,
            PayMonth: payMonth,
            PayslipId: complaint.PayslipId,
            InquiryType: complaint.InquiryType,
            Subject: complaint.Subject,
            Description: complaint.Description,
            Status: status,
            IsReadOnly: status is "resolved" or "rejected",
            Response: complaint.Response,
            RepliedBy: complaint.RepliedBy,
            RepliedByName: complaint.RepliedBy.HasValue ? userNames.GetValueOrDefault(complaint.RepliedBy.Value) : null,
            SubmittedAt: complaint.SubmittedAt,
            RepliedAt: complaint.RepliedAt,
            ResolvedAt: complaint.ResolvedAt,
            Attachments: attachmentDtos,
            SourceContext: sourceContext
        );
    }

    private static List<InquiryAttachmentInputDto> ValidateAttachments(List<InquiryAttachmentInputDto>? attachments)
    {
        if (attachments is null || attachments.Count == 0) return [];
        if (attachments.Count > 5)
            throw new AppException(400, "Chỉ được đính kèm tối đa 5 tệp minh chứng cho mỗi thắc mắc.");

        foreach (var item in attachments)
        {
            if (string.IsNullOrWhiteSpace(item.FileUrl) || item.FileUrl.Length > 500)
                throw new AppException(400, "Tệp đính kèm không hợp lệ. Vui lòng chọn tệp PDF, JPG hoặc PNG và dung lượng không vượt quá 10 MB.");

            var urlPath = item.FileUrl.Split('?', '#')[0];
            var ext = Path.GetExtension(urlPath).ToLowerInvariant();
            if (!AllowedAttachmentExtensions.Contains(ext))
                throw new AppException(400, "Tệp đính kèm không hợp lệ. Vui lòng chọn tệp PDF, JPG hoặc PNG và dung lượng không vượt quá 10 MB.");
        }

        return attachments;
    }
}
