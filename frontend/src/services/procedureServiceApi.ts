import { axiosClient } from './axiosClient';
import type {
  ProcedureServiceDetail,
  ProcedureServiceFilter,
  ProcedureServiceItem,
  SaveProcedureServiceInput,
} from '../types/procedureService';

export const procedureServiceApi = {
  list: async (filter: ProcedureServiceFilter = {}): Promise<ProcedureServiceItem[]> => {
    const params: Record<string, string> = {};
    if (filter.q?.trim()) params.q = filter.q.trim();
    if (filter.category?.trim()) params.category = filter.category.trim();
    if (filter.status?.trim()) params.status = filter.status.trim();

    const res = await axiosClient.get<ProcedureServiceItem[]>('/procedure-services', { params });
    return res.data;
  },

  listCategories: async (): Promise<string[]> => {
    const res = await axiosClient.get<string[]>('/procedure-services/categories');
    return res.data;
  },

  getDetail: async (id: string): Promise<ProcedureServiceDetail> => {
    const res = await axiosClient.get<ProcedureServiceDetail>(`/procedure-services/${id}`);
    return res.data;
  },

  create: async (input: SaveProcedureServiceInput): Promise<ProcedureServiceItem> => {
    const res = await axiosClient.post<ProcedureServiceItem>('/procedure-services', input);
    return res.data;
  },

  update: async (id: string, input: SaveProcedureServiceInput): Promise<ProcedureServiceItem> => {
    const res = await axiosClient.put<ProcedureServiceItem>(`/procedure-services/${id}`, input);
    return res.data;
  },

  setStatus: async (id: string, status: 'active' | 'inactive'): Promise<ProcedureServiceItem> => {
    const res = await axiosClient.patch<ProcedureServiceItem>(`/procedure-services/${id}/status`, {
      status,
    });
    return res.data;
  },
};
