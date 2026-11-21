export interface LeaveApprovalFilter {
  status?: string;
  departmentId?: string;
  search?: string;
  leaveType?: string;
  fromDate?: string;
  toDate?: string;
}

export interface LeaveApprovalSummary {
  requestId: string;
  staffId: string;
  staffCode: string;
  staffName: string;
  departmentId: string;
  departmentName: string;
  positionName: string | null;
  leaveType: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string | null;
  attachmentUrl: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  createdAt: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  annualLeaveBalance: number | null;
  hasShiftConflict: boolean;
  shiftConflictCount: number;
  hasLeaveConflict: boolean;
}

export interface LeaveApprovalDetail {
  requestId: string;
  staffId: string;
  staffCode: string;
  staffName: string;
  staffEmail: string | null;
  staffPhone: string | null;
  departmentId: string;
  departmentName: string;
  positionName: string | null;
  leaveType: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string | null;
  attachmentUrl: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  createdAt: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  annualLeaveEntitlement: number;
  annualLeaveUsed: number;
  annualLeaveRemaining: number;
  hasShiftConflict: boolean;
  conflictingShifts: string[];
  hasLeaveConflict: boolean;
  conflictingLeaves: string[];
}

export interface RejectLeaveRequestInput {
  rejectedReason: string;
}

