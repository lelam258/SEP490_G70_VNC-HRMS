import { useState } from 'react';

export default function SelectOrTextField({ id, label, value, choices, onChange, disabled, placeholder }: {
  id: string; label: string; value: string; choices: string[];
  onChange: (value: string) => void; disabled?: boolean; placeholder?: string;
}) {
  const [custom, setCustom] = useState(false);
  const showCustom = custom || (value !== '' && !choices.includes(value));
  return <div className="schedule-preset-field">
    <label htmlFor={id}>{label}</label>
    <select id={id} required disabled={disabled} value={showCustom ? '__custom__' : value} onChange={event => {
      const selected = event.target.value;
      setCustom(selected === '__custom__');
      onChange(selected === '__custom__' ? '' : selected);
    }}>
      <option value="">Chọn nội dung</option>
      {choices.map(choice => <option key={choice} value={choice}>{choice}</option>)}
      <option value="__custom__">Nội dung khác — tự nhập…</option>
    </select>
    {showCustom && <input id={`${id}-custom`} aria-label={`${label} — nội dung khác`} required disabled={disabled} maxLength={1000} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder || 'Nhập nội dung khác'} />}
  </div>;
}
