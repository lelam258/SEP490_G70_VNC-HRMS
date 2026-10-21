import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import Alert from '../../components/ui/Alert';
import PasswordInput from '../../components/ui/PasswordInput';
import { authApi } from '../../services/authApi';
import { useAppStore } from '../../store/useAppStore';
import { useRecoveryStore } from '../../store/useRecoveryStore';

export default function LoginPage() {
  const [login, setLogin] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const notice = useAppStore(state => state.notice);
  const navigate = useNavigate(); const location = useLocation();
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      await authApi.login(login.trim(), password);
      useRecoveryStore.getState().setChallenge(null); useAppStore.getState().setNotice('');
      const from = location.state?.from;
      navigate(typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/', { replace: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không đăng nhập được.'); }
    finally { setBusy(false); }
  }
  return <AuthLayout title="Chào mừng trở lại" description="Đăng nhập để bắt đầu ngày làm việc của bạn." back={false}>
    <form onSubmit={submit} className="login-form"><div className="auth-field"><label htmlFor="login-username">Tên đăng nhập hoặc email</label>
      <input id="login-username" autoComplete="username" value={login} onChange={event => setLogin(event.target.value)} required maxLength={100} placeholder="Nhập tên đăng nhập hoặc email" /></div>
      <PasswordInput id="login-password" label="Mật khẩu" value={password} onChange={setPassword} />
      <Link to="/forgot-password" className="text-button justify-end">Quên mật khẩu?</Link>
      {error && <Alert>{error}</Alert>}{notice && <Alert variant="success">{notice}</Alert>}
      <button className="button primary login-submit" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</button>
    </form><p className="auth-register">Chưa có tài khoản? <Link className="text-button" to="/register">Đăng ký</Link></p>
  </AuthLayout>;
}
