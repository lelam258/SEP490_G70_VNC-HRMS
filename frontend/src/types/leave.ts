export interface LeaveType {
  code: string;
  name: string;
  description?: string | null;
  isPaid?: boolean;
}

export interface LeaveRequestSummary {
  requestId: string;
  leaveType: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string | null;
  attachmentUrl: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  createdAt: string | null;
}

export interface LeaveRequestDetail extends LeaveRequestSummary {
  approvedByName: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  updatedAt: string | null;
}

export interface CreateLeaveRequestInput {
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  attachment?: File | null;
}
