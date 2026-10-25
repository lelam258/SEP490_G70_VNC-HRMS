import { axiosClient, publicClient } from './axiosClient';
import { useAuthStore } from '../store/useAuthStore';
import type { CurrentUser, Session } from '../types/auth';

export const authApi = {
  async login(login: string, password: string) {
    const { data } = await publicClient.post<Session>('/auth/login', { login, password });
    useAuthStore.getState().setSession(data); return data;
  },
  async me() { return (await axiosClient.get<CurrentUser>('/auth/me')).data; },
  async logout() {
    // An expired access token must not prevent revocation of the refresh cookie.
    await publicClient.post('/auth/logout', {});
    useAuthStore.getState().setSession(null);
  },
  async changePassword(currentPassword: string, newPassword: string) {
    await axiosClient.post('/auth/change-password', { currentPassword, newPassword });
    useAuthStore.getState().setSession(null);
  },
};
