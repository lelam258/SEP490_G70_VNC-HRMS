export interface PayrollPeriod {
  lockId: string;
  payMonth: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'locked' | 'finalized' | 'exported' | string;
  employeeCount: number;
  totalNetPay: number;
  lockedAt: string | null;
  createdAt: string | null;
}

export interface CreatePayrollPeriodInput {
  payMonth: string;
}

export interface PayslipSummaryItem {
  payslipId: string;
  staffId: string;
  staffCode: string | null;
  staffName: string | null;
  departmentName: string | null;
  basePay: number;
  allowanceTotal: number;
  grossPay: number;
  insuranceDeduction: number;
  taxDeduction: number;
  netPay: number;
  status: string | null;
}

export interface PayrollPeriodDetail extends PayrollPeriod {
  payslips: PayslipSummaryItem[];
}
