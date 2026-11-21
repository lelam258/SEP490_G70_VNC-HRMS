import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AttendanceShell from '../../components/attendance/AttendanceShell';
import ResourceState from '../../components/attendance/ResourceState';
import useApiResource from '../../hooks/useApiResource';
import { attendanceApi } from '../../services/attendanceApi';
import type { AttendanceList, AttendanceOptions, OnCallContext, OnCallDetail, OnCallInput, OnCallItem } from '../../types/attendance';
import { attendanceLabel, clockTime } from '../../utils/attendance';
import { clinicToday, shiftHours, shortDate } from '../../utils/schedule';

function Editor({ options, initial, onSaved }: { options: AttendanceOptions; initial?: OnCallItem; onSaved: (id: string, message: string) => void }) {
  const date = initial?.date || clinicToday(); const category = initial?.category || 'noon'; const [plannedStart, plannedEnd] = shiftHours(date, category).split('–');
  const [form, setForm] = useState<OnCallInput>({ staffId: initial?.staffId || '', facilityId: initial?.facilityId || '', date, category,
    start: initial?.start ? clockTime(initial.start) : plannedStart, end: initial?.end ? clockTime(initial.end) : plannedEnd,
    note: initial?.note || '', deviationReason: initial?.deviationReason || '', supervisorEvidence: initial?.supervisorEvidence || '',
    attendanceEvidenceId: initial?.attendanceEvidenceId || null, version: initial?.version });
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const received = Date.now(); setElapsed(0);
    const timer = window.setInterval(() => setElapsed(Date.now() - received), 30_000);
    return () => window.clearInterval(timer);
  }, [options.serverNow]);
  const serverTime = Date.parse(options.serverNow);
  const clinicNow = new Date((Number.isFinite(serverTime) ? serverTime + elapsed : Date.now()) + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const today = clinicNow.slice(0, 10);
  const person = options.staff.find(item => item.id === form.staffId);
  const department = options.departments.find(item => item.id === person?.departmentId);
  const context = useApiResource<OnCallContext>(form.staffId && form.facilityId && form.date ? '/attendance/on-call-context' : '',
    { staffId: form.staffId, facilityId: form.facilityId, date: form.date });
  const attendance = useApiResource<AttendanceList>(form.staffId && form.facilityId ? '/attendance/records' : '',
    { staffId: form.staffId, facilityId: form.facilityId, month: form.date.slice(0, 7), page: 1, pageSize: 100 });
  const recent = (attendance.data?.items || []).filter(item => item.staffId === form.staffId && item.facilityId === form.facilityId && item.workDate <= today);
  const schedule = context.data?.schedules.find(item => item.facilityId === form.facilityId && item.shift === form.category);
  const hours = shiftHours(form.date, form.category).split('–');
  const outsideSchedule = !!context.data && !schedule;
  const deviation = !!initial || outsideSchedule || form.start !== hours[0] || form.end !== hours[1];
  const issues: { field: string; message: string }[] = [];
  if (!form.staffId) issues.push({ field: 'oncall-staff', message: 'Chọn nhân viên.' });
  if (!form.facilityId) issues.push({ field: 'oncall-facility', message: 'Chọn cơ sở thực tế đã trực.' });
  if (!form.date) issues.push({ field: 'oncall-date', message: 'Chọn ngày trực.' });
  else if (form.date > today) issues.push({ field: 'oncall-date', message: 'Ngày trực chưa diễn ra. Chọn ngày đã trực thực tế.' });
  else if (person && (form.date < person.dateJoined || (person.dateLeft && form.date > person.dateLeft)))
    issues.push({ field: 'oncall-date', message: `Ngày trực phải nằm trong thời gian công tác, từ ${shortDate(person.dateJoined, true)}${person.dateLeft ? ` đến ${shortDate(person.dateLeft, true)}` : ''}.` });
  if (!form.start) issues.push({ field: 'oncall-start', message: 'Nhập giờ vào thực tế.' });
  if (!form.end) issues.push({ field: 'oncall-end', message: 'Nhập giờ ra thực tế.' });
  if (form.start && form.end) {
    if (form.end <= form.start) issues.push({ field: 'oncall-end', message: 'Giờ ra phải sau giờ vào trong cùng ngày.' });
    else if (form.end <= hours[0] || form.start >= hours[1]) issues.push({ field: 'oncall-category', message: `Giờ thực tế phải có thời gian thuộc ca ${hours.join('–')}. Kiểm tra loại ca hoặc giờ đã nhập.` });
    if (form.date === today && form.end > clinicNow.slice(11)) issues.push({ field: 'oncall-end', message: `Giờ ra ${form.end} hôm nay chưa diễn ra (hiện tại ${clinicNow.slice(11)}, giờ Việt Nam). Chọn ngày đã trực hoặc nhập giờ thực tế đã kết thúc.` });
  }
  if (context.data?.lockedReason) issues.push({ field: 'oncall-date', message: context.data.lockedReason });
  if (context.data?.approvedLeave) issues.push({ field: 'oncall-date', message: 'Nhân viên có nghỉ phép đã duyệt trong ngày này. Chọn đúng người/ngày hoặc đối chiếu lại nghỉ phép.' });
  if (deviation && !form.deviationReason.trim()) issues.push({ field: 'oncall-reason', message: initial ? 'Ghi lý do sửa hồ sơ.' : outsideSchedule ? 'Ghi lý do trực ngoài lịch hoặc khác cơ sở.' : 'Ghi lý do giờ thực tế khác giờ dự kiến.' });
  if (outsideSchedule && !form.supervisorEvidence.trim()) issues.push({ field: 'oncall-supervisor', message: 'Bổ sung người xác nhận và căn cứ quản lý cho phép trực ngoài lịch.' });
  if (context.error) issues.push({ field: 'oncall-context', message: 'Chưa tải được lịch và bằng chứng. Bấm Tải lại dữ liệu ở bên dưới.' });
  function update(values: Partial<OnCallInput>) { setError(''); setForm(current => ({ ...current, ...values })); }
  function changeDate(value: string, nextCategory = form.category) {
    const [start, end] = shiftHours(value, nextCategory).split('–'); update({ date: value, category: nextCategory, start, end, attendanceEvidenceId: null });
  }
  function chooseAttendance(id: string) {
    const item = recent.find(record => record.id === id);
    if (!item) return;
    const [start, end] = shiftHours(item.workDate, form.category).split('–');
    update({ date: item.workDate, start, end, attendanceEvidenceId: item.id });
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy || !context.data || context.data.approvedLeave || context.data.lockedReason) return;
    if (issues.length) {
      setError(issues[0].message); document.getElementById(issues[0].field)?.focus(); return;
    }
    setBusy(true); setError('');
    try { const result = await attendanceApi.onCall(initial?.id, form); onSaved(result.id, result.message); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không lưu được hồ sơ trực.'); }
    finally { setBusy(false); }
  }
  return <form className="operations-panel operations-form" noValidate onSubmit={event => void submit(event)}><fieldset disabled={busy}>
    {error && <p className="alert error" role="alert">{error}</p>}
    <div className="operations-grid"><label htmlFor="oncall-staff">Nhân viên<select id="oncall-staff" required value={form.staffId} onChange={event => update({ staffId: event.target.value, attendanceEvidenceId: null })}><option value="">Chọn nhân viên</option>{options.staff.filter(item => item.status === 'active' && item.departmentId && options.departments.find(d => d.id === item.departmentId)?.status !== 'inactive').map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
      <label htmlFor="oncall-facility">Cơ sở<select id="oncall-facility" required value={form.facilityId} onChange={event => update({ facilityId: event.target.value, attendanceEvidenceId: null })}><option value="">Chọn cơ sở</option>{options.facilities.filter(item => item.status === 'active').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label htmlFor="oncall-date">Ngày trực<input id="oncall-date" type="date" required max={today} min={person?.dateJoined || '2000-01-01'} value={form.date} onChange={event => { if (event.target.value) changeDate(event.target.value); }} /></label>
      <label htmlFor="oncall-category">Loại ca<select id="oncall-category" value={form.category} onChange={event => changeDate(form.date, event.target.value)}><option value="noon">Trực trưa</option><option value="evening">Trực tối</option></select></label>
      <label htmlFor="oncall-start">Vào thực tế<input id="oncall-start" type="time" required value={form.start} onChange={event => update({ start: event.target.value })} /></label>
      <label htmlFor="oncall-end">Ra thực tế<input id="oncall-end" type="time" required value={form.end} onChange={event => update({ end: event.target.value })} /></label>
    </div>
    {person && <p className="operations-note">Khoa/phòng: <strong>{department?.name || 'Chưa phân khoa/phòng'}</strong></p>}
    <p className="operations-note">Giờ dự kiến: {hours.join(' – ')} (giờ Việt Nam). Chỉ ghi nhận thời gian thực tế đã diễn ra.</p>
    {form.staffId && form.facilityId && <section className="oncall-shortcut" aria-label="Chọn ngày có chấm công">
      <label htmlFor="oncall-attendance-date">Chọn nhanh từ chấm công tháng {form.date.slice(5, 7)}/{form.date.slice(0, 4)}<select id="oncall-attendance-date" disabled={attendance.loading || !recent.length}
        value={recent.some(item => item.id === form.attendanceEvidenceId) ? form.attendanceEvidenceId || '' : ''} onChange={event => chooseAttendance(event.target.value)}>
        <option value="">{attendance.loading ? 'Đang tìm ngày có chấm công…' : recent.length ? 'Chọn bản ghi để điền ngày và liên kết bằng chứng' : 'Chưa có chấm công của nhân viên tại cơ sở trong tháng này'}</option>
        {recent.map(item => <option key={item.id} value={item.id}>{shortDate(item.workDate, true)} · {clockTime(item.checkIn)}–{clockTime(item.checkOut)} · {attendanceLabel(item.status)}</option>)}
      </select></label>
      {attendance.error ? <p className="operations-note">Không tải được danh sách chọn nhanh. Bạn vẫn có thể nhập ngày trực. <button type="button" className="text-button" onClick={attendance.reload}>Thử lại</button></p>
        : <p className="operations-note">Chọn một bản ghi để dùng ngày và bằng chứng đã có; kiểm tra lại giờ trực thực tế. Bạn cũng có thể nhập ngày khác hoặc <Link to="/attendance/imports/new">nhập tệp chấm công</Link>.</p>}
    </section>}
    <div id="oncall-save-status" className={`oncall-readiness ${issues.length ? 'waiting' : 'ready'}`} role="status" aria-live="polite">
      <strong>{context.loading ? 'Đang kiểm tra lịch và bằng chứng…' : issues.length ? 'Cần bổ sung trước khi lưu' : 'Có thể lưu hồ sơ chờ xác nhận'}</strong>
      {!!issues.length && <ul>{issues.map((issue, index) => <li key={`${issue.field}-${index}`}><a href={`#${issue.field}`}>{issue.message}</a></li>)}</ul>}
      {!issues.length && !context.loading && <p>Hồ sơ được giữ chờ đối chiếu, chưa được dùng tính lương.</p>}
    </div>
    {form.staffId && form.facilityId && <div id="oncall-context"><ResourceState {...context} />{context.data && <section className="operations-panel"><h3>Lịch và bằng chứng trong ngày</h3>
      {context.data.schedules.map(item => <p key={item.id}>{attendanceLabel(item.shift)} · {item.start}–{item.end} · {item.facilityName}</p>)}
      {outsideSchedule && <p id="oncall-outside-schedule" className="operations-note">Chưa có lịch trực đã công bố khớp ca và cơ sở. Bạn có thể ghi nhận trực ngoài lịch: điền <a href="#oncall-reason">lý do</a> và <a href="#oncall-supervisor">căn cứ quản lý</a> bên dưới để lưu hồ sơ chờ xác nhận.</p>}
      <label htmlFor="oncall-evidence">Bằng chứng chấm công (có thể bổ sung sau)<select id="oncall-evidence" value={form.attendanceEvidenceId || ''} onChange={event => update({ attendanceEvidenceId: event.target.value || null })}><option value="">Chưa liên kết · Chờ đối chiếu</option>{context.data.evidence.map(item => <option key={item.id} value={item.id}>{clockTime(item.checkIn)}–{clockTime(item.checkOut)} · {attendanceLabel(item.source)} · {attendanceLabel(item.validationStatus)}</option>)}</select></label>
      {!form.attendanceEvidenceId && <p id="oncall-evidence-hint" className="operations-note">{context.data.evidence.length ? 'Bạn có thể chọn bản ghi ở trên để đối chiếu.' : 'Ngày này chưa có bản ghi chấm công phù hợp.'} Chưa liên kết bằng chứng vẫn lưu được hồ sơ chờ đối chiếu.</p>}
    </section>}</div>}
    <div className="operations-grid"><label className="wide" htmlFor="oncall-reason">Lý do sửa / khác lịch{deviation ? ' *' : ''}<textarea id="oncall-reason" maxLength={1000} required={deviation} value={form.deviationReason} onChange={event => update({ deviationReason: event.target.value })} placeholder={initial ? 'Nội dung cần sửa và lý do sửa' : 'Vì sao phát sinh trực ngoài lịch hoặc giờ thực tế khác dự kiến'} /></label>
      <label className="wide" htmlFor="oncall-supervisor">Căn cứ xác nhận quản lý{outsideSchedule ? ' *' : ''}<textarea id="oncall-supervisor" maxLength={1000} required={outsideSchedule} value={form.supervisorEvidence} onChange={event => update({ supervisorEvidence: event.target.value })} placeholder="Người xác nhận, nội dung cho phép hoặc mã biên bản" /></label>
      <label className="wide" htmlFor="oncall-note">Ghi chú<textarea id="oncall-note" maxLength={1000} value={form.note} onChange={event => update({ note: event.target.value })} /></label>
    </div>
    {form.category === 'evening' && form.end < hours[1] && !form.supervisorEvidence.trim() && <p className="alert warning">Trực tối kết thúc sớm cần quản lý xác nhận tình huống phục vụ bệnh nhân. Hồ sơ sẽ chờ bổ sung căn cứ trước khi được xác nhận.</p>}
    <div className="form-actions"><Link className="button" to={initial ? `/attendance/on-call/${initial.id}` : '/attendance/on-call'}>Hủy</Link><button className="button primary" type="submit" disabled={busy || context.loading || !context.data || !!context.error || context.data.approvedLeave || !!context.data.lockedReason}>{busy ? 'Đang lưu…' : 'Lưu hồ sơ chờ xác nhận'}</button></div>
  </fieldset></form>;
}

export default function OnCallFormPage() {
  const { id } = useParams(); const navigate = useNavigate();
  const options = useApiResource<AttendanceOptions>('/attendance/options');
  const detail = useApiResource<OnCallDetail>(id ? `/attendance/on-call-shifts/${id}` : '');
  const unavailable = !!id && (detail.data?.item.status !== 'pending' || !!detail.data?.lockedReason);
  return <AttendanceShell title={id ? 'Sửa hồ sơ trực' : 'Ghi nhận ca trực'} description="Lưu thời gian trực thực tế và căn cứ đối chiếu; hồ sơ được đưa vào hàng chờ xác nhận."
    actions={<Link className="button" to="/attendance/on-call">Danh sách ca trực</Link>}>
    <ResourceState loading={options.loading || detail.loading} error={options.error || detail.error} reload={() => { options.reload(); detail.reload(); }} />
    {options.data && (!id || detail.data) && (unavailable ? <p className="alert error" role="alert">{detail.data?.lockedReason || 'Hồ sơ đã được xác nhận hoặc không còn ở trạng thái chờ. Không được sửa trực tiếp.'}</p>
      : <Editor key={`${id || 'new'}-${detail.data?.item.version || ''}`} options={options.data} initial={detail.data?.item} onSaved={(newId, message) => navigate(`/attendance/on-call/${newId}`, { state: { notice: message } })} />)}
  </AttendanceShell>;
}
