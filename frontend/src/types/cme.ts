export interface StaffCmeSummary {
  staffId: string;
  staffCode: string;
  fullName: string;
  departmentId: string | null;
  departmentName: string;
  email: string | null;
  status: string;
  avatarUrl: string | null;
  certificateCount: number;
  cmeCertificateCount: number;
  cmeRecordCount: number;
  pendingVerifyCount: number;
  totalRequiredCredits: number;
  totalEarnedCredits: number;
  verifiedCredits: number;
}

export interface CmeRecord {
  cmeId: string;
  certificateId: string;
  certificateType: string;
  certificateNumber: string | null;
  cmeCycleMonths: number | null;
  cmeRequiredCredits: number | null;
  staffId: string;
  staffCode: string;
  staffName: string;
  departmentId: string | null;
  departmentName: string | null;
  cmeCycleId: string | null;
  cycleNumber: number | null;
  courseName: string;
  provider: string | null;
  completedDate: string;
  credits: number;
  fileUrl: string | null;
  verified: boolean;
  verifiedBy: string | null;
  verifiedByName: string | null;
  verifiedAt: string | null;
  createdAt: string | null;
}

export interface SaveCmeRecordInput {
  certificateId: string;
  courseName: string;
  provider?: string | null;
  completedDate: string;
  credits: number;
  fileUrl?: string | null;
  verified?: boolean;
}

export interface UpdateCmeRecordInput {
  certificateId: string;
  courseName: string;
  provider?: string | null;
  completedDate: string;
  credits: number;
  fileUrl?: string | null;
  verified?: boolean | null;
}
