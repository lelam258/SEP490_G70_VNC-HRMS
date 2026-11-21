import Icon from '../ui/Icon';
import type { ScheduleRow } from '../../types/schedules';
import { canChangeShift } from '../../utils/schedule';
import '../../styles/schedule-timetable.css';

const shiftRows = [
  { key: 'morning', name: 'Sáng', hint: 'Giờ theo mùa' },
  { key: 'noon', name: 'Trực trưa', hint: 'Sau ca sáng – 13:30' },
  { key: 'afternoon', name: 'Chiều', hint: '13:30 – 17:00' },
  { key: 'evening', name: 'Trực tối', hint: '17:00 – 19:00' },
];
const dayNames = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật'];
function dateKey(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
function moveDate(date: string, days: number) { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + days); return dateKey(d); }
function formatDate(date: string, year = false) { return new Date(`${date}T12:00:00`).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', ...(year ? { year: 'numeric' } : {}) }); }

export default function ScheduleTimetable({ date, rows, head, canEdit, now, busy, loading = false, onDateChange, onEdit, onCancel, onConfirmPatient, onEndDuty, onInspect, onCreateSlot }: {
  date: string; rows: ScheduleRow[]; head: boolean; canEdit: boolean; now: number; busy: boolean; loading?: boolean;
  onDateChange: (date: string) => void; onEdit: (row: ScheduleRow) => void;
  onCancel: (row: ScheduleRow) => void; onConfirmPatient: (row: ScheduleRow) => void;
  onEndDuty: (row: ScheduleRow) => void;
  onInspect?: (row: ScheduleRow) => void;
  onCreateSlot?: (slot: { date: string; shift: string }) => void;
}) {
  const dayOffset = (new Date(`${date}T12:00:00`).getDay() + 6) % 7;
  const monday = moveDate(date, -dayOffset);
  const days = dayNames.map((name, day) => ({ name, date: moveDate(monday, day) }));
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' }).format(new Date());
  const weekRows = rows.filter(row => days.some(day => day.date === row.assignment.date));
  const grouped = new Map<string, ScheduleRow[]>();
  for (const row of weekRows) {
    const key = `${row.assignment.date}-${row.assignment.shift}`;
    grouped.set(key, [...(grouped.get(key) || []), row]);
  }
  const pending = busy || loading;
  return <section className="schedule-timetable panel" aria-labelledby="schedule-timetable-title" aria-busy={loading}>
    <div className="schedule-timetable-heading">
      <div><h2 id="schedule-timetable-title">Lịch tuần <span>{weekRows.length} phân công</span></h2><p>{formatDate(monday, true)} – {formatDate(days[6].date, true)}{loading && <span className="schedule-calendar-loading" role="status">Đang tải…</span>}</p></div>
      <div className="schedule-week-navigation" role="group" aria-label="Chuyển tuần trong thời khóa biểu">
        <button type="button" disabled={pending} onClick={() => onDateChange(moveDate(monday, -7))}><Icon name="arrow" size={15} />Tuần trước</button>
        <button type="button" className="schedule-current-week" disabled={pending} onClick={() => onDateChange(today)}>Tuần này</button>
        <button type="button" disabled={pending} onClick={() => onDateChange(moveDate(monday, 7))}>Tuần sau<Icon name="arrow" size={15} /></button>
      </div>
    </div>
    <div className="schedule-timetable-legend"><span><i className="draft" />Nháp</span><span><i className="published" />Đã chốt</span><span><i className="cancelled" />Đã hủy</span><small>{head && onCreateSlot ? 'Bấm + để phân công · Bấm tên để xem chi tiết' : onInspect ? 'Bấm tên để xem chi tiết' : 'Giờ hiển thị theo ngày làm việc'}</small></div>
    <div className="schedule-timetable-scroll" role="region" aria-label="Thời khóa biểu làm việc từ thứ Hai đến Chủ nhật" tabIndex={0}>
      <table className="schedule-week-table">
        <caption className="sr-only">Lịch tuần từ {formatDate(monday, true)} đến {formatDate(days[6].date, true)}. Cột là ngày, hàng là ca làm việc.</caption>
        <thead><tr><th scope="col">Ca làm việc</th>{days.map((day, index) => <th key={day.date} scope="col" className={`${day.date === today ? 'is-today' : ''} ${index === 6 ? 'is-sunday' : ''}`}><span>{day.name}</span><strong>{formatDate(day.date)}</strong>{day.date === today && <small>Hôm nay</small>}</th>)}</tr></thead>
        <tbody>{shiftRows.map(shift => <tr key={shift.key} className={`schedule-slot-row ${shift.key}`}>
          <th scope="row"><span className="schedule-slot-icon"><Icon name="clock" size={16} /></span><strong>{shift.name}</strong><small>{shift.hint}</small></th>
          {days.map(day => {
            const assignments = grouped.get(`${day.date}-${shift.key}`) || [];
            return <td key={day.date} className={day.date === today ? 'is-today' : ''} aria-label={`${day.name} ${formatDate(day.date)}, ${shift.name}`}>
              {assignments.length === 0 ? head && onCreateSlot && canChangeShift(day.date, shift.key, now) ? <button type="button" className="schedule-empty-slot-create" disabled={pending} onClick={() => onCreateSlot({ date: day.date, shift: shift.key })} aria-label={`Phân công ${shift.name}, ${day.name}, ngày ${formatDate(day.date, true)}`} title={`Phân công ${shift.name}, ${formatDate(day.date)}`}><Icon name="plus" size={16} /><span>Phân công</span></button> : <span className="schedule-empty-slot">—</span> : <div className="schedule-event-stack">{assignments.map(row => {
                const assignment = row.assignment;
                const status = assignment.cancelled ? 'cancelled' : row.published ? 'published' : 'draft';
                const duty = ['noon', 'evening'].includes(assignment.shift);
                const editable = canEdit && !row.published && canChangeShift(assignment.date, assignment.shift, now);
                const recordable = row.published && duty && new Date(`${assignment.date}T${row.start}:00+07:00`).getTime() <= now;
                const hasActions = (editable && !assignment.patientConfirmed && !assignment.actualEndAt) || (recordable && (!assignment.patientConfirmed || !assignment.actualEndAt));
                return <article key={assignment.id} className={`schedule-event ${status}`}>
                  <div className="schedule-event-top">
                    {onInspect ? <button type="button" className="schedule-event-name" disabled={busy} onClick={() => onInspect(row)} aria-label={`Xem lịch của ${row.fullName}, ${shift.name}, ngày ${formatDate(day.date, true)}`}>{row.fullName}</button> : <strong className="schedule-event-name">{row.fullName}</strong>}
                    {head && !assignment.cancelled && hasActions && <details className="schedule-event-menu"><summary aria-label={`Thao tác với lịch của ${row.fullName}`} title="Thao tác"><span aria-hidden="true">•••</span></summary><div className="schedule-event-actions">
                      {editable && !assignment.patientConfirmed && !assignment.actualEndAt && <><button type="button" disabled={pending} onClick={() => onEdit(row)}><Icon name="edit" size={13} />Sửa phân công</button><button type="button" className="schedule-cancel-action" disabled={pending} onClick={() => onCancel(row)}><Icon name="close" size={13} />Hủy phân công</button></>}
                      {recordable && <>
                        {!assignment.patientConfirmed && <button type="button" disabled={pending} onClick={() => onConfirmPatient(row)}><Icon name="check" size={13} />Xác nhận bệnh nhân</button>}
                        {!assignment.actualEndAt && <button type="button" disabled={pending} onClick={() => onEndDuty(row)}><Icon name="clock" size={13} />Kết thúc trực</button>}
                      </>}
                    </div></details>}
                  </div>
                  <p className="schedule-event-time"><Icon name="clock" size={12} />{row.start}–{row.end}</p>
                  <p className="schedule-event-place" title={`${row.facility} · ${row.coverage}`}>{row.facility} · {row.coverage}</p>
                  <div className="schedule-event-footer"><span className="schedule-event-status">{assignment.cancelled ? 'Đã hủy' : row.published ? 'Đã chốt' : 'Nháp'}</span>{duty && row.dutyCredit && !assignment.cancelled && <span className="schedule-event-credit confirmed" title="Đã ghi nhận công trực"><Icon name="check" size={11} />Có công</span>}</div>
                  {!onInspect && assignment.actualEndAt && <p className="schedule-event-actual">Kết thúc {new Date(assignment.actualEndAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })}</p>}
                </article>;
              })}</div>}
            </td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>
    {weekRows.length === 0 && !loading && <p className="schedule-timetable-empty">Chưa có phân công phù hợp trong tuần này.</p>}
  </section>;
}
