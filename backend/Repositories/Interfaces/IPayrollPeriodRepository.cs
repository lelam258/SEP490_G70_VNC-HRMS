using Vnc.HRMS.DTOs.Payroll;
using Vnc.HRMS.Models;
using Vnc.HRMS.Models.Employees;
using Vnc.HRMS.Models.Organization;
using Vnc.HRMS.Services.Rules;

namespace Vnc.HRMS.Repositories.Interfaces;

public sealed record PayrollCalculationContext(
    bool AttendanceLocked,
    bool ProceduresVerified,
    List<Staff> ActiveCs1Staff,
    Dictionary<Guid, Contract> ActiveContractsByStaff,
    Dictionary<Guid, Position> PositionsById,
    Dictionary<Guid, Department> DepartmentsById,
    ILookup<Guid, (StaffAllowance Assignment, AllowanceType Type)> AllowancesByStaff,
    List<AttendanceRecord> MonthAttendanceRecords,
    List<OnCallShift> MonthOnCallShifts,
    List<LeaveRequest> ApprovedLeavesInMonth,
    Dictionary<string, bool> LeaveTypesIsPaid,
    ILookup<Guid, (decimal CommissionAmount, bool IsVerified)> ProcedureCommissionsByStaff,
    List<(string InsuranceType, decimal RatePercent)> EmployeeInsuranceConfigs,
    decimal EmployeeInsuranceRatePercent,
    List<PayrollRateConfig> ActiveRateConfigs,
    List<TaxBracketItem> ActiveTaxBrackets,
    decimal PersonalDeduction,
    decimal DependentDeduction,
    decimal FlatThreshold,
    decimal FlatRatePercent,
    decimal RoundingUnit,
    bool DeductInsuranceBeforeTax,
    bool DeductUnionFeeBeforeTax,
    bool DeductOtherBeforeTax,
    string FlatTaxBase,
    Dictionary<Guid, Payslip> ExistingPayslipsByStaff
);

public interface IPayrollPeriodRepository
{
    Task<List<PayrollPeriodDto>> ListPeriodsAsync(CancellationToken ct);
    Task<PayrollLock?> FindByMonthAsync(string payMonth, CancellationToken ct);
    Task<PayrollPeriodDetailDto?> GetPeriodDetailAsync(string payMonth, CancellationToken ct);
    Task<bool> HasPaidPayslipsAsync(string payMonth, CancellationToken ct);
    Task<List<Payslip>> GetPayslipsByMonthAsync(string payMonth, CancellationToken ct);
    void AddPeriod(PayrollLock period);

    Task<PayrollCalculationContext> LoadCalculationContextAsync(string payMonth, CancellationToken ct);
    Task ReplacePayslipLinesAsync(
        Guid payslipId,
        IEnumerable<PayslipAllowance> allowances,
        IEnumerable<PayslipDeduction> deductions,
        CancellationToken ct);
    void AddPayslip(Payslip payslip);
    Task<Payslip?> FindPayslipAsync(string payMonth, Guid payslipId, CancellationToken ct);
    Task<PayslipDetailDto?> GetPayslipDetailAsync(string payMonth, Guid payslipId, CancellationToken ct);
    Task<(bool AttendanceLocked, bool ProceduresVerified)> GetPeriodReadinessAsync(string payMonth, CancellationToken ct);
    Task<List<PayslipAllowance>> GetPayslipAllowancesAsync(Guid payslipId, CancellationToken ct);
    Task<bool> HasPayslipComplaintsAsync(string payMonth, CancellationToken ct);
    Task DeleteDraftPeriodCascadeAsync(PayrollLock period, CancellationToken ct);

    // Self-service My Payslip (SRS 6.13)
    Task<Guid?> FindStaffIdByUserIdAsync(Guid userId, CancellationToken ct);
    Task<List<MyPayslipSummaryDto>> ListFinalizedPayslipsByStaffAsync(Guid staffId, int? year, CancellationToken ct);
    Task<Payslip?> FindPayslipByIdAsync(Guid payslipId, CancellationToken ct);
    Task<Payslip?> FindPayslipByMonthAndStaffAsync(string payMonth, Guid staffId, CancellationToken ct);
}
