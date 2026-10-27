import { axiosClient } from './axiosClient';
import type {
  Certificate,
  SaveCertificateInput,
  StaffCertificateSummary,
  UpdateCertificateInput,
} from '../types/certificates';

export const certificateApi = {
  async listStaffSummaries(): Promise<StaffCertificateSummary[]> {
    return (await axiosClient.get<StaffCertificateSummary[]>('/certificates/employees')).data;
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

  async delete(id: string): Promise<void> {
    await axiosClient.delete(`/certificates/${id}`);
  },
};
