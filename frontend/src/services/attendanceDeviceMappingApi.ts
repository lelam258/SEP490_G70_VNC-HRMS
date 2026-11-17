import { axiosClient } from './axiosClient';

export type AttendanceDeviceMapping = {
  staffId: string; staffCode: string; staffName: string; departmentName: string | null;
  deviceEnrollId: string | null; status: string; version: string;
};
export type AttendanceDeviceMappingList = { items: AttendanceDeviceMapping[] };

export const attendanceDeviceMappingApi = {
  async save(staffId: string, deviceEnrollId: string | null, reason: string, version: string) {
    return (await axiosClient.post<{ item: AttendanceDeviceMapping; message: string }>(
      `/attendance/device-mappings/${staffId}`, { deviceEnrollId, reason, version })).data;
  },
};
