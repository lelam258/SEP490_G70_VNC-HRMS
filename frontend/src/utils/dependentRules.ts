export function validateDependentFullName(value: string): string {
  if (!value.trim()) return 'Họ và tên người phụ thuộc là bắt buộc.';
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (normalized.length < 2 || normalized.length > 100) {
    return 'Họ và tên phải từ 2 đến 100 ký tự.';
  }
  if (!/^[\p{L}\s'\-]+$/u.test(normalized)) {
    return 'Họ và tên chỉ được chứa chữ cái, khoảng trắng, dấu gạch nối và nháy đơn.';
  }
  return '';
}

export function validateDependentDob(value: string): string {
  if (!value) return 'Ngày sinh người phụ thuộc là bắt buộc.';
  if (value < '1900-01-01') return 'Năm sinh người phụ thuộc phải từ năm 1900 trở lại đây.';
  const today = new Date().toISOString().slice(0, 10);
  if (value > today) return 'Ngày sinh người phụ thuộc không được lớn hơn ngày hiện tại.';
  return '';
}

export function validateDependentIdCard(value: string): string {
  if (!value) return '';
  if (/\s/.test(value)) {
    return 'Số CCCD không được chứa khoảng trắng.';
  }
  if (!/^\d{12}$/.test(value)) {
    return 'Số CCCD chỉ được gồm đúng 12 chữ số (không chứa số âm, chữ cái hay ký tự đặc biệt).';
  }
  return '';
}

export function validateDependentTaxCode(value: string): string {
  if (!value) return '';
  if (/\s/.test(value)) {
    return 'Mã số thuế không được chứa khoảng trắng.';
  }
  if (!/^(\d{10}|\d{13})$/.test(value)) {
    return 'Mã số thuế chỉ được gồm 10 hoặc 13 chữ số (không chứa số âm, khoảng trắng hay ký tự đặc biệt).';
  }
  return '';
}

export function validateDependentDocumentUrl(value: string): string {
  if (!value) return '';
  if (/\s/.test(value)) {
    return 'Đường dẫn tài liệu không được chứa khoảng trắng.';
  }
  if (value.length > 500) {
    return 'Đường dẫn tài liệu tối đa 500 ký tự.';
  }
  return '';
}
