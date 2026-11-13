import { useState } from 'react';
import { Link } from 'react-router-dom';
import useApiResource from '../../hooks/useApiResource';
import { accountApi } from '../../services/accountApi';
import { useAuthStore } from '../../store/useAuthStore';
import type { Account } from '../../types/accounts';
import Modal from '../../components/ui/Modal';
import DataTable from '../../components/ui/DataTable';
import ResourceState from '../../components/attendance/ResourceState';
import { statusLabels } from '../../types/accounts';

type RoleDefinition = { id: string; name: string; description: string; areas: string[]; accountCount: number };
export default function RoleManagementPage() {
  const catalog = useApiResource<RoleDefinition[]>('/roles');
  const accounts = useApiResource<Account[]>('/users');
  const actor = useAuthStore(state => state.session?.user.id);
  const [selected, setSelected] = useState('admin');
  const [accountId, setAccountId] = useState('');
  const [confirm, setConfirm] = useState<Account>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const role = catalog.data?.find(x => x.id === selected);
  const eligible = accounts.data?.filter(x => x.role !== selected && (x.id !== actor || selected === 'admin')) || [];
  async function assign() {
    if (!confirm || busy) return;
    setBusy(true); setError('');
    try { await accountApi.role(confirm.id, selected, confirm.version); setConfirm(undefined); setAccountId(''); setNotice('Đã cập nhật vai trò và kết thúc các phiên cũ của tài khoản.'); catalog.reload(); accounts.reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không gán được vai trò.'); }
    finally { setBusy(false); }
  }
  return <section className="directory-page operations-page">
    <header className="directory-heading"><div><span className="eyebrow">QUẢN TRỊ HỆ THỐNG</span><h1>Quản lý vai trò</h1><p>Xem phạm vi quyền và phân công vai trò có sẵn cho tài khoản.</p></div><div className="operations-actions"><button type="button" className="button" onClick={() => { catalog.reload(); accounts.reload(); }}>Tải lại dữ liệu</button><Link className="button" to="/accounts">Quản lý tài khoản</Link></div></header>
    {notice && <p className="alert success" role="status">{notice}</p>}
    <ResourceState loading={catalog.loading || accounts.loading} error={catalog.error || accounts.error} reload={() => { catalog.reload(); accounts.reload(); }} />
    <div className="operations-role-grid">{catalog.data?.map(item => <button type="button" key={item.id} className={`operations-role-card ${selected === item.id ? 'active' : ''}`} aria-pressed={selected === item.id} onClick={() => { setSelected(item.id); setAccountId(''); }}><strong>{item.name}</strong><p>{item.description}</p><span>{item.accountCount} tài khoản</span></button>)}</div>
    {role && <section className="operations-panel"><h2>{role.name}</h2><p>{role.description}</p><div className="operations-stats">{role.areas.map(area => <span key={area}>{area}</span>)}</div>
      <div className="operations-filters"><label htmlFor="role-target-account">Gán tài khoản vào vai trò<select id="role-target-account" value={accountId} disabled={busy || accounts.loading} onChange={event => setAccountId(event.target.value)}><option value="">Chọn tài khoản</option>{eligible.map(account => <option key={account.id} value={account.id}>{account.username} · {account.fullName || 'Chưa có tên'}</option>)}</select></label><button type="button" className="button primary" disabled={!accountId || busy} onClick={() => { setError(''); setConfirm(eligible.find(x => x.id === accountId)); }}>Gán vai trò</button></div>
      <DataTable rows={accounts.data?.filter(x => x.role === selected) || []} rowKey={x => x.id} emptyMessage="Chưa có tài khoản trong vai trò này." columns={[
        { key: 'username', label: 'Tài khoản', render: item => <Link to={`/accounts/${item.id}`}>{item.username}</Link> },
        { key: 'name', label: 'Họ tên', render: item => item.fullName || '—' },
        { key: 'status', label: 'Trạng thái', render: item => statusLabels[item.status] },
        { key: 'action', label: 'Thao tác', render: item => <Link className="button" to={`/accounts/${item.id}/edit`}>Mở tài khoản</Link> },
      ]} />
    </section>}
    {confirm && <Modal title="Xác nhận gán vai trò" busy={busy} onClose={() => setConfirm(undefined)}><div className="operations-panel"><p>Chuyển <strong>{confirm.username}</strong> sang vai trò <strong>{role?.name}</strong>?</p><p>Các phiên cũ sẽ kết thúc để áp dụng quyền mới.</p>{error && <p className="alert error" role="alert">{error}</p>}<div className="form-actions"><button type="button" className="button" disabled={busy} onClick={() => setConfirm(undefined)}>Đóng</button><button type="button" className="button primary" disabled={busy} onClick={() => void assign()}>{busy ? 'Đang lưu…' : 'Xác nhận'}</button></div></div></Modal>}
  </section>;
}
