import { useState } from 'react';
import Icon from './Icon';

export default function PasswordInput({ id, label, value, onChange, newPassword = false }: {
  id: string; label: string; value: string; onChange: (value: string) => void; newPassword?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return <div className="auth-field"><label htmlFor={id}>{label}</label><div className="input-icon"><Icon name="lock" />
    <input id={id} type={visible ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} required
      autoComplete={newPassword ? 'new-password' : 'current-password'} minLength={newPassword ? 6 : undefined} maxLength={128} />
    <button type="button" className="icon-button" aria-label={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} aria-pressed={visible} onClick={() => setVisible(!visible)}><Icon name="eye" /></button>
  </div></div>;
}
