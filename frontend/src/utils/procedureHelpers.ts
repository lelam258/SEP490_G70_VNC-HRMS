import type { ProcedureCommissionRole, ProcedureSlipStatus } from '../types/procedureSlip';

export const PROCEDURE_STATUS_LABELS: Record<ProcedureSlipStatus | string, string> = {
  pending: 'Chờ Kế toán duyệt',
  verified: 'Chờ thực hiện',
  completed: 'Đã hoàn thành',
  rejected: 'Bị từ chối',
  hr_checked: 'Chờ Kế toán duyệt',
};

export function getProcedureStatusBadgeClass(status: string): string {
  switch (status) {
    case 'completed':
      return 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold';
    case 'verified':
      return 'bg-sky-50 text-sky-800 border border-sky-300 font-semibold';
    case 'pending':
      return 'bg-amber-50 text-amber-800 border border-amber-300 font-medium';
    case 'rejected':
      return 'bg-rose-50 text-rose-700 border border-rose-300 font-medium';
    case 'hr_checked':
      return 'bg-sky-50 text-sky-700 border border-sky-200/80 font-medium';
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

export interface ParsedProcedureTimeRange {
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  startMinutes: number;
  endMinutes: number;
  durationHours: number;
  displayLabel: string; // e.g. "13h-13h30"
}

export function formatSingleTimeVn(hour: number, minute: number): string {
  return minute === 0 ? `${hour}h` : `${hour}h${String(minute).padStart(2, '0')}`;
}

export function formatTimePointVn(timeStr?: string | null): string {
  if (!timeStr) return '';
  const m = timeStr.trim().match(/^(\d{1,2})(?:[:hgHG](\d{1,2})?)?$/);
  if (!m) return timeStr;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (Number.isNaN(h) || Number.isNaN(min)) return timeStr;
  return formatSingleTimeVn(h, min);
}

export function formatTimeRangeVn(startTime?: string | null, endTime?: string | null): string {
  if (!startTime || !endTime) return '';
  return `${formatTimePointVn(startTime)}-${formatTimePointVn(endTime)}`;
}

export function parseTimePointToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const m = timeStr.trim().match(/^(\d{1,2})(?:[:hgHG](\d{1,2})?)?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  if (Number.isNaN(h) || Number.isNaN(min) || h < 0 || h > 23 || min < 0 || min > 59) {
    return null;
  }
  return h * 60 + min;
}

export function parseProcedureTimeRange(raw: string): ParsedProcedureTimeRange | null {
  if (!raw || !raw.trim()) return null;
  const match = raw
    .trim()
    .match(/^\s*(\d{1,2})(?:[:hgHG](\d{1,2})?)?\s*(?:[-–—~]|đến|to)\s*(\d{1,2})(?:[:hgHG](\d{1,2})?)?\s*$/i);
  if (!match) return null;

  const h1 = Number(match[1]);
  const min1 = match[2] ? Number(match[2]) : 0;
  const h2 = Number(match[3]);
  const min2 = match[4] ? Number(match[4]) : 0;

  if (
    Number.isNaN(h1) ||
    Number.isNaN(min1) ||
    Number.isNaN(h2) ||
    Number.isNaN(min2) ||
    h1 < 0 ||
    h1 > 23 ||
    min1 < 0 ||
    min1 > 59 ||
    h2 < 0 ||
    h2 > 23 ||
    min2 < 0 ||
    min2 > 59
  ) {
    return null;
  }

  const startMinutes = h1 * 60 + min1;
  const endMinutes = h2 * 60 + min2;
  if (endMinutes <= startMinutes) {
    return null;
  }

  const startTime = `${String(h1).padStart(2, '0')}:${String(min1).padStart(2, '0')}`;
  const endTime = `${String(h2).padStart(2, '0')}:${String(min2).padStart(2, '0')}`;
  const durationHours = Math.round(((endMinutes - startMinutes) / 60) * 100) / 100;
  const displayLabel = `${formatSingleTimeVn(h1, min1)}-${formatSingleTimeVn(h2, min2)}`;

  return {
    startTime,
    endTime,
    startMinutes,
    endMinutes,
    durationHours: durationHours > 0 ? durationHours : 0.01,
    displayLabel,
  };
}

export function formatMinutesVn(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return formatSingleTimeVn(h, m);
}

/**
 * Tính các khoảng thời gian còn rảnh từ mốc giờ dự kiến (windowStartMinutes) đến 17h00 (5h nghỉ)
 * dựa trên danh sách các ca thủ thuật đã đặt trong ngày của nhân sự.
 */
export function computeFreeTimeRangesUntil17h(
  windowStartMinutes: number,
  bookings: { startTime: string; endTime: string }[],
  offWorkMinutes: number = 17 * 60
): string[] {
  if (windowStartMinutes >= offWorkMinutes) {
    return [];
  }

  const busyIntervals: { start: number; end: number }[] = [];
  for (const b of bookings) {
    const bStart = parseTimePointToMinutes(b.startTime);
    const bEnd = parseTimePointToMinutes(b.endTime);
    if (bStart === null || bEnd === null || bEnd <= bStart) continue;
    if (bEnd <= windowStartMinutes || bStart >= offWorkMinutes) continue;

    const clampedStart = Math.max(windowStartMinutes, bStart);
    const clampedEnd = Math.min(offWorkMinutes, bEnd);
    if (clampedEnd > clampedStart) {
      busyIntervals.push({ start: clampedStart, end: clampedEnd });
    }
  }

  busyIntervals.sort((a, b) => (a.start !== b.start ? a.start - b.start : a.end - b.end));

  const merged: { start: number; end: number }[] = [];
  for (const interval of busyIntervals) {
    if (merged.length === 0 || merged[merged.length - 1].end < interval.start) {
      merged.push({ ...interval });
    } else if (interval.end > merged[merged.length - 1].end) {
      merged[merged.length - 1].end = interval.end;
    }
  }

  const freeRanges: string[] = [];
  let cursor = windowStartMinutes;

  for (const busy of merged) {
    if (busy.start > cursor) {
      freeRanges.push(`${formatMinutesVn(cursor)}-${formatMinutesVn(busy.start)}`);
    }
    if (busy.end > cursor) {
      cursor = busy.end;
    }
  }

  if (cursor < offWorkMinutes) {
    freeRanges.push(`${formatMinutesVn(cursor)}-${formatMinutesVn(offWorkMinutes)}`);
  }

  return freeRanges;
}
