import { useState, type FormEvent } from 'react';
import Alert from '../ui/Alert';

export default function DepartmentForm({ initial, onSave, onClose, busy, error }: { initial?: { code: string; name: string; status: string }; onSave: (value: { code: string; name: string; status: string }) => Promise<void>; onClose: () => void; busy: boolean; error: string }) {
  const [code, setCode] = useState(initial?.code || ''); const [name, setName] = useState(initial?.name || ''); const [status, setStatus] = useState(initial?.status || 'active');
  function submit(event: FormEvent) { event.preventDefault(); if (!busy) void onSave({ code: code.trim(), name: name.trim(), status }); }
  return <form onSubmit={submit}><div className="form-section"><div className="form-grid"><div><label htmlFor="department-code">Mã khoa/phòng</label><input id="department-code" required maxLength={20} value={code} onChange={e => setCode(e.target.value)} /></div>
    <div><label htmlFor="department-name">Tên khoa/phòng</label><input id="department-name" required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></div></div>
    {initial && <div className="mt-4"><label htmlFor="department-status">Trạng thái</label><select id="department-status" value={status} onChange={e => setStatus(e.target.value)}><option value="active">Hoạt động</option><option value="inactive">Ngừng hoạt động</option></select></div>}{error && <Alert>{error}</Alert>}</div>
    <div className="form-actions"><button className="button" type="button" disabled={busy} onClick={onClose}>Hủy</button><button className="button primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu khoa/phòng'}</button></div></form>;
}
