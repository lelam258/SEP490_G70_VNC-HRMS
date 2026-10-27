import { axiosClient } from './axiosClient';
import type {
  CmeRecord,
  SaveCmeRecordInput,
  StaffCmeSummary,
  UpdateCmeRecordInput,
} from '../types/cme';

export const cmeApi = {
  async listStaffSummaries(): Promise<StaffCmeSummary[]> {
    return (await axiosClient.get<StaffCmeSummary[]>('/cme-records/employees')).data;
  },

  async listByStaff(staffId: string): Promise<CmeRecord[]> {
    return (await axiosClient.get<CmeRecord[]>(`/cme-records/employee/${staffId}`)).data;
  },

  async listByCertificate(certificateId: string): Promise<CmeRecord[]> {
    return (await axiosClient.get<CmeRecord[]>(`/cme-records/certificate/${certificateId}`)).data;
  },

  async get(id: string): Promise<CmeRecord> {
    return (await axiosClient.get<CmeRecord>(`/cme-records/${id}`)).data;
  },

  async create(input: SaveCmeRecordInput): Promise<CmeRecord> {
    return (await axiosClient.post<CmeRecord>('/cme-records', input)).data;
  },

  async update(id: string, input: UpdateCmeRecordInput): Promise<CmeRecord> {
    return (await axiosClient.put<CmeRecord>(`/cme-records/${id}`, input)).data;
  },

  async verify(id: string, verified: boolean): Promise<CmeRecord> {
    return (await axiosClient.patch<CmeRecord>(`/cme-records/${id}/verify`, { verified })).data;
  },

  async delete(id: string): Promise<void> {
    await axiosClient.delete(`/cme-records/${id}`);
  },
};
