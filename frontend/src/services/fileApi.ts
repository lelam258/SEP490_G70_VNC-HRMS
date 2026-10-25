import { axiosClient } from './axiosClient';
export type UploadedFile = { publicId: string; url: string; resourceType: string; bytes: number };
export const fileApi = {
  async upload(file: File) {
    const body = new FormData(); body.append('file', file);
    return (await axiosClient.post<UploadedFile>('/files', body, { headers: { 'Content-Type': undefined }, timeout: 40_000 })).data;
  },
};
