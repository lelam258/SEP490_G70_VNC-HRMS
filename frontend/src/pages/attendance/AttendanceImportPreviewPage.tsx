import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import AttendanceShell from '../../components/attendance/AttendanceShell';
import ResourceState from '../../components/attendance/ResourceState';
import ImportRowCorrection from '../../components/attendance/ImportRowCorrection';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import useApiResource from '../../hooks/useApiResource';
import { attendanceApi, downloadAttendance } from '../../services/attendanceApi';
import { ApiError } from '../../services/axiosClient';
import { useAuthStore } from '../../store/useAuthStore';
import type { AttendanceOptions, ImportPreview, ImportRow } from '../../types/attendance';
import { attendanceLabel, clockTime, instant } from '../../utils/attendance';
import { shortDate } from '../../utils/schedule';

const issueLabels: Record<string, string> = { closed_period: 'Kỳ đã khóa / hết hạn', future_time: 'Giờ thực tế tương lai', unknown_device: 'Mã máy chưa khớp', ambiguous_device: 'Mã máy bị trùng', malformed_date: 'Ngày sai / chưa rõ định dạng', invalid_time: 'Thiếu/sai giờ', repeated_time_pairs: 'Máy lặp cặp Vào/Ra', cross_month: 'Khác tháng', existing_record: 'Trùng bản ghi đã lưu', duplicate_file: 'Trùng trong tệp', facility_conflict: 'Khác cơ sở', shift_conflict: 'Không khớp ca đã công bố', leave_conflict: 'Trùng nghỉ phép', needs_reconciliation: 'Cần đối chiếu', inactive_staff: 'Nhân viên/khoa không hoạt động', future_date: 'Ngày tương lai', employment_dates: 'Ngoài thời gian công tác', invalid_shift: 'Ca không hợp lệ', inactive_facility: 'Cơ sở ngừng hoạt động' };
export default function AttendanceImportPreviewPage({ errors = false }: { errors?: boolean }) {
  const { id = '' } = useParams(); const location = useLocation();
  const role = useAuthStore(state => state.session?.user.role); const manager = role === 'hr_staff';
  const [status, setStatus] = useState(''); const [errorCode, setErrorCode] = useState(''); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(20);
  const [row, setRow] = useState<ImportRow>(); const [inspect, setInspect] = useState<ImportRow>();
  const [exclude, setExclude] = useState<ImportRow>(); const [excludeReason, setExcludeReason] = useState('');
  const [confirm, setConfirm] = useState(false); const [mappingConfirmed, setMappingConfirmed] = useState(false); const [includeWarnings, setIncludeWarnings] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState<string>(location.state?.notice || '');
  const options = useApiResource<AttendanceOptions>('/attendance/options');
  const resource = useApiResource<ImportPreview>(`/attendance/imports/${id}`, { status: errors ? status || 'issues' : status, errorCode, page, pageSize });
  const data = resource.data;
  useEffect(() => { setRow(undefined); setInspect(undefined); setExclude(undefined); setConfirm(false); setMappingConfirmed(false); setIncludeWarnings(false); setPage(1); setStatus(''); setErrorCode(''); }, [id, errors]);
  useEffect(() => { setMappingConfirmed(false); setConfirm(false); }, [data?.version]);
  const eligible = data ? data.counts.valid + (includeWarnings ? data.counts.warning : 0) : 0;
  async function commit() {
    if (!data || busy || !mappingConfirmed) return;
    setBusy(true); setError('');
    try { const result = await attendanceApi.commit(id, data.version, includeWarnings); setConfirm(false); setNotice(result.message); resource.reload(); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không lưu được đợt nhập.');
      if (cause instanceof ApiError && (cause.status === 409 || cause.status === 400)) { setConfirm(false); setMappingConfirmed(false); resource.reload(); }
    }
    finally { setBusy(false); }
  }
  async function download(kind: 'source' | 'errors.csv') {
    if (!data) return;
    setError('');
    try { await downloadAttendance(`/attendance/imports/${id}/${kind}`, kind === 'source' ? data.batch.fileName : 'loi-cham-cong-da-an-danh.csv'); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được tệp.'); }
  }
  async function excludeRow() {
    if (!exclude || busy || !excludeReason.trim()) return;
    setBusy(true); setError('');
    try { const result = await attendanceApi.exclude(id, exclude.id, excludeReason.trim(), exclude.version); setExclude(undefined); setNotice(result.message); resource.reload(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không loại được dòng nhập.'); }
    finally { setBusy(false); }
  }
  return <AttendanceShell title={errors ? 'Kết quả lỗi nhập chấm công' : 'Xem trước nhập chấm công'} description={errors ? 'Kiểm tra từng lỗi, xác nhận nhân viên và bổ sung căn cứ điều chỉnh.' : 'Kiểm tra nguồn, ánh xạ nhân viên và các cặp vào/ra trước khi lưu dữ liệu.'}
    actions={<><Link className="button" to="/attendance/imports">Lịch sử nhập</Link><Link className="button" to={`/attendance/imports/${id}/${errors ? 'preview' : 'errors'}`}>{errors ? 'Xem trước tất cả' : 'Xem kết quả lỗi'}</Link></>}>
    {notice && <p className="alert success" role="status">{notice}</p>}{error && <p className="alert error" role="alert">{error}</p>}
    <ResourceState loading={resource.loading || options.loading} error={resource.error || options.error} reload={() => { resource.reload(); options.reload(); }} />
    {data && <><section className="operations-panel"><h2>{data.batch.fileName}</h2><p>{data.batch.payMonth} · {options.data?.facilities.find(item => item.id === data.batch.facilityId)?.name || '—'} · {data.batch.deviceSource || 'Máy chấm công'} · {instant(data.batch.importDate)}</p>
      <p className="operations-note">Định dạng ngày nguồn: {data.batch.dateOrder === 'mdy' ? 'Tháng / ngày / năm' : data.batch.dateOrder === 'dmy' ? 'Ngày / tháng / năm' : 'Tự nhận diện; ngày không đủ căn cứ được giữ trong kết quả lỗi'}. Giờ tính là thời lượng chấm công, chưa phải giờ được trả lương.</p>
      <div className="operations-stats"><span><strong>{data.employeeBlocks}</strong>khối/mã nhân viên</span>{Object.entries(data.counts).map(([key, count]) => <span key={key}><strong>{count}</strong>{attendanceLabel(key)}</span>)}</div>
      {data.lockedReason && <p className="alert warning">{data.lockedReason}</p>}
      <div className="operations-actions"><button className="button" type="button" disabled={busy} onClick={() => resource.reload()}>Tải lại kết quả</button>{data.sourceAvailable && <button className="button" type="button" onClick={() => void download('source')}>Tải tệp gốc</button>}<button className="button" type="button" onClick={() => void download('errors.csv')}>Xuất báo cáo lỗi ẩn danh</button></div>
      {manager && !data.lockedReason && <><label className="operations-checkbox"><input type="checkbox" checked={includeWarnings} onChange={event => setIncludeWarnings(event.target.checked)} />Lưu thêm dòng cảnh báo vào hàng chờ đối chiếu. Các dòng này vẫn chưa được xác nhận.</label><button className="button primary" type="button" disabled={busy || !eligible} onClick={() => { setError(''); setMappingConfirmed(false); setConfirm(true); }}>Lưu {eligible} dòng đủ điều kiện</button></>}
    </section><section className="operations-panel"><div className="operations-filters"><label htmlFor="import-row-status">Trạng thái<select id="import-row-status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">{errors ? 'Tất cả lỗi / cảnh báo / trùng' : 'Tất cả dòng'}</option>{(errors ? ['error', 'warning', 'duplicate', 'excluded'] : ['valid', 'warning', 'error', 'duplicate', 'excluded', 'committed']).map(item => <option key={item} value={item}>{attendanceLabel(item)}</option>)}</select></label><label htmlFor="import-row-issue">Loại vấn đề<select id="import-row-issue" value={errorCode} onChange={event => { setErrorCode(event.target.value); setPage(1); }}><option value="">Tất cả vấn đề</option>{Object.entries(issueLabels).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label></div>
      <DataTable rows={data.items} rowKey={item => item.id} emptyMessage="Không có dòng phù hợp với bộ lọc." columns={[
        { key: 'row', label: 'Dòng nguồn', render: item => <>{item.sheetName} · {item.rowNumber}<small className="table-secondary">Mã máy: {item.deviceEnrollId || 'Chưa có'}</small></> },
        { key: 'staff', label: 'Nhân viên', render: item => item.staffName || 'Chưa xác định' },
        { key: 'date', label: 'Ngày / ca', render: item => <>{item.workDate ? shortDate(item.workDate, true) : item.rawDate || 'Ngày thiếu'}<small className="table-secondary">{attendanceLabel(item.shiftType)}</small></> },
        { key: 'times', label: 'Vào / ra', render: item => item.pairs.length ? item.pairs.map((pair, index) => <div key={index}>{clockTime(pair.in)} – {clockTime(pair.out)}</div>) : 'Thiếu giờ' },
        { key: 'hours', label: 'Giờ tính / giờ máy', render: item => `${item.actualHours ?? '—'} / ${item.reportedHours ?? '—'}` },
        { key: 'minutes', label: 'Muộn / sớm (phút)', render: item => <>{item.lateMinutes ?? '—'} / {item.earlyMinutes ?? '—'}<small className="table-secondary">Ký hiệu: {item.attendanceSymbol || '—'}</small></> },
        { key: 'status', label: 'Kiểm tra', render: item => <>{attendanceLabel(item.validationStatus)}<small className="table-secondary">{item.validationNote}</small></> },
        { key: 'actions', label: 'Thao tác', render: item => <div className="operations-actions"><button className="button" type="button" onClick={() => setInspect(item)}>Dữ liệu gốc</button>{manager && !data.lockedReason && !item.attendanceId && <><button className="button" type="button" disabled={!options.data || busy} onClick={() => setRow(item)}>{item.validationStatus === 'excluded' ? 'Khôi phục / điều chỉnh' : 'Điều chỉnh'}</button>{item.validationStatus !== 'excluded' && <button className="button" type="button" disabled={busy} onClick={() => { setError(''); setExcludeReason(''); setExclude(item); }}>Loại dòng</button>}</>}{item.attendanceId && <Link className="button" to={`/attendance/records/${item.attendanceId}`}>Bản ghi</Link>}</div> },
      ]} /><Pagination total={data.total} page={data.page} pageSize={data.pageSize} label="dòng nhập" onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} />
    </section></>}
    {row && data && options.data && <ImportRowCorrection key={`${row.id}-${row.version}`} importId={id} row={row} month={data.batch.payMonth} options={options.data} onClose={() => setRow(undefined)} onSaved={message => { setRow(undefined); setNotice(message); resource.reload(); }} />}
    {inspect && <Modal title={`Dữ liệu gốc · Dòng ${inspect.rowNumber}`} onClose={() => setInspect(undefined)} maxWidth="760px"><div className="operations-panel"><p>{inspect.employeeBlock || 'Tệp dạng danh sách nhân viên'}</p><p>Mã máy: {inspect.deviceEnrollId || '—'} · Ngày gốc: {inspect.rawDate || '—'}</p><pre className="operations-json">{JSON.stringify(inspect.rawValues, null, 2)}</pre>{inspect.correctionReason && <p>Căn cứ điều chỉnh: {inspect.correctionReason} · {instant(inspect.correctedAt)}</p>}<button className="button" type="button" onClick={() => setInspect(undefined)}>Đóng</button></div></Modal>}
    {exclude && <Modal title={`Loại dòng ${exclude.rowNumber} khỏi đợt nhập`} busy={busy} onClose={() => setExclude(undefined)}><div className="operations-panel operations-form"><p>Dòng này sẽ không được lưu vào chấm công. Dữ liệu gốc và lịch sử thao tác được giữ lại; các dòng trùng còn lại sẽ được kiểm tra lại.</p><label htmlFor="exclude-import-reason">Lý do loại dòng<textarea id="exclude-import-reason" required maxLength={1000} disabled={busy} value={excludeReason} onChange={event => setExcludeReason(event.target.value)} /></label>{error && <p className="alert error" role="alert">{error}</p>}<div className="form-actions"><button className="button" type="button" disabled={busy} onClick={() => setExclude(undefined)}>Đóng</button><button className="button primary" type="button" disabled={busy || !excludeReason.trim()} onClick={() => void excludeRow()}>{busy ? 'Đang kiểm tra…' : 'Xác nhận loại dòng'}</button></div></div></Modal>}
    {confirm && data && <Modal title="Xác nhận lưu dòng chấm công" busy={busy} onClose={() => setConfirm(false)}><div className="operations-panel"><p>Lưu tối đa <strong>{eligible} dòng</strong> vào hàng chờ chấm công tháng <strong>{data.batch.payMonth}</strong>?</p><p>Hệ thống kiểm tra lại trùng dữ liệu và khóa kỳ. Dòng lỗi được giữ trong đợt nhập; dữ liệu mới vẫn chưa được tính lương.</p><label className="operations-checkbox"><input type="checkbox" checked={mappingConfirmed} disabled={busy} onChange={event => setMappingConfirmed(event.target.checked)} />Tôi đã kiểm tra cơ sở, tháng, ánh xạ nhân viên và các cặp Vào/Ra.</label>{error && <p className="alert error" role="alert">{error}</p>}<div className="form-actions"><button className="button" type="button" disabled={busy} onClick={() => setConfirm(false)}>Đóng</button><button className="button primary" type="button" disabled={busy || !mappingConfirmed} onClick={() => void commit()}>{busy ? 'Đang lưu…' : 'Xác nhận lưu'}</button></div></div></Modal>}
  </AttendanceShell>;
}
