import { axiosClient } from './axiosClient';
import {
  departmentApi,
  formatDepartmentFacilityLabel,
  readSharedDeptFacilitiesMap,
} from './departmentApi';
import type {
  CalculateMonthlyCommissionInput,
  CalculateMonthlyCommissionResult,
  CommissionResultsFilter,
  CommissionResultsResponse,
  PreviewAssignmentCommissionItem,
  PreviewProcedureCommissionInput,
  ProcedureLookups,
  ProcedureSlipDetail,
  ProcedureSlipFilter,
  ProcedureSlipListResponse,
  ProcedureStaffAvailability,
  ReviewProcedureSlipInput,
  SaveProcedureSlipInput,
  StaffCommissionDetailResponse,
} from '../types/procedureSlip';

export function isDepartmentInFacility(
  dept: { facilityIds?: string[]; facilityLabel?: string | null },
  facilityId?: string | null,
  facilityName?: string | null
): boolean {
  if (!facilityId) return true;

  // 1. Check by ID (case-insensitive)
  if (dept.facilityIds && dept.facilityIds.length > 0) {
    const targetId = facilityId.trim().toLowerCase();
    if (dept.facilityIds.some((id) => id.trim().toLowerCase() === targetId)) {
      return true;
    }
  }

  // 2. Check by Label as fallback
  if (dept.facilityLabel) {
    const label = dept.facilityLabel.toLowerCase();
    if (label.includes('cả hai') || label.includes('ca hai')) {
      return true;
    }
    if (facilityName && label.includes(facilityName.trim().toLowerCase())) {
      return true;
    }
  }

  // If no facilityIds and no facilityLabel, it is unassigned -> available everywhere
  if ((!dept.facilityIds || dept.facilityIds.length === 0) && !dept.facilityLabel) {
    return true;
  }

  return false;
}

