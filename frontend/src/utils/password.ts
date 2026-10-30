export const passwordHint = 'Từ 6 đến 128 ký tự, có ít nhất 1 chữ hoa, 1 số và 1 ký tự đặc biệt.';
export function isStrongPassword(value: string) {
  return value.trim().length > 0 && value.length >= 6 && value.length <= 128
    && /\p{Lu}/u.test(value) && /\p{Nd}/u.test(value) && /[^\p{L}\p{N}\s]/u.test(value);
}
