export interface ComplianceDepartmentOption {
  id: string;
  name: string;
}

export interface CompliancePositionOption {
  value: string;
  label: string;
}

export interface ComplianceSelectOption {
  value: string;
  label: string;
}

export type ComplianceCardFilter =
  | 'attention'
  | 'total'
  | 'valid'
  | 'expiring'
  | 'expired'
  | 'legacy'
  | 'cme_at_risk';

export interface OperationalComplianceFilterParams {
  departmentId?: string;
  position?: string;
  staffStatus?: string;
  contractType?: string;
  keyword?: string;
  fromDate?: string;
  toDate?: string;
  payMonth?: string;
  complianceStatus?: string;
  itemType?: 'all' | 'certificate' | 'cme_cycle' | string;
  maxDaysLeft?: number | '';
  sortBy?: 'daysLeft' | 'staffName' | 'department' | 'deadline' | string;
  sortDir?: 'asc' | 'desc' | string;
}

export interface ReportFilterOptionsResponse {
  departments: ComplianceDepartmentOption[];
  positions: CompliancePositionOption[];
  contractTypes: ComplianceSelectOption[];
  staffStatuses: ComplianceSelectOption[];
  availablePayMonths: string[];
  lockedDepartmentId: string | null;
}

export interface OperationalKpiSummary {
  totalActiveStaff: number;
  expiringContractsCount: number;
  pendingLeaveRequestsCount: number;
  onCallShiftsCount: number;
  totalWorkDaysInPeriod: number;
}

export interface ComplianceKpiSummary {
  totalStaff: number;
  validCount: number;
  expiringCount: number;
  expiredCount: number;
  legacyCount: number;
  cmeAtRiskCount: number;
  certExpiringThresholdDays: number;
  cmeAlertThresholdDays: number;
}

export interface ComplianceAttentionRow {
  staffId: string;
  staffCode: string;
  staffName: string;
  departmentId: string | null;
  departmentName: string;
  position: string;
  certificateId: string | null;
  cmeCycleId: string | null;
  item: string;
  itemType: 'certificate' | 'cme_cycle' | string;
  deadline: string | null;
  deadlineDisplay: string;
  daysLeft: number | null;
  cmeEarned: number | null;
  cmeRequired: number | null;
  cmeDisplay: string;
  status: 'Expired' | 'Expiring' | 'At risk' | 'Legacy' | 'Valid' | 'On track' | 'Completed' | string;
  certWorstStatus: 'Expired' | 'Expiring' | 'Legacy' | 'Valid' | string;
  isCmeAtRisk: boolean;
  requiresAttention: boolean;
  actionUrl: string;
  cmeItem?: string | null;
  cmeDeadline?: string | null;
  cmeDeadlineDisplay?: string | null;
  cmeDaysLeft?: number | null;
  hasCmeCreditsRequirement?: boolean;
  staffStatus?: string | null;
  contractType?: string | null;
  certificateNumber?: string | null;
}

export interface ComplianceChartItem {
  departmentName: string;
  validCount: number;
  expiringCount: number;
  expiredCount: number;
  legacyCount: number;
  cmeAtRiskCount: number;
}

export interface ComplianceDashboardResponse {
  kpis: ComplianceKpiSummary;
  operationalKpis?: OperationalKpiSummary;
  staffItems: ComplianceAttentionRow[];
  cmeItems: ComplianceAttentionRow[];
  departmentChart: ComplianceChartItem[];
  departments: ComplianceDepartmentOption[];
  positions: CompliancePositionOption[];
  contractTypes?: ComplianceSelectOption[];
  staffStatuses?: ComplianceSelectOption[];
  availablePayMonths?: string[];
  lockedDepartmentId: string | null;
}

export interface SendComplianceReminderInput {
  staffIds?: string[];
  departmentId?: string | null;
  position?: string | null;
  statusFilter?: string | null;
}

export interface SendComplianceReminderResponse {
  sentCount: number;
  sentAt: string;
  message: string;
}