export const procedureSlipApi = {
  getLookups: async (): Promise<ProcedureLookups> => {
    const [res, fallbackFacilities, sharedMap, deptList] = await Promise.all([
      axiosClient.get<ProcedureLookups>('/procedure-slips/lookups'),
      departmentApi.listFacilities(),
      readSharedDeptFacilitiesMap(),
      departmentApi.list().catch(() => []),
    ]);

    const data = res.data;
    const activeFacilities =
      data.facilities && data.facilities.length > 0
        ? data.facilities
        : fallbackFacilities.map((f) => ({
            facilityId: f.id,
            name: f.name,
            status: f.status,
          }));

    const facilityOptions = activeFacilities.map((f) => ({
      id: f.facilityId,
      name: f.name,
      status: f.status,
    }));
    const allFacilityIds = facilityOptions.map((f) => f.id);
    const validSet = new Set(allFacilityIds.map((id) => id.toLowerCase()));

    const deptFromListMap = new Map<string, { facilityIds?: string[]; facilityLabel?: string }>();
    for (const d of deptList) {
      deptFromListMap.set(d.id.toLowerCase(), d);
      deptFromListMap.set(d.code.toLowerCase(), d);
    }

    const enrichedDepartments = (data.departments ?? []).map((dept) => {
      const fromDeptList =
        deptFromListMap.get(dept.departmentId?.toLowerCase()) ||
        deptFromListMap.get(dept.deptCode?.toLowerCase());

      const fromShared = sharedMap[dept.departmentId]?.filter((id) => validSet.has(id.toLowerCase()));
      const fromServer = dept.facilityIds?.filter((id) => validSet.has(id.toLowerCase()));

      const resolvedIds =
        fromDeptList?.facilityIds && fromDeptList.facilityIds.length > 0
          ? fromDeptList.facilityIds
          : fromShared && fromShared.length > 0
          ? fromShared
          : fromServer && fromServer.length > 0
          ? fromServer
          : allFacilityIds;

      const resolvedLabel =
        fromDeptList?.facilityLabel ||
        formatDepartmentFacilityLabel(resolvedIds, facilityOptions);

      return {
        ...dept,
        facilityIds: resolvedIds,
        facilityLabel: resolvedLabel,
      };
    });

    return {
      ...data,
      facilities: activeFacilities,
      departments: enrichedDepartments,
    };
  },

  getStaffAvailability: async (params: {
    procedureDate: string;
    departmentId?: string | null;
    facilityId?: string | null;
    startTime?: string | null;
    endTime?: string | null;
    excludeSlipId?: string | null;
  }): Promise<ProcedureStaffAvailability[]> => {
    const query: Record<string, string> = {
      procedureDate: params.procedureDate,
    };
    if (params.departmentId) query.departmentId = params.departmentId;
    if (params.facilityId) query.facilityId = params.facilityId;
    if (params.startTime) query.startTime = params.startTime;
    if (params.endTime) query.endTime = params.endTime;
    if (params.excludeSlipId) query.excludeSlipId = params.excludeSlipId;

    const res = await axiosClient.get<ProcedureStaffAvailability[]>(
      '/procedure-slips/staff-availability',
      { params: query }
    );
    const items = res.data ?? [];

    // Also read shared weekly schedule cache (for compatibility if backend process has not been restarted yet)
    try {
      type CachedScheduleRow = {
        assignment: {
          id: string;
          staffId: string;
          date: string;
          shift: string;
          cancelled?: boolean;
        };
        published: boolean;
        fullName: string;
        facility: string;
        facilityId: string;
        departmentId: string;
      };
      type CachedWeek = {
        monday: string;
        closed: boolean;
        rows: CachedScheduleRow[];
      };

      let weeksMap: Record<string, CachedWeek> = {};
      try {
        const localRaw = localStorage.getItem('vnc_schedule_weeks_cache_v1');
        if (localRaw) {
          weeksMap = { ...weeksMap, ...(JSON.parse(localRaw) as Record<string, CachedWeek>) };
        }
      } catch {
        // ignore localStorage error
      }

      try {
        const cacheRes = await fetch('/api/shared-schedule-cache', { cache: 'no-store' });
        if (cacheRes.ok) {
          const serverCache = (await cacheRes.json()) as Record<string, CachedWeek>;
          if (serverCache && typeof serverCache === 'object') {
            weeksMap = { ...weeksMap, ...serverCache };
          }
        }
      } catch {
        // ignore fetch error
      }

      const publishedWeeks = Object.values(weeksMap).filter(
        (w) => w && Array.isArray(w.rows) && (w.closed || w.rows.some((r) => r.published))
      );

      if (publishedWeeks.length > 0) {
        const procDateObj = new Date(`${params.procedureDate}T00:00:00Z`);
        const dayOfWeek = (procDateObj.getUTCDay() + 6) % 7; // 0 = Monday .. 6 = Sunday
        const targetMondayObj = new Date(procDateObj);
        targetMondayObj.setUTCDate(procDateObj.getUTCDate() - dayOfWeek);
        const targetMonday = targetMondayObj.toISOString().slice(0, 10);

        const chosenWeek =
          publishedWeeks.find((w) => w.monday === targetMonday) ??
          publishedWeeks.sort((a, b) => {
            const da = Math.abs(Date.parse(a.monday) - Date.parse(targetMonday));
            const db = Math.abs(Date.parse(b.monday) - Date.parse(targetMonday));
            return da - db;
          })[0];

        if (chosenWeek) {
          const chosenMondayObj = new Date(`${chosenWeek.monday}T00:00:00Z`);
          const effectiveDateObj = new Date(chosenMondayObj);
          effectiveDateObj.setUTCDate(chosenMondayObj.getUTCDate() + dayOfWeek);
          const effectiveDate = effectiveDateObj.toISOString().slice(0, 10);

          const activePublishedRows = chosenWeek.rows.filter(
            (r) =>
              !r.assignment.cancelled &&
              (chosenWeek.closed || r.published) &&
              (!params.departmentId ||
                r.departmentId.toLowerCase() === params.departmentId.toLowerCase())
          );

          const facList = await departmentApi.listFacilities().catch(() => []);
          const targetFacId = params.facilityId ? params.facilityId.toLowerCase() : null;

          const staffInFacilityWeek = new Set(
            activePublishedRows
              .filter(
                (r) =>
                  !targetFacId ||
                  r.facilityId.toLowerCase() === targetFacId ||
                  (r.facility &&
                    facList.some(
                      (f) =>
                        f.id.toLowerCase() === targetFacId &&
                        f.name.toLowerCase() === r.facility.toLowerCase()
                    ))
              )
              .map((r) => r.assignment.staffId)
          );

          const shiftLabelMap: Record<string, string> = {
            morning: 'Sáng',
            noon: 'Trưa',
            afternoon: 'Chiều',
            evening: 'Tối',
          };
          const shiftOrder = ['morning', 'noon', 'afternoon', 'evening'];

          return items
            .filter(
              (st) =>
                (!params.departmentId ||
                  (st.departmentId &&
                    st.departmentId.toLowerCase() === params.departmentId.toLowerCase())) &&
                staffInFacilityWeek.has(st.staffId)
            )
            .map((st) => {
              const dayRows = activePublishedRows.filter(
                (r) =>
                  r.assignment.staffId === st.staffId &&
                  r.assignment.date === effectiveDate &&
                  (!targetFacId ||
                    r.facilityId.toLowerCase() === targetFacId ||
                    (r.facility &&
                      facList.some(
                        (f) =>
                          f.id.toLowerCase() === targetFacId &&
                          f.name.toLowerCase() === r.facility.toLowerCase()
                      )))
              );
              const shiftsToday = Array.from(
                new Set(dayRows.map((r) => r.assignment.shift.toLowerCase()))
              )
                .sort((a, b) => shiftOrder.indexOf(a) - shiftOrder.indexOf(b))
                .map((sh) => shiftLabelMap[sh] || sh);

              const isWorkingToday = !st.isOnLeave && (shiftsToday.length > 0 || st.isWorkingToday);
              return {
                ...st,
                isWorkingToday,
                shiftsToday: shiftsToday.length > 0 ? shiftsToday : st.shiftsToday,
                offReason: isWorkingToday ? null : st.offReason || 'Nghỉ hôm nay',
              };
            });
        }
      }
    } catch {
      // fallback to server response
    }

    return items;
  },

  listSlips: async (filter: ProcedureSlipFilter = {}): Promise<ProcedureSlipListResponse> => {
    const params: Record<string, string | number | boolean> = {};
    if (filter.periodType) params.periodType = filter.periodType;
    if (filter.year !== undefined) params.year = filter.year;
    if (filter.month !== undefined) params.month = filter.month;
    if (filter.quarter !== undefined) params.quarter = filter.quarter;
    if (filter.fromDate) params.fromDate = filter.fromDate;
    if (filter.toDate) params.toDate = filter.toDate;
    if (filter.departmentId) params.departmentId = filter.departmentId;
    if (filter.serviceId) params.serviceId = filter.serviceId;
    if (filter.staffId) params.staffId = filter.staffId;
    if (filter.status && filter.status !== 'all') params.status = filter.status;
    if (filter.isAfterHours !== undefined) params.isAfterHours = filter.isAfterHours;
    if (filter.q?.trim()) params.q = filter.q.trim();
    if (filter.scope) params.scope = filter.scope;
    if (filter.page !== undefined) params.page = filter.page;
    if (filter.pageSize !== undefined) params.pageSize = filter.pageSize;

    const res = await axiosClient.get<ProcedureSlipListResponse>('/procedure-slips', { params });
    return res.data;
  },

  getSlipDetail: async (slipId: string): Promise<ProcedureSlipDetail> => {
    const res = await axiosClient.get<ProcedureSlipDetail>(`/procedure-slips/${slipId}`);
    return res.data;
  },

  previewCommission: async (
    input: PreviewProcedureCommissionInput
  ): Promise<PreviewAssignmentCommissionItem[]> => {
    const res = await axiosClient.post<PreviewAssignmentCommissionItem[]>(
      '/procedure-slips/preview-commission',
      input
    );
    return res.data;
  },

  createSlip: async (input: SaveProcedureSlipInput): Promise<ProcedureSlipDetail> => {
    const res = await axiosClient.post<ProcedureSlipDetail>('/procedure-slips', input);
    return res.data;
  },

  updateSlip: async (slipId: string, input: SaveProcedureSlipInput): Promise<ProcedureSlipDetail> => {
    const res = await axiosClient.put<ProcedureSlipDetail>(`/procedure-slips/${slipId}`, input);
    return res.data;
  },

  hrCheckSlip: async (
    slipId: string,
    input: ReviewProcedureSlipInput
  ): Promise<ProcedureSlipDetail> => {
    const res = await axiosClient.post<ProcedureSlipDetail>(
      `/procedure-slips/${slipId}/hr-check`,
      input
    );
    return res.data;
  },

  verifySlip: async (
    slipId: string,
    input: ReviewProcedureSlipInput
  ): Promise<ProcedureSlipDetail> => {
    const res = await axiosClient.post<ProcedureSlipDetail>(
      `/procedure-slips/${slipId}/verify`,
      input
    );
    return res.data;
  },

  completeSlip: async (
    slipId: string,
    input: { note?: string | null } = {}
  ): Promise<ProcedureSlipDetail> => {
    const res = await axiosClient.post<ProcedureSlipDetail>(
      `/procedure-slips/${slipId}/complete`,
      input
    );
    return res.data;
  },

  calculateMonthlyCommission: async (
    input: CalculateMonthlyCommissionInput
  ): Promise<CalculateMonthlyCommissionResult> => {
    const res = await axiosClient.post<CalculateMonthlyCommissionResult>(
      '/procedure-slips/calculate-monthly-commission',
      input
    );
    return res.data;
  },

  getCommissionResults: async (
    filter: CommissionResultsFilter
  ): Promise<CommissionResultsResponse> => {
    const params: Record<string, string | number> = {
      payMonth: filter.payMonth,
    };
    if (filter.departmentId) params.departmentId = filter.departmentId;
    if (filter.search?.trim()) params.search = filter.search.trim();
    if (filter.page) params.page = filter.page;
    if (filter.pageSize) params.pageSize = filter.pageSize;

    const res = await axiosClient.get<CommissionResultsResponse>(
      '/procedure-slips/commission-results',
      { params }
    );
    return res.data;
  },

  getStaffCommissionDetail: async (
    staffId: string,
    payMonth: string
  ): Promise<StaffCommissionDetailResponse> => {
    const res = await axiosClient.get<StaffCommissionDetailResponse>(
      `/procedure-slips/commission-results/staff/${staffId}`,
      { params: { payMonth } }
    );
    return res.data;
  },
};
