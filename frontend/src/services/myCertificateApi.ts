import { axiosClient } from './axiosClient';
import type { Certificate, SaveCertificateInput } from '../types/certificates';

export const myCertificateApi = {
  async list(): Promise<Certificate[]> {
    return (await axiosClient.get<Certificate[]>('/me/certificates')).data;
  },

  async get(id: string): Promise<Certificate> {
    return (await axiosClient.get<Certificate>(`/me/certificates/${id}`)).data;
  },

  async create(input: SaveCertificateInput): Promise<Certificate> {
    return (await axiosClient.post<Certificate>('/me/certificates', input)).data;
  },

  async revoke(id: string): Promise<void> {
    await axiosClient.delete(`/me/certificates/${id}`);
  },
};
