export type PageResult<T> = { total: number; page: number; pageSize: number; items: T[]; lockedReason?: string | null };
export type AttendanceOption = { id: string; name: string; status?: string };
export type AttendanceStaff = AttendanceOption & { code: string; departmentId: string | null; deviceEnrollId?: string | null; dateJoined: string; dateLeft?: string | null };
export type AttendanceOptions = { staff: AttendanceStaff[]; facilities: AttendanceOption[]; departments: AttendanceOption[]; serverNow: string };
export type TimePair = { in: string | null; out: string | null };
export type AttendanceItem = {
  id: string; staffId: string; staffCode: string; staffName: string; departmentId: string | null; departmentName: string | null;
  facilityId: string | null; facilityName: string | null; workDate: string; shiftType: string; checkIn: string | null; checkOut: string | null;
  actualHours: number | null; source: string; status: string; importId: string | null; onCallShiftId: string | null;
};
export type AttendanceList = PageResult<AttendanceItem> & {
  month: string;
  counts: { confirmed: number; unconfirmed: number; flagged: number; reconciled?: number; pending?: number };
};
export type AttendanceDiscrepancy = { code: string; label: string; severity: 'error' | 'warning' | 'info' };
export type AttendanceDetail = {
  item: AttendanceItem; pairs: TimePair[]; machinePairs?: TimePair[]; deviceEnrollId: string | null;
  batch: { id: string; fileName: string; importDate: string; deviceSource?: string } | null;
  importRow?: {
    id: string; sheetName: string; rowNumber: number; deviceEnrollId: string; rawDate: string; rawValues: string[];
    pairs: TimePair[]; actualHours: number | null; reportedHours: number | null; lateMinutes: number | null;
    earlyMinutes: number | null; attendanceSymbol: string | null; validationStatus: string; errorCode: string | null;
    validationNote: string | null; correctionReason: string | null;
  } | null;
  note: string | null; reconcileNote: string | null; reconciledAt: string | null; reconciledBy: string | null;
  confirmedAt: string | null; confirmedBy: string | null; actors: { id: string; name: string }[]; createdAt: string; payslipId: string | null;
  lockedReason: string | null; schedules: { id: string; facilityId: string; date: string; shift: string }[];
  scheduleDetails?: {
    id: string; facilityId: string; facilityName: string | null; date: string; shift: string;
    start: string; end: string; patientConfirmed: boolean; patientEvidence: string | null;
    actualEndAt: string | null; endNote: string | null;
  }[];
  leaves?: { id: string; leaveType: string; startDate: string; endDate: string; totalDays: number | null; reason: string | null; status: string }[];
  onCalls?: {
    id: string; facilityId: string | null; facilityName: string | null; date: string; category: string;
    start: string | null; end: string | null; status: string; note: string | null; deviationReason: string | null;
    supervisorEvidence: string | null; reviewNote: string | null; confirmedBy: string | null; confirmedAt: string | null;
  }[];
  discrepancies?: AttendanceDiscrepancy[];
  suggestedClassification?: string;
  supervisorConfirmed?: boolean;
  supervisorEvidence?: string | null;
  version?: string;
  events: { logId: string; action: string; username: string | null; createdAt: string; result: string }[];
};
export type ManualAttendanceContext = {
  staffId: string; facilityId: string; date: string; approvedLeave: boolean; lockedReason: string | null;
  schedules: { id: string; facilityId: string; facilityName: string | null; shift: string; start: string; end: string }[];
  leaves: { id: string; leaveType: string; startDate: string; endDate: string; reason: string | null }[];
  existingRecords: { id: string; shiftType: string; facilityId: string | null; facilityName: string | null; checkIn: string | null; checkOut: string | null; actualHours: number | null; source: string; status: string }[];
  onCalls: { id: string; category: string; start: string | null; end: string | null; status: string; supervisorEvidence: string | null }[];
};
export type ManualAttendanceInput = {
  staffId: string; facilityId: string; workDate: string; shiftType: string;
  pairs: { in: string; out: string }[]; sourceReference: string; reason: string; supervisorEvidence?: string;
};
export type ReconcileAttendanceInput = {
  action: 'accept_machine' | 'accept_manual' | 'correct_time' | 'mark_unresolved';
  pairs?: { in: string; out: string }[];
  facilityId?: string | null;
  reason: string;
  supervisorEvidence?: string;
  supervisorConfirmed: boolean;
  version: string;
};
export type VerifyAttendanceInput = {
  decision: 'confirm' | 'return';
  reason?: string;
  supervisorEvidence?: string;
  version: string;
};
export type VerifyOnCallInput = {
  decision: 'confirm' | 'return' | 'reject';
  reason?: string;
  supervisorEvidence?: string;
  version: string;
};
export type ScopeMonthlyTotal = {
  id: string; name: string; staffCount: number; confirmedMainDays: number;
  confirmedNoonDuties: number; confirmedEveningDuties: number; confirmedHours: number;
  paidLeaveDays: number; flaggedCount: number; unconfirmedCount: number;
  unaccountedScheduleCount: number; completed: boolean;
};
export type StaffMonthlySummary = {
  staffId: string; staffCode: string; staffName: string; departmentId: string | null; departmentName: string | null;
  plannedMainDays: number; confirmedMainDays: number; confirmedNoonDuties: number; confirmedEveningDuties: number;
  confirmedHours: number; overtimeHours: number; paidLeaveDays: number; unpaidLeaveDays: number;
  machineRecordCount: number; manualRecordCount: number; flaggedCount: number; unconfirmedCount: number;
  missingPunchCount: number; unaccountedScheduleCount: number; readyForPayroll: boolean;
};
export type MonthlyException = {
  id: string; category: string; severity: 'error' | 'warning'; staffId: string; staffCode: string; staffName: string;
  departmentId: string | null; departmentName: string | null; facilityId: string | null; facilityName: string | null;
  date: string; shiftType: string; message: string; targetUrl: string | null;
};
export type MonthlyAttendanceSummary = {
  payMonth: string; status: string; timesheetId: string | null; lockedBy: string | null; lockedByName: string | null;
  lockedAt: string | null; consolidationOpenDate: string; standardLockDate: string; correctionDeadline: string;
  windowStatus: 'open' | 'early' | 'reopened' | 'locked' | 'closed';
  lockedReason: string | null; consolidationLockReason: string | null; canLock: boolean; version: string;
  totals: {
    totalStaff: number; confirmedMainDays: number; confirmedNoonDuties: number; confirmedEveningDuties: number;
    confirmedHours: number; overtimeHours: number; paidLeaveDays: number; unpaidLeaveDays: number;
    machineRecords: number; manualRecords: number; confirmedRecords: number; flaggedRecords: number;
    unconfirmedRecords: number; missingPunchRecords: number; pendingOnCalls: number; unaccountedScheduledShifts: number;
  };
  facilityTotals: ScopeMonthlyTotal[];
  departmentTotals: ScopeMonthlyTotal[];
  staffSummaries: StaffMonthlySummary[];
  exceptions: MonthlyException[];
  incompleteScopes: string[];
};
export type ImportBatch = { id: string; fileName: string; payMonth: string; facilityId: string; deviceSource: string | null;
  importedBy: string; importDate: string; totalRows: number; successRows: number; errorRows: number; status: string; dateOrder?: 'auto' | 'dmy' | 'mdy' };
