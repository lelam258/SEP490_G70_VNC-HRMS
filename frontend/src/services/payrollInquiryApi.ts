import { axiosClient } from './axiosClient';
import type {
  CreatePayrollInquiryRequest,
  PayrollInquiryDetail,
  PayrollInquiryFormOptions,
  PayrollInquiryListItem,
  PayrollInquiryQueueResponse,
  ResolvePayrollInquiryRequest,
} from '../types/payrollInquiry';

export const payrollInquiryApi = {
  // === Cổng nhân viên (SRS 7.8–7.10) ===
  getMyOptions: async (): Promise<PayrollInquiryFormOptions> => {
    const res = await axiosClient.get<PayrollInquiryFormOptions>('/me/payroll-inquiries/options');
    return res.data;
  },

  listMyInquiries: async (params?: {
    status?: string;
    inquiryType?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<PayrollInquiryListItem[]> => {
    const res = await axiosClient.get<PayrollInquiryListItem[]>('/me/payroll-inquiries', {
      params,
    });
    return res.data;
  },

  getMyDetail: async (complaintId: string): Promise<PayrollInquiryDetail> => {
    const res = await axiosClient.get<PayrollInquiryDetail>(`/me/payroll-inquiries/${complaintId}`);
    return res.data;
  },

  submitMyInquiry: async (payload: CreatePayrollInquiryRequest): Promise<PayrollInquiryDetail> => {
    const res = await axiosClient.post<PayrollInquiryDetail>('/me/payroll-inquiries', payload);
    return res.data;
  },

  // === Hàng đợi & Xử lý của Kế toán (SRS 7.10–7.12) ===
  listQueue: async (params?: {
    status?: string;
    departmentId?: string;
    inquiryType?: string;
    payMonth?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PayrollInquiryQueueResponse> => {
    const res = await axiosClient.get<PayrollInquiryQueueResponse>('/payroll/inquiries', {
      params,
    });
    return res.data;
  },

  getAccountantDetail: async (complaintId: string): Promise<PayrollInquiryDetail> => {
    const res = await axiosClient.get<PayrollInquiryDetail>(`/payroll/inquiries/${complaintId}`);
    return res.data;
  },

  startReview: async (complaintId: string): Promise<PayrollInquiryDetail> => {
    const res = await axiosClient.post<PayrollInquiryDetail>(
      `/payroll/inquiries/${complaintId}/start-review`,
      {}
    );
    return res.data;
  },

  resolve: async (
    complaintId: string,
    payload: ResolvePayrollInquiryRequest
  ): Promise<PayrollInquiryDetail> => {
    const res = await axiosClient.post<PayrollInquiryDetail>(
      `/payroll/inquiries/${complaintId}/resolve`,
      payload
    );
    return res.data;
  },
};
