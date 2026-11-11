export interface PayrollPeriod {
  lockId: string;
  payMonth: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'locked' | 'finalized' | 'exported' | string;
  employeeCount: number;
  totalGrossPay: number;
  totalNetPay: number;
  attendanceLocked: boolean;
  proceduresVerified: boolean;
  isLate: boolean;
  lockedAt: string | null;
  createdAt: string | null;
  openDate: string;
  standardLockDate: string;
  correctionDeadline: string;
}

export interface CreatePayrollPeriodInput {
  payMonth: string;
}

export interface ReopenPayrollPeriodInput {
  reason: string;
}

export interface PayslipSummaryItem {
  payslipId: string;
  staffId: string;
  staffCode: string | null;
  staffName: string | null;
  departmentName: string | null;
  workDays: number;
  onCallDays: number;
  basePay: number;
  allowanceTotal: number;
  commissionTotal: number;
  grossPay: number;
  insuranceDeduction: number;
  taxDeduction: number;
  netPay: number;
  status: string | null;
  contractType: string | null;
  hasContract: boolean;
  attendanceConfirmed: boolean;
  procedureConfirmed: boolean;
}

export interface PayrollPeriodDetail extends PayrollPeriod {
  reopenReason?: string | null;
  payslips: PayslipSummaryItem[];
}
