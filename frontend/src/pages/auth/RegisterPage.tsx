import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import Alert from '../../components/ui/Alert';
import PasswordInput from '../../components/ui/PasswordInput';
import { authApi } from '../../services/authApi';
import { useAppStore } from '../../store/useAppStore';
import { isStrongPassword, passwordHint } from '../../utils/password';

export default function RegisterPage() {
  const [employeeCode, setEmployeeCode] = useState(''); const [username, setUsername] = useState('');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const navigate = useNavigate();
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return; setError('');
    if (!isStrongPassword(password)) { setError(`Mật khẩu cần ${passwordHint}`); return; }
    if (password !== confirmation) { setError('Mật khẩu xác nhận không khớp.'); return; }
    setBusy(true);
    try {
      const result = await authApi.register({ employeeCode: employeeCode.trim(), username: username.trim(), email: email.trim(), password });
      useAppStore.getState().setNotice(result.message); navigate('/login', { replace: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không đăng ký được.'); }
    finally { setBusy(false); }
  }
  return <AuthLayout title="Đăng ký tài khoản" description="Sử dụng mã nhân viên và email đã được phòng khám lưu trong hồ sơ.">
    <form className="login-form" onSubmit={submit}>
      <div className="auth-field"><label htmlFor="register-employee">Mã nhân viên</label><input id="register-employee" value={employeeCode} onChange={e => setEmployeeCode(e.target.value)} required maxLength={20} /></div>
      <div className="auth-field"><label htmlFor="register-email">Email</label><input id="register-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={100} /></div>
      <div className="auth-field"><label htmlFor="register-username">Tên đăng nhập</label><input id="register-username" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} required minLength={3} maxLength={50} pattern="[a-zA-Z0-9._-]{3,50}" /></div>
      <PasswordInput id="register-password" label="Mật khẩu" value={password} onChange={setPassword} newPassword />
      <p className="field-hint">{passwordHint}</p>
      <PasswordInput id="register-confirmation" label="Xác nhận mật khẩu" value={confirmation} onChange={setConfirmation} newPassword />
      {error && <Alert>{error}</Alert>}
      <button className="button primary login-submit" disabled={busy}>{busy ? 'Đang đăng ký…' : 'Đăng ký'}</button>
    </form><p className="login-help">Thông tin phải khớp hồ sơ nhân viên đang hoạt động. Tài khoản mới được cấp vai trò nhân viên và có thể đăng nhập ngay.</p>
  </AuthLayout>;
}
