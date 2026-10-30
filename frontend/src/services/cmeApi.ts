import { axiosClient } from './axiosClient';
import type {
  CertificateCycle,
  CmeRecord,
  CreateNewCmeCycleInput,
  SaveCmeRecordInput,
  StaffCmeSummary,
  UpdateCmeCycleDatesInput,
  UpdateCmeRecordInput,
} from '../types/cme';

export const cmeApi = {
  async listStaffSummaries(): Promise<StaffCmeSummary[]> {
    return (await axiosClient.get<StaffCmeSummary[]>('/cme-records/employees')).data;
  },

  async listCertificateCyclesByStaff(staffId: string): Promise<CertificateCycle[]> {
    return (await axiosClient.get<CertificateCycle[]>(`/cme-records/employee/${staffId}/cycles`)).data;
  },

  async updateCycleDates(
    certificateId: string,
    input: UpdateCmeCycleDatesInput
  ): Promise<CertificateCycle> {
    return (
      await axiosClient.put<CertificateCycle>(
        `/cme-records/certificate/${certificateId}/cycle-dates`,
        input
      )
    ).data;
  },

  async createNewCycle(
    certificateId: string,
    input?: CreateNewCmeCycleInput
  ): Promise<CertificateCycle> {
    return (
      await axiosClient.post<CertificateCycle>(
        `/cme-records/certificate/${certificateId}/new-cycle`,
        input || {}
      )
    ).data;
  },

  async completeCycle(certificateId: string, cycleId?: string | null): Promise<CertificateCycle> {
    const query = cycleId ? `?cycleId=${encodeURIComponent(cycleId)}` : '';
    return (
      await axiosClient.post<CertificateCycle>(
        `/cme-records/certificate/${certificateId}/complete-cycle${query}`,
        {}
      )
    ).data;
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
