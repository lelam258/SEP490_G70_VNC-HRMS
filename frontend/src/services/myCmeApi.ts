import { axiosClient } from './axiosClient';
import type { CertificateCycle, CmeRecord, SaveCmeRecordInput } from '../types/cme';

export const myCmeApi = {
  async listCycles(): Promise<CertificateCycle[]> {
    return (await axiosClient.get<CertificateCycle[]>('/me/cme-records/cycles')).data;
  },

  async listRecords(certificateId?: string): Promise<CmeRecord[]> {
    const url = certificateId
      ? `/me/cme-records?certificateId=${certificateId}`
      : '/me/cme-records';
    return (await axiosClient.get<CmeRecord[]>(url)).data;
  },

  async getRecord(id: string): Promise<CmeRecord> {
    return (await axiosClient.get<CmeRecord>(`/me/cme-records/${id}`)).data;
  },

  async createRecord(input: SaveCmeRecordInput): Promise<CmeRecord> {
    return (await axiosClient.post<CmeRecord>('/me/cme-records', input)).data;
  },

  async deleteRecord(id: string): Promise<void> {
    await axiosClient.delete(`/me/cme-records/${id}`);
  },
};
