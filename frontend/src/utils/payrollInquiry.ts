import type { InquiryStatus, InquiryType } from '../types/payrollInquiry';

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_MIME_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);
export const ALLOWED_ATTACHMENT_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

export const MSG14_INVALID_FILE =
  'Tệp đính kèm không hợp lệ. Vui lòng chọn tệp PDF, JPG hoặc PNG và dung lượng không vượt quá 10 MB.';

export function validateAttachmentFile(file: File): string | null {
  if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
    return MSG14_INVALID_FILE;
  }
  const lowerName = file.name.toLowerCase();
  const hasValidExt = ALLOWED_ATTACHMENT_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
  const hasValidMime = !file.type || ALLOWED_ATTACHMENT_MIME_TYPES.has(file.type.toLowerCase());
  if (!hasValidExt || !hasValidMime) {
    return MSG14_INVALID_FILE;
  }
  return null;
}

export function getInquiryTypeLabel(type: string | null | undefined): string {
  switch ((type || '').toLowerCase() as InquiryType) {
    case 'attendance':
      return 'Chấm công & ca trực';
    case 'procedure_commission':
      return 'Hoa hồng thủ thuật';
    case 'payslip_salary':
      return 'Phiếu lương & khấu trừ';
    case 'other':
      return 'Khác';
    default:
      return type || 'Khác';
  }
}

export function getInquiryStatusLabel(status: string | null | undefined): string {
  switch ((status || '').toLowerCase() as InquiryStatus) {
    case 'submitted':
      return 'Đã gửi';
    case 'in_review':
      return 'Đang xem xét';
    case 'resolved':
      return 'Đã giải quyết';
    case 'rejected':
      return 'Từ chối';
    default:
      return status || 'Đã gửi';
  }
}

export function getInquiryStatusBadgeClass(status: string | null | undefined): string {
  switch ((status || '').toLowerCase() as InquiryStatus) {
    case 'submitted':
      return 'bg-amber-50 text-amber-700 border border-amber-200/80';
    case 'in_review':
      return 'bg-sky-50 text-sky-700 border border-sky-200/80';
    case 'resolved':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200/80';
    case 'rejected':
      return 'bg-rose-50 text-rose-700 border border-rose-200/80';
    default:
      return 'bg-slate-100 text-slate-600 border border-slate-200';
  }
}

export function formatPayMonthLabel(payMonth: string | null | undefined): string {
  if (!payMonth) return '—';
  const parts = payMonth.split('-');
  if (parts.length !== 2) return payMonth;
  return `Tháng ${Number(parts[1])}/${parts[0]}`;
}

export function extractOriginalFileName(url: string, fallback?: string | null): string {
  if (fallback && fallback.trim()) return fallback.trim();
  const clean = decodeURIComponent(url.split('?')[0].split('/').pop() || url);
  return clean.replace(/^\d+_[0-9a-f]{32}_/i, '');
}
