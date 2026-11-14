export const attendanceLabels: Record<string, string> = {
  main: 'Ca chính', noon: 'Trực trưa', evening: 'Trực tối', morning: 'Ca sáng', afternoon: 'Ca chiều',
  imported: 'Đã nhập · Chưa xác nhận', pending: 'Chờ xác nhận', reconciled: 'Đã đối chiếu · Chờ xác nhận',
  flagged: 'Cần đối chiếu', confirmed: 'Đã xác nhận', rejected: 'Đã từ chối', valid: 'Hợp lệ', warning: 'Cảnh báo', error: 'Lỗi', duplicate: 'Trùng', committed: 'Đã lưu',
  staged: 'Chờ xem trước', partial: 'Đã lưu một phần', excluded: 'Đã loại khỏi đợt nhập',
  machine: 'Máy chấm công', fingerprint: 'Máy vân tay', manual: 'Nhập/điều chỉnh thủ công', on_call: 'Hồ sơ trực',
  attendance: 'Chấm công', schedules: 'Lịch làm việc', accounts: 'Tài khoản', system: 'Hệ thống', payroll: 'Kỳ lương', success: 'Thành công',
  create_account: 'Tạo tài khoản', activate_account: 'Kích hoạt tài khoản', deactivate_account: 'Ngừng tài khoản', assign_role: 'Đổi vai trò', update_account: 'Sửa tài khoản',
  stage_import: 'Đọc tệp chấm công', correct_import_row: 'Sửa dòng nhập', exclude_import_row: 'Loại dòng nhập', commit_import: 'Lưu đợt nhập', import_record: 'Tạo bản ghi chấm công',
  map_attendance_device: 'Liên kết mã máy chấm công',
  create_manual_attendance: 'Nhập chấm công thủ công', reconcile_attendance: 'Đối chiếu chấm công',
  verify_attendance_record: 'Xác nhận ngày công', return_attendance_record: 'Trả về đối chiếu lại',
  create_on_call: 'Ghi nhận trực', edit_on_call: 'Sửa hồ sơ trực', verify_on_call: 'Xác nhận ca trực', return_on_call: 'Trả về ca trực',
  lock_monthly_timesheet: 'Khóa bảng công tháng',
  assign: 'Phân công ca', edit_assignment: 'Sửa phân công', cancel_assignment: 'Hủy phân công',
  publish_schedule: 'Chốt lịch', reopen_schedule: 'Mở lại lịch', record_duty: 'Ghi nhận công trực',
  draft: 'Bản nháp', open: 'Đang mở', reopened: 'Mở lại điều chỉnh', locked: 'Đã khóa', closed: 'Đã đóng', published: 'Đã công bố', cancelled: 'Đã hủy',
  missing_punch: 'Thiếu lượt Vào/Ra', late_early: 'Đi muộn / Về sớm', early_evening_unconfirmed: 'Ca tối về sớm thiếu xác nhận QL',
  unexplained_absence: 'Vắng mặt chưa rõ lý do', duplicate_shift: 'Trùng ca / Lặp cặp giờ', leave_conflict: 'Trùng ngày nghỉ phép',
  source_mismatch: 'Lệch nguồn / Lệch lịch phân công', matched: 'Khớp dữ liệu nguồn',
  accept_machine: 'Chấp nhận giờ máy', accept_manual: 'Chấp nhận thủ công có căn cứ',
  correct_time: 'Chỉnh sửa giờ thực tế', mark_unresolved: 'Giữ Flagged (Chưa giải quyết)',
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
