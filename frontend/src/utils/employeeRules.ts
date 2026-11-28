import { getMaxAdultDateOfBirth, getTodayInVietnam } from './leaveRules';

/** Tuổi tối đa theo GB-05: nam 62, nữ 60; giới tính khác/chưa cập nhật dùng mức 62 (khớp ProfileRules backend). */
export function getMaxWorkingAge(gender?: string | null): number {
  return gender === 'female' ? 60 : 62;
}

/** Ngày sinh sớm nhất còn hợp lệ (bao gồm): người sinh ngày này đang đúng tuổi tối đa. */
export function getMinWorkingDateOfBirth(gender?: string | null, todayStr?: string): string {
  const [y, m, d] = (todayStr || getTodayInVietnam()).split('-').map(Number);
  const date = new Date(Date.UTC(y - getMaxWorkingAge(gender) - 1, m - 1, d));
  if (date.getUTCMonth() !== m - 1) date.setUTCDate(0); // 29/02 -> 28/02 như DateOnly.AddYears
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** Kiểm tra ngày sinh theo độ tuổi lao động; trả về thông báo lỗi hoặc chuỗi rỗng. */
export function validateWorkingAge(dateOfBirth: string, gender?: string | null, todayStr?: string): string {
  if (!dateOfBirth) return '';
  if (dateOfBirth < '1940-01-01') return 'Năm sinh phải từ năm 1940 trở lại đây.';
  if (dateOfBirth > getMaxAdultDateOfBirth(todayStr)) return 'Nhân viên phải từ đủ 18 tuổi trở lên.';
  if (dateOfBirth < getMinWorkingDateOfBirth(gender, todayStr)) {
    const subject = gender === 'male' ? 'Nhân viên nam' : gender === 'female' ? 'Nhân viên nữ' : 'Nhân viên';
    return `${subject} không được quá ${getMaxWorkingAge(gender)} tuổi theo quy định độ tuổi lao động.`;
  }
  return '';
}

type EmployeeBasics = { code: string; name: string; email?: string | null };

export function validateDependentCount(value: string): string {
  return /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) <= 2147483647
    ? '' : 'Xin hãy nhập số người hợp lệ !';
}

export function validateEmployeeBasics(input: EmployeeBasics): string {
  if (!input.code.trim() || input.code.trim().length > 20) return 'Mã nhân viên là bắt buộc và tối đa 20 ký tự.';
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 100 || !/^[\p{L}\s'\-]+$/u.test(name))
    return 'Họ tên phải từ 2–100 ký tự, chỉ chứa chữ cái, khoảng trắng, dấu gạch nối và nháy đơn.';
  return '';
}

export function validateEmployeeProfile(input: EmployeeBasics & {
  phone?: string; dateOfBirth?: string; gender?: string | null; idCardNumber?: string;
  dateJoined?: string; dateLeft?: string; dependentCount: number;
}, today?: string): string {
  const basicError = validateEmployeeBasics(input);
  if (basicError) return basicError;
  if (input.phone?.trim() && !/^0[0-9]{9}$/.test(input.phone.trim())) return 'Số điện thoại phải gồm 10 chữ số bắt đầu bằng 0.';
  if (input.idCardNumber?.trim() && !/^[0-9]{12}$/.test(input.idCardNumber.trim())) return 'Số CCCD phải gồm đúng 12 chữ số.';
  const ageError = validateWorkingAge(input.dateOfBirth || '', input.gender, today);
  if (ageError) return ageError;
  if (input.dateOfBirth && input.dateJoined && input.dateJoined <= input.dateOfBirth) return 'Ngày vào làm phải sau ngày sinh.';
  if (input.dateJoined && input.dateLeft && input.dateLeft < input.dateJoined) return 'Ngày nghỉ việc phải sau hoặc bằng ngày vào làm.';
  if (!Number.isInteger(input.dependentCount) || input.dependentCount < 0) return 'Xin hãy nhập số người hợp lệ !';
  return '';
}
