import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import AuthLayout from '../../layouts/AuthLayout';
import Alert from '../../components/ui/Alert';
import PasswordInput from '../../components/ui/PasswordInput';
import { useOtpRecovery } from '../../hooks/useOtpRecovery';
import { authApi } from '../../services/authApi';
import { useAppStore } from '../../store/useAppStore';
import { useRecoveryStore } from '../../store/useRecoveryStore';
import { isStrongPassword, passwordHint } from '../../utils/password';

export default function ResetPasswordPage() {
  const { challenge, send, busy: sending, error, notice, setError, secondsLeft, resendSecondsLeft } = useOtpRecovery();
  const [otp, setOtp] = useState(''); const [password, setPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false); const navigate = useNavigate(); const busy = sending || saving;
  if (!challenge) return <Navigate to="/forgot-password" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !challenge || secondsLeft <= 0) return; setError('');
    if (!isStrongPassword(password)) { setError(`Mật khẩu cần ${passwordHint}`); return; }
    if (password !== confirmation) { setError('Mật khẩu xác nhận không khớp.'); return; }
    setSaving(true);
    try {
      const result = await authApi.resetPassword(challenge.challengeId, otp, password);
      useRecoveryStore.getState().setChallenge(null); useAppStore.getState().setNotice(result.message);
      navigate('/login', { replace: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không đặt lại được mật khẩu.'); }
    finally { setSaving(false); }
  }
  return <AuthLayout title="Đặt lại mật khẩu" description="Nhập OTP trong email và tạo mật khẩu mới cho tài khoản.">
    <form className="login-form" onSubmit={submit}>
      <div className="auth-field"><label htmlFor="reset-otp">Mã OTP</label><input id="reset-otp" className="auth-otp" inputMode="numeric" autoComplete="one-time-code"
        pattern={`[0-9]{${challenge.otpLength}}`} maxLength={challenge.otpLength} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} required />
        <p className="field-hint">Email: {challenge.email}. Còn {Math.floor(secondsLeft / 60)}:{(secondsLeft % 60).toString().padStart(2, '0')} · Tối đa {challenge.maxAttempts} lần nhập.</p></div>
      <PasswordInput id="reset-password" label="Mật khẩu mới" value={password} onChange={setPassword} newPassword />
      <p className="field-hint">{passwordHint}</p>
      <PasswordInput id="reset-confirmation" label="Xác nhận mật khẩu" value={confirmation} onChange={setConfirmation} newPassword />
      {(error || secondsLeft <= 0) && <Alert>{error || 'OTP đã hết hạn. Vui lòng yêu cầu mã mới.'}</Alert>}
      {(notice || challenge.message) && <Alert variant="success">{notice || challenge.message}</Alert>}
      <button className="button primary login-submit" disabled={busy || secondsLeft <= 0}>{saving ? 'Đang lưu…' : 'Lưu mật khẩu mới'}</button>
      <button className="text-button auth-request-new" type="button" disabled={busy || resendSecondsLeft > 0} onClick={async () => { if (await send(challenge.email)) setOtp(''); }}>
        {sending ? 'Đang gửi…' : resendSecondsLeft > 0 ? `Gửi lại OTP sau ${resendSecondsLeft}s` : 'Gửi lại OTP'}</button>
      <Link className="text-button" to="/forgot-password">Đổi email nhận OTP</Link>
    </form>
  </AuthLayout>;
}
