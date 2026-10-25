import { useState, type FormEvent } from 'react';
import Icon from '../ui/Icon';
import { roleLabels, roles, statuses, statusLabels, type Account, type AccountInput, type Employee, type Role, type Status } from '../../types/accounts';
import { formatDate, initials } from '../../utils/format';

export default function AccountForm({ account, accounts, employees, mode, onBack, onEdit, onSave }: {
  account?: Account; accounts: Account[]; employees: Employee[]; mode: 'create' | 'detail' | 'edit';
  onBack: () => void; onEdit: () => void; onSave: (value: AccountInput) => Promise<string | null>;
}) {
  const readonly = mode === 'detail';
  const [employeeId, setEmployeeId] = useState(account?.employeeId || '');
  const [username, setUsername] = useState(account?.username || '');
  const [role, setRole] = useState<Role>(account?.role || 'employee');
  const [status, setStatus] = useState<Status>(account?.status || 'active');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState(account?.email || '');
  const [fullName, setFullName] = useState(account?.fullName || '');
  const [busy, setBusy] = useState(false);
  const employeeOptional = role === 'hr_manager' || (mode !== 'create' && role === 'admin');
  const employee = employees.find(e => e.id === employeeId);
  const available = employees.filter(e => e.id === account?.employeeId || (e.status === 'active' && !accounts.some(a => a.employeeId === e.id)));
  const dirty = !!password || email !== (account?.email || '') || fullName !== (account?.fullName || '') || employeeId !== (account?.employeeId || '') || username !== (account?.username || '') || role !== (account?.role || 'employee') || status !== (account?.status || 'active');
  function back() { if (readonly || !dirty || window.confirm('Bạn có thay đổi chưa lưu. Quay lại danh sách?')) onBack(); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');
    const login = username.trim();
    if (!employee && !employeeOptional) { setError('Vui lòng chọn nhân viên.'); return; }
    if (!/^[a-zA-Z0-9._-]{3,50}$/.test(login)) { setError('Tên đăng nhập cần 3–50 ký tự, chỉ gồm chữ không dấu, số và . _ -'); return; }
    if (accounts.some(a => a.id !== account?.id && a.username.toLowerCase() === login.toLowerCase())) { setError('Tên đăng nhập đã tồn tại. Vui lòng chọn tên khác.'); return; }
    if (accounts.some(a => a.id !== account?.id && a.employeeId === employeeId)) { setError('Nhân viên này đã có tài khoản.'); return; }
    const now = new Date().toISOString();
    setBusy(true);
    try {
      const result = await onSave({ id: account?.id || '', employeeId: employeeId || null, username: login, email: email || null, fullName, role, status, password: password || undefined, version: account?.version || '', isProvisioned: account?.isProvisioned || false, createdAt: account?.createdAt || now, updatedAt: now, lastLogin: account?.lastLogin || null });
      if (result) setError(result);
    } finally { setBusy(false); }
  }
  return <section className="account-form-page">
    <button className="text-button back-button" onClick={back}><Icon name="arrow" size={18} /> Danh sách tài khoản</button>
    <div className="page-heading"><div><span className="eyebrow">QUẢN TRỊ HỆ THỐNG</span><h1>{mode === 'create' ? 'Tạo tài khoản' : mode === 'edit' ? 'Chỉnh sửa tài khoản' : 'Chi tiết tài khoản'}</h1><p className="muted">{mode === 'create' ? 'Thiết lập quyền truy cập hệ thống cho thành viên đội ngũ.' : 'Thông tin tài khoản và quyền truy cập của nhân viên.'}</p></div>{readonly && <button className="button primary" onClick={onEdit}><Icon name="edit" size={18} />Chỉnh sửa</button>}</div>
    <div className="form-layout"><form onSubmit={submit} className="panel account-form" aria-label={mode === 'create' ? 'Tạo tài khoản' : 'Thông tin tài khoản'}>
      <div className="panel-heading"><span className="section-number">01</span><div><h2>Thông tin nhân viên</h2><p>Liên kết tài khoản với hồ sơ nhân viên hiện có.</p></div></div>
      <div className="form-section"><label htmlFor="account-employee">Nhân viên {!employeeOptional && <span className="required">*</span>}</label><select id="account-employee" required={!employeeOptional} disabled={!!account?.employeeId || readonly} value={employeeId} onChange={e => { setEmployeeId(e.target.value); const selected = employees.find(x => x.id === e.target.value); setUsername(selected?.email?.split('@')[0] || selected?.code.toLowerCase() || ''); setEmail(selected?.email || ''); setFullName(selected?.name || ''); }}><option value="">{employeeOptional ? 'Chưa liên kết hồ sơ nhân viên' : 'Chọn nhân viên chưa có tài khoản'}</option>{available.map(e => <option key={e.id} value={e.id}>{e.code} — {e.name}</option>)}</select>{(!available.length || role === 'hr_manager') && <p className="field-hint">Administrator có thể cấp tài khoản HR Manager trước khi có hồ sơ nhân viên. Các vai trò khác cần hồ sơ do HR Manager tạo.</p>}
      {employee && <div className="employee-preview"><span className="avatar">{initials(employee.name)}</span><div><strong>{employee.name}</strong><span>{employee.code} · {employee.department}</span><small>{employee.email}</small></div></div>}</div>
      <div className="panel-heading divided"><span className="section-number">02</span><div><h2>Thông tin tài khoản</h2><p>Cấu hình tên đăng nhập, vai trò và trạng thái.</p></div></div>
      <div className="form-section"><label htmlFor="account-username">Tên đăng nhập <span className="required">*</span></label><input id="account-username" value={username} onChange={e => setUsername(e.target.value)} readOnly={readonly} required minLength={3} maxLength={50} autoComplete="off" placeholder="Ví dụ: nguyenvana" /><p className="field-hint">3–50 ký tự. Cho phép chữ không dấu, số và . _ -</p>
        <div className="form-grid"><div><label htmlFor="account-fullname">Họ tên hiển thị</label><input id="account-fullname" value={fullName} readOnly={readonly} maxLength={100} onChange={e => setFullName(e.target.value)} /></div><div><label htmlFor="account-email">Email đăng nhập</label><input id="account-email" type="email" value={email} readOnly={readonly} maxLength={100} onChange={e => setEmail(e.target.value)} /></div></div>
        {!readonly && <div style={{ marginTop: 20 }}><label htmlFor="account-password">{mode === 'create' || !account?.isProvisioned ? 'Mật khẩu ban đầu *' : 'Đặt lại mật khẩu (không bắt buộc)'}</label><input id="account-password" type="password" autoComplete="new-password" value={password} required={mode === 'create' || !account?.isProvisioned} minLength={6} maxLength={128} onChange={e => setPassword(e.target.value)} /><p className="field-hint">Từ 6 đến 128 ký tự. Đặt lại mật khẩu sẽ kết thúc mọi phiên của tài khoản.</p></div>}
        <div className="form-grid"><div><label htmlFor="account-role">Vai trò <span className="required">*</span></label><select id="account-role" value={role} disabled={readonly} onChange={e => setRole(e.target.value as Role)}>{roles.map(r => <option key={r} value={r}>{roleLabels[r]}</option>)}</select></div><div><label htmlFor="account-status">Trạng thái <span className="required">*</span></label><select id="account-status" value={status} disabled={readonly} onChange={e => setStatus(e.target.value as Status)}>{statuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}</select></div></div>
        {account && <dl className="metadata"><div><dt>Ngày tạo</dt><dd>{formatDate(account.createdAt)}</dd></div><div><dt>Cập nhật gần nhất</dt><dd>{formatDate(account.updatedAt)}</dd></div><div><dt>Đăng nhập gần nhất</dt><dd>{formatDate(account.lastLogin)}</dd></div></dl>}
        {error && <div className="alert error" role="alert">{error}</div>}
      </div>
      {!readonly && <div className="form-actions"><button type="button" className="button" onClick={back}>Hủy</button><button type="submit" className="button primary" disabled={busy || (mode === 'create' && !available.length && !employeeOptional)}><Icon name="check" size={18} />{busy ? 'Đang lưu…' : mode === 'create' ? 'Tạo tài khoản' : 'Lưu thay đổi'}</button></div>}
    </form><aside className="form-guide"><span className="guide-icon"><Icon name="shield" size={26} /></span><h3>Đúng người, đúng quyền</h3><p>Mỗi nhân viên được liên kết với một tài khoản duy nhất.</p><ul><li><strong>Vai trò</strong> xác định phạm vi chức năng được sử dụng.</li><li><strong>Ngừng hoạt động</strong> khi tài khoản không còn được sử dụng.</li><li><strong>Đã khóa</strong> để tạm thời chặn quyền truy cập.</li></ul><div className="guide-note">Mật khẩu được bảo vệ trong hệ thống. Gửi mật khẩu ban đầu cho nhân viên qua kênh riêng; nhân viên có thể đổi mật khẩu sau khi đăng nhập.</div></aside></div>
  </section>;
}
