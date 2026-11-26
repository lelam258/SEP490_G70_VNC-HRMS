import type { PayslipDetail } from './payrollPeriod';

export interface MyPayslipSummary {
  payslipId: string;
  payMonth: string;
  finalizedAt: string | null;
  workDays: number;
  basePay: number;
  allowanceTotal: number;
  commissionTotal: number;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
}

export type MyPayslipAvailability = 'available' | 'not_finalized' | 'not_found';

export interface MyPayslipMonthLookup {
  payMonth: string;
  availability: MyPayslipAvailability;
  message: string | null;
  payslip: PayslipDetail | null;
}
