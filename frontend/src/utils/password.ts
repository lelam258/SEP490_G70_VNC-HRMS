export const passwordHint = 'Từ 6 đến 128 ký tự.';
export function isStrongPassword(value: string) {
  return value.trim().length > 0 && value.length >= 6 && value.length <= 128;
}
