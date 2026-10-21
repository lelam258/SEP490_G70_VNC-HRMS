import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';

export default function ProtectedRoute({ roles }: { roles?: string[] }) {
  const session = useAuthStore(state => state.session); const location = useLocation();
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(session.user.role)) return <section className="vnc panel empty-state"><h1>Bạn không có quyền truy cập chức năng này.</h1><Link className="button" to="/">Về trang chủ</Link></section>;
  return <Outlet />;
}
