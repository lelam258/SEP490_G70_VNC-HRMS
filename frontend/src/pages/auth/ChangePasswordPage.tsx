import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import PasswordInput from '../../components/ui/PasswordInput';
import Alert from '../../components/ui/Alert';
import { authApi } from '../../services/authApi';
import { useAppStore } from '../../store/useAppStore';
import { isStrongPassword, passwordHint } from '../../utils/password';

export default function ChangePasswordPage() {
  const [current, setCurrent] = useState(''); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const navigate = useNavigate();
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setError('');
    if (!isStrongPassword(password)) { setError(`Mật khẩu cần ${passwordHint}`); return; }
    if (password !== confirmation) { setError('Mật khẩu xác nhận không khớp.'); return; }
    setBusy(true);
    try { await authApi.changePassword(current, password); useAppStore.getState().setNotice('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.'); navigate('/login', { replace: true }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không đổi được mật khẩu.'); }
    finally { setBusy(false); }
  }
  return <section><div className="page-heading"><div><h1>Đổi mật khẩu</h1><p className="muted">Đổi mật khẩu sẽ kết thúc các phiên đăng nhập.</p></div></div>
    <form className="panel account-form max-w-2xl" onSubmit={submit}><div className="form-section flex flex-col gap-5">
      <PasswordInput id="current-password" label="Mật khẩu hiện tại" value={current} onChange={setCurrent} />
      <PasswordInput id="new-password" label="Mật khẩu mới" value={password} onChange={setPassword} newPassword /><p className="field-hint">{passwordHint}</p>
      <PasswordInput id="confirm-password" label="Xác nhận mật khẩu" value={confirmation} onChange={setConfirmation} newPassword />
      {error && <Alert>{error}</Alert>}</div><div className="form-actions"><button type="button" className="button" disabled={busy} onClick={() => navigate('/')}>Quay lại</button>
      <button className="button primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Đổi mật khẩu'}</button></div></form>
  </section>;
}
