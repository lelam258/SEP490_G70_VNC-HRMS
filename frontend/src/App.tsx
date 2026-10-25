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
    const initialize = existing ? authApi.me().then(user => {
      const current = useAuthStore.getState().session;
      if (current) useAuthStore.getState().setSession({ ...current, user });
    }) : refreshSession();
    void initialize.catch(() => { /* Network errors preserve a saved session; 401s are handled by Axios. */ }).finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  return ready ? <AppRoutes /> : <div className="vnc loading-state" role="status">Đang khởi động…</div>;
}
