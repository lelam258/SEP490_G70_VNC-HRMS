import { axiosClient } from './axiosClient';
import type { UserProfile, UpdateProfileInput } from '../types/profile';

export const profileApi = {
  getProfile: async (): Promise<UserProfile> => {
    const res = await axiosClient.get<UserProfile>('/me/profile');
    return res.data;
  },
  updateProfile: async (input: UpdateProfileInput): Promise<UserProfile> => {
    const res = await axiosClient.put<UserProfile>('/me/profile', input);
    return res.data;
  },
  uploadAvatar: async (file: File): Promise<UserProfile> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axiosClient.post<UserProfile>('/me/profile/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },
};
