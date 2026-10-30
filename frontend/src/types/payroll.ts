export interface AllowanceType {
  id: string;
  code: string;
  name: string;
  valueType: 'fixed' | 'percentage';
  defaultValue: number | null;
  appliesTo: string;
  defaultCalcMethod: 'fixed' | 'prorate_by_workdays' | 'per_service_year' | 'percentage';
  minServiceYears?: number | null;
  isTaxable: boolean;
  isInsuranceBasis: boolean;
  status: 'active' | 'inactive';
  createdAt: string | null;
  affectedOpenPeriods?: string[];
}

export interface SaveAllowanceTypeInput {
  code: string;
  name: string;
  valueType: 'fixed' | 'percentage';
  defaultValue?: number | null;
  appliesTo?: string;
  defaultCalcMethod?: 'fixed' | 'prorate_by_workdays' | 'per_service_year' | 'percentage';
  minServiceYears?: number | null;
  isTaxable: boolean;
  isInsuranceBasis: boolean;
  status: 'active' | 'inactive';
}

export interface InsuranceConfig {
  id: string;
  insuranceType: 'social' | 'health' | 'unemployment' | 'accident';
  payer: 'employee' | 'employer';
  ratePercent: number;
  appliesTo: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: 'active' | 'inactive';
  affectedOpenPeriods?: string[];
}

export interface SaveInsuranceConfigInput {
  insuranceType: 'social' | 'health' | 'unemployment' | 'accident';
  payer: 'employee' | 'employer';
  ratePercent: number;
  appliesTo?: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: 'active' | 'inactive';
}

export interface TaxBracket {
  id: string;
  incomeFrom: number;
  incomeTo: number | null;
  taxRatePercent: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: 'active' | 'inactive';
  affectedOpenPeriods?: string[];
}

export interface SaveTaxBracketInput {
  incomeFrom: number;
  incomeTo?: number | null;
  taxRatePercent: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: 'active' | 'inactive';
}

export interface TaxDeductionPolicy {
  personalDeduction: number | null;
  dependentDeduction: number | null;
}

export interface TaxPolicySummary {
  brackets: TaxBracket[];
  personalDeduction: number;
  dependentDeduction: number;
  taxFlatThreshold: number;
  taxFlatRate: number;
  roundingUnit: number;
  deductInsuranceBeforeTax: boolean;
  deductUnionFeeBeforeTax: boolean;
  deductOtherBeforeTax: boolean;
  flatTaxBase: 'gross' | 'after_deductions';
}

export interface UpdateTaxPolicyFlagsInput {
  deductUnionFeeBeforeTax?: boolean;
  deductOtherBeforeTax?: boolean;
  flatTaxBase?: 'gross' | 'after_deductions';
}

export interface TaxCalculationPreviewRequest {
  totalIncome: number;
  insuranceSalary: number;
  isUnionMember: boolean;
  dependentCount: number;
  taxMethod?: 'progressive' | 'flat_10';
  otherDeductions?: number;
}

export interface TaxBracketBreakdown {
  bracketIndex: number;
  rangeText: string;
  taxableAmount: number;
  ratePercent: number;
  taxAmount: number;
}

export interface TaxCalculationResult {
  totalIncome: number;
  beforeTaxDeductions: number;
  insuranceDeduction: number;
  unionFeeDeduction: number;
  otherBeforeTaxDeduction: number;
  incomeAfterDeductions: number;
  taxableIncome: number;
  personalDeductionAmount: number;
  dependentDeductionAmount: number;
  totalFamilyDeductions: number;
  taxableIncomeNote?: string | null;
  pitTax: number;
  taxMethod: string;
  bracketBreakdowns: TaxBracketBreakdown[];
  taxNote?: string | null;
  takeHome: number;
  takeHomeRaw: number;
  roundingUnit: number;
}

export interface PayrollRateConfig {
  id: string;
  code: 'duty_night' | 'duty_noon' | 'duty_extra_hour_multiplier' | 'union_fee' | 'standard_working_days' | string;
  positionId?: string | null;
  positionName?: string | null;
  staffId?: string | null;
  staffCode?: string | null;
  staffName?: string | null;
  value: number;
  unit: 'vnd' | 'percent' | 'days';
  description?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: 'active' | 'inactive';
  createdBy?: string | null;
  createdAt?: string | null;
  affectedOpenPeriods?: string[];
}

export interface SavePayrollRateConfigInput {
  code: string;
  positionId?: string | null;
  staffId?: string | null;
  value: number;
  unit: 'vnd' | 'percent' | 'days';
  description?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status?: 'active' | 'inactive';
}

