import { axiosClient } from './axiosClient';
import type {
  Certificate,
  ReviewCertificateInput,
  SaveCertificateInput,
  StaffCertificateSummary,
  UpdateCertificateInput,
} from '../types/certificates';

export const certificateApi = {
  async listStaffSummaries(): Promise<StaffCertificateSummary[]> {
    return (await axiosClient.get<StaffCertificateSummary[]>('/certificates/employees')).data;
  },

  async listPending(): Promise<Certificate[]> {
    return (await axiosClient.get<Certificate[]>('/certificates/pending')).data;
  },

  async listByStaff(staffId: string): Promise<Certificate[]> {
    return (await axiosClient.get<Certificate[]>(`/certificates/employee/${staffId}`)).data;
  },

  async get(id: string): Promise<Certificate> {
    return (await axiosClient.get<Certificate>(`/certificates/${id}`)).data;
  },

  async create(input: SaveCertificateInput): Promise<Certificate> {
    return (await axiosClient.post<Certificate>('/certificates', input)).data;
  },

  async update(id: string, input: UpdateCertificateInput): Promise<Certificate> {
    return (await axiosClient.put<Certificate>(`/certificates/${id}`, input)).data;
  },

  async review(id: string, input: ReviewCertificateInput): Promise<Certificate> {
    return (await axiosClient.post<Certificate>(`/certificates/${id}/review`, input)).data;
  },

  async delete(id: string): Promise<void> {
    await axiosClient.delete(`/certificates/${id}`);
  },
};
