import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../services/axiosClient';
import { authApi } from '../services/authApi';
import { useRecoveryStore } from '../store/useRecoveryStore';

export function useOtpRecovery() {
  const challenge = useRecoveryStore(state => state.challenge);
  const setChallenge = useRecoveryStore(state => state.setChallenge);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const navigate = useNavigate();
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  async function send(email: string) {
    if (busy) return false;
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await authApi.forgotPassword(email.trim());
      setChallenge({ ...result, email: email.trim(), resendAvailableAt: Date.now() + 30_000 });
      setNow(Date.now()); setNotice(result.message); navigate('/reset-password', { replace: true }); return true;
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 429 ? 'Bạn đã yêu cầu OTP quá nhiều lần. Vui lòng chờ tối đa 15 phút rồi thử lại.'
        : cause instanceof Error ? cause.message : 'Chưa gửi được OTP. Vui lòng thử lại.'); return false;
    } finally { setBusy(false); }
  }
  return { challenge, send, busy, error, notice, setError, setNotice,
    secondsLeft: Math.max(0, Math.ceil(((challenge ? Date.parse(challenge.expiresAt) : 0) - now) / 1000)),
    resendSecondsLeft: Math.max(0, Math.ceil(((challenge?.resendAvailableAt || 0) - now) / 1000)) };
}
