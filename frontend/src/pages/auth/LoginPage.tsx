import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import Alert from '../../components/ui/Alert';
import Icon from '../../components/ui/Icon';
import { authApi } from '../../services/authApi';
import { useAppStore } from '../../store/useAppStore';
import { useAuthStore } from '../../store/useAuthStore';
import { useRecoveryStore } from '../../store/useRecoveryStore';
import { roleHome } from '../../utils/roleNavigation';

export default function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const notice = useAppStore(state => state.notice);
  const session = useAuthStore(state => state.session);
  const navigate = useNavigate();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');

    try {
      const session = await authApi.login(login.trim(), password);
      useRecoveryStore.getState().setChallenge(null);
      useAppStore.getState().setNotice('');
      
      if (rememberMe) {
        localStorage.setItem('vnc_remember_shift', 'true');
      } else {
        localStorage.removeItem('vnc_remember_shift');
      }

      navigate(roleHome(session.user.role), { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không đăng nhập được.');
    } finally {
      setBusy(false);
    }
  }

  if (session) {
    return <Navigate to={roleHome(session.user.role)} replace />;
  }

  return (
    <AuthLayout
      title="Chào mừng trở lại"
      description="Đăng nhập để bắt đầu ngày làm việc của bạn."
      back={false}
    >
      <form onSubmit={submit} className="vnc-modern-auth-form">
        {/* Username or Email field */}
        <div className="auth-input-group">
          <label htmlFor="login-username" className="auth-field-label">
            TÊN ĐĂNG NHẬP HOẶC EMAIL
          </label>
          <div className="auth-field-input-box">
            <span className="auth-field-prefix" aria-hidden="true">
              @
            </span>
            <input
              id="login-username"
              type="text"
              autoComplete="username"
              value={login}
              onChange={event => setLogin(event.target.value)}
              required
              maxLength={100}
              placeholder="thanh123 hoặc email..."
              className="auth-text-input"
            />
          </div>
        </div>

        {/* Password field */}
        <div className="auth-input-group">
          <label htmlFor="login-password" className="auth-field-label">
            MẬT KHẨU
          </label>
          <div className="auth-field-input-box">
            <span className="auth-field-prefix" aria-hidden="true">
              <Icon name="lock" size={18} />
            </span>
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              required
              maxLength={128}
              placeholder="••••••••"
              className="auth-text-input"
            />
            <button
              type="button"
              className="auth-password-toggle-btn"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              <Icon name="eye" size={18} />
            </button>
          </div>
        </div>

        {/* Remember me & Forgot password */}
        <div className="auth-options-flex-row">
          <label className="auth-checkbox-label">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              className="auth-custom-checkbox"
            />
            <span>Lưu mật khẩu</span>
          </label>
          <Link to="/forgot-password" className="auth-forgot-password-link">
            Quên mật khẩu?
          </Link>
        </div>

        {/* Alerts */}
        {error && <Alert>{error}</Alert>}
        {notice && <Alert variant="success">{notice}</Alert>}

        {/* Submit button */}
        <button
          type="submit"
          className="auth-submit-primary-btn"
          disabled={busy}
        >
          <span>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</span>
          <span className="btn-arrow-icon" aria-hidden="true">→</span>
        </button>

        {/* Divider */}
        <div className="auth-divider-line">
          <span>HOẶC</span>
        </div>

        {/* Help text */}
        <p className="auth-admin-help-note">
          Chưa có tài khoản? Vui lòng liên hệ quản trị viên để được cấp tài khoản.
        </p>
      </form>
    </AuthLayout>
  );
}
