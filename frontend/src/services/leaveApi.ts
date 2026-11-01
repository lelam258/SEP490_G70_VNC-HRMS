import { axiosClient } from './axiosClient';
import type {
  CreateLeaveRequestInput,
  LeaveRequestDetail,
  LeaveRequestSummary,
  LeaveType,
  UpdateLeaveRequestInput,
} from '../types/leave';

function toFormData(input: CreateLeaveRequestInput): FormData {
  const formData = new FormData();
  formData.append('leaveType', input.leaveType);
  formData.append('startDate', input.startDate);
  formData.append('endDate', input.endDate);
  formData.append('reason', input.reason);
  if (input.attachment) {
    formData.append('attachment', input.attachment);
  }
  return formData;
}

const multipart = { headers: { 'Content-Type': 'multipart/form-data' } };

export const leaveApi = {
  getLeaveTypes: async (): Promise<LeaveType[]> => {
    const res = await axiosClient.get<LeaveType[]>('/me/leave-requests/types');
    return res.data;
  },
  listMyLeaveRequests: async (status?: string): Promise<LeaveRequestSummary[]> => {
    const params = status && status !== 'all' ? { status } : {};
    const res = await axiosClient.get<LeaveRequestSummary[]>('/me/leave-requests', { params });
    return res.data;
  },
  getLeaveRequestDetail: async (id: string): Promise<LeaveRequestDetail> => {
    const res = await axiosClient.get<LeaveRequestDetail>(`/me/leave-requests/${id}`);
    return res.data;
  },
  createLeaveRequest: async (input: CreateLeaveRequestInput): Promise<LeaveRequestDetail> => {
    const res = await axiosClient.post<LeaveRequestDetail>('/me/leave-requests', toFormData(input), multipart);
    return res.data;
  },
  updateLeaveRequest: async (id: string, input: UpdateLeaveRequestInput): Promise<LeaveRequestDetail> => {
    const formData = toFormData(input);
    if (input.removeAttachment) {
      formData.append('removeAttachment', 'true');
    }
    const res = await axiosClient.put<LeaveRequestDetail>(`/me/leave-requests/${id}`, formData, multipart);
    return res.data;
  },
  withdrawLeaveRequest: async (id: string): Promise<LeaveRequestDetail> => {
    const res = await axiosClient.post<LeaveRequestDetail>(`/me/leave-requests/${id}/withdraw`);
    return res.data;
  },
};
