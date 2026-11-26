using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Models.Organization;
using Vnc.HRMS.Models.Users;

namespace Vnc.HRMS.Repositories.Interfaces;

public interface IPayrollInquiryRepository
{
    Task<Staff?> FindStaffByUserIdAsync(Guid userId, CancellationToken ct);
    Task<Payslip?> FindPayslipByIdAsync(Guid payslipId, CancellationToken ct);
    Task<Payslip?> FindPayslipByStaffAndMonthAsync(Guid staffId, string payMonth, CancellationToken ct);
    Task<PayrollLock?> FindPeriodByMonthAsync(string payMonth, CancellationToken ct);
    Task<Complaint?> FindByIdAsync(Guid complaintId, CancellationToken ct);
    Task<Complaint?> FindByIdTrackedAsync(Guid complaintId, CancellationToken ct);
    Task<List<ComplaintAttachment>> GetAttachmentsByComplaintIdAsync(Guid complaintId, CancellationToken ct);
    Task<Staff?> FindStaffByIdAsync(Guid staffId, CancellationToken ct);
    Task<Department?> FindDepartmentByIdAsync(Guid? departmentId, CancellationToken ct);
    Task<Dictionary<Guid, string>> GetUserNamesByIdsAsync(IEnumerable<Guid> userIds, CancellationToken ct);
    Task<List<User>> GetActiveAccountantsAsync(CancellationToken ct);

    Task<List<PayrollInquiryListItemDto>> ListMyInquiriesAsync(
        Guid staffId, MyPayrollInquiryFilter filter, CancellationToken ct);

    Task<PayrollInquiryQueueResponseDto> ListQueueAsync(
        PayrollInquiryQueueFilter filter, CancellationToken ct);

    Task<(string? AttendanceStatus, bool AttendanceConfirmed, int VerifiedProcedures, int UnverifiedProcedures)>
        GetSourceVerificationStateAsync(Guid staffId, string? payMonth, CancellationToken ct);

    void AddComplaint(Complaint complaint);
    void AddAttachments(IEnumerable<ComplaintAttachment> attachments);
    void AddNotifications(IEnumerable<Notification> notifications);
}
