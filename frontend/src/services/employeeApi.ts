import { axiosClient } from './axiosClient';
import type { Employee } from '../types/accounts';

export type EmployeeInput = { code: string; name: string; email: string | null; departmentId: string | null; dateJoined?: string };
export const employeeApi = {
  async list() { return (await axiosClient.get<Employee[]>('/employees')).data; },
  async create(input: EmployeeInput) { return (await axiosClient.post<Employee>('/employees', input)).data; },
};
