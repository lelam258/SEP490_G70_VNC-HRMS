import { axiosClient } from './axiosClient';
import type {
  CreateDependentDocumentInput,
  CreateEmployeeDependentInput,
  DependentDocument,
  EmployeeDependent,
  UpdateEmployeeDependentInput,
} from '../types/dependents';

export const dependentApi = {
  async list(staffId: string) {
    return (await axiosClient.get<EmployeeDependent[]>(`/employees/${staffId}/dependents`)).data;
  },
  async create(staffId: string, input: CreateEmployeeDependentInput) {
    return (await axiosClient.post<EmployeeDependent>(`/employees/${staffId}/dependents`, input)).data;
  },
  async update(staffId: string, staffDependentId: string, input: UpdateEmployeeDependentInput) {
    return (await axiosClient.put<EmployeeDependent>(`/employees/${staffId}/dependents/${staffDependentId}`, input)).data;
  },
  async addDocument(staffId: string, staffDependentId: string, input: CreateDependentDocumentInput) {
    return (
      await axiosClient.post<DependentDocument>(
        `/employees/${staffId}/dependents/${staffDependentId}/documents`,
        input,
      )
    ).data;
  },
  async verifyDocument(staffId: string, staffDependentId: string, documentId: string, verificationStatus: string) {
    return (
      await axiosClient.patch<DependentDocument>(
        `/employees/${staffId}/dependents/${staffDependentId}/documents/${documentId}/verify`,
        { verificationStatus },
      )
    ).data;
  },
  async deleteDocument(staffId: string, staffDependentId: string, documentId: string) {
    await axiosClient.delete(`/employees/${staffId}/dependents/${staffDependentId}/documents/${documentId}`);
  },
};
