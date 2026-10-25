import { axiosClient } from './axiosClient';
import type { Account, AccountInput, Employee } from '../types/accounts';

export const accountApi = {
  async employeeOptions() { return (await axiosClient.get<Employee[]>('/users/employee-options')).data; },
  async list() { return (await axiosClient.get<Account[]>('/users')).data; },
  async create(input: AccountInput) { return (await axiosClient.post<Account>('/users', input)).data; },
};
