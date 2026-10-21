import { useState, type FormEvent } from 'react';
import Alert from '../ui/Alert';

export default function DepartmentForm({ onSave, onClose, busy, error }: { onSave: (value: { code: string; name: string }) => Promise<void>; onClose: () => void; busy: boolean; error: string }) {
  const [code, setCode] = useState(''); const [name, setName] = useState('');
  function submit(event: FormEvent) { event.preventDefault(); if (!busy) void onSave({ code: code.trim(), name: name.trim() }); }
  return <form onSubmit={submit}><div className="form-section"><div className="form-grid"><div><label htmlFor="department-code">Mã khoa/phòng</label><input id="department-code" required maxLength={20} value={code} onChange={e => setCode(e.target.value)} /></div>
    <div><label htmlFor="department-name">Tên khoa/phòng</label><input id="department-name" required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></div></div>{error && <Alert>{error}</Alert>}</div>
    <div className="form-actions"><button className="button" type="button" disabled={busy} onClick={onClose}>Hủy</button><button className="button primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu khoa/phòng'}</button></div></form>;
}
