import { useState, type FormEvent } from 'react';
import type { EmployeeInput } from '../../services/employeeApi';
import type { Department } from '../../services/departmentApi';
import Alert from '../ui/Alert';

export default function EmployeeForm({ departments, onSave, onClose, busy, error }: { departments: Department[]; onSave: (value: EmployeeInput) => Promise<void>; onClose: () => void; busy: boolean; error: string }) {
  const [code, setCode] = useState(''); const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [departmentId, setDepartmentId] = useState('');
  function submit(event: FormEvent) { event.preventDefault(); if (!busy) void onSave({ code: code.trim(), name: name.trim(), email: email.trim() || null, departmentId: departmentId || null }); }
  return <form onSubmit={submit}><div className="form-section"><div className="form-grid"><div><label htmlFor="employee-code">Mã nhân viên</label><input id="employee-code" required maxLength={20} value={code} onChange={e => setCode(e.target.value)} /></div>
    <div><label htmlFor="employee-name">Họ tên</label><input id="employee-name" required maxLength={100} value={name} onChange={e => setName(e.target.value)} /></div></div>
    <div className="form-grid"><div><label htmlFor="employee-email">Email</label><input id="employee-email" type="email" maxLength={100} value={email} onChange={e => setEmail(e.target.value)} /></div>
    <div><label htmlFor="employee-department">Khoa/phòng</label><select id="employee-department" value={departmentId} onChange={e => setDepartmentId(e.target.value)}><option value="">Chưa phân khoa</option>{departments.filter(d => d.status === 'active').map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></div></div>{error && <Alert>{error}</Alert>}</div>
    <div className="form-actions"><button className="button" type="button" disabled={busy} onClick={onClose}>Hủy</button><button className="button primary" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu hồ sơ'}</button></div></form>;
}
