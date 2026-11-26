import { axiosClient, publicClient } from './axiosClient';
import { useAuthStore } from '../store/useAuthStore';
import type { CurrentUser, RecoveryChallenge, Session } from '../types/auth';

export const authApi = {
  async login(login: string, password: string) {
    const { data } = await publicClient.post<Session>('/auth/login', { login, password });
    useAuthStore.getState().setSession(data); return data;
  },
  async forgotPassword(email: string) {
    return (await publicClient.post<RecoveryChallenge>('/auth/forgot-password', { email })).data;
  },
  async resetPassword(challengeId: string, otp: string, newPassword: string) {
    const { data } = await publicClient.post<{ message: string }>('/auth/reset-password', { challengeId, otp, newPassword });
    useAuthStore.getState().setSession(null); return data;
  },
  async me() { return (await axiosClient.get<CurrentUser>('/auth/me')).data; },
  async logout() {
    try {
      await publicClient.post('/auth/logout', {});
    } catch (err) {
      console.warn('Backend logout encountered error, proceeding with local logout:', err);
    } finally {
      useAuthStore.getState().setSession(null);
    }
  },
  async changePassword(currentPassword: string, newPassword: string) {
    await axiosClient.post('/auth/change-password', { currentPassword, newPassword });
    useAuthStore.getState().setSession(null);
  },
};
