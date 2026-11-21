import { useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import AttendanceShell from '../../components/attendance/AttendanceShell';
import ResourceState from '../../components/attendance/ResourceState';
import useApiResource from '../../hooks/useApiResource';
import { attendanceApi } from '../../services/attendanceApi';
import { useAuthStore } from '../../store/useAuthStore';
import type { OnCallDetail } from '../../types/attendance';
import { shortDate } from '../../utils/schedule';
import { attendanceLabel, clockTime, instant } from '../../utils/attendance';

export default function OnCallDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const manager = useAuthStore(state => state.session?.user.role === 'hr_staff');
  const resource = useApiResource<OnCallDetail>(`/attendance/on-call-shifts/${id}`);
  const data = resource.data;
  const item = data?.item;

  const [decision, setDecision] = useState<'confirm' | 'return' | 'reject'>('confirm');
  const [reason, setReason] = useState('');
  const [supervisorEvidence, setSupervisorEvidence] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<string>(location.state?.notice || '');

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    if (!id || !item || busy) return;
    if ((decision === 'return' || decision === 'reject') && !reason.trim()) {
      setError('MSG02: Vui lòng nhập lý do trả về hoặc từ chối hồ sơ trực.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await attendanceApi.verifyOnCall(id, {
        decision,
        reason: reason.trim() || undefined,
        supervisorEvidence: supervisorEvidence.trim() || item.supervisorEvidence || undefined,
        version: item.version,
      });
      setNotice(result.message);
      setReason('');
      resource.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể xác nhận hồ sơ trực.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AttendanceShell
      title="Chi tiết hồ sơ trực"
      description="Đối chiếu giờ trực thực tế, lịch phân công và căn cứ xác nhận."
      actions={<Link className="button" to="/attendance/on-call">Danh sách ca trực</Link>}
    >
      {notice && <p className="alert success" role="status">{notice}</p>}
      <ResourceState {...resource} />
      {data && item && (
        <div className="att-split">
          <section className="operations-panel" style={{ margin: 0 }}>
            <div className="att-card-header">
              <h2>{item.staffName} · {item.staffCode}</h2>
              <span className={`att-badge ${item.status}`}>{attendanceLabel(item.status)}</span>
            </div>
            {data.lockedReason && <p className="alert warning">{data.lockedReason}</p>}
            {item.reviewNote && <p className="alert warning">{item.reviewNote}</p>}
            <dl className="operations-detail">
              <div><dt>Ngày / ca</dt><dd>{shortDate(item.date, true)} · {attendanceLabel(item.category)}</dd></div>
              <div><dt>Trạng thái</dt><dd>{attendanceLabel(item.status)}</dd></div>
              <div><dt>Cơ sở</dt><dd>{item.facilityName || 'Chưa xác định'}</dd></div>
              <div><dt>Khoa/phòng</dt><dd>{item.departmentName}</dd></div>
              <div><dt>Giờ dự kiến</dt><dd>{data.plannedStart} – {data.plannedEnd}</dd></div>
              <div><dt>Giờ thực tế</dt><dd>{clockTime(item.start)} – {clockTime(item.end)} · {data.actualHours?.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) ?? '—'} giờ</dd></div>
              <div><dt>Ngày ghi nhận</dt><dd>{instant(item.createdAt)}</dd></div>
              <div><dt>Cập nhật gần nhất</dt><dd>{instant(item.updatedAt)}</dd></div>
              <div><dt>Người ghi nhận</dt><dd>{item.recordedByName || 'Chưa có thông tin'}</dd></div>
              <div><dt>Xác nhận</dt><dd>{item.confirmedByName || 'Chưa xác nhận'} · {instant(item.confirmedAt)}</dd></div>
              <div className="wide"><dt>Lý do điều chỉnh / khác lịch</dt><dd>{item.deviationReason || '—'}</dd></div>
              <div className="wide"><dt>Căn cứ xác nhận quản lý</dt><dd>{item.supervisorEvidence || 'Chưa bổ sung'}</dd></div>
              <div className="wide"><dt>Ghi chú</dt><dd>{item.note || '—'}</dd></div>
            </dl>
            <div className="form-actions">
              <Link className="button" to={`/schedules?date=${item.date}`}>Lịch đã phân công</Link>
              {item.attendanceEvidenceId && <Link className="button" to={`/attendance/records/${item.attendanceEvidenceId}`}>Bằng chứng chấm công</Link>}
              {manager && item.status === 'pending' && !data.lockedReason && (
                <Link className="button primary" to={`/attendance/on-call/${item.id}/edit`}>Sửa hồ sơ trực</Link>
              )}
            </div>
            {item.status !== 'confirmed' && <p className="operations-note">Hồ sơ trực chỉ được đưa vào tính lương sau khi đối chiếu và xác nhận.</p>}
          </section>

          {manager && (
            <aside className="att-card operations-form">
              <div className="att-card-header">
                <div>
                  <h2 className="att-card-title">Xác nhận hồ sơ trực (4.13)</h2>
                  <p className="att-card-sub">Kiểm tra căn cứ chấm công và xác nhận của quản lý trước khi chốt tính lương.</p>
                </div>
              </div>
              {error && <p className="alert error" role="alert">{error}</p>}
              <form onSubmit={e => void handleVerify(e)} noValidate>
                <fieldset disabled={busy || !!data.lockedReason}>
                  <div className="att-radio-cards" role="radiogroup" aria-label="Quyết định xác nhận ca trực">
                    <button
                      type="button"
                      className={`att-radio-card ${decision === 'confirm' ? 'selected' : ''}`}
                      onClick={() => { setError(''); setDecision('confirm'); }}
                    >
                      <strong>Xác nhận ca trực (Confirm)</strong>
                      <small>Đủ điều kiện tổng hợp công trực tháng (GB-09, GB-13)</small>
                    </button>
                    <button
                      type="button"
                      className={`att-radio-card ${decision === 'return' ? 'selected' : ''}`}
                      onClick={() => { setError(''); setDecision('return'); }}
                    >
                      <strong>Trả về bổ sung (Return)</strong>
                      <small>Yêu cầu bổ sung bằng chứng chấm công hoặc xác nhận quản lý</small>
                    </button>
                  </div>

                  {item.category === 'evening' && clockTime(item.end) < '19:00' && !item.supervisorEvidence && (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 500, marginBottom: 8 }}>
                      Xác nhận của Trưởng khoa cho ca tối kết thúc sớm (GB-13) *
                      <input
                        type="text"
                        value={supervisorEvidence}
                        onChange={e => setSupervisorEvidence(e.target.value)}
                        placeholder="Nhập xác nhận của quản lý trực..."
                      />
                    </label>
                  )}

                  <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 500 }}>
                    {decision === 'confirm' ? 'Ghi chú xác nhận (tùy chọn)' : 'Lý do trả về / từ chối (MSG02) *'}
                    <textarea
                      rows={2}
                      value={reason}
                      onChange={e => { setError(''); setReason(e.target.value); }}
                      placeholder="Nhập ghi chú hoặc lý do..."
                    />
                  </label>

                  <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                    <button
                      type="submit"
                      className="button primary"
                      disabled={busy || !!data.lockedReason || (decision === 'confirm' && item.status === 'confirmed')}
                    >
                      {busy ? 'Đang lưu…' : decision === 'confirm' ? 'Xác nhận ca trực' : 'Trả về bổ sung'}
                    </button>
                  </div>
                </fieldset>
              </form>
            </aside>
          )}
        </div>
      )}
    </AttendanceShell>
  );
}
