import type { ProcedureCommissionRole, ProcedureSlipStatus } from '../types/procedureSlip';

export const PROCEDURE_STATUS_LABELS: Record<ProcedureSlipStatus | string, string> = {
  pending: 'Chờ HR kiểm tra',
  hr_checked: 'Chờ Kế toán xác minh',
  verified: 'Đã xác minh',
  rejected: 'Bị từ chối',
};

export function getProcedureStatusBadgeClass(status: string): string {
  switch (status) {
    case 'verified':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200/80';
    case 'hr_checked':
      return 'bg-sky-50 text-sky-700 border border-sky-200/80';
    case 'pending':
      return 'bg-amber-50 text-amber-700 border border-amber-200/80';
    case 'rejected':
      return 'bg-rose-50 text-rose-700 border border-rose-200/80';
    default:
      return 'bg-slate-100 text-slate-600 border border-slate-200';
  }
}

export const PROCEDURE_ROLE_LABELS: Record<ProcedureCommissionRole | string, string> = {
  indicating: 'BS Chỉ định',
  performing: 'BS Thực hiện chính',
  assisting: 'Phụ tá / Điều dưỡng',
  lab: 'KTV Lab / Xét nghiệm',
  typist: 'Nhập kết quả',
};

export const PROCEDURE_ROLES: { value: ProcedureCommissionRole; label: string }[] = [
  { value: 'indicating', label: 'BS Chỉ định (Indicating)' },
  { value: 'performing', label: 'BS Thực hiện chính (Performing)' },
  { value: 'assisting', label: 'Phụ tá / Điều dưỡng (Assisting)' },
  { value: 'lab', label: 'KTV Lab / Xét nghiệm (Lab)' },
  { value: 'typist', label: 'Nhập kết quả (Typist)' },
];

export const RULE_SOURCE_LABELS: Record<string, string> = {
  staff_override: 'Đơn giá riêng NV',
  service_rule: 'Quy tắc theo dịch vụ',
  category_rule: 'Quy tắc nhóm dịch vụ',
  manual: 'Nhập thủ công',
  no_rule: 'Chưa có quy tắc',
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: 'Tạo mới phiếu thủ thuật',
  update: 'Cập nhật phiếu thủ thuật',
  resubmit: 'Chỉnh sửa & Gửi duyệt lại',
  hr_check_approve: 'HR kiểm tra: Đạt yêu cầu',
  hr_check_reject: 'HR kiểm tra: Từ chối',
  accountant_verify_approve: 'Kế toán: Xác minh hợp lệ',
  accountant_verify_reject: 'Kế toán: Từ chối xác minh',
};

export function formatRuleFormula(valueType?: string | null, ruleValue?: number | null): string {
  if (ruleValue === null || ruleValue === undefined) return '—';
  switch (valueType) {
    case 'percent_service':
      return `${ruleValue}% giá DV`;
    case 'percent_profit':
      return `${ruleValue}% lợi nhuận`;
    case 'per_hour':
      return `${ruleValue.toLocaleString('vi-VN')} ₫/giờ`;
    case 'fixed':
    default:
      return `${ruleValue.toLocaleString('vi-VN')} ₫`;
  }
}
