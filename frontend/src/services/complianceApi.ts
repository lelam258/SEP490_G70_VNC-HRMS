import { axiosClient } from './axiosClient';
import type {
  ComplianceDashboardResponse,
  OperationalComplianceFilterParams,
  ReportFilterOptionsResponse,
  SendComplianceReminderInput,
  SendComplianceReminderResponse,
} from '../types/compliance';

export const complianceApi = {
  async getDashboard(
    params?: OperationalComplianceFilterParams
  ): Promise<ComplianceDashboardResponse> {
    const query = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, val]) => {
        if (
          val !== undefined &&
          val !== null &&
          val !== '' &&
          val !== 'all'
        ) {
          query.set(key, String(val));
        }
      });
    }
    const qs = query.toString();
    return (
      await axiosClient.get<ComplianceDashboardResponse>(
        `/compliance/dashboard${qs ? `?${qs}` : ''}`
      )
    ).data;
  },

  async getFilterOptions(): Promise<ReportFilterOptionsResponse> {
    return (
      await axiosClient.get<ReportFilterOptionsResponse>(
        '/compliance/filter-options'
      )
    ).data;
  },

  async sendReminder(
    payload: SendComplianceReminderInput
  ): Promise<SendComplianceReminderResponse> {
    return (
      await axiosClient.post<SendComplianceReminderResponse>(
        '/compliance/remind',
        payload
      )
    ).data;
  },
};
