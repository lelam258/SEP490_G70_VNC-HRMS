import { useState, type FormEvent } from 'react';
import Modal from '../ui/Modal';
import { attendanceApi } from '../../services/attendanceApi';
import type { AttendanceOptions, ImportRow } from '../../types/attendance';
import { clockTime, monthEnd } from '../../utils/attendance';

export default function ImportRowCorrection({ importId, row, month, options, onClose, onSaved }: {
  importId: string; row: ImportRow; month: string; options: AttendanceOptions; onClose: () => void; onSaved: (message: string) => void;
}) {
  const [staffId, setStaff] = useState(row.staffId || ''); const [date, setDate] = useState(row.workDate || `${month}-01`);
  const [shift, setShift] = useState(['main', 'noon', 'evening'].includes(row.shiftType) ? row.shiftType : 'main');
  const [pairs, setPairs] = useState(Array.from({ length: 3 }, (_, index) => ({ in: row.pairs[index]?.in ? clockTime(row.pairs[index].in) : '', out: row.pairs[index]?.out ? clockTime(row.pairs[index].out) : '' })));
  const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  async function save(event: FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try { const result = await attendanceApi.correct(importId, row.id, { staffId, workDate: date, shiftType: shift,
      pairs: pairs.filter(pair => pair.in || pair.out), reason: reason.trim(), version: row.version }); onSaved(result.message); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không sửa được dòng nhập.'); }
    finally { setBusy(false); }
  }
  return <Modal title={`Điều chỉnh dòng ${row.rowNumber} · ${row.sheetName}`} busy={busy} onClose={onClose} maxWidth="740px"><form className="operations-panel operations-form" onSubmit={event => void save(event)}><fieldset disabled={busy}>
    <p>Mã máy gốc: <strong>{row.deviceEnrollId || 'Chưa có'}</strong> · Ngày gốc: {row.rawDate || 'Chưa có'}</p>
    <p className="operations-note">Điều chỉnh được lưu cùng lý do, người thực hiện và thời điểm. Tệp gốc và bản ghi chấm công đã lưu được giữ lại.</p>
    {error && <p className="alert error" role="alert">{error}</p>}
    <div className="operations-grid"><label htmlFor="correction-staff">Nhân viên xác nhận<select id="correction-staff" value={staffId} required onChange={event => setStaff(event.target.value)}><option value="">Chọn đúng nhân viên</option>{options.staff.filter(item => item.status === 'active').map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
      <label htmlFor="correction-date">Ngày công<input id="correction-date" type="date" required min={`${month}-01`} max={monthEnd(month)} value={date} onChange={event => setDate(event.target.value)} /></label>
      <label htmlFor="correction-shift">Ca<select id="correction-shift" value={shift} onChange={event => setShift(event.target.value)}><option value="main">Ca chính</option><option value="noon">Trực trưa</option><option value="evening">Trực tối</option></select></label>
    </div>
    <div className="operations-pairs">{pairs.map((pair, index) => <div className="operations-pair" key={index}><span>Lần {index + 1}</span><label>Vào<input aria-label={`Vào lần ${index + 1}`} type="time" required={index === 0 || !!pair.in || !!pair.out} value={pair.in} onChange={event => setPairs(current => current.map((value, i) => i === index ? { ...value, in: event.target.value } : value))} /></label><label>Ra<input aria-label={`Ra lần ${index + 1}`} type="time" required={index === 0 || !!pair.in || !!pair.out} value={pair.out} onChange={event => setPairs(current => current.map((value, i) => i === index ? { ...value, out: event.target.value } : value))} /></label></div>)}</div>
    <label htmlFor="correction-reason">Lý do / căn cứ điều chỉnh<textarea id="correction-reason" required maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} /></label>
    <div className="form-actions"><button className="button" type="button" disabled={busy} onClick={onClose}>Đóng</button><button className="button primary" type="submit" disabled={busy || !reason.trim()}>{busy ? 'Đang kiểm tra…' : 'Lưu và kiểm tra lại'}</button></div>
  </fieldset></form></Modal>;
}
