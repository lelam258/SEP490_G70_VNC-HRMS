import { axiosClient } from './axiosClient';

export type Department = { id: string; code: string; name: string; status: string };
export const departmentApi = {
  async list() { return (await axiosClient.get<Department[]>('/departments')).data; },
  async create(input: { code: string; name: string }) { return (await axiosClient.post<Department>('/departments', input)).data; },
};
