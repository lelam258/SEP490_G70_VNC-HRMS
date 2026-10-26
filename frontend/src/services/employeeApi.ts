import { axiosClient } from './axiosClient';
import type { Employee, EmployeeDetail, UpdateEmployeeInput } from '../types/accounts';

export type EmployeeInput = { code: string; name: string; email: string | null; departmentId: string | null; dateJoined?: string };

export const employeeApi = {
  async list() {
    return (await axiosClient.get<Employee[]>('/employees')).data;
  },
  async get(id: string) {
    return (await axiosClient.get<EmployeeDetail>(`/employees/${id}`)).data;
  },
  async create(input: EmployeeInput) {
    return (await axiosClient.post<Employee>('/employees', input)).data;
  },
  async update(id: string, input: UpdateEmployeeInput) {
    return (await axiosClient.put<EmployeeDetail>(`/employees/${id}`, input)).data;
  },
};
