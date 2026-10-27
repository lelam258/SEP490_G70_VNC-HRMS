export function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim(); }
export function initials(name: string) { return name.split(' ').slice(-2).map(s => s[0]).join(''); }
export function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value.endsWith('Z') ? value : `${value}Z`)) : 'Chưa đăng nhập'; }

export function formatVnd(value: number | null | undefined): string {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
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
