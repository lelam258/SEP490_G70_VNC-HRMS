import { Link, useLocation, useParams } from 'react-router-dom';
import AttendanceShell from '../../components/attendance/AttendanceShell';
import ResourceState from '../../components/attendance/ResourceState';
import useApiResource from '../../hooks/useApiResource';
import { useAuthStore } from '../../store/useAuthStore';
import type { OnCallDetail } from '../../types/attendance';
import { shortDate } from '../../utils/schedule';
import { attendanceLabel, clockTime, instant } from '../../utils/attendance';

export default function OnCallDetailPage() {
  const { id } = useParams(); const location = useLocation();
  const manager = useAuthStore(state => state.session?.user.role === 'hr_staff');
  const resource = useApiResource<OnCallDetail>(`/attendance/on-call-shifts/${id}`);
  const data = resource.data; const item = data?.item;
  return <AttendanceShell title="Chi tiết hồ sơ trực" description="Đối chiếu giờ trực thực tế, lịch phân công và căn cứ xác nhận."
    actions={<Link className="button" to="/attendance/on-call">Danh sách ca trực</Link>}>
    {location.state?.notice && <p className="alert success" role="status">{location.state.notice}</p>}
    <ResourceState {...resource} />
    {data && item && <section className="operations-panel"><h2>{item.staffName} · {item.staffCode}</h2>
      {data.lockedReason && <p className="alert warning">{data.lockedReason}</p>}{item.reviewNote && <p className="alert warning">{item.reviewNote}</p>}
      <dl className="operations-detail"><div><dt>Ngày / ca</dt><dd>{shortDate(item.date, true)} · {attendanceLabel(item.category)}</dd></div><div><dt>Trạng thái</dt><dd>{attendanceLabel(item.status)}</dd></div>
        <div><dt>Cơ sở</dt><dd>{item.facilityName || 'Chưa xác định'}</dd></div><div><dt>Khoa/phòng</dt><dd>{item.departmentName}</dd></div>
        <div><dt>Giờ dự kiến</dt><dd>{data.plannedStart} – {data.plannedEnd}</dd></div><div><dt>Giờ thực tế</dt><dd>{clockTime(item.start)} – {clockTime(item.end)} · {data.actualHours?.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) ?? '—'} giờ</dd></div>
        <div><dt>Ngày ghi nhận</dt><dd>{instant(item.createdAt)}</dd></div><div><dt>Cập nhật gần nhất</dt><dd>{instant(item.updatedAt)}</dd></div>
        <div><dt>Người ghi nhận</dt><dd>{item.recordedByName || 'Chưa có thông tin'}</dd></div><div><dt>Xác nhận</dt><dd>{item.confirmedByName || 'Chưa xác nhận'} · {instant(item.confirmedAt)}</dd></div>
        <div className="wide"><dt>Lý do điều chỉnh / khác lịch</dt><dd>{item.deviationReason || '—'}</dd></div><div className="wide"><dt>Căn cứ xác nhận quản lý</dt><dd>{item.supervisorEvidence || 'Chưa bổ sung'}</dd></div><div className="wide"><dt>Ghi chú</dt><dd>{item.note || '—'}</dd></div>
      </dl>
      <div className="form-actions"><Link className="button" to={`/schedules?date=${item.date}`}>Lịch đã phân công</Link>{item.attendanceEvidenceId && <Link className="button" to={`/attendance/records/${item.attendanceEvidenceId}`}>Bằng chứng chấm công</Link>}{manager && item.status === 'pending' && !data.lockedReason && <Link className="button primary" to={`/attendance/on-call/${item.id}/edit`}>Sửa hồ sơ trực</Link>}</div>
      {item.status !== 'confirmed' && <p className="operations-note">Hồ sơ trực chỉ được đưa vào tính lương sau khi đối chiếu và xác nhận.</p>}
    </section>}
  </AttendanceShell>;
}
