export const shiftNames: Record<string, string> = { morning: 'Sáng', noon: 'Trực trưa', afternoon: 'Chiều', evening: 'Trực tối' };
export const dayNames = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];
export function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function clinicToday() { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' }).format(new Date()); }
export function weekStart(date: string) { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return dateKey(d); }
export function addDays(date: string, offset: number) { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + offset); return dateKey(d); }
export function shortDate(date: string, year = false) { return new Date(`${date}T12:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', ...(year ? { year: 'numeric' } : {}) }); }
export function shiftHours(date: string, shift: string) {
  const monthDay = date.slice(5);
  const summer = monthDay >= '04-15' && monthDay < '12-01';
  return ({ morning: summer ? '07:00–11:30' : '07:10–11:45', noon: summer ? '11:30–13:30' : '11:45–13:30', afternoon: '13:30–17:00', evening: '17:00–19:00' } as Record<string, string>)[shift] || '';
}
