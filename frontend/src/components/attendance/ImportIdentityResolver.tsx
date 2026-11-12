import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../ui/Modal';
import ResourceState from './ResourceState';
import useApiResource from '../../hooks/useApiResource';
import { attendanceDeviceMappingApi, type AttendanceDeviceMapping, type AttendanceDeviceMappingList } from '../../services/attendanceDeviceMappingApi';
import { ApiError } from '../../services/axiosClient';
import type { ImportIdentity } from '../../types/attendance';

const key = (value: string) => /^\d+$/.test(value.trim()) ? value.trim().replace(/^0+/, '') || '0' : value.trim().toUpperCase();
type Review = { person: AttendanceDeviceMapping; code: ImportIdentity; reason: string };

export default function ImportIdentityResolver({ identities, busy, onSaved }: {
  identities: ImportIdentity[]; busy: boolean; onSaved: () => void;
}) {
  const pending = identities.filter(item => item.status !== 'mapped' && item.deviceEnrollId);
  const resource = useApiResource<AttendanceDeviceMappingList>(pending.length ? '/attendance/device-mappings' : '');
  const [code, setCode] = useState(''); const [staffId, setStaff] = useState(''); const [reason, setReason] = useState('');
  const [review, setReview] = useState<Review>(); const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const alive = useRef(true);
  const selectedCode = pending.find(item => item.deviceEnrollId === code) || pending[0];
  const selected = resource.data?.items.find(item => item.staffId === staffId);
  const conflict = resource.data?.items.find(item => item.staffId !== staffId && item.deviceEnrollId && selectedCode && key(item.deviceEnrollId) === key(selectedCode.deviceEnrollId));
  const alreadyMapped = !!selected?.deviceEnrollId && !!selectedCode && key(selected.deviceEnrollId) === key(selectedCode.deviceEnrollId);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { setStaff(''); setReason(''); setReview(undefined); setConfirmed(false); setError(''); }, [selectedCode?.deviceEnrollId]);
  useEffect(() => { setReview(undefined); setConfirmed(false); }, [selected?.version]);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected || !selectedCode || busy || saving || conflict || alreadyMapped || !reason.trim()) return;
    setError(''); setConfirmed(false); setReview({ person: selected, code: selectedCode, reason: reason.trim() });
  }
  async function save() {
    if (!review || !confirmed || saving || busy) return;
    setSaving(true); setError('');
    try {
      await attendanceDeviceMappingApi.save(review.person.staffId, review.code.deviceEnrollId, review.reason, review.person.version);
      if (!alive.current) return;
      setReview(undefined); setConfirmed(false); setStaff(''); setReason('');
      setNotice(`Đã liên kết mã ${review.code.deviceEnrollId}. Đang kiểm tra lại ${review.code.rowCount} dòng của mã này.`);
      resource.reload(); onSaved();
    } catch (cause) {
      if (!alive.current) return;
      setError(cause instanceof Error ? cause.message : 'Không liên kết được mã máy.');
      if (cause instanceof ApiError && cause.status === 409) { setReview(undefined); setConfirmed(false); resource.reload(); }
    } finally { if (alive.current) setSaving(false); }
  }
  return <section id="import-identity-resolver" className="operations-panel operations-form" aria-labelledby="import-identity-title">
    <h2 id="import-identity-title">1. Liên kết mã máy với nhân viên</h2>
    <p>Mỗi mã chỉ cần đối chiếu một lần cho toàn bộ ngày công của người đó. Hệ thống không tự chọn nhân viên theo tên trong tệp.</p>
    <p className="operations-note">Nếu chưa có hồ sơ nhân viên phù hợp, HR Manager cần bổ sung hồ sơ trước. Không chọn nhân viên khác chỉ để hết cảnh báo.</p>
    {notice && <p className="alert success" role="status">{notice}</p>}
    {error && !review && <p className="alert error" role="alert">{error}</p>}
    {!pending.length ? <p className="alert success">Các mã có thể liên kết đã được xử lý.</p> : <>
      <ResourceState {...resource} />
      <form onSubmit={submit}><fieldset disabled={busy || saving || resource.loading || !!resource.error}>
        <div className="operations-grid">
          <label htmlFor="analysis-device-code">Mã cần đối chiếu<select id="analysis-device-code" value={selectedCode?.deviceEnrollId || ''} onChange={event => setCode(event.target.value)}>{pending.map(item => <option key={item.deviceEnrollId} value={item.deviceEnrollId}>{item.deviceEnrollId} · {item.rowCount} dòng{item.status === 'ambiguous' ? ' · Đang trùng liên kết' : ''}</option>)}</select></label>
          <label htmlFor="analysis-mapping-employee">Nhân viên trong hệ thống<select id="analysis-mapping-employee" required value={staffId} onChange={event => { setStaff(event.target.value); setError(''); }}><option value="">Chọn nhân viên sau khi đối chiếu hồ sơ</option>{resource.data?.items.filter(item => item.status === 'active').map(item => <option key={item.staffId} value={item.staffId}>{item.staffCode} · {item.staffName}{item.departmentName ? ` · ${item.departmentName}` : ' · Chưa phân khoa'}</option>)}</select></label>
        </div>
        {!!selectedCode?.sourceLabels.length && <div className="operations-note"><strong>Thông tin nguyên văn trên tệp:</strong>{selectedCode.sourceLabels.map(label => <p key={label}>{label}</p>)}</div>}
        {selected?.deviceEnrollId && <p className="operations-note">Mã hiện tại của nhân viên đã chọn: <strong>{selected.deviceEnrollId}</strong>. Hãy kiểm tra trước khi thay đổi liên kết.</p>}
        {conflict && <p className="alert warning">Mã này đang được liên kết với {conflict.staffCode} · {conflict.staffName}. Cần đối chiếu và xử lý liên kết hiện có tại <Link to={`/attendance/device-mappings?deviceId=${encodeURIComponent(selectedCode?.deviceEnrollId || '')}`}>danh sách mã máy</Link> trước khi gán lại.</p>}
        {alreadyMapped && <p className="operations-note">Mã này đã thuộc nhân viên được chọn. <button className="button" type="button" onClick={onSaved}>Kiểm tra lại kết quả</button></p>}
        <label htmlFor="analysis-mapping-reason">Căn cứ xác nhận<textarea id="analysis-mapping-reason" required maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} placeholder="Ví dụ: Đối chiếu danh sách đăng ký trên máy và hồ sơ nhân viên" /></label>
        <button id="review-analysis-mapping" className="button primary" type="submit" disabled={!selected || !reason.trim() || !!conflict || alreadyMapped}>Kiểm tra liên kết {selectedCode?.rowCount || 0} dòng</button>
      </fieldset></form>
    </>}
    {review && <Modal title="Xác nhận nhân viên và mã máy" busy={saving} onClose={() => setReview(undefined)}><div className="operations-panel operations-form">
      <p>Liên kết mã <strong>{review.code.deviceEnrollId}</strong> với <strong>{review.person.staffCode} · {review.person.staffName}</strong> để kiểm tra lại <strong>{review.code.rowCount} dòng</strong> trong tệp.</p>
      <p>Mã hiện tại của nhân viên: {review.person.deviceEnrollId || 'Chưa liên kết'}. Căn cứ: {review.reason}</p>
      <p>Thay đổi có lịch sử thao tác. Bản ghi chấm công đã lưu giữ nguyên nhân viên hiện tại.</p>
      <label className="operations-checkbox"><input id="analysis-mapping-confirmed" type="checkbox" checked={confirmed} disabled={saving} onChange={event => setConfirmed(event.target.checked)} />Tôi đã đối chiếu hồ sơ và xác nhận đúng nhân viên cho mã máy này.</label>
      {error && <p className="alert error" role="alert">{error}</p>}
      <div className="form-actions"><button className="button" type="button" disabled={saving} onClick={() => setReview(undefined)}>Đóng</button><button id="save-analysis-mapping" className="button primary" type="button" disabled={saving || !confirmed} onClick={() => void save()}>{saving ? 'Đang lưu…' : 'Xác nhận và kiểm tra lại tệp'}</button></div>
    </div></Modal>}
  </section>;
}
