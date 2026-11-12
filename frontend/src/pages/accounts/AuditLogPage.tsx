import { useState } from 'react';
import { Link } from 'react-router-dom';
import AttendanceShell from '../../components/attendance/AttendanceShell';
import ResourceState from '../../components/attendance/ResourceState';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import useApiResource from '../../hooks/useApiResource';
import { downloadAttendance } from '../../services/attendanceApi';
import { useAuthStore } from '../../store/useAuthStore';
import type { AttendanceOptions, AuditEvent, AuditOptions, PageResult } from '../../types/attendance';
import { attendanceLabel, instant } from '../../utils/attendance';
import { clinicToday, shortDate } from '../../utils/schedule';

export default function AuditLogPage({ history = false }: { history?: boolean }) {
  const base = history ? '/attendance/history' : '/audit-logs';
  const role = useAuthStore(state => state.session?.user.role || '');
  const empty = { from: '', to: '', month: history ? clinicToday().slice(0, 7) : '', module: '', userId: '', action: '', facilityId: '', departmentId: '', staffId: '' };
  const [draft, setDraft] = useState(empty);
  const [query, setQuery] = useState({ ...empty, page: 1, pageSize: 20 });
  const [selected, setSelected] = useState('');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const options = useApiResource<AuditOptions>(`${base}/options`);
  const teams = useApiResource<AttendanceOptions>(history ? '/attendance/options' : '');
  const resource = useApiResource<PageResult<AuditEvent>>(base, query);
  const detail = useApiResource<AuditEvent>(selected ? `${base}/${selected}` : '');
  const canExport = history && ['admin', 'hr_staff', 'hr_manager', 'accountant'].includes(role);
  const facility = (id: string | null) => options.data?.facilities.find(item => item.id === id)?.name || '—';
  async function exportHistory() {
    setExporting(true); setError('');
    try { await downloadAttendance('/attendance/history/export.csv', 'lich-su-cham-cong.csv', query); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không xuất được lịch sử.'); }
    finally { setExporting(false); }
  }
  const content = <>
    {error && <p className="alert error" role="alert">{error}</p>}
    <section className="operations-panel"><form className="operations-filters" onSubmit={event => { event.preventDefault(); setQuery({ ...draft, page: 1, pageSize: query.pageSize }); }}>
      {history && <label htmlFor="history-month">Tháng nghiệp vụ<input id="history-month" type="month" min="2000-01" max="9998-12" value={draft.month} onChange={event => setDraft({ ...draft, month: event.target.value })} /></label>}
      <label htmlFor="audit-from">Sự kiện từ ngày<input id="audit-from" type="date" value={draft.from} onChange={event => setDraft({ ...draft, from: event.target.value })} /></label>
      <label htmlFor="audit-to">Đến ngày<input id="audit-to" type="date" min={draft.from || undefined} value={draft.to} onChange={event => setDraft({ ...draft, to: event.target.value })} /></label>
      <label htmlFor="audit-module">Phân hệ<select id="audit-module" value={draft.module} onChange={event => setDraft({ ...draft, module: event.target.value })}><option value="">Tất cả phân hệ</option>{options.data?.modules.map(item => <option key={item} value={item}>{attendanceLabel(item)}</option>)}</select></label>
      <label htmlFor="audit-actor">Người thao tác<select id="audit-actor" value={draft.userId} onChange={event => setDraft({ ...draft, userId: event.target.value })}><option value="">Tất cả người thao tác</option>{options.data?.users.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label htmlFor="audit-action">Thao tác<select id="audit-action" value={draft.action} onChange={event => setDraft({ ...draft, action: event.target.value })}><option value="">Tất cả thao tác</option>{options.data?.actions.map(item => <option key={item} value={item}>{attendanceLabel(item)}</option>)}</select></label>
      <label htmlFor="audit-facility">Cơ sở<select id="audit-facility" value={draft.facilityId} onChange={event => setDraft({ ...draft, facilityId: event.target.value })}><option value="">Tất cả cơ sở</option>{options.data?.facilities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {history && <><label htmlFor="history-department">Khoa/phòng<select id="history-department" value={draft.departmentId} onChange={event => setDraft({ ...draft, departmentId: event.target.value, staffId: '' })}><option value="">Tất cả khoa/phòng được xem</option>{teams.data?.departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label htmlFor="history-staff">Nhân viên<select id="history-staff" value={draft.staffId} onChange={event => setDraft({ ...draft, staffId: event.target.value })}><option value="">Tất cả nhân viên được xem</option>{teams.data?.staff.filter(item => !draft.departmentId || item.departmentId === draft.departmentId).map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label></>}
      <button type="submit" className="button primary">Áp dụng bộ lọc</button><button type="button" className="button" onClick={() => { setDraft(empty); setQuery({ ...empty, page: 1, pageSize: query.pageSize }); }}>Xóa lọc</button>
    </form>
      <ResourceState loading={resource.loading || options.loading || teams.loading} error={resource.error || options.error || teams.error} reload={() => { resource.reload(); options.reload(); teams.reload(); }} />
      {resource.data && <><DataTable rows={resource.data.items} rowKey={item => item.id} emptyMessage="Không tìm thấy sự kiện phù hợp." columns={[
        { key: 'time', label: 'Thời gian', render: item => <button type="button" className="text-button" onClick={() => setSelected(item.id)}>{instant(item.createdAt)}</button> },
        { key: 'actor', label: 'Người thao tác', render: item => item.actor || 'Hệ thống' },
        { key: 'module', label: 'Phân hệ / thao tác', render: item => <>{attendanceLabel(item.action)}<small className="table-secondary">{attendanceLabel(item.module)}</small></> },
        { key: 'record', label: 'Bản ghi', render: item => <>{item.entityType || '—'}<small className="table-secondary">{item.workDate ? shortDate(item.workDate, true) : item.entityId?.slice(0, 8) || '—'}</small></> },
        { key: 'facility', label: 'Cơ sở', render: item => facility(item.facilityId) },
        { key: 'status', label: 'Trước → sau', render: item => `${attendanceLabel(item.oldStatus)} → ${attendanceLabel(item.newStatus)}` },
        { key: 'result', label: 'Kết quả', render: item => attendanceLabel(item.result) },
        { key: 'details', label: 'Chi tiết', render: item => <button type="button" className="button" onClick={() => setSelected(item.id)}>Xem sự kiện</button> },
      ]} /><Pagination total={resource.data.total} page={resource.data.page} pageSize={resource.data.pageSize} label="sự kiện" onPageChange={page => setQuery({ ...query, page })} onPageSizeChange={pageSize => setQuery({ ...query, pageSize, page: 1 })} /></>}
    </section>
    {selected && <Modal title="Chi tiết sự kiện" onClose={() => setSelected('')} maxWidth="780px"><div className="operations-panel"><ResourceState {...detail} />{detail.data && <>
      <dl className="operations-detail"><div><dt>Thời gian</dt><dd>{instant(detail.data.createdAt)}</dd></div><div><dt>Người thao tác</dt><dd>{detail.data.actor || 'Hệ thống'}</dd></div><div><dt>Thao tác</dt><dd>{attendanceLabel(detail.data.action)}</dd></div><div><dt>Cơ sở</dt><dd>{facility(detail.data.facilityId)}</dd></div><div className="wide"><dt>Mã bản ghi</dt><dd>{detail.data.entityId || '—'}</dd></div></dl>
      <h3>Trước thay đổi</h3><pre className="operations-json">{JSON.stringify(detail.data.oldValue, null, 2) || '—'}</pre>
      <h3>Sau thay đổi</h3><pre className="operations-json">{JSON.stringify(detail.data.newValue, null, 2) || '—'}</pre>
      <p className="operations-note">Thông tin nhạy cảm đã được ẩn. Sự kiện chỉ được xem.</p>
      {detail.data.sourceUrl && <Link className="button" to={detail.data.sourceUrl}>Mở bản ghi nguồn</Link>}
    </>}<div className="form-actions"><button type="button" className="button" onClick={() => setSelected('')}>Đóng</button></div></div></Modal>}
  </>;
  return history ? <AttendanceShell title="Lịch sử chấm công / ca" description="Tra cứu các lần nhập, điều chỉnh, phân công và thay đổi trạng thái đã ghi nhận."
    actions={canExport && <button type="button" className="button" disabled={exporting || resource.loading || !!resource.error} onClick={() => void exportHistory()}>{exporting ? 'Đang xuất…' : 'Xuất lịch sử'}</button>}>{content}</AttendanceShell>
    : <section className="directory-page operations-page"><header className="directory-heading"><div><span className="eyebrow">QUẢN TRỊ HỆ THỐNG</span><h1>Nhật ký hệ thống</h1><p>Tra cứu thay đổi tài khoản và nghiệp vụ đã được ghi nhận.</p></div></header>{content}</section>;
}
