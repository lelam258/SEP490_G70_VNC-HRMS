import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationApi, type AppNotification } from '../../services/notificationApi';
import Icon from './Icon';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationApi.list(1, 20);
      setNotifications(res.items || []);
    } catch {
      // Ignore background notification fetch errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchNotifications();
    const timer = setInterval(() => {
      void fetchNotifications();
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const handleItemClick = async (notif: AppNotification) => {
    try {
      if (!notif.isRead) {
        await notificationApi.markAsRead(notif.notificationId);
        setNotifications((prev) =>
          prev.map((item) =>
            item.notificationId === notif.notificationId ? { ...item, isRead: true } : item
          )
        );
      }
    } catch {
      // Ignore mark read error
    }
    setOpen(false);
    if (notif.actionUrl) {
      navigate(notif.actionUrl);
    }
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
        ' ' +
        d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) void fetchNotifications();
        }}
        className="relative flex items-center justify-center w-9 h-9 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 transition shadow-xs cursor-pointer"
        title="Thông báo hệ thống"
        aria-label="Thông báo"
      >
        <Icon name="bell" size={17} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 bg-white shadow-lg z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-slate-800">Thông báo</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                  {unreadCount} mới
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void fetchNotifications()}
              className="text-[11px] text-teal-700 hover:text-teal-800 font-medium cursor-pointer"
            >
              Làm mới
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {loading && notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Đang tải thông báo...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Chưa có thông báo nào
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.notificationId}
                  onClick={() => void handleItemClick(item)}
                  className={`p-3 text-left transition cursor-pointer hover:bg-slate-50 ${
                    !item.isRead ? 'bg-teal-50/20' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-xs text-slate-900 leading-snug">
                      {item.title}
                    </div>
                    {!item.isRead && (
                      <span className="h-2 w-2 rounded-full bg-teal-600 shrink-0 mt-1" />
                    )}
                  </div>
                  {item.body && (
                    <div className="mt-1 text-[11px] text-slate-600 line-clamp-2 leading-relaxed">
                      {item.body}
                    </div>
                  )}
                  <div className="mt-1.5 text-[10px] text-slate-400">
                    {formatTime(item.createdAt)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

