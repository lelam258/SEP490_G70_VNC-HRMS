export type ScheduleRow = {
  assignment: {
    id: string; staffId: string; coverageId: string; date: string; shift: string;
    cancelled: boolean; patientConfirmed: boolean; actualEndAt: string | null;
    reason?: string; transferConsent?: string | null;
  };
  published: boolean; fullName: string; facility: string; facilityId: string; coverage: string;
  start: string; end: string; dutyCredit: boolean;
  version?: string;
};

export type ScheduleOption = { id: string; name: string; departmentId?: string; facilityId?: string; status?: string };
export type ScheduleOptions = { facilities: ScheduleOption[]; coverage: ScheduleOption[]; departments: ScheduleOption[]; staff: { id: string; fullName: string; departmentId: string | null; dateJoined?: string; dateLeft?: string | null }[] };
export type ScheduleWeekStatus = {
  monday: string; closed: boolean; assignmentCount: number; isCorrection: boolean;
  serverNow: string; planningStartsAt: string; publishDeadline: string; correctionEndsAt: string;
};
export type ScheduleDraft = { staffId: string; facilityId: string; date: string; shift: string; reason: string; transferConsent: string; mode: 'week' | 'day' | 'edit'; monday: string; days: number[]; shifts: string[] };
