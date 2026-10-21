export const passwordHint = '12–128 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.';
export function isStrongPassword(value: string) {
  return value.length >= 12 && value.length <= 128 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /[0-9]/.test(value) && /[^a-zA-Z0-9]/.test(value);
}
