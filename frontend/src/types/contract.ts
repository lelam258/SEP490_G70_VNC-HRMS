export type ContractDisplayStatus = 'active' | 'expiring' | 'expired' | 'upcoming' | 'inactive';

/** One row of the contract list. Intentionally carries no salary amounts. */
export interface ContractListItem {
  contractId: string;
  contractCode: string | null;
  staffId: string;
  staffCode: string;
  staffName: string;
  departmentId: string | null;
  departmentName: string | null;
  positionName: string | null;
  siteName: string | null;
  contractType: string;
  salaryType: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  fileUrl: string | null;
  displayStatus: ContractDisplayStatus;
}

export interface ContractDetail {
  contractId: string;
  contractCode: string | null;
  staffId: string;
  staffCode: string;
  staffName: string;
  staffEmail: string | null;
  departmentName: string | null;
  positionName: string | null;
  siteName: string | null;
  contractType: string;
  salaryType: string;
  dailyRate: number;
  monthlySalary: number | null;
  standardWorkingDays: number | null;
  isInsuranceEligible: boolean;
  insuranceSalaryBasis: number | null;
  taxMethod: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  fileUrl: string | null;
  createdAt: string;
  updatedAt: string;
  displayStatus: ContractDisplayStatus;
}

export interface CreateContractInput {
  staffId: string;
  contractCode: string;
  contractType: string;
  salaryType: string;
  baseSalary: number;
  standardWorkingDays: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  fileUrl: string | null;
}

export interface UpdateContractInput {
  contractCode: string;
  contractType: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  fileUrl: string | null;
}

export const CONTRACT_TYPES = [
  'Hợp đồng không xác định thời hạn',
  'Hợp đồng xác định thời hạn',
  'Hợp đồng thử việc',
] as const;

export function isIndefiniteContract(contractType: string) {
  return contractType.toLowerCase().includes('không xác định');
}

export const contractStatusLabels: Record<ContractDisplayStatus, string> = {
  active: 'Đang hiệu lực',
  expiring: 'Sắp hết hạn',
  expired: 'Hết hạn',
  upcoming: 'Chưa hiệu lực',
  inactive: 'Ngừng hiệu lực',
};

export const salaryTypeLabels: Record<string, string> = {
  daily: 'Theo ngày',
  monthly: 'Theo tháng',
};
