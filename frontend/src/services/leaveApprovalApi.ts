import { axiosClient } from './axiosClient';
import type {
  LeaveApprovalDetail,
  LeaveApprovalFilter,
  LeaveApprovalSummary,
  RejectLeaveRequestInput,
} from '../types/leaveApproval';

export const leaveApprovalApi = {
  getQueue: async (filter?: LeaveApprovalFilter): Promise<LeaveApprovalSummary[]> => {
    const res = await axiosClient.get<LeaveApprovalSummary[]>('/leave-approvals', {
      params: filter,
    });
    return res.data;
  },

  getDetail: async (id: string): Promise<LeaveApprovalDetail> => {
    const res = await axiosClient.get<LeaveApprovalDetail>(`/leave-approvals/${id}`);
    return res.data;
  },

  approve: async (id: string): Promise<LeaveApprovalDetail> => {
    const res = await axiosClient.post<LeaveApprovalDetail>(`/leave-approvals/${id}/approve`);
    return res.data;
  },

  reject: async (id: string, input: RejectLeaveRequestInput): Promise<LeaveApprovalDetail> => {
    const res = await axiosClient.post<LeaveApprovalDetail>(`/leave-approvals/${id}/reject`, input);
    return res.data;
  },
};

