import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { roleLabels, type Role } from '../types/accounts';

export default function DashboardPage() {
  const user = useAuthStore(state => state.session!.user);
  return <section className="panel p-8"><h1 className="text-2xl font-semibold">Xin chào, {user.name}</h1><p className="mt-3 text-slate-500">Bạn đang đăng nhập với vai trò {roleLabels[user.role as Role] || user.role}.</p>
    <div className="mt-6 flex flex-wrap gap-3">{user.role === 'admin' && <><Link className="button primary" to="/accounts">Quản lý tài khoản</Link><Link className="button" to="/employees">Nhân viên</Link><Link className="button" to="/departments">Khoa/phòng</Link></>}
    <Link className="button" to="/change-password">Đổi mật khẩu</Link></div></section>;
}
