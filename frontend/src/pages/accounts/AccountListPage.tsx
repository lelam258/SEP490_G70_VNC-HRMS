import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { useAppStore } from '../../store/useAppStore';
import { useAccounts } from '../../hooks/useAccounts';

import { roleLabels, roles, statuses, statusLabels, type Account, type Status } from '../../types/accounts';
import { normalize, initials, formatDate } from '../../utils/format';

const PAGE_SIZE = 6;
export default function AccountListPage() {
  const navigate = useNavigate();
  const { accounts, employees, loading, loadError, reload } = useAccounts();
  const notice = useAppStore(state => state.notice);
  const setNotice = useAppStore(state => state.setNotice);
  function employeeInfo(a: Account) {
    const staff = employees.find(e => e.id === a.employeeId);
    return { name: a.fullName || staff?.name || a.username, code: staff?.code || 'Hệ thống', department: staff?.department || 'Quản trị', email: a.email || staff?.email || '' };
  }
  const [query, setQuery] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => accounts.filter(a => {
    const e = employeeInfo(a);
    return (!employeeId || a.employeeId === employeeId) && (!role || a.role === role) && (!status || a.status === status) && normalize([a.username, e.name, e.code, e.email].join(' ')).includes(normalize(query));
  }), [accounts, employees, query, employeeId, role, status]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  function resetFilters() { setQuery(''); setEmployeeId(''); setRole(''); setStatus(''); setPage(1); }
  return <div className="vnc admin-page">
    <>
      <div className="page-heading"><div><span className="eyebrow">QUẢN TRỊ HỆ THỐNG</span><h1>Quản lý tài khoản</h1><p className="muted">Tra cứu tài khoản và trạng thái truy cập của đội ngũ VNC Clinic.</p></div><button className="button primary" disabled={!!loadError || loading} onClick={() => { setNotice(''); navigate('/accounts/new'); }}><Icon name="plus" size={18} />Tạo tài khoản</button></div>
      <div className="stats-grid"><div className="stat-card"><span className="stat-icon blue"><Icon name="users" size={22} /></span><div><span>Tổng tài khoản</span><strong>{accounts.length.toString().padStart(2, '0')}</strong></div><small>Toàn bộ hệ thống</small></div>{(['active', 'inactive', 'locked'] as Status[]).map(s => <div className="stat-card" key={s}><span className={`stat-icon ${s}`}><Icon name={s === 'active' ? 'check' : s === 'locked' ? 'lock' : 'clock'} size={22} /></span><div><span>{statusLabels[s]}</span><strong>{accounts.filter(a => a.status === s).length.toString().padStart(2, '0')}</strong></div><small>{s === 'active' ? 'Được phép truy cập' : s === 'locked' ? 'Tạm khóa truy cập' : 'Ngừng sử dụng'}</small></div>)}</div>
      {loadError && <div className="alert error" role="alert">{loadError}<button className="button" onClick={() => void reload()}>Tải lại</button></div>}{loading && <div className="loading-state" role="status">Đang tải dữ liệu…</div>}
      {notice && <div className="alert success" role="status"><Icon name="check" size={18} />{notice}<button className="icon-button" aria-label="Đóng thông báo" onClick={() => setNotice('')}><Icon name="close" size={16} /></button></div>}
      <section className="panel account-list" aria-label="Danh sách tài khoản"><div className="list-heading"><div><h2>Danh sách tài khoản <span className="count-badge">{accounts.length}</span></h2><p>Theo dõi thông tin truy cập của từng nhân viên.</p></div><button className="text-button" disabled={loading} onClick={() => void reload()}>Làm mới</button></div>
        <div className="filter-bar"><div className="search-field"><label className="sr-only" htmlFor="account-search">Tìm kiếm tài khoản</label><div className="input-icon"><Icon name="search" size={19} /><input id="account-search" type="search" placeholder="Tìm tên, username, email, mã nhân viên…" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} /></div></div><div className="filter-select"><label htmlFor="employee-filter">Nhân viên</label><select id="employee-filter" value={employeeId} onChange={e => { setEmployeeId(e.target.value); setPage(1); }}><option value="">Tất cả nhân viên</option>{employees.map(e => <option value={e.id} key={e.id}>{e.code} — {e.name}</option>)}</select></div><div className="filter-select"><label htmlFor="role-filter">Vai trò</label><select id="role-filter" value={role} onChange={e => { setRole(e.target.value); setPage(1); }}><option value="">Tất cả vai trò</option>{roles.map(r => <option key={r} value={r}>{roleLabels[r]}</option>)}</select></div><div className="filter-select"><label htmlFor="status-filter">Trạng thái</label><select id="status-filter" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}><option value="">Tất cả trạng thái</option>{statuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></div></div>
        {(query || employeeId || role || status) && <div className="filter-summary"><span>Tìm thấy <strong>{filtered.length}</strong> tài khoản</span><button className="text-button" onClick={resetFilters}>Xóa bộ lọc <Icon name="close" size={14} /></button></div>}
        {visible.length ? <div className="table-scroll"><table><caption className="sr-only">Danh sách tài khoản nhân viên</caption><thead><tr><th scope="col">Nhân viên</th><th scope="col">Tên đăng nhập</th><th scope="col">Vai trò</th><th scope="col">Trạng thái</th><th scope="col">Đăng nhập gần nhất</th></tr></thead><tbody>{visible.map(a => { const e = employeeInfo(a); return <tr key={a.id}><td><div className="person-cell"><span className={`avatar tone-${accounts.indexOf(a) % 4}`}>{initials(e.name)}</span><div><span className="person-name">{e.name}</span><small>{e.code} · {e.department}</small></div></div></td><td><span className="username">{a.username}</span><small className="table-secondary">{e.email}</small></td><td><span className={`role-badge ${a.role === roles[0] ? 'admin-role' : ''}`}>{roleLabels[a.role]}</span></td><td><span className={`status-badge ${a.status}`}><i />{a.isProvisioned ? statusLabels[a.status] : 'Chờ cấp mật khẩu'}</span></td><td className="date-cell">{formatDate(a.lastLogin)}</td></tr>; })}</tbody></table></div> : <div className="empty-state"><Icon name="search" size={38} /><h3>Không tìm thấy tài khoản</h3><p>Thử từ khóa khác hoặc thay đổi bộ lọc để tìm nhân viên.</p><button className="button" onClick={resetFilters}>Xóa bộ lọc</button></div>}
        <div className="table-footer"><span>Hiển thị <strong>{filtered.length ? (currentPage - 1) * PAGE_SIZE + 1 : 0}–{Math.min(currentPage * PAGE_SIZE, filtered.length)}</strong> trong <strong>{filtered.length}</strong> tài khoản</span><nav className="pagination" aria-label="Phân trang tài khoản"><button className="icon-button" aria-label="Trang trước" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><Icon name="arrow" size={16} /></button>{Array.from({ length: totalPages }, (_, i) => i + 1).map(n => <button key={n} className={`page-button ${n === currentPage ? 'current' : ''}`} aria-current={n === currentPage ? 'page' : undefined} aria-label={`Trang ${n}`} onClick={() => setPage(n)}>{n}</button>)}<button className="icon-button" aria-label="Trang sau" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}><Icon name="chevron" size={16} /></button></nav></div>
      </section><div className="page-footnote"><Icon name="shield" size={16} /><span>Cấp quyền phù hợp với công việc và kiểm tra trạng thái tài khoản khi nhân viên ngừng sử dụng.</span></div>
    </>
  </div>;
}
