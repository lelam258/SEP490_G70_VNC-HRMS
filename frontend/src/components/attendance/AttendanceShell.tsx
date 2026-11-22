import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';

export default function AttendanceShell({ title, description, actions, children, layout = 'content' }: { title: string; description: string; actions?: ReactNode; children: ReactNode; layout?: 'list' | 'content' }) {
  const role = useAuthStore(state => state.session?.user.role || '');
  return <section className={`directory-page operations-page workspace-attendance-page ${layout === 'list' ? 'workspace-list-page' : ''}`}>
    <header className="directory-heading"><div><span className="eyebrow">CHẤM CÔNG & CA TRỰC</span><h1>{title}</h1><p>{description}</p></div>{actions && <div className="operations-actions">{actions}</div>}</header>
    <nav className="operations-tabs" aria-label="Nghiệp vụ chấm công">
      {role !== 'accountant' && <><NavLink to="/attendance/records">Bảng chấm công</NavLink><NavLink to="/attendance/on-call">Hồ sơ trực</NavLink></>}
      {['admin', 'hr_manager', 'hr_staff', 'department_head', 'accountant'].includes(role) && <NavLink to="/attendance/monthly">Chốt công tháng</NavLink>}
      {['admin', 'hr_manager', 'hr_staff'].includes(role) && <NavLink to="/attendance/imports">Nhập chấm công</NavLink>}
      {['admin', 'hr_manager', 'hr_staff'].includes(role) && <NavLink to="/attendance/device-mappings">Mã máy chấm công</NavLink>}
      {['admin', 'hr_manager', 'hr_staff', 'department_head', 'accountant'].includes(role) && <NavLink to="/attendance/history">Lịch sử chấm công / ca</NavLink>}
    </nav><div className={`workspace-section-body ${layout === 'list' ? 'workspace-list-body' : ''}`}>{children}</div>
  </section>;
}
