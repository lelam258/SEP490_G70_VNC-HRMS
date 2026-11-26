import { axiosClient } from './axiosClient';
import type { MyPayslipMonthLookup, MyPayslipSummary } from '../types/myPayslip';
import type { PayslipDetail } from '../types/payrollPeriod';

export const myPayslipApi = {
  listMyPayslips: async (year?: number): Promise<MyPayslipSummary[]> => {
    const res = await axiosClient.get<MyPayslipSummary[]>('/me/payslips', {
      params: year ? { year } : undefined,
    });
    return res.data;
  },

  getMyPayslipByMonth: async (month: string): Promise<MyPayslipMonthLookup> => {
    const res = await axiosClient.get<MyPayslipMonthLookup>(`/me/payslips/by-month/${month}`);
    return res.data;
  },

  getMyPayslipDetail: async (payslipId: string): Promise<PayslipDetail> => {
    const res = await axiosClient.get<PayslipDetail>(`/me/payslips/${payslipId}`);
    return res.data;
  },

  downloadMyPayslipPdf: async (payslipId: string, fallbackFileName: string): Promise<void> => {
    const res = await axiosClient.get<Blob>(`/me/payslips/${payslipId}/pdf`, {
      responseType: 'blob',
    });

    const disposition = res.headers['content-disposition'] as string | undefined;
    let fileName = fallbackFileName;
    if (disposition) {
      const match = /filename\*?=(?:UTF-8''|")?([^";\n]+)/i.exec(disposition);
      if (match?.[1]) {
        fileName = decodeURIComponent(match[1].replace(/"/g, '').trim());
      }
    }

    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
