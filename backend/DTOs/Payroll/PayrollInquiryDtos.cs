namespace Vnc.HRMS.DTOs.Payroll;

/// <summary>
/// Tệp đính kèm khi nhân viên gửi thắc mắc bảng lương (từ POST /api/files).
/// </summary>
public sealed record InquiryAttachmentInputDto(
    string FileUrl,
    string? FileName
);

/// <summary>
/// Thông tin tệp đính kèm của một thắc mắc lương.
/// </summary>
public sealed record PayrollInquiryAttachmentDto(
    Guid AttachmentId,
    string FileUrl,
    string? FileName,
    Guid UploadedBy,
    string? UploadedByName,
    DateTime? UploadedAt
);

/// <summary>
/// Yêu cầu tạo mới thắc mắc bảng lương / chấm công / hoa hồng (SRS 7.8 / Task 82).
/// </summary>
public sealed record CreatePayrollInquiryRequest(
    string InquiryType,
    string Subject,
    string Description,
    string PayMonth,
    Guid? PayslipId,
    List<InquiryAttachmentInputDto>? Attachments
);

/// <summary>
/// Yêu cầu xử lý / đóng thắc mắc lương của Kế toán (SRS 7.12 / Task 86).
/// </summary>
public sealed record ResolvePayrollInquiryRequest(
    string Decision,
    string Response,
    string? ExpectedStatus = null,
    DateTime? ExpectedRepliedAt = null
);

/// <summary>
/// Bộ lọc danh sách thắc mắc của nhân viên (SRS 7.9 / Task 83).
/// </summary>
public sealed record MyPayrollInquiryFilter(
    string? Status = null,
    string? InquiryType = null,
    string? Search = null,
    DateOnly? FromDate = null,
    DateOnly? ToDate = null
);

/// <summary>
/// Bộ lọc hàng đợi thắc mắc lương cho Kế toán (SRS 7.11 / Task 85).
/// </summary>
public sealed record PayrollInquiryQueueFilter(
    string? Status = null,
    Guid? DepartmentId = null,
    string? InquiryType = null,
    string? PayMonth = null,
    string? Search = null,
    int Page = 1,
    int PageSize = 15
);

/// <summary>
/// Một dòng thắc mắc lương hiển thị ở danh sách cá nhân hoặc hàng đợi Kế toán.
/// </summary>
public sealed record PayrollInquiryListItemDto(
    Guid ComplaintId,
    string InquiryCode,
    Guid StaffId,
    string StaffCode,
    string StaffName,
    Guid? DepartmentId,
    string? DepartmentName,
    string? PayMonth,
    Guid? PayslipId,
    bool IsPeriodFinalized,
    string? PeriodStatus,
    string InquiryType,
    string Subject,
    string Status,
    string? ResponsePreview,
    string? RepliedByName,
    int AttachmentCount,
    bool MissingEvidence,
    int AgeDays,
    DateTime? SubmittedAt,
    DateTime? RepliedAt,
    DateTime? ResolvedAt
);

/// <summary>
/// Dữ liệu đối chiếu nguồn cho thắc mắc lương (chấm công, thủ thuật, kỳ lương).
/// </summary>
public sealed record PayrollInquirySourceContextDto(
    string? PayMonth,
    bool IsPeriodFinalized,
    string? PeriodStatus,
    string? AttendanceStatus,
    bool AttendanceConfirmed,
    int VerifiedProcedureCount,
    int UnverifiedProcedureCount,
    decimal? FinalizedWorkDays,
    decimal? FinalizedGrossPay,
    decimal? FinalizedNetPay,
    string? SalaryMaskedReason
);

/// <summary>
/// Chi tiết đầy đủ một thắc mắc bảng lương (SRS 7.10 / Task 84).
/// </summary>
public sealed record PayrollInquiryDetailDto(
    Guid ComplaintId,
    string InquiryCode,
    Guid StaffId,
    string StaffCode,
    string StaffName,
    Guid? DepartmentId,
    string? DepartmentName,
    string? PayMonth,
    Guid? PayslipId,
    string InquiryType,
    string Subject,
    string Description,
    string Status,
    bool IsReadOnly,
    string? Response,
    Guid? RepliedBy,
    string? RepliedByName,
    DateTime? SubmittedAt,
    DateTime? RepliedAt,
    DateTime? ResolvedAt,
    List<PayrollInquiryAttachmentDto> Attachments,
    PayrollInquirySourceContextDto SourceContext
);

/// <summary>
/// Tùy chọn khởi tạo form gửi thắc mắc lương của nhân viên.
/// </summary>
public sealed record PayrollInquiryFormOptionsDto(
    string DefaultPayMonth,
    List<MyPayslipSummaryDto> FinalizedPayslips
);

/// <summary>
/// Tùy chọn khoa/phòng dùng cho bộ lọc hàng đợi thắc mắc lương.
/// </summary>
public sealed record InquiryDepartmentOptionDto(
    Guid DepartmentId,
    string Name
);

/// <summary>
/// Kết quả phân trang hàng đợi thắc mắc lương cho Kế toán.
/// </summary>
public sealed record PayrollInquiryQueueResponseDto(
    int Total,
    int Page,
    int PageSize,
    Dictionary<string, int> StatusCounts,
    List<InquiryDepartmentOptionDto> Departments,
    List<PayrollInquiryListItemDto> Items
);
