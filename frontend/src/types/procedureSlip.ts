import type { ProcedureServiceOption } from './payroll';

export type ProcedureSlipStatus = 'pending' | 'hr_checked' | 'verified' | 'rejected';

export type ProcedureCommissionRole = 'indicating' | 'performing' | 'assisting' | 'lab' | 'typist';

export interface ProcedureSlipFilter {
  periodType?: 'month' | 'quarter' | 'year' | 'all' | 'custom';
  year?: number;
  month?: number;
  quarter?: number;
  fromDate?: string;
  toDate?: string;
  departmentId?: string;
  serviceId?: string;
  staffId?: string;
  status?: string;
  isAfterHours?: boolean;
  q?: string;
  scope?: 'mine' | 'department' | 'all';
  page?: number;
  pageSize?: number;
}

export interface ProcedureAssignmentItem {
  assignmentId: string;
  slipId: string;
  staffId: string;
  staffCode: string;
  staffName: string;
  departmentName?: string | null;
  positionName?: string | null;
  role: ProcedureCommissionRole;
  ruleId?: string | null;
  ruleSource: string;
  valueType?: string | null;
  ruleValue?: number | null;
  commissionAmount: number;
  payslipId?: string | null;
  status: ProcedureSlipStatus;
}

export interface ProcedureSlipListItem {
  slipId: string;
  slipNumber: string;
  procedureDate: string;
  patientCode?: string | null;
  serviceId: string;
  serviceCode: string;
  serviceName: string;
  serviceCategory?: string | null;
  departmentId?: string | null;
  departmentCode?: string | null;
  departmentName?: string | null;
  chargedAmount: number;
  directCost: number;
  netRevenue: number;
  isAfterHours: boolean;
  durationHours?: number | null;
  indicatingStaffId?: string | null;
  indicatingStaffCode?: string | null;
  indicatingStaffName?: string | null;
  performingStaffId?: string | null;
  performingStaffCode?: string | null;
  performingStaffName?: string | null;
  participantCount: number;
  totalCommissionAmount: number;
  status: ProcedureSlipStatus;
  recordedBy?: string | null;
  recordedByName?: string | null;
  hrCheckedBy?: string | null;
  hrCheckedByName?: string | null;
  hrCheckedAt?: string | null;
  verifiedBy?: string | null;
  verifiedByName?: string | null;
  verifiedAt?: string | null;
  rejectedReason?: string | null;
  createdAt?: string | null;
  isPeriodLocked: boolean;
}

export interface ProcedureSlipAuditItem {
  logId: string;
  action: string;
  username?: string | null;
  actorFullName?: string | null;
  detail?: string | null;
  createdAt?: string | null;
}

export interface ProcedureSlipDetail extends ProcedureSlipListItem {
  serviceBasePrice?: number | null;
  hrCheckNote?: string | null;
  verifyNote?: string | null;
  canEdit: boolean;
  canHrCheck: boolean;
  canAccountantVerify: boolean;
  assignments: ProcedureAssignmentItem[];
  auditHistory: ProcedureSlipAuditItem[];
}

export interface ProcedureDepartmentSummary {
  departmentId?: string | null;
  departmentCode: string;
  departmentName: string;
  totalSlips: number;
  pendingCount: number;
  hrCheckedCount: number;
  verifiedCount: number;
  rejectedCount: number;
  totalChargedAmount: number;
  totalDirectCost: number;
  totalNetRevenue: number;
  totalCommissionAmount: number;
  verifiedCommissionAmount: number;
}

export interface ProcedurePeriodBreakdown {
  periodKey: string;
  periodLabel: string;
  totalSlips: number;
  pendingCount: number;
  hrCheckedCount: number;
  verifiedCount: number;
  rejectedCount: number;
  totalChargedAmount: number;
  totalDirectCost: number;
  totalCommissionAmount: number;
  verifiedCommissionAmount: number;
}

export interface ProcedureSlipListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: ProcedureSlipListItem[];
  allCount: number;
  pendingCount: number;
  hrCheckedCount: number;
  verifiedCount: number;
  rejectedCount: number;
  totalChargedAmount: number;
  totalDirectCost: number;
  totalNetRevenue: number;
  totalCommissionAmount: number;
  verifiedCommissionAmount: number;
  byDepartment: ProcedureDepartmentSummary[];
  byPeriod: ProcedurePeriodBreakdown[];
}

export interface SaveProcedureAssignmentInput {
  staffId: string;
  role: ProcedureCommissionRole;
  customCommissionAmount?: number | null;
}

export interface SaveProcedureSlipInput {
  serviceId: string;
  departmentId?: string | null;
  slipNumber?: string | null;
  procedureDate: string;
  patientCode?: string | null;
  chargedAmount: number;
  directCost: number;
  isAfterHours: boolean;
  durationHours?: number | null;
  indicatingStaffId?: string | null;
  assignments: SaveProcedureAssignmentInput[];
}

export interface ReviewProcedureSlipInput {
  decision: 'approve' | 'reject';
  reason?: string | null;
  note?: string | null;
}

export interface PreviewProcedureCommissionInput {
  serviceId: string;
  procedureDate: string;
  chargedAmount: number;
  directCost: number;
  isAfterHours: boolean;
  durationHours?: number | null;
  assignments: SaveProcedureAssignmentInput[];
}

export interface PreviewAssignmentCommissionItem {
  staffId: string;
  staffCode: string;
  staffName: string;
  positionName?: string | null;
  role: ProcedureCommissionRole;
  ruleId?: string | null;
  ruleSource: string;
  valueType?: string | null;
  ruleValue?: number | null;
  commissionAmount: number;
}

export interface ProcedureLookupStaff {
  staffId: string;
  staffCode: string;
  fullName: string;
  departmentId?: string | null;
  departmentName?: string | null;
  positionId?: string | null;
  positionName?: string | null;
}

export interface ProcedureLookupDepartment {
  departmentId: string;
  deptCode: string;
  name: string;
}

export interface ProcedureLookups {
  services: ProcedureServiceOption[];
  departments: ProcedureLookupDepartment[];
  staff: ProcedureLookupStaff[];
  currentUserStaffId?: string | null;
  currentUserStaffCode?: string | null;
  currentUserFullName?: string | null;
  currentUserDepartmentId?: string | null;
}

export interface CalculateMonthlyCommissionInput {
  payMonth: string;
  departmentId?: string | null;
}

export interface StaffMonthlyCommissionItem {
  staffId: string;
  staffCode: string;
  staffName: string;
  departmentId?: string | null;
  departmentName?: string | null;
  verifiedSlipCount: number;
  assignmentCount: number;
  totalCommissionAmount: number;
  payslipId?: string | null;
  linkedToPayslip: boolean;
}

export interface CalculateMonthlyCommissionResult {
  payMonth: string;
  verifiedSlipCount: number;
  assignmentCount: number;
  staffCount: number;
  totalChargedAmount: number;
  totalCommissionCalculated: number;
  updatedPayslipCount: number;
  staffSummaries: StaffMonthlyCommissionItem[];
}
