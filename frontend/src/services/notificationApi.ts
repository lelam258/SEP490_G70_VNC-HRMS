import { axiosClient } from './axiosClient';

export interface AppNotification {
  notificationId: string;
  recipientId: string;
  senderService: string;
  type: string;
  title: string;
  body?: string;
  actionUrl?: string;
  entityType?: string;
  entityId?: string;
  isRead?: boolean;
  createdAt?: string;
}

export interface NotificationListResponse {
  total: number;
  page: number;
  pageSize: number;
  items: AppNotification[];
}

export const notificationApi = {
  list: async (page = 1, pageSize = 20): Promise<NotificationListResponse> => {
    const res = await axiosClient.get<NotificationListResponse>('/notifications', {
      params: { page, pageSize },
    });
    return res.data;
  },
  markAsRead: async (id: string): Promise<void> => {
    await axiosClient.put(`/notifications/${id}/read`);
  },
};

