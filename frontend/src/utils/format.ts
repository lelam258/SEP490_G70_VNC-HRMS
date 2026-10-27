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
