import { axiosClient } from './axiosClient';
import type {
  ContractSummary,
  ContractCompensation,
  UpdateContractCompensationInput,
  StaffAllowance,
  SaveStaffAllowanceInput,
  ContractSalaryHistory,
  DeactivateParameterInput,
} from '../types/payroll';

export const compensationApi = {
  async listContracts(params?: { q?: string; status?: string }) {
    return (await axiosClient.get<ContractSummary[]>('/compensation/contracts', { params })).data;
  },
  async getContract(id: string) {
    return (await axiosClient.get<ContractCompensation>(`/compensation/contracts/${id}`)).data;
  },
  async updateContract(id: string, input: UpdateContractCompensationInput) {
    return (await axiosClient.put<ContractCompensation>(`/compensation/contracts/${id}`, input)).data;
  },
  async listSalaryHistories(contractId: string) {
    return (await axiosClient.get<ContractSalaryHistory[]>(`/compensation/contracts/${contractId}/salary-history`)).data;
  },
  async listStaffAllowances(contractId: string) {
    return (await axiosClient.get<StaffAllowance[]>(`/compensation/contracts/${contractId}/allowances`)).data;
  },
  async createStaffAllowance(contractId: string, input: SaveStaffAllowanceInput) {
    return (await axiosClient.post<StaffAllowance>(`/compensation/contracts/${contractId}/allowances`, input)).data;
  },
  async updateStaffAllowance(contractId: string, staffAllowanceId: string, input: SaveStaffAllowanceInput) {
    return (await axiosClient.put<StaffAllowance>(`/compensation/contracts/${contractId}/allowances/${staffAllowanceId}`, input)).data;
  },
  async deactivateStaffAllowance(contractId: string, staffAllowanceId: string, input?: DeactivateParameterInput) {
    return (await axiosClient.post<StaffAllowance>(`/compensation/contracts/${contractId}/allowances/${staffAllowanceId}/deactivate`, input || {})).data;
  },
};
