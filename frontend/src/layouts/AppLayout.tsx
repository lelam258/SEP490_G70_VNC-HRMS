import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../components/ui/Icon';
import { useAuthStore } from '../store/useAuthStore';
import { useAppStore } from '../store/useAppStore';
import { authApi } from '../services/authApi';
import { roleLabels, type Role } from '../types/accounts';
import { initials } from '../utils/format';

export default function AppLayout() {
  const user = useAuthStore(state => state.session?.user);

  const sidebarOpen = useAppStore(state => state.sidebarOpen);
  const toggleSidebar = useAppStore(state => state.toggleSidebar);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); }, [location.pathname]);
  const navClass = ({ isActive }: { isActive: boolean }) => `nav-item ${isActive ? 'selected' : ''}`;
  const title = location.pathname.startsWith('/accounts')
    ? 'Quản lý tài khoản'
    : location.pathname.startsWith('/employees')
    ? 'Nhân viên'
    : location.pathname.startsWith('/departments')
    ? 'Khoa/phòng'
    : location.pathname.startsWith('/certificates')
    ? 'Certificate / Qualification List'
    : location.pathname.startsWith('/cme-records')
    ? 'CME Records'
    : location.pathname.startsWith('/payroll/parameters')
    ? 'Tham số lương'
    : location.pathname.startsWith('/payroll/compensation')
    ? 'Đãi ngộ hợp đồng'
    : location.pathname.startsWith('/payroll/periods')
    ? 'Kỳ tính lương'
    : location.pathname.startsWith('/me/profile')
    ? 'Hồ sơ của tôi'
    : location.pathname.startsWith('/me/leave-requests')
    ? 'Đơn nghỉ phép'
    : location.pathname === '/change-password'
    ? 'Đổi mật khẩu'
    : 'Trang chủ';

  async function logout() {
    setBusy(true);
    setError('');
    try {
      await authApi.logout();
      navigate('/login', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không đăng xuất được.');
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <div className="vnc workspace">
      {sidebarOpen && (
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark">✚</span>
            <div>
              VNC <span>CLINIC</span>
              <small>QUẢN LÝ NHÂN SỰ</small>
            </div>
          </div>
          <div className="workspace-label">KHÔNG GIAN LÀM VIỆC</div>
          <nav aria-label="Điều hướng chính">
            <NavLink to="/" end className={navClass}>
              <Icon name="building" />
              Trang chủ
            </NavLink>
            {user.role === 'admin' && (
              <NavLink to="/accounts" className={navClass}>
                <Icon name="users" />
                Quản lý tài khoản
              </NavLink>
            )}
            {user.role === 'hr_manager' && (
              <>
                <NavLink to="/employees" className={navClass}>
                  <Icon name="users" />
                  Nhân viên
                </NavLink>
                <NavLink to="/departments" className={navClass}>
                  <Icon name="building" />
                  Khoa/phòng
                </NavLink>
                <NavLink to="/certificates" className={navClass}>
                  <Icon name="award" />
                  Certificate / Qualification List
                </NavLink>
                <NavLink to="/cme-records" className={navClass}>
                  <Icon name="fileText" />
                  CME Records
                </NavLink>
              </>
            )}
            {user.role === 'accountant' && (
              <>
                <NavLink to="/payroll/parameters" className={navClass}>
                  <Icon name="sliders" />
                  Tham số lương
                </NavLink>
                <NavLink to="/payroll/compensation" className={navClass}>
                  <Icon name="file" />
                  Đãi ngộ hợp đồng
                </NavLink>
                <NavLink to="/payroll/periods" className={navClass}>
                  <Icon name="calendar" />
                  Kỳ tính lương
                </NavLink>
              </>
            )}
          </nav>
          <div className="workspace-label" style={{ marginTop: '24px' }}>CÁ NHÂN</div>
          <nav aria-label="Điều hướng cá nhân">
            {user.role !== 'admin' && (
              <>
                <NavLink to="/me/profile" className={navClass}>
                  <Icon name="users" />
                  Hồ sơ của tôi
                </NavLink>
                <NavLink to="/me/leave-requests" className={navClass}>
                  <Icon name="clock" />
                  Đơn nghỉ phép
                </NavLink>
              </>
            )}
            <NavLink to="/change-password" className={navClass}>
              <Icon name="lock" />
              Đổi mật khẩu
            </NavLink>
          </nav>
          <div className="sidebar-bottom">
            <button className="nav-item logout" disabled={busy} onClick={() => void logout()}>
              <Icon name="logout" />
              Đăng xuất
            </button>
            {error && <p role="alert">{error}</p>}
          </div>
        </aside>
      )}
      <div className="workspace-main">
        <header className="topbar">
          <div className="flex items-center gap-4">
            <button
              className="button"
              onClick={toggleSidebar}
              aria-expanded={sidebarOpen}
              aria-label="Đóng/mở thanh điều hướng"
            >
              ☰
            </button>
            <div className="topbar-path">
              Không gian làm việc <span>/</span>
              <strong>{title}</strong>
            </div>
          </div>
          <div className="topbar-user">
            <span className="avatar small">{initials(user.name).toUpperCase()}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{roleLabels[user.role as Role] || user.role}</small>
            </div>
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
        <footer className="workspace-footer">
          © {new Date().getFullYear()} VNC Clinic
          <span>Hệ thống quản lý nhân sự</span>
        </footer>
      </div>
    </div>
  );
}
