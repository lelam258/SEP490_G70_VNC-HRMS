import { axiosClient } from './axiosClient';
import type { PayrollHistoryDetail, PayrollHistoryResponse } from '../types/payrollHistory';

export interface PayrollHistoryQuery {
  fromMonth?: string;
  toMonth?: string;
  departmentId?: string;
  status?: string;
}

export const payrollHistoryApi = {
  listHistory: async (params?: PayrollHistoryQuery): Promise<PayrollHistoryResponse> => {
    const res = await axiosClient.get<PayrollHistoryResponse>('/payroll/history', { params });
    return res.data;
  },

  getMonthDetail: async (month: string, departmentId?: string): Promise<PayrollHistoryDetail> => {
    const res = await axiosClient.get<PayrollHistoryDetail>(`/payroll/history/${month}`, {
      params: departmentId ? { departmentId } : undefined,
    });
    return res.data;
  },

  exportCsv: async (params?: PayrollHistoryQuery): Promise<void> => {
    const res = await axiosClient.get<Blob>('/payroll/history/export.csv', {
      params,
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'lich-su-tinh-luong.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
