export interface PayrollHistoryDepartmentOption {
  departmentId: string;
  name: string;
}

export interface PayrollHistoryItem {
  lockId: string;
  payMonth: string;
  status: string;
  runCount: number;
  isLate: boolean;
  hasWarning: boolean;
  warningMessage?: string | null;
  employeeCount: number;
  totalWorkDays: number;
  totalCommission: number;
  totalGrossPay: number;
  totalInsurance: number;
  totalTax: number;
  totalNetPay: number;
  lastCalculatedAt?: string | null;
  lockedAt?: string | null;
  lockedByName?: string | null;
}

export interface PayrollHistoryResponse {
  items: PayrollHistoryItem[];
  departments: PayrollHistoryDepartmentOption[];
}

export interface PayrollHistoryDepartmentBreakdown {
  departmentId?: string | null;
  departmentName: string;
  employeeCount: number;
  totalWorkDays: number;
  totalCommission: number;
  totalGrossPay: number;
  totalInsurance: number;
  totalTax: number;
  totalNetPay: number;
}

export interface PayrollHistoryEvent {
  logId: string;
  action: string;
  actionLabel: string;
  actorName: string;
  createdAt?: string | null;
  summary?: string | null;
}

export interface PayrollHistoryDetail {
  summary: PayrollHistoryItem;
  departmentBreakdowns: PayrollHistoryDepartmentBreakdown[];
  events: PayrollHistoryEvent[];
}
