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

export type PayslipReviewStatus =
  | 'pending'
  | 'reviewed'
  | 'needs_hr'
  | 'needs_attendance'
  | 'needs_procedure';

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
  onCallPay: number;
  overtimePay: number;
  otherDeduction: number;
  reviewStatus: PayslipReviewStatus | string;
  reviewNote: string | null;
  reviewedAt: string | null;
  noonDutyCount?: number;
  eveningDutyCount?: number;
  noonDutyRate?: number;
  eveningDutyRate?: number;
}

export interface PayslipAllowanceItem {
  id: string;
  allowanceId: string | null;
  name: string;
  amount: number;
}

export interface PayslipDeductionItem {
  payslipDeductionId: string;
  deductionType: string;
  deductionName: string;
  calculationBase: number;
  ratePercent: number | null;
  amount: number;
}

export interface TaxBracketBreakdownItem {
  bracketIndex: number;
  rangeText: string;
  taxableAmount: number;
  ratePercent: number;
  taxAmount: number;
}

export interface PayslipDetail {
  payslipId: string;
  staffId: string;
  staffCode: string | null;
  staffName: string | null;
  departmentName: string | null;
  positionName: string | null;
  payMonth: string;
  status: string | null;
  isLocked: boolean;
  contractCode: string | null;
  contractType: string | null;
  salaryType: string | null;
  dailyRate: number;
  monthlySalary: number | null;
  standardWorkingDays: number;
  taxMethod: string;
  isInsuranceEligible: boolean;
  insuranceSalaryBase: number;
  isUnionMember: boolean;
  dependentCount: number;
  workDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  noonDutyCount: number;
  eveningDutyCount: number;
  overtimeHours: number;
  onCallDays: number;
  basePay: number;
  noonDutyPay: number;
  eveningDutyPay: number;
  overtimePay: number;
  onCallPay: number;
  allowanceTotal: number;
  commissionTotal: number;
  grossPay: number;
  insuranceDeduction: number;
  unionFeeDeduction: number;
  otherDeduction: number;
  personalDeduction: number;
  dependentDeduction: number;
  taxableIncome: number;
  taxDeduction: number;
  netPay: number;
  hasContract: boolean;
  attendanceConfirmed: boolean;
  procedureConfirmed: boolean;
  reviewStatus: PayslipReviewStatus | string;
  reviewNote: string | null;
  reviewedAt: string | null;
  allowances: PayslipAllowanceItem[];
  deductions: PayslipDeductionItem[];
  taxBrackets: TaxBracketBreakdownItem[];
  taxCalculationNote: string | null;
}

export interface ReviewPayslipInput {
  reviewStatus: PayslipReviewStatus | string;
  note?: string;
}

export interface ConfirmPayrollPeriodInput {
  note?: string;
}

export interface FinalizePayrollPeriodInput {
  confirmLock: boolean;
  note?: string;
}

export interface PayrollPeriodDetail extends PayrollPeriod {
  reopenReason?: string | null;
  payslips: PayslipSummaryItem[];
}

export interface UpdatePayslipInlineInput {
  workDays: number;
  onCallDays: number;
  basePay: number;
  allowanceAndDutyTotal: number;
  commissionTotal: number;
  note?: string;
  noonDutyCount?: number;
  eveningDutyCount?: number;
}
