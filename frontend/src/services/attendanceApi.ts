import { axiosClient } from './axiosClient';
import type { ImportAnalysis, ImportAnalysisQuery, ImportRowInput, OnCallInput } from '../types/attendance';

function importBody(file: File, facilityId: string, month: string, deviceSource: string, mapping: Record<string, number>, dateOrder: string) {
  const body = new FormData();
  body.append('file', file); body.append('facilityId', facilityId); body.append('month', month); body.append('deviceSource', deviceSource);
  if (Object.keys(mapping).length) body.append('columnMapping', JSON.stringify(mapping));
  body.append('dateOrder', dateOrder);
  return body;
}

export const attendanceApi = {
  async upload(file: File, facilityId: string, month: string, deviceSource: string, mapping: Record<string, number>, dateOrder = 'auto') {
    return (await axiosClient.post<{ id: string; reused: boolean; message: string }>('/attendance/imports', importBody(file, facilityId, month, deviceSource, mapping, dateOrder),
      { headers: { 'Content-Type': undefined }, timeout: 120_000 })).data;
  },
  async analyze(file: File, facilityId: string, month: string, deviceSource: string, mapping: Record<string, number>, dateOrder: string,
    query: ImportAnalysisQuery, signal?: AbortSignal) {
    return (await axiosClient.post<ImportAnalysis>('/attendance/imports/analyze', importBody(file, facilityId, month, deviceSource, mapping, dateOrder),
      { params: query, signal, headers: { 'Content-Type': undefined }, timeout: 120_000 })).data;
  },
  async commit(id: string, version: string, includeWarnings: boolean) {
    return (await axiosClient.post<{ created: number; message: string }>(`/attendance/imports/${id}/commit`, { version, includeWarnings }, { timeout: 120_000 })).data;
  },
  async correct(id: string, rowId: string, input: ImportRowInput) {
    return (await axiosClient.put<{ message: string; status: string }>(`/attendance/imports/${id}/rows/${rowId}`, input)).data;
  },
  async exclude(id: string, rowId: string, reason: string, version: string) {
    return (await axiosClient.post<{ message: string }>(`/attendance/imports/${id}/rows/${rowId}/exclude`, { reason, version })).data;
  },
  async onCall(id: string | undefined, input: OnCallInput) {
    return (await (id ? axiosClient.put<{ id: string; message: string }>(`/attendance/on-call-shifts/${id}`, input)
      : axiosClient.post<{ id: string; message: string }>('/attendance/on-call-shifts', input))).data;
  },
};
export async function downloadAttendance(path: string, filename: string, params?: Record<string, unknown>) {
  const { data } = await axiosClient.get<Blob>(path, { params, responseType: 'blob' });
  const url = URL.createObjectURL(data); const link = document.createElement('a'); link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
