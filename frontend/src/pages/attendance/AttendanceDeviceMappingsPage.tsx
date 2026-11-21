import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AttendanceShell from '../../components/attendance/AttendanceShell';
import ResourceState from '../../components/attendance/ResourceState';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import useApiResource from '../../hooks/useApiResource';
import { ApiError } from '../../services/axiosClient';
import { attendanceDeviceMappingApi, type AttendanceDeviceMapping, type AttendanceDeviceMappingList } from '../../services/attendanceDeviceMappingApi';
import { useAuthStore } from '../../store/useAuthStore';

const deviceKey = (value: string) => /^\d+$/.test(value.trim()) ? value.trim().replace(/^0+/, '') || '0' : value.trim().toUpperCase();
type MappingReview = { employee: AttendanceDeviceMapping; next: string | null; reason: string };

export default function AttendanceDeviceMappingsPage() {
  const manager = useAuthStore(state => state.session?.user.role) === 'hr_staff';
  const [params] = useSearchParams();
  const queryDevice = params.get('deviceId') || '';
  const resource = useApiResource<AttendanceDeviceMappingList>('/attendance/device-mappings');
  const items = resource.data?.items || [];
  const [staffId, setStaffId] = useState('');
  const [device, setDevice] = useState(queryDevice);
  const [reason, setReason] = useState('');
  const [search, setSearch] = useState('');
  const [review, setReview] = useState<MappingReview>();
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selected = items.find(item => item.staffId === staffId);
  const next = device.trim() || null;
  const conflict = next ? items.find(item => item.staffId !== staffId && item.deviceEnrollId && deviceKey(item.deviceEnrollId) === deviceKey(next)) : undefined;
  const unchanged = !!selected && (selected.deviceEnrollId || null) === next;

  useEffect(() => {
    setDevice(queryDevice); setStaffId(''); setReason(''); setReview(undefined); setConfirmed(false); setError('');
  }, [queryDevice]);
  useEffect(() => { setReview(undefined); setConfirmed(false); }, [selected?.version]);

  function choose(value: string) {
    setStaffId(value); setReason(''); setError(''); setNotice(''); setConfirmed(false); setReview(undefined);
    setDevice(queryDevice || items.find(item => item.staffId === value)?.deviceEnrollId || '');
  }
  function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!selected || busy || !manager) return;
    if (device.trim().length > 50 || /[\u0000-\u001f\u007f]/.test(device)) { setError('Mã máy tối đa 50 ký tự và không được chứa ký tự điều khiển.'); return; }
    if (!reason.trim()) { setError('Cần ghi căn cứ xác nhận nhân viên và mã máy.'); return; }
    if (next && (selected.status !== 'active' || !selected.departmentName)) { setError('Chỉ liên kết mã máy cho nhân viên đang hoạt động và đã phân khoa/phòng.'); return; }
    if (conflict || unchanged) return;
    setConfirmed(false); setReview({ employee: selected, next, reason: reason.trim() });
  }
  async function save() {
    if (!review || !confirmed || busy) return;
    setBusy(true); setError('');
    try {
      const result = await attendanceDeviceMappingApi.save(review.employee.staffId, review.next, review.reason, review.employee.version);
      setNotice(result.message); setReview(undefined); setConfirmed(false); setReason(''); resource.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không lưu được liên kết mã máy.');
      if (cause instanceof ApiError && cause.status === 409) { setReview(undefined); setConfirmed(false); resource.reload(); }
    } finally { setBusy(false); }
  }

  return <AttendanceShell title="Liên kết mã máy chấm công" description="Chọn đúng nhân viên và xác nhận mã đăng ký trên máy từ hồ sơ gốc trước khi nhập chấm công."
    actions={<Link className="button" to="/attendance/imports">Lịch sử nhập</Link>}>
    {notice && <p className="alert success" role="status">{notice}</p>}
    {error && !review && <p className="alert error" role="alert">{error}</p>}
    <ResourceState loading={resource.loading} error={resource.error} reload={resource.reload} />
    <section className="operations-panel"><p>Mã nhân viên trong hồ sơ và mã đăng ký trên máy là hai trường riêng. Mỗi mã máy chỉ liên kết với một nhân viên, kể cả hồ sơ ngừng hoạt động. Các mã số như 0001 và 1 được coi là cùng mã.</p>
      <p className="operations-note">Khi chuyển mã sang người khác, cần chọn người đang giữ mã, xác nhận xóa liên kết, rồi chọn người nhận mã và xác nhận liên kết mới. Dữ liệu chấm công đã lưu giữ nguyên nhân viên đã xác nhận.</p>
      {!manager && <p className="operations-note">Bạn có quyền tra cứu. HR Staff thực hiện thay đổi liên kết có căn cứ.</p>}
    </section>
    {manager && <form className="operations-panel operations-form" onSubmit={submit}><fieldset disabled={busy || resource.loading || !!resource.error}>
      <div className="operations-grid"><label htmlFor="mapping-employee">Nhân viên<select id="mapping-employee" required value={staffId} onChange={event => choose(event.target.value)}>
        <option value="">Chọn nhân viên sau khi đối chiếu hồ sơ</option>{items.map(item => <option key={item.staffId} value={item.staffId}>{item.staffCode} · {item.staffName}{item.departmentName ? ` · ${item.departmentName}` : ' · Chưa phân khoa'}{item.status !== 'active' ? ' · Ngừng hoạt động' : ''}</option>)}
      </select></label><label htmlFor="mapping-device">Mã đăng ký trên máy<input id="mapping-device" maxLength={50} value={device} onChange={event => { setDevice(event.target.value); setReview(undefined); setConfirmed(false); }} aria-describedby="mapping-device-help" /></label></div>
      <p id="mapping-device-help" className="operations-note">Để trống mã để xóa liên kết của nhân viên đã chọn. Mã điền từ tệp chỉ là dữ liệu cần đối chiếu; bạn vẫn phải chọn nhân viên.</p>
      {selected && <p>Liên kết hiện tại của <strong>{selected.staffCode} · {selected.staffName}</strong>: <strong>{selected.deviceEnrollId || 'Chưa có mã máy'}</strong>.</p>}
      {conflict && <p className="alert warning" role="alert">Mã này đang thuộc {conflict.staffCode} · {conflict.staffName}. Xác nhận xóa liên kết của người đang giữ mã trước khi chuyển sang nhân viên khác.</p>}
      {selected?.status !== 'active' && selected && <p className="alert warning">Nhân viên đã ngừng hoạt động. Chỉ có thể xóa liên kết hiện tại.</p>}
      <label htmlFor="mapping-reason">Căn cứ xác nhận<textarea id="mapping-reason" required maxLength={1000} value={reason} onChange={event => setReason(event.target.value)} placeholder="Ghi nguồn đối chiếu nhân viên với mã máy, biên bản hoặc xác nhận liên quan" /></label>
      <div className="form-actions"><button className="button" type="button" onClick={resource.reload}>Tải lại danh sách</button><button className="button primary" type="submit" disabled={!selected || !reason.trim() || !!conflict || unchanged}>{next ? 'Kiểm tra liên kết' : 'Kiểm tra xóa liên kết'}</button></div>
    </fieldset></form>}
    {resource.data && <section className="operations-panel"><div className="operations-filters"><label htmlFor="mapping-search">Tìm mã hoặc nhân viên<input id="mapping-search" value={search} onChange={event => setSearch(event.target.value)} /></label></div>
      <DataTable rows={items.filter(item => `${item.staffCode} ${item.staffName} ${item.departmentName || ''} ${item.deviceEnrollId || ''}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')))} rowKey={item => item.staffId} emptyMessage="Không có nhân viên phù hợp." columns={[
        { key: 'staff', label: 'Nhân viên', render: item => <>{item.staffCode}<small className="table-secondary">{item.staffName}</small></> },
        { key: 'department', label: 'Khoa/phòng', render: item => item.departmentName || 'Chưa phân khoa' },
        { key: 'device', label: 'Mã đăng ký trên máy', render: item => item.deviceEnrollId || 'Chưa liên kết' },
        { key: 'status', label: 'Hồ sơ', render: item => item.status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động' },
      ]} />
    </section>}
    {review && <Modal title={review.next ? 'Xác nhận liên kết mã máy' : 'Xác nhận xóa liên kết mã máy'} busy={busy} onClose={() => setReview(undefined)}><div className="operations-panel operations-form">
      <p>Nhân viên: <strong>{review.employee.staffCode} · {review.employee.staffName}</strong></p>
      <p>Mã hiện tại: <strong>{review.employee.deviceEnrollId || 'Chưa liên kết'}</strong><br />Mã sau xác nhận: <strong>{review.next || 'Xóa liên kết'}</strong></p>
      <p>Căn cứ: {review.reason}</p><p>Liên kết được dùng khi kiểm tra lại tệp nhập. Các bản ghi chấm công đã lưu giữ nguyên nhân viên hiện tại.</p>
      <label className="operations-checkbox"><input id="mapping-confirmed" type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} />Tôi đã đối chiếu hồ sơ gốc và xác nhận đúng nhân viên cùng mã máy cần thay đổi hoặc xóa.</label>
      {error && <p className="alert error" role="alert">{error}</p>}
      <div className="form-actions"><button className="button" type="button" disabled={busy} onClick={() => setReview(undefined)}>Đóng</button><button className="button primary" type="button" disabled={busy || !confirmed} onClick={() => void save()}>{busy ? 'Đang lưu…' : 'Xác nhận lưu liên kết'}</button></div>
    </div></Modal>}
  </AttendanceShell>;
}
