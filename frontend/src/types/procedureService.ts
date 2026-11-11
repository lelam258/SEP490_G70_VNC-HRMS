import type { ProcedureSlipAuditItem } from './procedureSlip';

export interface ProcedureServiceItem {
  serviceId: string;
  serviceCode: string;
  serviceName: string;
  category?: string | null;
  basePrice?: number | null;
  status: string;
  slipCount: number;
  activeRuleCount: number;
}

export interface ProcedureServiceSlipSummary {
  slipId: string;
  slipNumber: string;
  procedureDate: string;
  patientCode?: string | null;
  departmentName?: string | null;
  chargedAmount: number;
  directCost: number;
  isAfterHours: boolean;
  totalCommissionAmount: number;
  status: string;
}

export interface ProcedureServiceRuleSummary {
  ruleId: string;
  isDirectRule: boolean;
  positionName?: string | null;
  role: string;
  timeCondition: string;
  valueType: string;
  commissionValue: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: string;
}

export interface ProcedureServiceOverrideSummary {
  overrideId: string;
  staffId: string;
  staffCode: string;
  staffName: string;
  isDirectRule: boolean;
  role: string;
  timeCondition: string;
  valueType: string;
  commissionValue: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: string;
}

export interface ProcedureServiceDetail {
  serviceId: string;
  serviceCode: string;
  serviceName: string;
  category?: string | null;
  basePrice?: number | null;
  status: string;
  totalSlips: number;
  pendingSlips: number;
  hrCheckedSlips: number;
  verifiedSlips: number;
  rejectedSlips: number;
  totalChargedAmount: number;
  totalCommissionAmount: number;
  directRuleCount: number;
  activeDirectRuleCount: number;
  categoryRuleCount: number;
  overrideCount: number;
  recentSlips: ProcedureServiceSlipSummary[];
  commissionRules: ProcedureServiceRuleSummary[];
  staffOverrides: ProcedureServiceOverrideSummary[];
  auditHistory: ProcedureSlipAuditItem[];
}

export interface SaveProcedureServiceInput {
  code: string;
  name: string;
  category?: string | null;
  basePrice?: number | null;
  status?: string;
}

export interface ProcedureServiceFilter {
  q?: string;
  category?: string;
  status?: string;
}
