import { axiosClient } from './axiosClient';
import type {
  AllowanceType,
  SaveAllowanceTypeInput,
  InsuranceConfig,
  SaveInsuranceConfigInput,
  TaxBracket,
  SaveTaxBracketInput,
  TaxDeductionPolicy,
  CommissionRule,
  SaveCommissionRuleInput,
  ProcedureServiceOption,
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
  async getTaxDeductionPolicy() {
    return (await axiosClient.get<TaxDeductionPolicy>('/payroll-parameters/tax-deductions')).data;
  },

  // Commission rules
  async listCommissionRules(params?: { status?: string; effectiveOn?: string; q?: string }) {
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

  // Procedure services
  async listProcedureServices() {
    return (await axiosClient.get<ProcedureServiceOption[]>('/payroll-parameters/procedure-services')).data;
  },
};
