import { axiosClient } from './axiosClient';

export type Department = { id: string; code: string; name: string; status: string };
export const departmentApi = {
  async setStatus(id: string, status: 'active' | 'inactive') { return (await axiosClient.patch<Department>(`/departments/${id}/status`, { status })).data; },
  async list() { return (await axiosClient.get<Department[]>('/departments')).data; },
  async create(input: { code: string; name: string }) { return (await axiosClient.post<Department>('/departments', input)).data; },
  async update(id: string, input: { code: string; name: string; status: string }) { return (await axiosClient.put<Department>(`/departments/${id}`, input)).data; },
};
