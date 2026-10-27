import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/useAuthStore';
import type { Session } from '../types/auth';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';
const options = { baseURL, withCredentials: true, timeout: 25_000, headers: { 'Content-Type': 'application/json' } };
// Public authentication calls must not inherit a stale Bearer token.
export const publicClient = axios.create(options);
export const axiosClient = axios.create(options);

export class ApiError extends Error {
  constructor(public status: number, message: string, public field?: string) { super(message); this.name = 'ApiError'; }
}

function apiError(error: AxiosError<{ message?: string; detail?: string; title?: string; field?: string }>) {
  const response = error.response;
  const fallback = response?.status === 429 ? 'Bạn thao tác quá nhiều lần. Vui lòng đợi rồi thử lại.'
    : response?.status === 403 ? 'Bạn không có quyền thực hiện chức năng này.'
    : response ? `Yêu cầu thất bại (${response.status}).` : 'Không kết nối được backend. Kiểm tra kết nối rồi thử lại.';
  return new ApiError(response?.status || 0, response?.data?.message || response?.data?.detail || response?.data?.title || fallback, response?.data?.field);
}

let refreshing: Promise<Session> | null = null;
export function refreshSession(): Promise<Session> {
  if (!refreshing) refreshing = publicClient.post<Session>('/auth/refresh', {}).then(({ data }) => {
    useAuthStore.getState().setSession(data); return data;
  }).catch(error => {
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) useAuthStore.getState().setSession(null);
    throw error;
  }).finally(() => { refreshing = null; });
  return refreshing;
}

axiosClient.interceptors.request.use(config => {
  const token = useAuthStore.getState().session?.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

type RetriableConfig = InternalAxiosRequestConfig & { retried?: boolean };
axiosClient.interceptors.response.use(response => response, async (error: AxiosError) => {
  const original = error.config as RetriableConfig | undefined;
  if (error.response?.status === 401 && original && !original.retried && useAuthStore.getState().session) {
    original.retried = true;
    const current = useAuthStore.getState().session;
    const sentToken = original.headers.Authorization;
    const session = current && sentToken !== `Bearer ${current.accessToken}` ? current : await refreshSession();
    original.headers.Authorization = `Bearer ${session.accessToken}`;
    return axiosClient.request(original);
  }
  if (error.response?.status === 401) useAuthStore.getState().setSession(null);
  throw apiError(error as AxiosError<{ message?: string }>);
});
publicClient.interceptors.response.use(response => response, (error: AxiosError<{ message?: string }>) => { throw apiError(error); });
