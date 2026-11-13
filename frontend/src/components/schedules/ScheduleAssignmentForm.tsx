import { useEffect, useState, type FormEvent } from 'react';
import type { ScheduleAvailability, ScheduleDraft, ScheduleOptions, ScheduleRow } from '../../types/schedules';
import { addDays, canChangeShift, dayNames, shiftNames, shortDate, weekStart } from '../../utils/schedule';
import { axiosClient as api } from '../../services/axiosClient';
import Icon from '../ui/Icon';
import SelectOrTextField from '../ui/SelectOrTextField';

const reasons = ['Phân công lịch làm việc tuần', 'Phân công trực trưa', 'Phân công trực tối', 'Bố trí người thay thế nhân viên nghỉ', 'Hỗ trợ cơ sở thiếu nhân sự', 'Điều chỉnh lịch làm việc'];
const shiftHints: Record<string, string> = { morning: 'Giờ theo mùa', noon: 'Sau ca sáng – 13:30', afternoon: '13:30–17:00', evening: '17:00–19:00 dự kiến' };

export default function ScheduleAssignmentForm({ date, options, existing, slot, now, busy, error, onSave, onClose }: {
  date: string; options: ScheduleOptions; existing?: ScheduleRow; slot?: { date: string; shift: string };
  now: number; busy: boolean; error: string; onSave: (draft: ScheduleDraft) => Promise<void>; onClose: () => void;
}) {
  const initialDate = existing?.assignment.date || slot?.date || date;
  const monday = weekStart(initialDate);
  const [weekly, setWeekly] = useState(!existing && !slot);
  const [days, setDays] = useState(() => [0, 1, 2, 3, 4, 5, 6].filter(day =>
    ['morning', 'afternoon'].every(shift => canChangeShift(addDays(monday, day), shift, now))));
  const [shifts, setShifts] = useState(['morning', 'afternoon']);
  const [validationError, setValidationError] = useState('');
  const [availability, setAvailability] = useState<ScheduleAvailability>();
  const [availabilityError, setAvailabilityError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [form, setForm] = useState({
    staffId: existing?.assignment.staffId || '', facilityId: existing?.facilityId || '',
    date: initialDate, shift: existing?.assignment.shift || slot?.shift || 'full-day',
    reason: existing?.assignment.reason || 'Phân công lịch làm việc tuần', transferConsent: existing?.assignment.transferConsent || '',
  });
  const count = weekly ? days.length * shifts.length : form.shift === 'full-day' ? 2 : 1;
  const dates = weekly ? days.map(day => addDays(monday, day)) : [form.date];
  const chosenShifts = weekly ? shifts : form.shift === 'full-day' ? ['morning', 'afternoon'] : [form.shift];
  const previewReady = !!availability && availability.staffId === form.staffId && availability.monday === monday;
  const existingAssignments = previewReady ? availability.assignments.filter(item => dates.includes(item.date)) : [];
  const approvedLeave = previewReady ? availability.leave.filter(leave => dates.some(day => day >= leave.startDate && day <= leave.endDate)) : [];
  const duplicate = existingAssignments.some(item => chosenShifts.includes(item.shift));
  const crossFacility = !!form.facilityId && existingAssignments.some(item => item.facilityId !== form.facilityId);
  const timeError = (existing && !canChangeShift(existing.assignment.date, existing.assignment.shift, now))
    || dates.some(day => chosenShifts.some(shift => !canChangeShift(day, shift, now)))
    ? 'Trong tuần làm việc, cả ca cũ và ca mới bị ảnh hưởng phải bắt đầu ít nhất 24 giờ sau khi lưu.' : '';
  const conflictError = approvedLeave.length ? 'Nhân viên đã có nghỉ phép được duyệt trong ngày được chọn.'
    : duplicate ? 'Nhân viên đã có phân công trong ngày và ca được chọn.' : '';
  const inactiveFacility = options.facilities.find(item => item.id === form.facilityId)?.status === 'inactive';
  const blocked = busy || count === 0 || !!timeError || !!conflictError || inactiveFacility || !previewReady;

  useEffect(() => {
    setAvailability(undefined); setAvailabilityError('');
    if (!form.staffId) return;
    const controller = new AbortController();
    api.get<ScheduleAvailability>('/schedules/availability', { signal: controller.signal,
      params: { staffId: form.staffId, date: monday, excludeAssignmentId: existing?.assignment.id } })
      .then(result => { if (!controller.signal.aborted) setAvailability(result.data); })
      .catch(() => { if (!controller.signal.aborted) setAvailabilityError('Không tải được lịch và nghỉ phép. Vui lòng thử lại.'); });
    return () => controller.abort();
  }, [form.staffId, monday, existing?.assignment.id, refresh]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (blocked) return;
    const staff = options.staff.find(s => s.id === form.staffId);
    if (staff && dates.some(day => (staff.dateJoined && day < staff.dateJoined) || (staff.dateLeft && day > staff.dateLeft))) {
      setValidationError('Ngày phân công phải nằm trong thời gian công tác của nhân viên.');
      return;
    }
    setValidationError('');
    await onSave({ ...form, mode: existing ? 'edit' : weekly ? 'week' : 'day', monday, days, shifts });
  }
  return <div className="schedule-page schedule-modal-content"><form className="schedule-editor" onSubmit={event => void submit(event)}>
    <div className="schedule-dialog-context"><span><Icon name="clock" size={15} />{shortDate(monday)} – {shortDate(addDays(monday, 6), true)}</span>
      {!existing && <div className="schedule-mode" role="group" aria-label="Cách phân công"><button type="button" aria-pressed={weekly} disabled={busy} onClick={() => setWeekly(true)}>Cả tuần</button><button type="button" aria-pressed={!weekly} disabled={busy} onClick={() => setWeekly(false)}>Từng ngày</button></div>}
    </div>
    <fieldset disabled={busy} className="schedule-form-body">
      {(validationError || error) && <p className="alert error" role="alert">{validationError || error}</p>}
      <div className="schedule-fields">
        <label htmlFor="schedule-staff">Nhân viên<select id="schedule-staff" required value={form.staffId} onChange={event => setForm({ ...form, staffId: event.target.value })}><option value="">Chọn nhân viên</option>{options.staff.filter(staff => staff.departmentId && options.departments.find(d => d.id === staff.departmentId)?.status !== 'inactive').map(staff => <option key={staff.id} value={staff.id}>{staff.fullName} · {options.departments.find(d => d.id === staff.departmentId)?.name}</option>)}</select></label>
        <label htmlFor="schedule-facility">Cơ sở<select id="schedule-facility" required value={form.facilityId} onChange={event => setForm({ ...form, facilityId: event.target.value })}><option value="">Chọn cơ sở</option>{options.facilities.filter(unit => unit.status !== 'inactive' || unit.id === form.facilityId).map(unit => <option key={unit.id} value={unit.id} disabled={unit.status === 'inactive'}>{unit.name}{unit.status === 'inactive' ? ' · Ngừng hoạt động' : ''}</option>)}</select></label>
        {!weekly && <><label htmlFor="schedule-date">Ngày<input id="schedule-date" type="date" required min={monday} max={addDays(monday, 6)} value={form.date} onChange={event => setForm({ ...form, date: event.target.value })} /></label>
          <label htmlFor="schedule-shift">Ca<select id="schedule-shift" value={form.shift} onChange={event => setForm({ ...form, shift: event.target.value })}>{!existing && <option value="full-day">Cả ngày · sáng + chiều</option>}{Object.entries(shiftNames).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label></>}
      </div>
      {existing && <p className="schedule-field-hint">Có thể đổi ngày trong cùng tuần.</p>}
      {timeError && <p className="alert error" role="alert">{timeError}</p>}
      {inactiveFacility && <p className="alert error" role="alert">Vui lòng chọn cơ sở đang hoạt động.</p>}
      {weekly && <>
        <section className="schedule-selection" aria-labelledby="schedule-days-title"><div className="schedule-selection-header"><h3 id="schedule-days-title">Ngày làm việc <small>{days.length}/7 ngày</small></h3><div className="schedule-preset-actions"><button type="button" onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])}>Cả tuần</button><button type="button" onClick={() => setDays([0, 1, 2, 3, 4])}>T2–T6</button></div></div>
          <div className="schedule-day-grid" role="group" aria-label="Ngày làm việc">{dayNames.map((name, index) => <button type="button" className="schedule-day-card" key={index} aria-label={`${name}, ${shortDate(addDays(monday, index), true)}`} aria-pressed={days.includes(index)} onClick={() => setDays(days.includes(index) ? days.filter(day => day !== index) : [...days, index])}><span className="schedule-day-name">{index === 6 ? 'CN' : `T${index + 2}`}</span><strong>{shortDate(addDays(monday, index))}</strong></button>)}</div>
        </section>
        <section className="schedule-selection" aria-labelledby="schedule-shifts-title"><div className="schedule-selection-header"><h3 id="schedule-shifts-title">Ca mỗi ngày</h3><div className="schedule-preset-actions"><button type="button" onClick={() => setShifts(['morning', 'afternoon'])}>Sáng + chiều</button><button type="button" onClick={() => setShifts(['noon', 'evening'])}>Trưa + tối</button></div></div>
          <div className="schedule-shift-grid" role="group" aria-label="Ca làm việc">{Object.entries(shiftNames).map(([key, name]) => <button type="button" className="schedule-shift-card" key={key} aria-pressed={shifts.includes(key)} onClick={() => setShifts(shifts.includes(key) ? shifts.filter(shift => shift !== key) : [...shifts, key])}><strong>{name}</strong><small>{shiftHints[key]}</small>{shifts.includes(key) && <Icon name="check" size={13} />}</button>)}</div>
        </section>
      </>}
      {form.staffId && <section className="schedule-availability" aria-label="Lịch và nghỉ phép của nhân viên" aria-busy={!previewReady && !availabilityError}>
        <h3>Lịch và nghỉ phép trong ngày được chọn</h3>
        {availabilityError ? <p className="alert error" role="alert">{availabilityError} <button type="button" onClick={() => setRefresh(value => value + 1)}>Thử lại</button></p>
          : !previewReady ? <p role="status">Đang kiểm tra lịch và nghỉ phép…</p>
          : <>{existingAssignments.length === 0 && approvedLeave.length === 0 && <p>Chưa có phân công hoặc nghỉ phép được duyệt.</p>}
            {existingAssignments.map(item => <p key={item.id}>{shortDate(item.date)} · {shiftNames[item.shift]} · {item.facility}</p>)}
            {approvedLeave.map((leave, index) => <p key={index}>Nghỉ phép đã duyệt: {shortDate(leave.startDate)}–{shortDate(leave.endDate, true)}</p>)}
            {conflictError && <p className="alert error" role="alert">{conflictError}</p>}
            {crossFacility && <p>Có phân công tại cơ sở khác trong cùng ngày. Cần ghi xác nhận điều chuyển và giải thích thời gian di chuyển.</p>}</>}
      </section>}
      <details className="schedule-editor-notes" open={crossFacility || !!error || undefined}><summary>Ghi chú / điều chuyển <span>Không bắt buộc với lịch thông thường</span></summary><div className="schedule-note-fields schedule-fields">
        <SelectOrTextField id="schedule-reason" label="Lý do" value={form.reason} choices={reasons} onChange={reason => setForm({ ...form, reason })} placeholder="Nhập lý do" />
        <label htmlFor="schedule-consent">Xác nhận điều chuyển<input id="schedule-consent" required={crossFacility} maxLength={1000} value={form.transferConsent} onChange={event => setForm({ ...form, transferConsent: event.target.value })} placeholder="Người đồng ý, nội dung và thời gian di chuyển" /><small className="schedule-field-hint">Cần nhập khi làm ở hai cơ sở trong cùng ngày.</small></label>
      </div></details>
    </fieldset>
    <div className="schedule-editor-footer"><div className="schedule-bulk-summary" role="status"><strong className="schedule-total">{count}</strong><span>{weekly ? `${days.length} ngày × ${shifts.length} ca` : 'phân công'}<small>{existing ? 'Cập nhật lịch hiện có' : 'Lịch nháp · Chốt tuần để công bố'}</small></span></div><div className="schedule-save-actions"><button type="button" disabled={busy} onClick={onClose}>Đóng</button><button type="submit" className="schedule-save-button" disabled={blocked}>{busy ? 'Đang lưu…' : existing ? 'Lưu thay đổi ca' : `Lưu ${count} ca`}</button></div></div>
  </form></div>;
}
