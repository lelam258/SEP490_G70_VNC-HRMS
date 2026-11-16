import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AttendanceShell from '../../components/attendance/AttendanceShell';
import ResourceState from '../../components/attendance/ResourceState';
import useApiResource from '../../hooks/useApiResource';
import { attendanceApi } from '../../services/attendanceApi';
import type { AttendanceOptions, ManualAttendanceContext } from '../../types/attendance';
import { attendanceLabel, clockTime } from '../../utils/attendance';
import { clinicToday, shiftHours, shortDate } from '../../utils/schedule';

function defaultPairsForShift(date: string, shift: string): { in: string; out: string }[] {
  if (shift === 'main') {
    const [mStart, mEnd] = shiftHours(date, 'morning').split('–');
    const [aStart, aEnd] = shiftHours(date, 'afternoon').split('–');
    return [{ in: mStart, out: mEnd }, { in: aStart, out: aEnd }];
  }
  const [start, end] = shiftHours(date, shift).split('–');
  return [{ in: start, out: end }];
}

export default function ManualAttendanceFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const options = useApiResource<AttendanceOptions>('/attendance/options');

  const initialDate = searchParams.get('date') || clinicToday();
  const initialShift = searchParams.get('shift') || 'main';
  const [staffId, setStaffId] = useState(searchParams.get('staffId') || '');
  const [facilityId, setFacilityId] = useState(searchParams.get('facilityId') || '');
  const [workDate, setWorkDate] = useState(initialDate);
  const [shiftType, setShiftType] = useState(initialShift);
  const [pairs, setPairs] = useState<{ in: string; out: string }[]>(() => defaultPairsForShift(initialDate, initialShift));
  const [sourceReference, setSourceReference] = useState('');
  const [reason, setReason] = useState('');
  const [supervisorEvidence, setSupervisorEvidence] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const received = Date.now();
    setElapsed(0);
    const timer = window.setInterval(() => setElapsed(Date.now() - received), 30_000);
    return () => window.clearInterval(timer);
  }, [options.data?.serverNow]);

  const serverTime = Date.parse(options.data?.serverNow || '');
  const clinicNow = new Date((Number.isFinite(serverTime) ? serverTime + elapsed : Date.now()) + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const today = clinicNow.slice(0, 10);

  const context = useApiResource<ManualAttendanceContext>(
    staffId && facilityId && workDate ? '/attendance/manual-context' : '',
    { staffId, facilityId, date: workDate }
  );

  const person = options.data?.staff.find(item => item.id === staffId);
  const department = options.data?.departments.find(item => item.id === person?.departmentId);

  function handleDateOrShiftChange(nextDate: string, nextShift: string) {
    setError('');
    setWorkDate(nextDate);
    setShiftType(nextShift);
    setPairs(defaultPairsForShift(nextDate, nextShift));
  }

  function updatePair(index: number, field: 'in' | 'out', value: string) {
    setError('');
    setPairs(current => current.map((item, idx) => (idx === index ? { ...item, [field]: value } : item)));
  }

  function addPair() {
    if (pairs.length >= 3) return;
    setPairs(current => [...current, { in: '13:30', out: '17:00' }]);
  }

  function removePair(index: number) {
    if (pairs.length <= 1) return;
    setPairs(current => current.filter((_, idx) => idx !== index));
  }

  const existingDuplicate = context.data?.existingRecords.find(r => r.shiftType === shiftType);
  const candidateShifts = shiftType === 'main' ? ['morning', 'afternoon'] : [shiftType];
  const matchingPlans = (context.data?.schedules || []).filter(s => candidateShifts.includes(s.shift));
  const hasScheduleConflict = !!context.data && (
    context.data.schedules.length === 0 ||
    matchingPlans.length === 0 ||
    matchingPlans.every(s => s.facilityId !== facilityId)
  );
  const lastOut = pairs.map(p => p.out).filter(Boolean).sort().at(-1) || '';
  const eveningEarly = shiftType === 'evening' && lastOut > '00:00' && lastOut < '19:00';
  const willFlag = !!context.data && (context.data.approvedLeave || hasScheduleConflict || (eveningEarly && !supervisorEvidence.trim()));

  const issues: { field: string; message: string }[] = [];
  if (!staffId) issues.push({ field: 'manual-staff', message: 'MSG02: Chọn nhân viên.' });
  if (!facilityId) issues.push({ field: 'manual-facility', message: 'MSG02: Chọn cơ sở làm việc.' });
  if (!workDate) issues.push({ field: 'manual-date', message: 'MSG02: Chọn ngày làm việc.' });
  else if (workDate > today) issues.push({ field: 'manual-date', message: 'MSG04: Không thể nhập chấm công cho ngày tương lai.' });
  else if (person && (workDate < person.dateJoined || (person.dateLeft && workDate > person.dateLeft))) {
    issues.push({ field: 'manual-date', message: `MSG25: Ngày công nằm ngoài thời gian công tác (${shortDate(person.dateJoined, true)}${person.dateLeft ? ` – ${shortDate(person.dateLeft, true)}` : ''}).` });
  }
  if (pairs.some(p => !p.in || !p.out)) {
    issues.push({ field: 'manual-in-0', message: 'MSG02: Nhập đầy đủ giờ Vào và giờ Ra cho từng cặp giờ.' });
  } else {
    let prevOut = '';
    for (let i = 0; i < pairs.length; i++) {
      if (pairs[i].out <= pairs[i].in) {
        issues.push({ field: `manual-out-${i}`, message: `MSG04: Cặp giờ ${i + 1} có giờ Ra không sau giờ Vào.` });
        break;
      }
      if (prevOut && pairs[i].in < prevOut) {
        issues.push({ field: `manual-in-${i}`, message: 'MSG04: Các cặp giờ Vào/Ra bị chồng lấn hoặc không theo thứ tự thời gian.' });
        break;
      }
      prevOut = pairs[i].out;
    }
    if (workDate === today && lastOut > clinicNow.slice(11)) {
      issues.push({ field: 'manual-out-0', message: `MSG04: Giờ ra ${lastOut} hôm nay chưa diễn ra (hiện tại ${clinicNow.slice(11)}).` });
    }
  }
  if (context.data?.lockedReason) issues.push({ field: 'manual-date', message: context.data.lockedReason });
  if (existingDuplicate) {
    issues.push({ field: 'manual-shift', message: 'MSG04: Ngày và ca này đã có bản ghi chấm công. Vui lòng mở bản ghi hiện có để Đối chiếu (4.11).' });
  }
  if (!reason.trim()) issues.push({ field: 'manual-reason', message: 'MSG02: Nhập lý do / căn cứ bảng công giấy cho bản ghi thủ công.' });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (issues.length) {
      setError(issues[0].message);
      document.getElementById(issues[0].field)?.focus();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await attendanceApi.createManual({
        staffId,
        facilityId,
        workDate,
        shiftType,
        pairs,
        sourceReference: sourceReference.trim(),
        reason: reason.trim(),
        supervisorEvidence: supervisorEvidence.trim() || undefined,
      });
      navigate(`/attendance/records/${result.id}`, { state: { notice: result.message } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu bản ghi chấm công thủ công.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AttendanceShell
      title="Nhập chấm công thủ công"
      description="Tạo bản ghi từ bảng chấm công giấy khi máy vân tay không ghi nhận; kiểm tra lịch, nghỉ phép và lưu chờ xác nhận."
      actions={<Link className="button" to="/attendance/records">Bảng chấm công</Link>}
    >
      <ResourceState loading={options.loading} error={options.error} reload={options.reload} />
      {options.data && (
        <div className="att-split">
          <form className="att-card operations-form" noValidate onSubmit={event => void submit(event)}>
            <div className="att-card-header">
              <div>
                <h2 className="att-card-title">Thông tin ngày công & Cặp giờ</h2>
                <p className="att-card-sub">Điền giờ thực tế theo bảng chấm công giấy hoặc biên bản xác nhận của khoa.</p>
              </div>
              <span className="att-badge neutral">UC 4.12 · Nguồn thủ công</span>
            </div>

            {error && <p className="alert error" role="alert">{error}</p>}

            <fieldset disabled={busy}>
              <div className="operations-grid">
                <label htmlFor="manual-staff">
                  Nhân viên *
                  <select id="manual-staff" required value={staffId} onChange={e => { setError(''); setStaffId(e.target.value); }}>
                    <option value="">Chọn nhân viên đang hoạt động</option>
                    {options.data.staff
                      .filter(s => s.status === 'active' && s.departmentId && options.data?.departments.find(d => d.id === s.departmentId)?.status !== 'inactive')
                      .map(s => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
                  </select>
                </label>

                <label htmlFor="manual-facility">
                  Cơ sở làm việc *
                  <select id="manual-facility" required value={facilityId} onChange={e => { setError(''); setFacilityId(e.target.value); }}>
                    <option value="">Chọn cơ sở</option>
                    {options.data.facilities.filter(f => f.status === 'active').map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </label>

                <label htmlFor="manual-date">
                  Ngày làm việc *
                  <input
                    id="manual-date"
                    type="date"
                    required
                    max={today}
                    min={person?.dateJoined || '2000-01-01'}
                    value={workDate}
                    onChange={e => e.target.value && handleDateOrShiftChange(e.target.value, shiftType)}
                  />
                </label>

                <label htmlFor="manual-shift">
                  Ca làm việc *
                  <select id="manual-shift" value={shiftType} onChange={e => handleDateOrShiftChange(workDate, e.target.value)}>
                    <option value="main">Ca chính (Sáng / Chiều)</option>
                    <option value="noon">Trực trưa (On-call Noon)</option>
                    <option value="evening">Trực tối (On-call Evening)</option>
                  </select>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <strong style={{ fontSize: 12.5, color: '#334155' }}>Các cặp giờ Vào / Ra (HH:mm) *</strong>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="button" style={{ padding: '4px 9px', fontSize: 11.5 }} onClick={() => setPairs(defaultPairsForShift(workDate, shiftType))}>
                    Điền giờ chuẩn ca
                  </button>
                  {pairs.length < 3 && (
                    <button type="button" className="button" style={{ padding: '4px 9px', fontSize: 11.5 }} onClick={addPair}>
                      + Thêm cặp giờ
                    </button>
                  )}
                </div>
              </div>

              <div className="att-compact-pairs">
                {pairs.map((pair, idx) => (
                  <div key={idx} className="att-compact-pair">
                    <span style={{ fontWeight: 600, color: '#475569' }}>Lần {idx + 1}</span>
                    <input
                      id={`manual-in-${idx}`}
                      aria-label={`Giờ vào lần ${idx + 1}`}
                      type="time"
                      required
                      value={pair.in}
                      onChange={e => updatePair(idx, 'in', e.target.value)}
                    />
                    <input
                      id={`manual-out-${idx}`}
                      aria-label={`Giờ ra lần ${idx + 1}`}
                      type="time"
                      required
                      value={pair.out}
                      onChange={e => updatePair(idx, 'out', e.target.value)}
                    />
                    {pairs.length > 1 ? (
                      <button type="button" className="button" style={{ padding: '4px 8px', fontSize: 11.5 }} onClick={() => removePair(idx)}>
                        Xóa
                      </button>
                    ) : <span />}
                  </div>
                ))}
              </div>

              <div className="operations-grid" style={{ marginTop: 8 }}>
                <label htmlFor="manual-source-ref">
                  Mã tham chiếu bảng công giấy
                  <input
                    id="manual-source-ref"
                    type="text"
                    maxLength={200}
                    value={sourceReference}
                    onChange={e => setSourceReference(e.target.value)}
                    placeholder="VD: Bảng chấm công giấy Khoa Nội - Tờ 02"
                  />
                </label>

                <label htmlFor="manual-supervisor">
                  Xác nhận của Trưởng khoa / Quản lý {eveningEarly ? '*' : '(nếu có)'}
                  <input
                    id="manual-supervisor"
                    type="text"
                    maxLength={500}
                    value={supervisorEvidence}
                    onChange={e => setSupervisorEvidence(e.target.value)}
                    placeholder="Họ tên quản lý xác nhận ca đặc biệt / về sớm"
                  />
                </label>

                <label className="wide" htmlFor="manual-reason">
                  Lý do & Bằng chứng nhập thủ công *
                  <textarea
                    id="manual-reason"
                    required
                    maxLength={1000}
                    rows={2}
                    value={reason}
                    onChange={e => { setError(''); setReason(e.target.value); }}
                    placeholder="Nêu rõ lý do máy vân tay không ghi nhận và căn cứ giấy tờ đi kèm..."
                  />
                </label>
              </div>

              <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
                <Link className="button" to="/attendance/records">Hủy</Link>
                <button
                  id="manual-submit"
                  className="button primary"
                  type="submit"
                  disabled={busy || !!context.data?.lockedReason || !!existingDuplicate}
                >
                  {busy ? 'Đang lưu…' : willFlag ? 'Lưu & Gắn cờ đối chiếu (Flagged)' : 'Lưu bản ghi chờ xác nhận'}
                </button>
              </div>
            </fieldset>
          </form>

          <aside className="att-card" id="manual-context-panel">
            <div className="att-card-header">
              <div>
                <h2 className="att-card-title">Đối chiếu ngữ cảnh trong ngày</h2>
                <p className="att-card-sub">
                  {person ? `${person.code} · ${person.name} (${department?.name || 'Chưa phân khoa'})` : 'Chọn nhân viên, cơ sở và ngày để kiểm tra xung đột.'}
                </p>
              </div>
              {context.data && (
                <span className={`att-badge ${issues.length ? 'error' : willFlag ? 'warning' : 'ready'}`}>
                  {issues.length ? 'Chưa đủ điều kiện' : willFlag ? 'Sẽ gắn cờ Flagged' : 'Hợp lệ · Chờ xác nhận'}
                </span>
              )}
            </div>

            <div id="manual-readiness" className={`oncall-readiness ${issues.length || willFlag ? 'waiting' : 'ready'}`} role="status" aria-live="polite">
              <strong>
                {context.loading
                  ? 'Đang kiểm tra lịch làm việc, nghỉ phép và chấm công hiện có…'
                  : issues.length
                  ? 'Cần kiểm tra trước khi lưu:'
                  : willFlag
                  ? 'MSG04: Phát hiện lệch lịch / nghỉ phép — Hệ thống sẽ lưu ở trạng thái Cần đối chiếu (Flagged)'
                  : 'Sẵn sàng lưu bản ghi chấm công thủ công (Pending Verification)'}
              </strong>
              {!!issues.length && (
                <ul>
                  {issues.map((issue, idx) => (
                    <li key={idx}><a href={`#${issue.field}`}>{issue.message}</a></li>
                  ))}
                </ul>
              )}
              {!issues.length && willFlag && (
                <p>Bản ghi vẫn được lưu kèm bằng chứng nhưng bắt buộc qua bước Đối chiếu & Quản lý xác nhận trước khi duyệt tính lương (GB-06, GB-07).</p>
              )}
            </div>

            {staffId && facilityId && (
              <>
                <ResourceState loading={context.loading} error={context.error} reload={context.reload} />
                {context.data && (
                  <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
                    <div className={`att-source-box ${matchingPlans.length ? 'highlight' : 'warn'}`}>
                      <div className="att-source-head">
                        <span>1. Lịch phân công đã công bố ({shortDate(workDate, true)})</span>
                        <span>{context.data.schedules.length} ca</span>
                      </div>
                      {context.data.schedules.length ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {context.data.schedules.map(s => (
                            <span key={s.id} className="att-time-chip">
                              {attendanceLabel(s.shift)}: {s.start}–{s.end} · {s.facilityName}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="operations-note" style={{ margin: 0 }}>Chưa có lịch phân công đã công bố trong ngày này.</p>
                      )}
                    </div>

                    <div className={`att-source-box ${context.data.approvedLeave ? 'warn' : ''}`}>
                      <div className="att-source-head">
                        <span>2. Đơn nghỉ phép đã duyệt</span>
                        <span>{context.data.approvedLeave ? 'Có nghỉ phép' : 'Không có'}</span>
                      </div>
                      {context.data.leaves.length ? (
                        context.data.leaves.map(lv => (
                          <p key={lv.id} className="operations-note" style={{ margin: 0, color: '#b45309', fontWeight: 500 }}>
                            Nghỉ phép ({lv.leaveType}): {shortDate(lv.startDate, true)} – {shortDate(lv.endDate, true)} {lv.reason ? `· ${lv.reason}` : ''}
                          </p>
                        ))
                      ) : (
                        <p className="operations-note" style={{ margin: 0 }}>Nhân viên không có đơn nghỉ phép đã duyệt trong ngày.</p>
                      )}
                    </div>

                    <div className={`att-source-box ${existingDuplicate ? 'warn' : ''}`}>
                      <div className="att-source-head">
                        <span>3. Bản ghi chấm công & Ca trực hiện có</span>
                        <span>{context.data.existingRecords.length} bản ghi</span>
                      </div>
                      {context.data.existingRecords.length ? (
                        <div style={{ display: 'grid', gap: 6 }}>
                          {context.data.existingRecords.map(rec => (
                            <div key={rec.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                              <span>
                                <strong>{attendanceLabel(rec.shiftType)}</strong>: {clockTime(rec.checkIn)}–{clockTime(rec.checkOut)} ({attendanceLabel(rec.source)} · {attendanceLabel(rec.status)})
                              </span>
                              <Link className="button" style={{ padding: '2px 8px', fontSize: 11 }} to={`/attendance/records/${rec.id}`}>
                                Mở đối chiếu
                              </Link>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="operations-note" style={{ margin: 0 }}>Chưa có bản ghi chấm công nào cho nhân viên trong ngày này.</p>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </aside>
        </div>
      )}
    </AttendanceShell>
  );
}
