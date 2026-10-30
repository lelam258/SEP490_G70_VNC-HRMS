import { axiosClient } from './axiosClient';
import type { CreatePayrollPeriodInput, PayrollPeriod, PayrollPeriodDetail } from '../types/payrollPeriod';

export const payrollPeriodApi = {
  listPeriods: async (): Promise<PayrollPeriod[]> => {
    const res = await axiosClient.get<PayrollPeriod[]>('/payroll/periods');
    return res.data;
  },
  getPeriodDetail: async (month: string): Promise<PayrollPeriodDetail> => {
    const res = await axiosClient.get<PayrollPeriodDetail>(`/payroll/periods/${month}`);
    return res.data;
  },
  createPeriod: async (input: CreatePayrollPeriodInput): Promise<PayrollPeriod> => {
    const res = await axiosClient.post<PayrollPeriod>('/payroll/periods', input);
    return res.data;
  },
};
