export interface UserProfile {
  staffId: string;
  staffCode: string;
  fullName: string;
  dateOfBirth: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  idCardNumber: string | null;
  avatarUrl: string | null;
  departmentName: string | null;
  positionName: string | null;
  dateJoined: string | null;
  scopeOfPractice: string | null;
  dependentCount: number;
  status: string;
}

export interface UpdateProfileInput {
  fullName: string;
  dateOfBirth: string | null;
  gender: string | null;
  idCardNumber: string | null;
  phone: string;
}
