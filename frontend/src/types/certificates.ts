export type CertificateCategory = 'degree' | 'certificate';

export const EDUCATION_LEVELS = [
  'Trung cấp',
  'Cao đẳng',
  'Đại học / Cử nhân',
  'Thạc sĩ',
  'Tiến sĩ',
] as const;

export const DEGREE_MAJORS = [
  'Y khoa',
  'Điều dưỡng',
  'Kỹ thuật xét nghiệm y học',
] as const;

export const VERIFICATION_STATUSES = [
  { value: 'unverified', label: 'Chưa xác minh' },
  { value: 'verified', label: 'Đã xác minh' },
  { value: 'rejected', label: 'Không hợp lệ / Từ chối' },
] as const;

export const ISSUANCE_METHODS = [
  'Cấp lần đầu',
  'Cấp lại',
  'Cấp điều chỉnh / Bổ sung',
  'Gia hạn',
] as const;

export interface StaffCertificateSummary {
  staffId: string;
  staffCode: string;
  fullName: string;
  departmentId: string | null;
  departmentName: string;
  email: string | null;
  status: string;
  avatarUrl: string | null;
  certificateCount: number;
}

export interface Certificate {
  certificateId: string;
  staffId: string;
  staffCode: string;
  staffName: string;
  departmentId: string | null;
  departmentName: string | null;
  certificateNumber: string | null;
  category: CertificateCategory;
  categoryLabel: string;
  certificateType: string;
  issuingAuthority: string | null; // "Cơ sở đào tạo" (Bằng cấp) hoặc "Nơi cấp" (Chứng chỉ)
  issueDate: string | null;
  expiryDate: string | null;
  scopeOfPractice: string | null;
  cmeCycleMonths: number | null;
  cmeRequiredCredits: number | null;
  status: string;
  fileUrl: string | null;
  createdAt: string | null;
  updatedAt: string | null;

  // Trường chuyên biệt cho Bằng cấp (Degree):
  degreeType?: string | null; // Trình độ đào tạo
  major?: string | null; // Ngành hoặc chuyên ngành
  verificationStatus?: string | null; // Trạng thái xác minh
  notes?: string | null; // Ghi chú

  // Trường chuyên biệt cho Chứng chỉ (Certificate):
  professionalDegree?: string | null; // Văn bằng chuyên môn
  issuanceMethod?: string | null; // Hình thức cấp (nếu có)
}

export interface SaveCertificateInput {
  staffId: string;
  category?: CertificateCategory | null;
  certificateNumber?: string | null;
  certificateType: string;
  issuingAuthority?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  scopeOfPractice?: string | null;
  cmeCycleMonths?: number | null;
  cmeRequiredCredits?: number | null;
  status?: string | null;
  fileUrl?: string | null;
  departmentId?: string | null;

  degreeType?: string | null;
  major?: string | null;
  verificationStatus?: string | null;
  notes?: string | null;
  professionalDegree?: string | null;
  issuanceMethod?: string | null;
}

export interface UpdateCertificateInput {
  category?: CertificateCategory | null;
  certificateNumber?: string | null;
  certificateType: string;
  issuingAuthority?: string | null;
  issueDate?: string | null;
  expiryDate?: string | null;
  scopeOfPractice?: string | null;
  cmeCycleMonths?: number | null;
  cmeRequiredCredits?: number | null;
  status?: string | null;
  fileUrl?: string | null;
  departmentId?: string | null;

  degreeType?: string | null;
  major?: string | null;
  verificationStatus?: string | null;
  notes?: string | null;
  professionalDegree?: string | null;
  issuanceMethod?: string | null;
}
