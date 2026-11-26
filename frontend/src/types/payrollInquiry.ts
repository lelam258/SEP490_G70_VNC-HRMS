import type { MyPayslipSummary } from './myPayslip';

export type InquiryType = 'attendance' | 'procedure_commission' | 'payslip_salary' | 'other';
export type InquiryStatus = 'submitted' | 'in_review' | 'resolved' | 'rejected';

export const INQUIRY_TYPE_LABELS: Record<string, string> = {
  attendance: 'Chấm công & ca trực',
  procedure_commission: 'Hoa hồng thủ thuật',
  payslip_salary: 'Phiếu lương & khấu trừ',
  other: 'Khác',
};

export const INQUIRY_STATUS_LABELS: Record<string, string> = {
  submitted: 'Đã gửi',
  in_review: 'Đang xem xét',
  resolved: 'Đã giải quyết',
  rejected: 'Từ chối',
};

export interface InquiryAttachmentInput {
  fileUrl: string;
  fileName?: string | null;
}

export interface PayrollInquiryAttachment {
  attachmentId: string;
  fileUrl: string;
  fileName?: string | null;
  uploadedBy: string;
  uploadedByName?: string | null;
  uploadedAt?: string | null;
}

export interface CreatePayrollInquiryRequest {
  inquiryType: InquiryType;
  subject: string;
  description: string;
  payMonth: string;
  payslipId?: string | null;
  attachments?: InquiryAttachmentInput[];
}

export interface ResolvePayrollInquiryRequest {
  decision: 'resolved' | 'rejected';
  response: string;
  expectedStatus?: string | null;
  expectedRepliedAt?: string | null;
}

export interface PayrollInquiryListItem {
  complaintId: string;
  inquiryCode: string;
  staffId: string;
  staffCode: string;
  staffName: string;
  departmentId?: string | null;
  departmentName?: string | null;
  payMonth?: string | null;
  payslipId?: string | null;
  isPeriodFinalized: boolean;
  periodStatus?: string | null;
  inquiryType: string;
  subject: string;
  status: InquiryStatus;
  responsePreview?: string | null;
  repliedByName?: string | null;
  attachmentCount: number;
  missingEvidence: boolean;
  ageDays: number;
  submittedAt?: string | null;
  repliedAt?: string | null;
  resolvedAt?: string | null;
}

export interface PayrollInquirySourceContext {
  payMonth?: string | null;
  isPeriodFinalized: boolean;
  periodStatus?: string | null;
  attendanceStatus?: string | null;
  attendanceConfirmed: boolean;
  verifiedProcedureCount: number;
  unverifiedProcedureCount: number;
  finalizedWorkDays?: number | null;
  finalizedGrossPay?: number | null;
  finalizedNetPay?: number | null;
  salaryMaskedReason?: string | null;
}

export interface PayrollInquiryDetail {
  complaintId: string;
  inquiryCode: string;
  staffId: string;
  staffCode: string;
  staffName: string;
  departmentId?: string | null;
  departmentName?: string | null;
  payMonth?: string | null;
  payslipId?: string | null;
  inquiryType: string;
  subject: string;
  description: string;
  status: InquiryStatus;
  isReadOnly: boolean;
  response?: string | null;
  repliedBy?: string | null;
  repliedByName?: string | null;
  submittedAt?: string | null;
  repliedAt?: string | null;
  resolvedAt?: string | null;
  attachments: PayrollInquiryAttachment[];
  sourceContext: PayrollInquirySourceContext;
}

export interface PayrollInquiryFormOptions {
  defaultPayMonth: string;
  finalizedPayslips: MyPayslipSummary[];
}

export interface InquiryDepartmentOption {
  departmentId: string;
  name: string;
}

export interface PayrollInquiryQueueResponse {
  total: number;
  page: number;
  pageSize: number;
  statusCounts: Record<string, number>;
  departments: InquiryDepartmentOption[];
  items: PayrollInquiryListItem[];
}
