export function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim(); }
export function initials(name: string) { return name.split(' ').slice(-2).map(s => s[0]).join(''); }
export function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value.endsWith('Z') ? value : `${value}Z`)) : 'Chưa đăng nhập'; }
