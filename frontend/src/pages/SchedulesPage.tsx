import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { axiosClient as api } from '../services/axiosClient';
import { useAuthStore } from '../store/useAuthStore';
import Icon from '../components/ui/Icon';
import Modal from '../components/ui/Modal';
import ScheduleTimetable from '../components/schedules/ScheduleTimetable';
import ScheduleAssignmentForm from '../components/schedules/ScheduleAssignmentForm';
import type { ScheduleDraft, ScheduleOptions, ScheduleRow, ScheduleWeekStatus } from '../types/schedules';
import { addDays, canChangeShift, clinicToday, schedulePermissions, shiftNames, shortDate, weekStart } from '../utils/schedule';
import { formatVietnamDateTime } from '../utils/leaveRules';

type Editor = { date: string; existing?: ScheduleRow; slot?: { date: string; shift: string } };
type Action = { type: 'publish' | 'reopen' | 'cancel' | 'patient' | 'end'; row?: ScheduleRow };
const actionTitles = { publish: 'Chốt lịch tuần', reopen: 'Mở lại tuần để sửa sai', cancel: 'Hủy phân công', patient: 'Xác nhận công trực', end: 'Kết thúc trực' };

export default function SchedulesPage() {
  const user = useAuthStore(state => state.session?.user);
  const manager = user?.role === 'hr_staff';
  const globalReader = ['admin', 'hr_manager', 'hr_staff', 'department_head'].includes(user?.role || '');
  const [searchParams] = useSearchParams();
  const [date, setDate] = useState(() => {
    const linked = searchParams.get('date');
    if (linked && /^\d{4}-\d{2}-\d{2}$/.test(linked) && Number.isFinite(Date.parse(`${linked}T12:00:00+07:00`))
      && new Date(`${linked}T12:00:00+07:00`).toISOString().slice(0, 10) === linked) return linked;
    return manager ? addDays(weekStart(clinicToday()), 7) : clinicToday();
  });
  const monday = weekStart(date);
  const [facilityId, setFacility] = useState('');
  const [departmentId, setDepartment] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [options, setOptions] = useState<ScheduleOptions>();
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [status, setStatus] = useState<ScheduleWeekStatus>();
  const [clock, setClock] = useState(Date.now);
  const [serverOffset, setServerOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [inspect, setInspect] = useState<ScheduleRow | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [actionNote, setActionNote] = useState('');
  const [endTime, setEndTime] = useState('');
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const [snapshotKey, setSnapshotKey] = useState('');
  const queryKey = `${user?.id}|${monday}|${facilityId}|${departmentId}|${staffFilter}`;
  const ready = snapshotKey === queryKey;
  const visibleRows = ready ? rows : [];
  const currentStatus = ready && status?.monday === monday ? status : undefined;
  const permissions = schedulePermissions(currentStatus, clock + serverOffset);
  const serverNow = clock + serverOffset;
  const canEdit = manager && permissions.canEdit;
  const unavailable = saving || loading || !ready || !!error;

  const load = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    const currentGeneration = ++generation.current;
    setLoading(true); setError('');
    try {
      const config = { signal: controller.signal };
      const [o, r, s] = await Promise.all([
        api.get<ScheduleOptions>('/schedules/options', config),
        api.get<ScheduleRow[]>('/schedules', { ...config, params: { date: monday, facilityId: facilityId || undefined, departmentId: departmentId || undefined, staffId: staffFilter || undefined } }),
        api.get<ScheduleWeekStatus>('/schedules/week-status', { ...config, params: { date: monday } }),
      ]);
      if (controller.signal.aborted || currentGeneration !== generation.current) return false;
      const receivedAt = Date.now();
      setServerOffset(Date.parse(s.data.serverNow) - receivedAt);
      setClock(receivedAt);
      setOptions(o.data); setRows(r.data); setStatus(s.data); setSnapshotKey(queryKey);
      setNotice(current => current.includes('Chưa tải lại được lịch') ? 'Đã tải lại lịch.' : current);
      return true;
    } catch (cause) {
      if (!controller.signal.aborted && currentGeneration === generation.current) setError(cause instanceof Error ? cause.message : 'Không tải được lịch.');
      return false;
    } finally {
      if (currentGeneration === generation.current && !controller.signal.aborted) setLoading(false);
    }
  }, [monday, facilityId, departmentId, staffFilter, queryKey]);
  useEffect(() => { void load(); return () => request.current?.abort(); }, [load]);
  useEffect(() => { setNotice(''); }, [monday]);
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function closeDialog() { if (saving) return; setEditor(null); setInspect(null); setAction(null); setDialogError(''); }
  function openEditor(existing?: ScheduleRow, slot?: Editor['slot']) {
    if (!canEdit || unavailable) return;
    if (existing && !canChangeShift(existing.assignment.date, existing.assignment.shift, serverNow)) return;
    if (slot && !canChangeShift(slot.date, slot.shift, serverNow)) return;
    setDialogError(''); setInspect(null); setAction(null);
    setEditor({ date: existing?.assignment.date || slot?.date || date, existing, slot });
  }
  function openAction(type: Action['type'], row?: ScheduleRow) {
    if (unavailable || (type === 'publish' && !permissions.canPublish)
      || (type === 'reopen' && !permissions.canReopen) || (type === 'cancel' && !canEdit)) return;
    if (type === 'cancel' && row && !canChangeShift(row.assignment.date, row.assignment.shift, serverNow)) return;
    setDialogError(''); setInspect(null); setAction({ type, row }); setActionNote('');
    if (row) {
      const nowTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
      setEndTime(row.assignment.date === clinicToday() && row.end > nowTime ? nowTime : row.end);
    }
  }
  async function mutate(operation: () => Promise<unknown>, success: string) {
    if (saving) return;
    setSaving(true); setDialogError('');
    try { await operation(); }
    catch (cause) { setDialogError(cause instanceof Error ? cause.message : 'Không lưu được thay đổi.'); setSaving(false); return; }
    setEditor(null); setInspect(null); setAction(null); setNotice(success);
    if (!await load()) setNotice(`${success} Chưa tải lại được lịch; bấm Tải lại để xem cập nhật.`);
    setSaving(false);
  }
  async function saveAssignment(draft: ScheduleDraft) {
    const input = { staffId: draft.staffId, facilityId: draft.facilityId, date: draft.date, shift: draft.shift, reason: draft.reason, transferConsent: draft.transferConsent, expectedVersion: editor?.existing?.version };
    await mutate(() => draft.mode === 'edit' && editor?.existing ? api.put(`/schedules/assignments/${editor.existing.assignment.id}`, input)
      : draft.mode === 'week' ? api.post('/schedules/assign-week', { ...input, monday: draft.monday, days: draft.days, shifts: draft.shifts })
      : api.post(draft.shift === 'full-day' ? '/schedules/full-day' : '/schedules/assignments', input), 'Đã lưu phân công.');
  }
  async function submitAction(event: FormEvent) {
    event.preventDefault(); if (!action) return;
    if (action.type === 'publish') await mutate(() => api.post('/schedules/publish', null, { params: { monday } }), 'Đã chốt lịch tuần.');
    else if (action.type === 'reopen') await mutate(() => api.post('/schedules/reopen', { reason: actionNote }, { params: { monday } }), 'Đã mở lại tuần. Sửa lịch rồi chốt lại để công bố.');
    else if (action.row) {
      const row = action.row; const base = `/schedules/assignments/${row.assignment.id}`;
      if (action.type === 'cancel') await mutate(() => api.post(`${base}/cancel`, { reason: actionNote, expectedVersion: row.version }), 'Đã hủy phân công.');
      if (action.type === 'patient') await mutate(() => api.post(`${base}/patient-confirmation`, { evidence: actionNote, expectedVersion: row.version }), 'Đã ghi nhận công trực.');
      if (action.type === 'end') await mutate(() => api.post(`${base}/end-duty`, { endedAt: `${row.assignment.date}T${endTime}:00+07:00`, note: actionNote, expectedVersion: row.version }), 'Đã ghi nhận kết thúc trực.');
    }
  }
  const activeRows = visibleRows.filter(row => !row.assignment.cancelled);
  const actionRow = action?.row;
  return <section className="schedule-page schedule-workspace">
    <header className="schedule-page-header"><div><span className="eyebrow">VNC · NHÂN SỰ</span><h1>Lịch làm việc</h1><p>{manager ? 'Lập lịch tuần kế tiếp · Chốt trước 00:00 thứ Hai' : globalReader ? 'Theo dõi lịch làm việc tại các cơ sở' : 'Lịch cá nhân đã công bố'}</p></div>
      {manager && <div className="schedule-primary-actions">{currentStatus?.closed
        ? <button id="schedule-reopen" disabled={unavailable || !permissions.canReopen} onClick={() => openAction('reopen')}><Icon name="edit" size={16} />Mở lại tuần</button>
        : <button disabled={unavailable || !permissions.canPublish} onClick={() => openAction('publish')}><Icon name="check" size={16} />{currentStatus?.isCorrection ? 'Chốt lại tuần' : 'Chốt tuần'}</button>}
        <button id="schedule-create" className="schedule-primary-button" disabled={unavailable || !options || !canEdit} onClick={() => openEditor()}><Icon name="plus" size={17} />Phân công</button></div>}
    </header>
    {notice && <div className="alert success" role="status"><Icon name="check" size={17} /><span>{notice}</span><button className="schedule-dismiss" aria-label="Đóng thông báo" onClick={() => setNotice('')}>×</button></div>}
    {error && <div className="alert error" role="alert"><span>{error}</span><button disabled={loading || saving} onClick={() => void load()}>Tải lại</button></div>}
    <div className="schedule-filters">
      <label htmlFor="schedule-view-date">Tuần làm việc<input id="schedule-view-date" type="date" required disabled={saving} value={date} onChange={event => { if (event.target.value) setDate(event.target.value); }} /></label>
      <label htmlFor="schedule-filter-facility">Cơ sở<select id="schedule-filter-facility" disabled={saving} value={facilityId} onChange={event => setFacility(event.target.value)}><option value="">Tất cả cơ sở</option>{options?.facilities.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      {globalReader && <><label htmlFor="schedule-filter-department">Khoa/phòng<select id="schedule-filter-department" disabled={saving} value={departmentId} onChange={event => { setDepartment(event.target.value); setStaffFilter(''); }}><option value="">Tất cả khoa/phòng</option>{options?.departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label htmlFor="schedule-filter-staff">Nhân viên<select id="schedule-filter-staff" disabled={saving} value={staffFilter} onChange={event => setStaffFilter(event.target.value)}><option value="">Tất cả nhân viên</option>{options?.staff.filter(s => !departmentId || s.departmentId === departmentId).map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}</select></label></>}
      {(facilityId || departmentId || staffFilter) && <button className="schedule-clear-filters" disabled={saving} onClick={() => { setFacility(''); setDepartment(''); setStaffFilter(''); }}>Xóa lọc</button>}
    </div>
    <div className="schedule-overview"><span><strong>{loading ? '—' : activeRows.length}</strong> ca đang xem</span><span><strong>{loading ? '—' : new Set(activeRows.map(r => r.assignment.staffId)).size}</strong> nhân viên</span>{currentStatus && <span className={currentStatus.closed ? 'schedule-week-status closed' : 'schedule-week-status'}>{currentStatus.closed ? 'Đã chốt · Chỉ xem' : 'Chưa chốt'}</span>}</div>
    {manager && currentStatus && <p className="schedule-field-hint">{currentStatus.isCorrection
      ? `Lịch điều chỉnh · Mỗi ca bị ảnh hưởng phải bắt đầu ít nhất 24 giờ sau khi lưu trong tuần làm việc. Chốt lại trước ${formatVietnamDateTime(currentStatus.correctionEndsAt)} (giờ Việt Nam).`
      : `Lập lịch từ ${formatVietnamDateTime(currentStatus.planningStartsAt)} · Phải chốt lần đầu trước ${formatVietnamDateTime(currentStatus.publishDeadline)} (giờ Việt Nam).`}</p>}
    <ScheduleTimetable date={date} rows={visibleRows} head={manager} canEdit={canEdit} now={serverNow} busy={saving || !!error} loading={loading || (!ready && !error)} onDateChange={setDate} onInspect={row => { setInspect(row); setDialogError(''); }} onCreateSlot={canEdit ? slot => openEditor(undefined, slot) : undefined} onEdit={row => openEditor(row)} onCancel={row => openAction('cancel', row)} onConfirmPatient={row => openAction('patient', row)} onEndDuty={row => openAction('end', row)} />
    {editor && options && <Modal className="schedule-dialog" title={editor.existing ? 'Sửa phân công' : 'Phân công làm việc'} busy={saving} onClose={closeDialog}><ScheduleAssignmentForm date={editor.date} options={options} existing={editor.existing} slot={editor.slot} now={serverNow} busy={saving || !canEdit} error={!canEdit ? 'Đã hết thời hạn phân công cho tuần này. Vui lòng đóng và tải lại lịch.' : dialogError} onSave={saveAssignment} onClose={closeDialog} /></Modal>}
    {inspect && <Modal className="schedule-detail-dialog" title="Chi tiết phân công" busy={saving} onClose={closeDialog}><div className="schedule-page schedule-action-body"><div className="schedule-person-heading"><span className="avatar">{inspect.fullName.split(' ').slice(-2).map(part => part[0]).join('')}</span><div><h3>{inspect.fullName}</h3><p>{inspect.assignment.cancelled ? 'Đã hủy' : inspect.published ? 'Đã chốt' : 'Nháp'}</p></div></div><dl className="schedule-detail-grid"><div><dt>Ngày · ca</dt><dd>{shortDate(inspect.assignment.date, true)} · {shiftNames[inspect.assignment.shift]}</dd></div><div><dt>Giờ dự kiến</dt><dd>{inspect.start}–{inspect.end}</dd></div><div><dt>Cơ sở</dt><dd>{inspect.facility}</dd></div><div><dt>Khoa/phòng · vị trí</dt><dd>{inspect.coverage}</dd></div>{['noon', 'evening'].includes(inspect.assignment.shift) && <><div><dt>Công trực</dt><dd>{inspect.dutyCredit ? 'Đã ghi nhận' : 'Chưa ghi nhận'}</dd></div><div><dt>Kết thúc thực tế</dt><dd>{inspect.assignment.actualEndAt ? new Date(inspect.assignment.actualEndAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }) : 'Chưa ghi nhận'}</dd></div></>}{inspect.assignment.reason && <div className="wide"><dt>Lý do</dt><dd>{inspect.assignment.reason}</dd></div>}{inspect.assignment.transferConsent && <div className="wide"><dt>Xác nhận điều chuyển</dt><dd>{inspect.assignment.transferConsent}</dd></div>}</dl><div className="schedule-modal-actions"><button onClick={closeDialog}>Đóng</button>{canEdit && canChangeShift(inspect.assignment.date, inspect.assignment.shift, serverNow) && !inspect.assignment.cancelled && !inspect.assignment.patientConfirmed && !inspect.assignment.actualEndAt && <button className="schedule-primary-button" onClick={() => openEditor(inspect)}>Sửa phân công</button>}</div></div></Modal>}
    {action && <Modal title={actionTitles[action.type]} busy={saving} onClose={closeDialog}><div className="schedule-page schedule-action-body"><form onSubmit={event => void submitAction(event)}>
      {dialogError && <p className="alert error" role="alert">{dialogError}</p>}
      {action.type === 'publish' ? <><p>Công bố <strong>{currentStatus?.assignmentCount} phân công</strong> trong tuần <strong>{shortDate(monday)}–{shortDate(addDays(monday, 6), true)}</strong>.</p><p>Áp dụng cho tất cả khoa/phòng và cả hai cơ sở, bao gồm các phân công ngoài bộ lọc hiện tại.</p><p className="schedule-action-warning">{currentStatus?.isCorrection ? 'Trong tuần làm việc, cả ca cũ và ca mới bị ảnh hưởng phải bắt đầu ít nhất 24 giờ sau khi lưu và chốt lại. ' : `Chốt lần đầu trước ${formatVietnamDateTime(currentStatus?.publishDeadline)} (giờ Việt Nam). `}Sau khi chốt, nhân viên xem được lịch cá nhân. Không thể tạo, sửa hoặc hủy khi tuần đang chốt. Nếu nhập sai, HR Staff có thể mở lại tuần trong thời hạn chỉnh sửa.</p></>
        : action.type === 'reopen' ? <><p>Mở lại tuần <strong>{shortDate(monday)}–{shortDate(addDays(monday, 6), true)}</strong> cho tất cả khoa/phòng và cả hai cơ sở, kể cả ngoài bộ lọc hiện tại.</p><p className="schedule-action-warning">Nhân viên tiếp tục xem lịch đã công bố cho đến khi chốt lại bản điều chỉnh. Trong tuần làm việc, chỉ thay đổi ca bắt đầu ít nhất 24 giờ sau khi lưu. Các ca đã ghi nhận công hoặc kết thúc trực vẫn không được sửa/hủy.</p><label htmlFor="schedule-reopen-reason">Lý do mở lại<input id="schedule-reopen-reason" required maxLength={1000} disabled={saving} value={actionNote} onChange={event => setActionNote(event.target.value)} placeholder="Ví dụ: Chọn nhầm cơ sở khi phân công" /></label></>
        : actionRow && <><p className="schedule-action-context"><strong>{actionRow.fullName}</strong><span>{shortDate(actionRow.assignment.date, true)} · {shiftNames[actionRow.assignment.shift]} · {actionRow.facility}</span></p>{action.type === 'end' && <label htmlFor="schedule-end-time">Giờ kết thúc thực tế<input id="schedule-end-time" type="time" required disabled={saving} value={endTime} onChange={event => setEndTime(event.target.value)} /><small className="schedule-field-hint">Giờ Việt Nam. Kết thúc chưa tự tính công trực.</small></label>}<label htmlFor="schedule-action-note">{action.type === 'cancel' ? 'Lý do hủy' : action.type === 'patient' ? 'Mã phiếu khám / căn cứ xác nhận' : 'Ghi chú'}<input id="schedule-action-note" required maxLength={1000} disabled={saving} value={actionNote} onChange={event => setActionNote(event.target.value)} placeholder="Nhập nội dung" /></label></>}
      {action.type === 'cancel' && actionRow && !canChangeShift(actionRow.assignment.date, actionRow.assignment.shift, serverNow) && <p className="alert error" role="alert">Ca phải bắt đầu ít nhất 24 giờ sau khi xác nhận hủy.</p>}
      <div className="schedule-modal-actions"><button type="button" disabled={saving} onClick={closeDialog}>Đóng</button><button type="submit" className={action.type === 'cancel' ? 'schedule-danger-button' : 'schedule-primary-button'} disabled={saving || (action.type === 'publish' && !permissions.canPublish) || (action.type === 'cancel' && (!canEdit || !actionNote.trim() || (!!actionRow && !canChangeShift(actionRow.assignment.date, actionRow.assignment.shift, serverNow)))) || (action.type === 'reopen' && (!actionNote.trim() || !permissions.canReopen))}>{saving ? 'Đang lưu…' : action.type === 'publish' ? 'Chốt tuần' : action.type === 'reopen' ? 'Mở lại tuần' : action.type === 'cancel' ? 'Xác nhận hủy' : 'Xác nhận'}</button></div>
    </form></div></Modal>}
  </section>;
}
