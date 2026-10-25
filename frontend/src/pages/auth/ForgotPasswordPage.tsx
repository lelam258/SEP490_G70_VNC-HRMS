import { useState, type FormEvent } from 'react';
import AuthLayout from '../../layouts/AuthLayout';
import Alert from '../../components/ui/Alert';
import { useOtpRecovery } from '../../hooks/useOtpRecovery';

export default function ForgotPasswordPage() {
  const { challenge, send, busy, error, resendSecondsLeft } = useOtpRecovery();
  const [email, setEmail] = useState(challenge?.email || '');
  const cooldown = email.trim().toLowerCase() === challenge?.email.toLowerCase() && resendSecondsLeft > 0;
  function submit(event: FormEvent) { event.preventDefault(); if (!cooldown) void send(email); }
  return <AuthLayout title="Quên mật khẩu?" description="Nhập email của tài khoản để nhận mã OTP đặt lại mật khẩu.">
    <form className="login-form" onSubmit={submit}><div className="auth-field"><label htmlFor="forgot-email">Email của tài khoản</label>
      <input id="forgot-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required maxLength={100} /></div>
      {error && <Alert>{error}</Alert>}
      <button className="button primary login-submit" disabled={busy || cooldown}>{busy ? 'Đang gửi…' : cooldown ? `Gửi lại sau ${resendSecondsLeft}s` : 'Gửi mã OTP'}</button>
    </form><p className="login-help">OTP chỉ gửi tới email khớp tài khoản đang hoạt động. Nếu không nhận được, kiểm tra thư rác hoặc liên hệ quản trị viên.</p>
  </AuthLayout>;
}
