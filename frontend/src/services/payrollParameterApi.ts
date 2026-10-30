import { axiosClient } from './axiosClient';
import type {
  AllowanceType,
  SaveAllowanceTypeInput,
  InsuranceConfig,
  SaveInsuranceConfigInput,
  TaxBracket,
  SaveTaxBracketInput,
  TaxDeductionPolicy,
  TaxPolicySummary,
  UpdateTaxPolicyFlagsInput,
  TaxCalculationPreviewRequest,
  TaxCalculationResult,
  PayrollRateConfig,
  SavePayrollRateConfigInput,
  CommissionRule,
  SaveCommissionRuleInput,
  CommissionMatrix,
  StaffCommissionOverride,
  SaveStaffCommissionOverrideInput,
  DeactivateParameterInput,
  ProcedureServiceOption,
  PositionOption,
  SiteOption,
} from '../types/payroll';

export const payrollParameterApi = {
  // Allowances
  async listAllowances(params?: { status?: string; q?: string }) {
    return (await axiosClient.get<AllowanceType[]>('/payroll-parameters/allowances', { params })).data;
  },
  async getAllowance(id: string) {
    return (await axiosClient.get<AllowanceType>(`/payroll-parameters/allowances/${id}`)).data;
  },
  async createAllowance(input: SaveAllowanceTypeInput) {
    return (await axiosClient.post<AllowanceType>('/payroll-parameters/allowances', input)).data;
  },
  async updateAllowance(id: string, input: SaveAllowanceTypeInput) {
    return (await axiosClient.put<AllowanceType>(`/payroll-parameters/allowances/${id}`, input)).data;
  },
  async deactivateAllowance(id: string, input?: DeactivateParameterInput) {
    return (await axiosClient.post<AllowanceType>(`/payroll-parameters/allowances/${id}/deactivate`, input || {})).data;
  },

  // Insurances
  async listInsurances(params?: { status?: string; effectiveOn?: string; q?: string }) {
    return (await axiosClient.get<InsuranceConfig[]>('/payroll-parameters/insurances', { params })).data;
  },
  async getInsurance(id: string) {
    return (await axiosClient.get<InsuranceConfig>(`/payroll-parameters/insurances/${id}`)).data;
  },
  async createInsurance(input: SaveInsuranceConfigInput) {
    return (await axiosClient.post<InsuranceConfig>('/payroll-parameters/insurances', input)).data;
  },
  async updateInsurance(id: string, input: SaveInsuranceConfigInput) {
    return (await axiosClient.put<InsuranceConfig>(`/payroll-parameters/insurances/${id}`, input)).data;
  },
  async deactivateInsurance(id: string, input?: DeactivateParameterInput) {
    return (await axiosClient.post<InsuranceConfig>(`/payroll-parameters/insurances/${id}/deactivate`, input || {})).data;
  },

  // Tax brackets & policy
  async listTaxBrackets(params?: { status?: string; effectiveOn?: string }) {
    return (await axiosClient.get<TaxBracket[]>('/payroll-parameters/tax-brackets', { params })).data;
  },
  async getTaxBracket(id: string) {
    return (await axiosClient.get<TaxBracket>(`/payroll-parameters/tax-brackets/${id}`)).data;
  },
  async createTaxBracket(input: SaveTaxBracketInput) {
    return (await axiosClient.post<TaxBracket>('/payroll-parameters/tax-brackets', input)).data;
  },
  async updateTaxBracket(id: string, input: SaveTaxBracketInput) {
    return (await axiosClient.put<TaxBracket>(`/payroll-parameters/tax-brackets/${id}`, input)).data;
  },
  async deactivateTaxBracket(id: string, input?: DeactivateParameterInput) {
    return (await axiosClient.post<TaxBracket>(`/payroll-parameters/tax-brackets/${id}/deactivate`, input || {})).data;
  },
  async getTaxDeductionPolicy() {
    return (await axiosClient.get<TaxDeductionPolicy>('/payroll-parameters/tax-deductions')).data;
  },
  async getTaxPolicySummary() {
    return (await axiosClient.get<TaxPolicySummary>('/payroll-parameters/tax-policy')).data;
  },

  async updateTaxPolicyFlags(data: UpdateTaxPolicyFlagsInput) {
    return (await axiosClient.put<TaxPolicySummary>('/payroll-parameters/tax-policy/flags', data)).data;
  },

  async previewTaxCalculation(data: TaxCalculationPreviewRequest) {
    return (await axiosClient.post<TaxCalculationResult>('/payroll-parameters/tax-policy/preview', data)).data;
  },

  // Payroll Rate Configs (duty_night, duty_noon, duty_extra_hour_multiplier, union_fee, standard_working_days)
  async listRateConfigs(params?: { code?: string; positionId?: string; staffId?: string; status?: string; effectiveOn?: string; q?: string }) {
    return (await axiosClient.get<PayrollRateConfig[]>('/payroll-parameters/rate-configs', { params })).data;
  },
  async getRateConfig(id: string) {
    return (await axiosClient.get<PayrollRateConfig>(`/payroll-parameters/rate-configs/${id}`)).data;
  },
  async createRateConfig(input: SavePayrollRateConfigInput) {
    return (await axiosClient.post<PayrollRateConfig>('/payroll-parameters/rate-configs', input)).data;
  },
  async updateRateConfig(id: string, input: SavePayrollRateConfigInput) {
    return (await axiosClient.put<PayrollRateConfig>(`/payroll-parameters/rate-configs/${id}`, input)).data;
  },
  async deactivateRateConfig(id: string, input?: DeactivateParameterInput) {
    return (await axiosClient.post<PayrollRateConfig>(`/payroll-parameters/rate-configs/${id}/deactivate`, input || {})).data;
  },

  // Commission rules
  async listCommissionRules(params?: {
    serviceId?: string;
    serviceCategory?: string;
    positionId?: string;
    role?: string;
    timeCondition?: string;
    status?: string;
    effectiveOn?: string;
    q?: string;
  }) {
    return (await axiosClient.get<CommissionRule[]>('/payroll-parameters/commission-rules', { params })).data;
  },
  async getCommissionRule(id: string) {
    return (await axiosClient.get<CommissionRule>(`/payroll-parameters/commission-rules/${id}`)).data;
  },
  async createCommissionRule(input: SaveCommissionRuleInput) {
    return (await axiosClient.post<CommissionRule>('/payroll-parameters/commission-rules', input)).data;
  },
  async updateCommissionRule(id: string, input: SaveCommissionRuleInput) {
    return (await axiosClient.put<CommissionRule>(`/payroll-parameters/commission-rules/${id}`, input)).data;
  },
  async deactivateCommissionRule(id: string, input?: DeactivateParameterInput) {
    return (await axiosClient.post<CommissionRule>(`/payroll-parameters/commission-rules/${id}/deactivate`, input || {})).data;
  },
  async getCommissionMatrix() {
    return (await axiosClient.get<CommissionMatrix>('/payroll-parameters/commission-matrix')).data;
  },

  // Staff Commission Overrides
  async listCommissionOverrides(params?: {
    staffId?: string;
    serviceId?: string;
    serviceCategory?: string;
    role?: string;
    status?: string;
    effectiveOn?: string;
    q?: string;
  }) {
    return (await axiosClient.get<StaffCommissionOverride[]>('/payroll-parameters/commission-overrides', { params })).data;
  },
  async getCommissionOverride(id: string) {
    return (await axiosClient.get<StaffCommissionOverride>(`/payroll-parameters/commission-overrides/${id}`)).data;
  },
  async createCommissionOverride(input: SaveStaffCommissionOverrideInput) {
    return (await axiosClient.post<StaffCommissionOverride>('/payroll-parameters/commission-overrides', input)).data;
  },
  async updateCommissionOverride(id: string, input: SaveStaffCommissionOverrideInput) {
    return (await axiosClient.put<StaffCommissionOverride>(`/payroll-parameters/commission-overrides/${id}`, input)).data;
  },
  async deactivateCommissionOverride(id: string, input?: DeactivateParameterInput) {
    return (await axiosClient.post<StaffCommissionOverride>(`/payroll-parameters/commission-overrides/${id}/deactivate`, input || {})).data;
  },

  // Dropdowns & Lookups
  async listProcedureServices() {
    return (await axiosClient.get<ProcedureServiceOption[]>('/payroll-parameters/procedure-services')).data;
  },
  async listPositions() {
    return (await axiosClient.get<PositionOption[]>('/payroll-parameters/positions')).data;
  },
  async listSites() {
    return (await axiosClient.get<SiteOption[]>('/payroll-parameters/sites')).data;
  },
};
