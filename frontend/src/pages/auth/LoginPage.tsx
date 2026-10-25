import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import Alert from '../../components/ui/Alert';
import PasswordInput from '../../components/ui/PasswordInput';
import { authApi } from '../../services/authApi';
import { useAuthStore } from '../../store/useAuthStore';
import { useAppStore } from '../../store/useAppStore';

export default function LoginPage() {
  const [login, setLogin] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const session = useAuthStore(state => state.session);
  const notice = useAppStore(state => state.notice);
  const navigate = useNavigate();
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      await authApi.login(login.trim(), password);
      useAppStore.getState().setNotice('');
      navigate('/', { replace: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không đăng nhập được.'); }
    finally { setBusy(false); }
  }
  if (session) return <Navigate to="/" replace />;
  return <AuthLayout title="Chào mừng trở lại" description="Đăng nhập để bắt đầu ngày làm việc của bạn." back={false}>
    <form onSubmit={submit} className="login-form"><div className="auth-field"><label htmlFor="login-username">Tên đăng nhập hoặc email</label>
      <input id="login-username" autoComplete="username" value={login} onChange={event => setLogin(event.target.value)} required maxLength={100} placeholder="Nhập tên đăng nhập hoặc email" /></div>
      <PasswordInput id="login-password" label="Mật khẩu" value={password} onChange={setPassword} />
      {error && <Alert>{error}</Alert>}{notice && <Alert variant="success">{notice}</Alert>}
      <button className="button primary login-submit" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
    </form>
  </AuthLayout>;
}
