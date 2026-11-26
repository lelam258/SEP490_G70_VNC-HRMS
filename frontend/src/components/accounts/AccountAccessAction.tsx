import { useState } from 'react';
import Modal from '../ui/Modal';
import { useAuthStore } from '../../store/useAuthStore';
import { accountApi } from '../../services/accountApi';
import type { Account } from '../../types/accounts';

export default function AccountAccessAction({ account, onChanged }: { account: Account; onChanged: (message: string) => void }) {
  const actor = useAuthStore(state => state.session?.user.id);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const active = account.status === 'active';
  async function save() {
    if (busy) return;
    setBusy(true); setError('');
    try { await accountApi.status(account.id, active ? 'inactive' : 'active', account.version); setOpen(false); onChanged(active ? 'Đã ngừng hoạt động tài khoản.' : 'Đã kích hoạt tài khoản.'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không đổi được trạng thái.'); }
    finally { setBusy(false); }
  }
  return <><button type="button" className="button" disabled={actor === account.id} onClick={() => { setOpen(true); setError(''); }}
    title={actor === account.id ? 'Không được thay đổi quyền truy cập của chính mình tại đây' : undefined}>{active ? 'Ngừng hoạt động' : 'Kích hoạt'}</button>
    {open && <Modal title={active ? 'Ngừng hoạt động tài khoản' : 'Kích hoạt tài khoản'} busy={busy} onClose={() => setOpen(false)}>
      <div className="operations-panel operations-form"><p>Xác nhận {active ? 'ngừng hoạt động' : 'kích hoạt'} tài khoản <strong>{account.username}</strong>?</p>
        <p>{active ? 'Tài khoản sẽ không thể đăng nhập và các phiên hiện tại sẽ kết thúc.' : 'Tài khoản được phép truy cập theo vai trò đã gán.'} Lịch sử tài khoản được giữ lại.</p>
        {error && <p className="alert error" role="alert">{error}</p>}
        <div className="form-actions"><button type="button" className="button" disabled={busy} onClick={() => setOpen(false)}>Đóng</button><button type="button" className="button primary" disabled={busy} onClick={() => void save()}>{busy ? 'Đang lưu…' : 'Xác nhận'}</button></div>
      </div></Modal>}
  </>;
}
