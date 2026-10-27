import { Link } from 'react-router';
import { useAuthStore } from '../store/useAuthStore';
import { roleLabels, type Role } from '../types/accounts';

export default function DashboardPage() {
  const user = useAuthStore(state => state.session?.user);
  if (!user) return null;
  return <section className="panel p-8"><h1 className="text-2xl font-semibold">Xin chào, {user.name}</h1><p className="mt-3 text-slate-500">Bạn đang đăng nhập với vai trò {roleLabels[user.role as Role] || user.role}.</p>
    <div className="mt-6 flex flex-wrap gap-3">{user.role === 'admin' && <Link className="button primary" to="/accounts">Quản lý tài khoản</Link>}
    {user.role === 'hr_manager' && <><Link className="button primary" to="/employees">Nhân viên</Link><Link className="button" to="/departments">Khoa/phòng</Link></>}
    {user.role === 'accountant' && <><Link className="button primary" to="/payroll/parameters">Tham số lương</Link><Link className="button" to="/payroll/compensation">Đãi ngộ hợp đồng</Link></>}
    <Link className="button" to="/change-password">Đổi mật khẩu</Link></div></section>;
}
