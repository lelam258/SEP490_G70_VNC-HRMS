import { axiosClient } from './axiosClient';
import type { ContractDetail, ContractListItem, CreateContractInput, UpdateContractInput } from '../types/contract';

export const contractApi = {
  async list() {
    return (await axiosClient.get<ContractListItem[]>('/contracts')).data;
  },
  async get(id: string) {
    return (await axiosClient.get<ContractDetail>(`/contracts/${id}`)).data;
  },
  async create(input: CreateContractInput) {
    return (await axiosClient.post<ContractDetail>('/contracts', input)).data;
  },
  async update(id: string, input: UpdateContractInput) {
    return (await axiosClient.put<ContractDetail>(`/contracts/${id}`, input)).data;
  },
};
