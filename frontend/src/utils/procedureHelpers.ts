import type { ProcedureCommissionRole, ProcedureSlipStatus } from '../types/procedureSlip';

export const PROCEDURE_STATUS_LABELS: Record<ProcedureSlipStatus | string, string> = {
  pending: 'Chờ Kế toán duyệt',
  verified: 'Chờ thực hiện',
  completed: 'Đã hoàn thành',
  rejected: 'Bị từ chối',
  hr_checked: 'Chờ Kế toán duyệt',
  cancelled: 'Đã hủy ca',
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
    case 'cancelled':
      return 'bg-slate-100 text-slate-600 border border-slate-300 font-medium';
    default:
      return 'bg-slate-100 text-slate-600 border border-slate-200';
  }
}

export function getProcedureStatusLabel(status?: string | null, userRole?: string): string {
  const s = (status || '').toLowerCase();
  if (s === 'verified') {
    if (userRole === 'accountant') return 'Đã duyệt viện phí (Chờ thực hiện)';
    return 'Chờ thực hiện';
  }
  return PROCEDURE_STATUS_LABELS[s] || status || 'Chưa rõ';
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

export interface TimeMinuteInterval {
  start: number;
  end: number;
}

export function mergeMinuteIntervals(intervals: TimeMinuteInterval[]): TimeMinuteInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals]
    .filter((i) => i.end > i.start)
    .sort((a, b) => (a.start !== b.start ? a.start - b.start : a.end - b.end));
  if (sorted.length === 0) return [];

  const merged: TimeMinuteInterval[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = merged[merged.length - 1];
    if (cur.start <= last.end) {
      if (cur.end > last.end) last.end = cur.end;
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

export function subtractMinuteIntervals(
  baseIntervals: TimeMinuteInterval[],
  busyIntervals: TimeMinuteInterval[]
): TimeMinuteInterval[] {
  let current = mergeMinuteIntervals(baseIntervals);
  const mergedBusy = mergeMinuteIntervals(busyIntervals);

  for (const busy of mergedBusy) {
    const next: TimeMinuteInterval[] = [];
    for (const seg of current) {
      if (busy.end <= seg.start || busy.start >= seg.end) {
        next.push(seg);
      } else {
        if (busy.start > seg.start) {
          next.push({ start: seg.start, end: busy.start });
        }
        if (busy.end < seg.end) {
          next.push({ start: busy.end, end: seg.end });
        }
      }
    }
    current = next;
  }
  return current;
}

export function intersectMinuteIntervalLists(
  listA: TimeMinuteInterval[],
  listB: TimeMinuteInterval[]
): TimeMinuteInterval[] {
  const result: TimeMinuteInterval[] = [];
  for (const a of listA) {
    for (const b of listB) {
      const start = Math.max(a.start, b.start);
      const end = Math.min(a.end, b.end);
      if (end > start) {
        result.push({ start, end });
      }
    }
  }
  return mergeMinuteIntervals(result);
}

/**
 * Xác định các khung giờ làm việc trong ngày của nhân sự dựa theo danh sách ca (shiftsToday).
 * Ca Sáng: 08:00 - 12:00, Trực trưa: 12:00 - 13:30, Ca Chiều: 13:00 - 17:00, Trực tối: 17:00 - 19:00.
 * Tự động tách khung nghỉ trưa 12:00 - 13:00 nếu nhân sự không có ca Trực trưa.
 */
export function getStaffShiftIntervals(
  shiftsToday: string[],
  isAfterHours: boolean = false
): TimeMinuteInterval[] {
  if (isAfterHours) {
    return [{ start: 7 * 60, end: 22 * 60 }];
  }

  const normalized = shiftsToday.map((s) => s.toLowerCase());
  const intervals: TimeMinuteInterval[] = [];

  const hasMorning = normalized.some((s) => s.includes('sáng'));
  const hasNoon = normalized.some((s) => s.includes('trưa'));
  const hasAfternoon = normalized.some((s) => s.includes('chiều'));
  const hasEvening = normalized.some((s) => s.includes('tối'));
  const hasOnCallOrFull = normalized.some(
    (s) => s.includes('ca trực') || s.includes('có lịch làm')
  );

  if (hasMorning) {
    intervals.push({ start: 8 * 60, end: 12 * 60 });
  }
  if (hasNoon) {
    intervals.push({ start: 12 * 60, end: 13 * 60 + 30 });
  }
  if (hasAfternoon) {
    intervals.push({ start: 13 * 60, end: 17 * 60 });
  }
  if (hasEvening) {
    intervals.push({ start: 17 * 60, end: 19 * 60 });
  }

  if (intervals.length === 0 && (hasOnCallOrFull || shiftsToday.length > 0)) {
    intervals.push({ start: 8 * 60, end: 12 * 60 }, { start: 13 * 60, end: 17 * 60 });
  }

  return mergeMinuteIntervals(intervals);
}

export function computeStaffFreeIntervals(
  shiftsToday: string[],
  bookings: { startTime: string; endTime: string }[],
  minWindowStartMinutes?: number | null,
  isAfterHours: boolean = false
): TimeMinuteInterval[] {
  let base = getStaffShiftIntervals(shiftsToday, isAfterHours);
  if (minWindowStartMinutes != null && minWindowStartMinutes > 0) {
    base = base
      .map((seg) => ({
        start: Math.max(seg.start, minWindowStartMinutes),
        end: seg.end,
      }))
      .filter((seg) => seg.end > seg.start);
  }

  const busy: TimeMinuteInterval[] = [];
  for (const b of bookings) {
    const bStart = parseTimePointToMinutes(b.startTime);
    const bEnd = parseTimePointToMinutes(b.endTime);
    if (bStart !== null && bEnd !== null && bEnd > bStart) {
      busy.push({ start: bStart, end: bEnd });
    }
  }

  return subtractMinuteIntervals(base, busy);
}

export function formatIntervalLabel(interval: TimeMinuteInterval): string {
  return `${formatMinutesVn(interval.start)}-${formatMinutesVn(interval.end)}`;
}

export interface TimelineSegment {
  start: number;
  end: number;
  widthPercent: number;
  type: 'free' | 'busy' | 'off_shift';
  label: string;
}

/**
 * Tạo dữ liệu thanh timeline mini (08:00 -> 17:00) cho thẻ nhân sự để bác sĩ nhìn trực quan
 * đoạn nào đang rảnh (xanh), đã có ca thủ thuật (cam), hay nghỉ trưa / ngoài ca (xám).
 */
export function buildDayTimelineSegments(
  shiftsToday: string[],
  bookings: { startTime: string; endTime: string; serviceName?: string; slipNumber?: string }[],
  dayStart: number = 8 * 60,
  dayEnd: number = 17 * 60
): TimelineSegment[] {
  const totalMinutes = dayEnd - dayStart;
  if (totalMinutes <= 0) return [];

  const shiftIntervals = getStaffShiftIntervals(shiftsToday, false);
  const busyIntervals: { start: number; end: number; title: string }[] = [];

  for (const b of bookings) {
    const bStart = parseTimePointToMinutes(b.startTime);
    const bEnd = parseTimePointToMinutes(b.endTime);
    if (bStart === null || bEnd === null || bEnd <= bStart) continue;
    const clampedStart = Math.max(dayStart, bStart);
    const clampedEnd = Math.min(dayEnd, bEnd);
    if (clampedEnd > clampedStart) {
      const rangeStr = `${formatMinutesVn(bStart)}-${formatMinutesVn(bEnd)}`;
      const detail = b.serviceName
        ? `${rangeStr}: ${b.serviceName}${b.slipNumber ? ` (${b.slipNumber})` : ''}`
        : `Bận ${rangeStr}`;
      busyIntervals.push({ start: clampedStart, end: clampedEnd, title: detail });
    }
  }

  // Tập hợp các mốc thời gian chia đoạn trong khoảng [dayStart, dayEnd]
  const pointsSet = new Set<number>([dayStart, dayEnd]);
  for (const s of shiftIntervals) {
    if (s.start > dayStart && s.start < dayEnd) pointsSet.add(s.start);
    if (s.end > dayStart && s.end < dayEnd) pointsSet.add(s.end);
  }
  for (const b of busyIntervals) {
    if (b.start > dayStart && b.start < dayEnd) pointsSet.add(b.start);
    if (b.end > dayStart && b.end < dayEnd) pointsSet.add(b.end);
  }

  const points = Array.from(pointsSet).sort((a, b) => a - b);
  const rawSegments: { start: number; end: number; type: 'free' | 'busy' | 'off_shift'; label: string }[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const segStart = points[i];
    const segEnd = points[i + 1];
    if (segEnd <= segStart) continue;
    const mid = (segStart + segEnd) / 2;

    const matchingBusy = busyIntervals.find((b) => mid >= b.start && mid <= b.end);
    if (matchingBusy) {
      rawSegments.push({
        start: segStart,
        end: segEnd,
        type: 'busy',
        label: matchingBusy.title,
      });
      continue;
    }

    const inShift = shiftIntervals.some((s) => mid >= s.start && mid <= s.end);
    if (inShift) {
      rawSegments.push({
        start: segStart,
        end: segEnd,
        type: 'free',
        label: `Rảnh ${formatMinutesVn(segStart)}-${formatMinutesVn(segEnd)}`,
      });
    } else {
      const isLunch = segStart >= 12 * 60 && segEnd <= 13 * 60 + 30;
      rawSegments.push({
        start: segStart,
        end: segEnd,
        type: 'off_shift',
        label: isLunch
          ? `Nghỉ trưa (${formatMinutesVn(segStart)}-${formatMinutesVn(segEnd)})`
          : `Ngoài ca (${formatMinutesVn(segStart)}-${formatMinutesVn(segEnd)})`,
      });
    }
  }

  // Gộp các đoạn liền kề cùng loại
  const merged: typeof rawSegments = [];
  for (const seg of rawSegments) {
    const last = merged[merged.length - 1];
    if (last && last.type === seg.type && (seg.type !== 'busy' || last.label === seg.label)) {
      last.end = seg.end;
      if (last.type === 'free') {
        last.label = `Rảnh ${formatMinutesVn(last.start)}-${formatMinutesVn(last.end)}`;
      }
    } else {
      merged.push({ ...seg });
    }
  }

  return merged.map((seg) => ({
    ...seg,
    widthPercent: Math.max(2, Math.round(((seg.end - seg.start) / totalMinutes) * 1000) / 10),
  }));
}

