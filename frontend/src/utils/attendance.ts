export const attendanceLabels: Record<string, string> = {
  main: 'Ca chính', noon: 'Trực trưa', evening: 'Trực tối', imported: 'Đã nhập · Chưa xác nhận', pending: 'Chờ xác nhận',
  flagged: 'Cần đối chiếu', confirmed: 'Đã xác nhận', valid: 'Hợp lệ', warning: 'Cảnh báo', error: 'Lỗi', duplicate: 'Trùng', committed: 'Đã lưu',
  staged: 'Chờ xem trước', partial: 'Đã lưu một phần', excluded: 'Đã loại khỏi đợt nhập', machine: 'Máy chấm công', manual: 'Nhập/điều chỉnh thủ công', on_call: 'Hồ sơ trực',
  attendance: 'Chấm công', schedules: 'Lịch làm việc', accounts: 'Tài khoản', system: 'Hệ thống', payroll: 'Kỳ lương', success: 'Thành công',
  create_account: 'Tạo tài khoản', activate_account: 'Kích hoạt tài khoản', deactivate_account: 'Ngừng tài khoản', assign_role: 'Đổi vai trò', update_account: 'Sửa tài khoản',
  stage_import: 'Đọc tệp chấm công', correct_import_row: 'Sửa dòng nhập', exclude_import_row: 'Loại dòng nhập', commit_import: 'Lưu đợt nhập', import_record: 'Tạo bản ghi chấm công',
  map_attendance_device: 'Liên kết mã máy chấm công',
  create_on_call: 'Ghi nhận trực', edit_on_call: 'Sửa hồ sơ trực', assign: 'Phân công ca', edit_assignment: 'Sửa phân công', cancel_assignment: 'Hủy phân công',
  publish_schedule: 'Chốt lịch', reopen_schedule: 'Mở lại lịch', record_duty: 'Ghi nhận công trực', draft: 'Nháp', published: 'Đã công bố', cancelled: 'Đã hủy',
};
export function attendanceLabel(value: string | null | undefined) { return value ? attendanceLabels[value] || value : '—'; }
export function clockTime(value: string | null | undefined) { return value ? value.includes('T') ? value.slice(11, 16) : value.slice(0, 5) : '—'; }
export function instant(value: string | null | undefined) {
  if (!value) return '—';
  const utc = /(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`;
  return new Date(utc).toLocaleString('vi-VN', { timeZone: 'Asia/Bangkok', hour12: false });
}
export function monthEnd(month: string) {
  const [year, m] = month.split('-').map(Number);
  return `${month}-${new Date(year, m, 0).getDate()}`;
}
