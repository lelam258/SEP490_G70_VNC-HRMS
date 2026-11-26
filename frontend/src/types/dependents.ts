export type DependentGender = 'male' | 'female' | 'other';

export type DependentRelationship = 'father' | 'mother' | 'child' | 'spouse' | 'other';

export type DependentDocumentType =
  | 'birth_certificate'
  | 'id_card'
  | 'marriage_certificate'
  | 'student_confirmation'
  | 'disability_certificate'
  | 'other';

export type DependentVerificationStatus = 'pending' | 'verified' | 'rejected' | 'expired';

export interface DependentDocument {
  documentId: string;
  staffDependentId: string;
  documentType: DependentDocumentType | string;
  fileName: string;
  fileUrl: string | null;
  verificationStatus: DependentVerificationStatus | string;
  uploadedAt: string;
  verifiedBy: string | null;
  verifiedByName: string | null;
}

export interface EmployeeDependent {
  staffDependentId: string;
  dependentId: string;
  staffId: string;
  registeredBy: string;
  registeredByName: string | null;
  fullName: string;
  dateOfBirth: string;
  gender: DependentGender | string;
  idCardNumber: string | null;
  taxCode: string | null;
  relationship: DependentRelationship | string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  documents: DependentDocument[];
}

export interface CreateDependentDocumentInput {
  documentType: string;
  fileName: string;
  fileUrl: string | null;
}

export interface CreateEmployeeDependentInput {
  fullName: string;
  dateOfBirth: string;
  gender: string;
  idCardNumber: string | null;
  taxCode: string | null;
  relationship: string;
  isActive: boolean;
  documents?: CreateDependentDocumentInput[];
}

export interface UpdateEmployeeDependentInput {
  fullName: string;
  dateOfBirth: string;
  gender: string;
  idCardNumber: string | null;
  taxCode: string | null;
  relationship: string;
  isActive: boolean;
}

export const DEPENDENT_RELATIONSHIP_OPTIONS: { value: DependentRelationship; label: string }[] = [
  { value: 'father', label: 'Cha' },
  { value: 'mother', label: 'Mẹ' },
  { value: 'child', label: 'Con' },
  { value: 'spouse', label: 'Vợ / Chồng' },
  { value: 'other', label: 'Người thân khác' },
];

export const DEPENDENT_GENDER_OPTIONS: { value: DependentGender; label: string }[] = [
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác' },
];

export const DEPENDENT_DOCUMENT_TYPE_OPTIONS: { value: DependentDocumentType; label: string }[] = [
  { value: 'birth_certificate', label: 'Giấy khai sinh' },
  { value: 'id_card', label: 'CCCD / CMND' },
  { value: 'marriage_certificate', label: 'Giấy đăng ký kết hôn' },
  { value: 'student_confirmation', label: 'Giấy xác nhận sinh viên' },
  { value: 'disability_certificate', label: 'Giấy xác nhận khuyết tật' },
  { value: 'other', label: 'Giấy tờ khác' },
];

export function getRelationshipLabel(value: string): string {
  return DEPENDENT_RELATIONSHIP_OPTIONS.find(o => o.value === value)?.label ?? value;
}

export function getGenderLabel(value: string): string {
  return DEPENDENT_GENDER_OPTIONS.find(o => o.value === value)?.label ?? value;
}

export function getDocumentTypeLabel(value: string): string {
  return DEPENDENT_DOCUMENT_TYPE_OPTIONS.find(o => o.value === value)?.label ?? value;
}

export function getVerificationStatusLabel(value: string): string {
  switch (value) {
    case 'verified':
      return 'Đã xác nhận';
    case 'expired':
      return 'Mất hiệu lực';
    case 'rejected':
      return 'Từ chối';
    default:
      return 'Chờ kiểm tra';
  }
}
