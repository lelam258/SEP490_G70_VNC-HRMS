import { useState, type FormEvent } from 'react';
import AuthLayout from '../../layouts/AuthLayout';
import Alert from '../../components/ui/Alert';
import Icon from '../../components/ui/Icon';
import { useOtpRecovery } from '../../hooks/useOtpRecovery';

export default function ForgotPasswordPage() {
  const { challenge, send, busy, error, resendSecondsLeft } = useOtpRecovery();
  const [email, setEmail] = useState(challenge?.email || '');
  const cooldown = email.trim().toLowerCase() === challenge?.email.toLowerCase() && resendSecondsLeft > 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!cooldown) void send(email);
  }

  return (
    <AuthLayout
      title="Quên mật khẩu?"
      description="Nhập email tài khoản nhân sự của bạn để nhận mã OTP xác thực đặt lại mật khẩu."
      back={true}
    >
      <form className="vnc-modern-auth-form" onSubmit={submit}>
        <div className="auth-input-group">
          <label htmlFor="forgot-email" className="auth-field-label">
            EMAIL CỦA TÀI KHOẢN
          </label>
          <div className="auth-field-input-box">
            <span className="auth-field-prefix" aria-hidden="true">
              <Icon name="mail" size={18} />
            </span>
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              maxLength={100}
              placeholder="nhansu@vnc-clinic.com..."
              className="auth-text-input"
            />
          </div>
        </div>

        {error && <Alert>{error}</Alert>}

        <button
          type="submit"
          className="auth-submit-primary-btn"
          disabled={busy || cooldown}
        >
          <span>
            {busy ? 'Đang gửi mã…' : cooldown ? `Gửi lại sau ${resendSecondsLeft}s` : 'Gửi mã OTP'}
          </span>
          <span className="btn-arrow-icon" aria-hidden="true">→</span>
        </button>

        <p className="auth-admin-help-note">
          Mã OTP chỉ gửi tới email khớp với hồ sơ nhân sự đang hoạt động. Nếu không nhận được, hãy kiểm tra hòm thư rác hoặc liên hệ Quản trị viên VNC.
        </p>
      </form>
    </AuthLayout>
  );
}
