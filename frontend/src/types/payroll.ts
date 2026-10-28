export interface AllowanceType {
  id: string;
  code: string;
  name: string;
  valueType: 'fixed' | 'percentage';
  defaultValue: number | null;
  appliesTo: string;
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

export interface CommissionRule {
  id: string;
  serviceId: string;
  serviceCode: string;
  serviceName: string;
  role: 'indicating' | 'performing' | 'assisting';
  valueType: 'fixed' | 'percent_service' | 'percent_profit';
  commissionValue: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: 'active' | 'inactive';
  createdBy: string | null;
  createdAt: string | null;
  affectedOpenPeriods?: string[];
}

export interface SaveCommissionRuleInput {
  serviceId: string;
  role: 'indicating' | 'performing' | 'assisting';
  valueType: 'fixed' | 'percent_service' | 'percent_profit';
  commissionValue: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: 'active' | 'inactive';
}

export interface ProcedureServiceOption {
  id: string;
  code: string;
  name: string;
  category: string | null;
}

export interface ContractSummary {
  contractId: string;
  staffId: string;
  contractCode: string | null;
  staffCode: string;
  staffName: string;
  departmentName: string | null;
  contractType: string;
  dailyRate: number;
  isInsuranceEligible: boolean;
  insuranceSalaryBasis: number | null;
  effectiveFrom: string;
  effectiveTo: string | null;
  status: string;
}

export interface StaffAllowance {
  staffAllowanceId: string;
  staffId: string;
  allowanceId: string;
  allowanceCode: string;
  allowanceName: string;
  valueType: string;
  amountValue: number;
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
  dailyRate: number;
  isInsuranceEligible: boolean;
  insuranceSalaryBasis?: number | null;
}

export interface SaveStaffAllowanceInput {
  allowanceId: string;
  valueType: string;
  amountValue: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: string;
}
