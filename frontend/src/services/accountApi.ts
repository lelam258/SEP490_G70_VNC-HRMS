import { axiosClient } from './axiosClient';
import type { Account, AccountInput } from '../types/accounts';

export const accountApi = {
  async list() { return (await axiosClient.get<Account[]>('/users')).data; },
  async get(id: string) { return (await axiosClient.get<Account>(`/users/${id}`)).data; },
  async create(input: AccountInput) { return (await axiosClient.post<Account>('/users', input)).data; },
  async update(id: string, input: AccountInput) { return (await axiosClient.put<Account>(`/users/${id}`, input)).data; },
};
