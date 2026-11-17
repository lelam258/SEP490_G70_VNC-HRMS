import { getMaxAdultDateOfBirth } from './leaveRules';

type EmployeeBasics = { code: string; name: string; email?: string | null };

export function validateEmployeeBasics(input: EmployeeBasics): string {
  if (!input.code.trim() || input.code.trim().length > 20) return 'Mã nhân viên là bắt buộc và tối đa 20 ký tự.';
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 100 || !/^[\p{L}\s'\-]+$/u.test(name))
    return 'Họ tên phải từ 2–100 ký tự, chỉ chứa chữ cái, khoảng trắng, dấu gạch nối và nháy đơn.';
  return '';
}

export function validateEmployeeProfile(input: EmployeeBasics & {
  phone?: string; dateOfBirth?: string; idCardNumber?: string;
  dateJoined?: string; dateLeft?: string; dependentCount: number;
}, today?: string): string {
  const basicError = validateEmployeeBasics(input);
  if (basicError) return basicError;
  if (input.phone?.trim() && !/^0[0-9]{9}$/.test(input.phone.trim())) return 'Số điện thoại phải gồm 10 chữ số bắt đầu bằng 0.';
  if (input.idCardNumber?.trim() && !/^[0-9]{12}$/.test(input.idCardNumber.trim())) return 'Số CCCD phải gồm đúng 12 chữ số.';
  if (input.dateOfBirth && (input.dateOfBirth < '1940-01-01' || input.dateOfBirth > getMaxAdultDateOfBirth(today)))
    return 'Năm sinh phải từ 1940 và nhân viên phải đủ 18 tuổi.';
  if (input.dateOfBirth && input.dateJoined && input.dateJoined <= input.dateOfBirth) return 'Ngày vào làm phải sau ngày sinh.';
  if (input.dateJoined && input.dateLeft && input.dateLeft < input.dateJoined) return 'Ngày nghỉ việc phải sau hoặc bằng ngày vào làm.';
  if (!Number.isInteger(input.dependentCount) || input.dependentCount < 0) return 'Số người phụ thuộc phải là số nguyên không âm.';
  return '';
}
