using Vnc.HRMS.DTOs.Payroll;

namespace Vnc.HRMS.Services.Interfaces;

public interface IProcedureSlipService
{
    Task<ProcedureLookupsDto> GetLookupsAsync(Guid currentUserId, CancellationToken ct);
    Task<ProcedureSlipListResponseDto> ListSlipsAsync(Guid currentUserId, string currentUserRole, ProcedureSlipListFilter filter, CancellationToken ct);
    Task<ProcedureSlipDetailDto> GetSlipDetailAsync(Guid currentUserId, string currentUserRole, Guid slipId, CancellationToken ct);
    Task<IReadOnlyList<PreviewAssignmentCommissionDto>> PreviewCommissionAsync(PreviewProcedureCommissionRequest request, CancellationToken ct);
    Task<ProcedureSlipDetailDto> CreateSlipAsync(Guid currentUserId, string currentUserRole, SaveProcedureSlipRequest request, CancellationToken ct);
    Task<ProcedureSlipDetailDto> UpdateSlipAsync(Guid currentUserId, string currentUserRole, Guid slipId, SaveProcedureSlipRequest request, CancellationToken ct);
    Task<ProcedureSlipDetailDto> HrCheckSlipAsync(Guid currentUserId, string currentUserRole, Guid slipId, ReviewProcedureSlipRequest request, CancellationToken ct);
    Task<ProcedureSlipDetailDto> VerifySlipAsync(Guid currentUserId, string currentUserRole, Guid slipId, ReviewProcedureSlipRequest request, CancellationToken ct);
    Task<CalculateMonthlyCommissionResultDto> CalculateMonthlyCommissionAsync(Guid currentUserId, CalculateMonthlyCommissionRequest request, CancellationToken ct);
}
