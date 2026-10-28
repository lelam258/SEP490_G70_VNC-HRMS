/**
 * Leave rules and Vietnam timezone utilities for frontend.
 */

export const VIETNAM_OFFSET_HOURS = 7;

/**
 * Returns today's date in Vietnam timezone as YYYY-MM-DD.
 */
export function getTodayInVietnam(date: Date = new Date()): string {
  const vnTime = new Date(date.getTime() + (VIETNAM_OFFSET_HOURS * 60 + date.getTimezoneOffset()) * 60 * 1000);
  const year = vnTime.getFullYear();
  const month = String(vnTime.getMonth() + 1).padStart(2, '0');
  const day = String(vnTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns the maximum date of birth for an adult (at least 18 years old today in Vietnam).
 */
export function getMaxAdultDateOfBirth(todayStr?: string): string {
  const [y, m, d] = (todayStr || getTodayInVietnam()).split('-').map(Number);
  return `${y - 18}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Formats an ISO datetime string into Vietnam timezone DD/MM/YYYY HH:mm.
 */
export function formatVietnamDateTime(isoString: string | null | undefined): string {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '—';

  const vnTime = new Date(date.getTime() + (VIETNAM_OFFSET_HOURS * 60 + date.getTimezoneOffset()) * 60 * 1000);
  const day = String(vnTime.getDate()).padStart(2, '0');
  const month = String(vnTime.getMonth() + 1).padStart(2, '0');
  const year = vnTime.getFullYear();
  const hours = String(vnTime.getHours()).padStart(2, '0');
  const minutes = String(vnTime.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Calculates working days between startDate and endDate (inclusive),
 * excluding Sundays (VNC Clinic works Monday - Saturday).
 * Throws an error if count is 0 or range is invalid.
 */
export function calculateWorkingDays(startDateStr: string, endDateStr: string, todayStr?: string): number {
  if (!startDateStr || !endDateStr) return 0;
  if (endDateStr < startDateStr) {
    throw new Error('Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.');
  }

  const effectiveToday = todayStr || getTodayInVietnam();
  if (startDateStr < effectiveToday) {
    throw new Error('Ngày bắt đầu nghỉ không được ở trong quá khứ.');
  }

  const start = new Date(startDateStr + 'T00:00:00');
  const end = new Date(endDateStr + 'T00:00:00');

  let days = 0;
  const current = new Date(start);
  while (current <= end) {
    if (current.getDay() !== 0) { // 0 is Sunday
      days += 1;
    }
    current.setDate(current.getDate() + 1);
  }

  if (days <= 0) {
    throw new Error('Khoảng thời gian đã chọn không có ngày làm việc.');
  }

  return days;
}
