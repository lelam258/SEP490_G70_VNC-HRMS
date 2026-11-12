import { Link, useParams } from 'react-router-dom';
import AttendanceShell from '../../components/attendance/AttendanceShell';
import ResourceState from '../../components/attendance/ResourceState';
import useApiResource from '../../hooks/useApiResource';
import type { AttendanceDetail } from '../../types/attendance';
import { useAuthStore } from '../../store/useAuthStore';
import { attendanceLabel, clockTime, instant } from '../../utils/attendance';
import { shortDate } from '../../utils/schedule';

export default function AttendanceRecordDetailPage() {
  const { id } = useParams();
  const resource = useApiResource<AttendanceDetail>(`/attendance/records/${id}`);
  const role = useAuthStore(state => state.session?.user.role || '');
  const data = resource.data; const item = data?.item;
  const actor = (actorId: string | null | undefined) => data?.actors.find(x => x.id === actorId)?.name || '—';
  return <AttendanceShell title="Chi tiết chấm công" description="Thông tin ngày công, bằng chứng nguồn và lịch sử xác nhận."
    actions={<Link className="button" to="/attendance/records">Danh sách chấm công</Link>}>
    <ResourceState {...resource} />
    {data && item && <><section className="operations-panel"><h2>{item.staffName} · {item.staffCode}</h2>
      {data.lockedReason && <p className="alert warning">{data.lockedReason}</p>}
      <dl className="operations-detail">
        <div><dt>Ngày / ca</dt><dd>{shortDate(item.workDate, true)} · {attendanceLabel(item.shiftType)}</dd></div><div><dt>Trạng thái</dt><dd>{attendanceLabel(item.status)}</dd></div>
        <div><dt>Khoa/phòng</dt><dd>{item.departmentName || '—'}</dd></div><div><dt>Cơ sở</dt><dd>{item.facilityName || 'Chưa xác định'}</dd></div>
        <div><dt>Nguồn</dt><dd>{attendanceLabel(item.source)}</dd></div><div><dt>Mã máy chấm công</dt><dd>{data.deviceEnrollId || '—'}</dd></div>
        <div><dt>Giờ ghi nhận</dt><dd>{item.actualHours?.toLocaleString('vi-VN') ?? '—'} giờ</dd></div><div><dt>Ngày tạo</dt><dd>{instant(data.createdAt)}</dd></div>
        {data.batch && <div className="wide"><dt>Tệp / đợt nhập</dt><dd>{['admin', 'hr_staff', 'hr_manager'].includes(role) ? <Link to={`/attendance/imports/${data.batch.id}/preview`}>{data.batch.fileName}</Link> : data.batch.fileName} · {data.batch.deviceSource || 'Máy chấm công'}</dd></div>}
        <div><dt>Người đối chiếu gần nhất</dt><dd>{actor(data.reconciledBy)} · {instant(data.reconciledAt)}</dd></div><div><dt>Người xác nhận</dt><dd>{actor(data.confirmedBy)} · {instant(data.confirmedAt)}</dd></div>
        {data.note && <div className="wide"><dt>Ghi chú / điểm cần đối chiếu</dt><dd>{data.note}</dd></div>}{data.reconcileNote && <div className="wide"><dt>Căn cứ điều chỉnh</dt><dd>{data.reconcileNote}</dd></div>}
      </dl>
      <h3>Các cặp vào / ra</h3><div className="operations-stats">{data.pairs.map((pair, index) => <span key={index}>Lần {index + 1}: {clockTime(pair.in)} – {clockTime(pair.out)}</span>)}</div>
      <div className="operations-actions"><Link className="button" to={`/schedules?date=${item.workDate}`}>Lịch làm việc của tuần</Link>{item.onCallShiftId && <Link className="button" to={`/attendance/on-call/${item.onCallShiftId}`}>Hồ sơ trực liên quan</Link>}</div>
    </section><section className="operations-panel"><h2>Diễn biến bản ghi</h2>
      {data.events.length ? <ul>{data.events.map(event => <li key={event.logId}>{instant(event.createdAt)} · {attendanceLabel(event.action)} · {event.username || 'Hệ thống'}</li>)}</ul> : <p>Chưa có sự kiện lịch sử riêng cho bản ghi này.</p>}
      {item.status !== 'confirmed' && <p className="operations-note">Bản ghi chưa xác nhận chưa được dùng để tính lương.</p>}
    </section></>}
  </AttendanceShell>;
}
