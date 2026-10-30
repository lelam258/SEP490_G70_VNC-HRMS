export function normalize(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(-2).map(s => s[0]).join('').toUpperCase();
}

export function formatDate(value?: string | null, fallback = 'Chưa có') {
  if (!value) return fallback;
  try {
    const isIsoTime = value.includes('T');
    const date = new Date(isIsoTime ? (value.endsWith('Z') ? value : `${value}Z`) : value);
    if (isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeStyle: isIsoTime ? 'short' : undefined,
    }).format(date);
  } catch {
    return value;
  }
}

export function formatVnd(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return `${Math.round(value).toLocaleString('vi-VN')} ₫`;
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return `${value}%`;
}

export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return '-';
  const parts = value.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return value;
}

/** Today's date (yyyy-MM-dd) in Vietnam time (UTC+7), independent of the browser timezone. */
export function todayVn(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function formatDateRange(from: string | null | undefined, to: string | null | undefined): string {
  const fromStr = formatDateOnly(from);
  const toStr = to ? formatDateOnly(to) : 'nay';
  return `${fromStr} → ${toStr}`;
}

export function formatNumberWithDots(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '';
  const clean = String(val).replace(/\D/g, '');
  if (!clean) return '';
  return Number(clean).toLocaleString('vi-VN');
}

export function parseNumberFromDots(val: string): number {
  if (!val) return 0;
  const clean = val.replace(/\./g, '').replace(/,/g, '').trim();
  const num = Number(clean);
  return isNaN(num) ? 0 : num;
}
