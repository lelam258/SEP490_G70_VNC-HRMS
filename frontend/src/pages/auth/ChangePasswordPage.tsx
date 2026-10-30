import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import PasswordInput from '../../components/ui/PasswordInput';
import Alert from '../../components/ui/Alert';
import Icon from '../../components/ui/Icon';
import { authApi } from '../../services/authApi';
import { useAppStore } from '../../store/useAppStore';
import { isStrongPassword, passwordHint } from '../../utils/password';

export default function ChangePasswordPage() {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const checklist = [
    { label: 'Tối thiểu 6 ký tự', valid: password.length >= 6 },
    { label: 'Có chữ hoa (A-Z)', valid: /[A-Z]/.test(password) },
    { label: 'Có chữ thường (a-z)', valid: /[a-z]/.test(password) },
    { label: 'Có chữ số (0-9)', valid: /[0-9]/.test(password) },
  ];

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');

    if (!current) {
      setError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (!isStrongPassword(password)) {
      setError(`Mật khẩu cần ${passwordHint}`);
      return;
    }
    if (password !== confirmation) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setBusy(true);
    try {
      await authApi.changePassword(current, password);
      useAppStore.getState().setNotice('Đổi mật khẩu thành công. Vui lòng đăng nhập lại.');
      navigate('/login', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không đổi được mật khẩu.');
    } finally {
      setBusy(false);
    }
  }

  const isFormValid = current.trim().length > 0 && password.length >= 6 && password === confirmation;

  return (
    <section style={{ padding: '0.5rem 1rem' }}>
      <div className="change-password-card">
        {/* Header with Security Shield Icon */}
        <div className="change-password-header">
          <div className="change-password-icon-box" aria-hidden="true">
            <Icon name="shield" size={24} />
          </div>
          <div className="change-password-header-text">
            <h1>Đổi mật khẩu</h1>
            
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={submit}>
          <div className="change-password-body">
            {error && <Alert variant="error">{error}</Alert>}

            <PasswordInput
              id="current-password"
              label="Mật khẩu hiện tại"
              value={current}
              onChange={setCurrent}
            />

            <div>
              <PasswordInput
                id="new-password"
                label="Mật khẩu mới"
                value={password}
                onChange={setPassword}
                newPassword
              />

              {/* Dynamic Password Checklist */}
              <div className="password-checklist-box" style={{ marginTop: '0.625rem' }}>
                <div className="password-checklist-title">
                  <span>Yêu cầu mật khẩu an toàn:</span>
                </div>
                <div className="password-checklist-grid">
                  {checklist.map((item, idx) => (
                    <div
                      key={idx}
                      className={`password-checklist-item ${item.valid ? 'valid' : ''}`}
                    >
                      <span className="checklist-icon">
                        {item.valid ? '✓' : '○'}
                      </span>
                      <span>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <PasswordInput
                id="confirm-password"
                label="Xác nhận mật khẩu mới"
                value={confirmation}
                onChange={setConfirmation}
                newPassword
              />
              {confirmation.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    marginTop: '6px',
                    fontWeight: 500,
                    color: password === confirmation ? '#15803d' : '#dc2626',
                  }}
                >
                  <span>{password === confirmation ? '✓' : '✕'}</span>
                  <span>
                    {password === confirmation
                      ? 'Mật khẩu xác nhận trùng khớp'
                      : 'Mật khẩu xác nhận chưa khớp'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="change-password-footer">
            <button
              type="button"
              className="button secondary"
              disabled={busy}
              onClick={() => navigate('/')}
            >
              <Icon name="arrow" /> Quay lại
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={busy || !isFormValid}
              style={{ minWidth: '145px' }}
            >
              {busy ? (
                <>
                  <span className="vnc-spinner" /> Đang lưu…
                </>
              ) : (
                <>
                  <Icon name="lock" /> Đổi mật khẩu
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
