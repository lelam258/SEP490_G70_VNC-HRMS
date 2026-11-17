import { useEffect, useState } from 'react';
import AppRoutes from './routes/AppRoutes';
import { authApi } from './services/authApi';
import { refreshSession } from './services/axiosClient';
import { useAuthStore } from './store/useAuthStore';

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    const existing = useAuthStore.getState().session;

    // Nếu đã có session đang hoạt động trong phiên làm việc hiện tại, xác thực lại thông tin user
    // Nếu chưa đăng nhập, KHÔNG tự động refreshSession() mà chuyển đến màn hình đăng nhập yêu cầu nhập tài khoản & mật khẩu
    if (existing) {
      authApi.me()
        .then((user) => {
          const current = useAuthStore.getState().session;
          if (current) useAuthStore.getState().setSession({ ...current, user });
        })
        .catch(() => {
          useAuthStore.getState().setSession(null);
        })
        .finally(() => {
          if (active) setReady(true);
        });
    } else {
      if (active) setReady(true);
    }

    return () => {
      active = false;
    };
  }, []);

  return ready ? <AppRoutes /> : <div className="vnc loading-state" role="status">Đang khởi động…</div>;
}