export interface CommissionRule {
  id: string;
  serviceId?: string | null;
  serviceCode?: string | null;
  serviceName?: string | null;
  serviceCategory?: string | null;
  positionId?: string | null;
  positionName?: string | null;
  role: 'indicating' | 'performing' | 'assisting' | 'lab' | 'typist';
  timeCondition: 'all' | 'in_hours' | 'after_hours';
  valueType: 'fixed' | 'percent_service' | 'percent_profit' | 'per_hour';
  commissionValue: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: 'active' | 'inactive';
  createdBy: string | null;
  createdAt: string | null;
  affectedOpenPeriods?: string[];
}

export interface SaveCommissionRuleInput {
  serviceId?: string | null;
  serviceCategory?: string | null;
  positionId?: string | null;
  role: 'indicating' | 'performing' | 'assisting' | 'lab' | 'typist';
  timeCondition?: 'all' | 'in_hours' | 'after_hours';
  valueType: 'fixed' | 'percent_service' | 'percent_profit' | 'per_hour';
  commissionValue: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: 'active' | 'inactive';
}

export interface CommissionMatrixCell {
  ruleId: string;
  valueType: string;
  commissionValue: number;
  timeCondition: string;
  positionId?: string | null;
  positionName?: string | null;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: string;
}

export interface CommissionMatrixRow {
  serviceId?: string | null;
  serviceCode?: string | null;
  serviceName: string;
  category?: string | null;
  basePrice?: number | null;
  cells: Record<string, CommissionMatrixCell | null>;
}

export interface CommissionMatrixGroup {
  category: string;
  rows: CommissionMatrixRow[];
}

export interface CommissionMatrix {
  groups: CommissionMatrixGroup[];
}

export interface StaffCommissionOverride {
  id: string;
  staffId: string;
  staffCode: string;
  staffName: string;
  serviceId?: string | null;
  serviceCode?: string | null;
  serviceName?: string | null;
  serviceCategory?: string | null;
  role: string;
  timeCondition: string;
  valueType: string;
  commissionValue: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: string;
  createdBy?: string | null;
  createdAt?: string | null;
  affectedOpenPeriods?: string[];
}

export interface SaveStaffCommissionOverrideInput {
  staffId: string;
  serviceId?: string | null;
  serviceCategory?: string | null;
  role: string;
  timeCondition?: string;
  valueType: string;
  commissionValue: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status?: string;
}

export interface DeactivateParameterInput {
  effectiveTo?: string | null;
}

export interface ProcedureServiceOption {
  id: string;
  code: string;
  name: string;
  category: string | null;
  basePrice?: number | null;
}

export interface PositionOption {
  id: string;
  name: string;
  scopeTag?: string | null;
}

export interface SiteOption {
  id: string;
  code: string;
  name: string;
  address?: string | null;
}

export interface ContractSummary {
  contractId: string;
  staffId: string;
  contractCode: string | null;
  staffCode: string;
  staffName: string;
  departmentName: string | null;
  contractType: string;
  salaryType: 'daily' | 'monthly';
  dailyRate: number;
  monthlySalary?: number | null;
  standardWorkingDays?: number | null;
  isInsuranceEligible: boolean;
  insuranceSalaryBasis: number | null;
  taxMethod: 'progressive' | 'flat_10';
  siteId?: string | null;
  siteName?: string | null;
  isUnionMember: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  /** Salary change scheduled to start after today (from the salary history), if any. */
  pendingSalaryChange?: ContractSalaryHistory | null;
}

export interface StaffAllowance {
  staffAllowanceId: string;
  staffId: string;
  allowanceId: string;
  allowanceCode: string;
  allowanceName: string;
  valueType: string;
  amountValue: number;
  calcMethod: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
  approvedBy: string | null;
  createdAt: string;
  affectedOpenPeriods?: string[];
}

export interface ContractCompensation extends ContractSummary {
  allowances: StaffAllowance[];
  affectedOpenPeriods?: string[];
}

export interface UpdateContractCompensationInput {
  salaryType?: 'daily' | 'monthly';
  dailyRate: number;
  monthlySalary?: number | null;
  standardWorkingDays?: number | null;
  isInsuranceEligible: boolean;
  insuranceSalaryBasis?: number | null;
  taxMethod?: 'progressive' | 'flat_10';
  siteId?: string | null;
  isUnionMember?: boolean;
  effectiveFrom?: string | null;
  note?: string | null;
}

export interface SaveStaffAllowanceInput {
  allowanceId: string;
  valueType: string;
  amountValue: number;
  calcMethod?: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: string;
}

export interface ContractSalaryHistory {
  historyId: string;
  contractId: string;
  salaryType: string;
  dailyRate: number;
  monthlySalary?: number | null;
  standardWorkingDays?: number | null;
  insuranceSalaryBasis?: number | null;
  taxMethod: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  note?: string | null;
  createdAt: string;
}
