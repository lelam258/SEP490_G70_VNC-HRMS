import { axiosClient } from './axiosClient';
import type {
  ConfirmPayrollPeriodInput,
  CreatePayrollPeriodInput,
  FinalizePayrollPeriodInput,
  PayrollPeriod,
  PayrollPeriodDetail,
  PayslipDetail,
  ReopenPayrollPeriodInput,
  ReviewPayslipInput,
  UpdatePayslipInlineInput,
} from '../types/payrollPeriod';

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
  calculatePeriod: async (month: string): Promise<PayrollPeriodDetail> => {
    const res = await axiosClient.post<PayrollPeriodDetail>(`/payroll/periods/${month}/calculate`);
    return res.data;
  },
  getPayslipDetail: async (month: string, payslipId: string): Promise<PayslipDetail> => {
    const res = await axiosClient.get<PayslipDetail>(`/payroll/periods/${month}/payslips/${payslipId}`);
    return res.data;
  },
  reviewPayslip: async (
    month: string,
    payslipId: string,
    input: ReviewPayslipInput
  ): Promise<PayslipDetail> => {
    const res = await axiosClient.post<PayslipDetail>(
      `/payroll/periods/${month}/payslips/${payslipId}/review`,
      input
    );
    return res.data;
  },
  reviewAllValid: async (month: string): Promise<PayrollPeriodDetail> => {
    const res = await axiosClient.post<PayrollPeriodDetail>(`/payroll/periods/${month}/review-all`);
    return res.data;
  },
  confirmPeriod: async (
    month: string,
    input?: ConfirmPayrollPeriodInput
  ): Promise<PayrollPeriodDetail> => {
    const res = await axiosClient.post<PayrollPeriodDetail>(
      `/payroll/periods/${month}/confirm`,
      input ?? {}
    );
    return res.data;
  },
  finalizePeriod: async (
    month: string,
    input: FinalizePayrollPeriodInput
  ): Promise<PayrollPeriodDetail> => {
    const res = await axiosClient.post<PayrollPeriodDetail>(
      `/payroll/periods/${month}/finalize`,
      input
    );
    return res.data;
  },
  reopenPeriod: async (month: string, input: ReopenPayrollPeriodInput): Promise<PayrollPeriodDetail> => {
    const res = await axiosClient.post<PayrollPeriodDetail>(`/payroll/periods/${month}/reopen`, input);
    return res.data;
  },
  deletePeriod: async (month: string): Promise<void> => {
    await axiosClient.delete(`/payroll/periods/${month}`);
  },
  updatePayslipInline: async (
    month: string,
    payslipId: string,
    input: UpdatePayslipInlineInput
  ): Promise<PayrollPeriodDetail> => {
    const res = await axiosClient.put<PayrollPeriodDetail>(
      `/payroll/periods/${month}/payslips/${payslipId}`,
      input
    );
    return res.data;
  },
};