export type ImportRow = {
  id: string; sheetName: string; rowNumber: number; employeeBlock: string; deviceEnrollId: string; staffId: string | null; staffName: string | null;
  rawDate: string; rawValues: string[]; workDate: string | null; shiftType: string; pairs: TimePair[];
  actualHours: number | null; reportedHours: number | null; sourceHours?: number | null; lateMinutes: number | null; earlyMinutes: number | null; attendanceSymbol: string | null;
  validationStatus: string; errorCode: string | null; validationNote: string | null; correctionReason: string | null;
  correctedBy: string | null; correctedAt: string | null; attendanceId: string | null; version: string;
};
export type ImportPreview = PageResult<ImportRow> & { batch: ImportBatch; version: string; lockedReason: string | null; sourceAvailable: boolean; employeeBlocks: number;
  counts: { valid: number; warning: number; error: number; duplicate: number; excluded: number; committed: number } };
export type ImportAnalysisQuery = { status: string; errorCode: string; page: number; pageSize: number };
export type ImportIdentity = { deviceEnrollId: string; rowCount: number; status: 'mapped' | 'unknown' | 'ambiguous' | 'missing';
  staffId: string | null; staffName: string | null; sourceLabels: string[] };
export type ImportAnalysis = PageResult<ImportRow> & {
  fileName: string; payMonth: string; facilityId: string; deviceSource: string | null; dateOrder: string;
  totalRows: number; employeeCodes: number; dateFrom: string | null; dateTo: string | null;
  sourceMonths: { month: string; rows: number }[]; suggestedMonth: string | null; lockedReason: string | null; canStage: boolean;
  counts: { valid: number; warning: number; error: number; duplicate: number };
  identity?: { mappedCodes: number; unresolvedCodes: number; unresolvedRows: number; items: ImportIdentity[] };
  sourceTimeQuality?: { completeRows: number; missingTimeRows: number; noPunchRows: number; invalidTimeRows: number;
    invalidDateRows: number; repeatedPairRows: number; reportedHourMismatchRows: number };
  otherErrorRows?: number;
};
export type ImportRowInput = { staffId: string; workDate: string; shiftType: string; pairs: { in: string; out: string }[]; reason: string; version: string };
export type OnCallItem = {
  id: string; staffId: string; staffCode: string; staffName: string; departmentId: string; departmentName: string; facilityId: string; facilityName: string;
  date: string; category: string; start: string; end: string; status: string; note: string | null; deviationReason: string | null;
  supervisorEvidence: string | null; reviewNote: string | null; scheduleAssignmentId: string | null; attendanceEvidenceId: string | null;
  recordedBy: string; confirmedBy: string | null; confirmedAt: string | null; createdAt: string; updatedAt: string; version: string;
  recordedByName?: string | null; confirmedByName?: string | null;
};
export type OnCallDetail = { item: OnCallItem; plannedStart: string; plannedEnd: string; actualHours: number | null; lockedReason: string | null };
export type OnCallInput = { staffId: string; facilityId: string; date: string; category: string; start: string; end: string;
  note: string; deviationReason: string; supervisorEvidence: string; attendanceEvidenceId: string | null; version?: string };
export type OnCallContext = { staffId: string; date: string; facilityId: string; approvedLeave: boolean; lockedReason: string | null;
  schedules: { id: string; facilityId: string; facilityName: string; shift: string; start: string; end: string }[];
  evidence: { id: string; checkIn: string | null; checkOut: string | null; source: string; validationStatus: string }[] };
export type AuditEvent = { id: string; createdAt: string; userId: string | null; actor: string | null; action: string; module: string;
  entityType: string | null; entityId: string | null; facilityId: string | null; departmentId: string | null; staffId: string | null;
  workDate: string | null; result: string; oldStatus: string | null; newStatus: string | null;
  oldValue: unknown; newValue: unknown; sourceUrl: string | null };
export type AuditOptions = { users: AttendanceOption[]; actions: string[]; modules: string[]; facilities: AttendanceOption[] };
