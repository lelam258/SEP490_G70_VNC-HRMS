import { axiosClient } from './axiosClient';
import type {
  CalculateMonthlyCommissionInput,
  CalculateMonthlyCommissionResult,
  PreviewAssignmentCommissionItem,
  PreviewProcedureCommissionInput,
  ProcedureLookups,
  ProcedureSlipDetail,
  ProcedureSlipFilter,
  ProcedureSlipListResponse,
  ReviewProcedureSlipInput,
  SaveProcedureSlipInput,
} from '../types/procedureSlip';

export const procedureSlipApi = {
  getLookups: async (): Promise<ProcedureLookups> => {
    const res = await axiosClient.get<ProcedureLookups>('/procedure-slips/lookups');
    return {
      ...res.data,
      services: (res.data.services || []).slice(0, 3),
    };
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

  calculateMonthlyCommission: async (
    input: CalculateMonthlyCommissionInput
  ): Promise<CalculateMonthlyCommissionResult> => {
    const res = await axiosClient.post<CalculateMonthlyCommissionResult>(
      '/procedure-slips/calculate-monthly-commission',
      input
    );
    return res.data;
  },
};
