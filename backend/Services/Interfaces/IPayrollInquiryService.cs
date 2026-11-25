using Vnc.HRMS.DTOs.Payroll;

namespace Vnc.HRMS.Services.Interfaces;

public interface IPayrollInquiryService
{
    Task<PayrollInquiryFormOptionsDto> GetMyFormOptionsAsync(Guid currentUserId, CancellationToken ct);
    Task<List<PayrollInquiryListItemDto>> ListMyInquiriesAsync(Guid currentUserId, MyPayrollInquiryFilter filter, CancellationToken ct);
    Task<PayrollInquiryDetailDto> GetMyInquiryDetailAsync(Guid currentUserId, Guid complaintId, CancellationToken ct);
    Task<PayrollInquiryDetailDto> SubmitMyInquiryAsync(Guid currentUserId, CreatePayrollInquiryRequest request, CancellationToken ct);

    Task<PayrollInquiryQueueResponseDto> ListQueueAsync(PayrollInquiryQueueFilter filter, CancellationToken ct);
    Task<PayrollInquiryDetailDto> GetAccountantDetailAsync(Guid complaintId, CancellationToken ct);
    Task<PayrollInquiryDetailDto> StartReviewAsync(Guid accountantUserId, Guid complaintId, CancellationToken ct);
    Task<PayrollInquiryDetailDto> ResolveAsync(Guid accountantUserId, Guid complaintId, ResolvePayrollInquiryRequest request, CancellationToken ct);
}
