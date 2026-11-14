import { useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AttendanceShell from '../../components/attendance/AttendanceShell';
import ResourceState from '../../components/attendance/ResourceState';
import useApiResource from '../../hooks/useApiResource';
import { attendanceApi } from '../../services/attendanceApi';
import { useAuthStore } from '../../store/useAuthStore';
import type { MonthlyAttendanceSummary } from '../../types/attendance';
import { attendanceLabel, instant } from '../../utils/attendance';
import { clinicToday, shortDate } from '../../utils/schedule';

export default function MonthlyAttendancePage() {
  const role = useAuthStore(state => state.session?.user.role || '');
  const canLock = role === 'hr_staff';

  const [searchParams, setSearchParams] = useSearchParams();
  const initialMonth = searchParams.get('month') || clinicToday().slice(0, 7);
  const [month, setMonth] = useState(initialMonth);
  const [activeTab, setActiveTab] = useState<'staff' | 'scope' | 'exceptions'>('staff');
  const [deptFilter, setDeptFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [lockNote, setLockNote] = useState('');
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const dialogRef = useRef<HTMLDialogElement>(null);
  const resource = useApiResource<MonthlyAttendanceSummary>(`/attendance/monthly-timesheets/${month}`);
  const summary = resource.data;

  const handleMonthChange = (nextMonth: string) => {
    if (!nextMonth) return;
    setMonth(nextMonth);
    setSearchParams({ month: nextMonth }, { replace: true });
    setError('');
    setNotice('');
  };

  const departments = useMemo(() => {
    if (!summary) return [];
    return summary.departmentTotals.map(d => ({ id: d.id, name: d.name }));
  }, [summary]);

  const filteredStaff = useMemo(() => {
    if (!summary) return [];
    const q = searchQuery.trim().toLowerCase();
    return summary.staffSummaries.filter(s => {
      if (deptFilter && s.departmentId !== deptFilter) return false;
      if (
        q &&
        !s.staffName.toLowerCase().includes(q) &&
        !s.staffCode.toLowerCase().includes(q) &&
        !(s.departmentName || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [summary, deptFilter, searchQuery]);

  const filteredExceptions = useMemo(() => {
    if (!summary) return [];
    const q = searchQuery.trim().toLowerCase();
    return summary.exceptions.filter(ex => {
      if (deptFilter && ex.departmentId !== deptFilter) return false;
      if (
        q &&
        !ex.staffName.toLowerCase().includes(q) &&
        !ex.staffCode.toLowerCase().includes(q) &&
        !(ex.departmentName || '').toLowerCase().includes(q) &&
        !ex.message.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [summary, deptFilter, searchQuery]);

  const openConfirmModal = () => {
    setError('');
    setNotice('');
    dialogRef.current?.showModal();
  };

  const closeConfirmModal = () => {
    dialogRef.current?.close();
  };

  const handleLockMonthly = async () => {
    if (!summary || locking) return;
    setLocking(true);
    setError('');
    setNotice('');
    try {
      const result = await attendanceApi.lockMonthly(month, summary.version, lockNote.trim());
      closeConfirmModal();
      setNotice(result.message);
      setLockNote('');
      resource.reload();
    } catch (err) {
      closeConfirmModal();
      setError(err instanceof Error ? err.message : 'Không thể khóa bảng chấm công tháng.');
    } finally {
      setLocking(false);
    }
  };

  const totalExceptionsCount = summary
    ? summary.totals.flaggedRecords +
      summary.totals.unconfirmedRecords +
      summary.totals.pendingOnCalls +
      summary.totals.unaccountedScheduledShifts
    : 0;

  const blockingMessage = summary?.lockedReason || summary?.consolidationLockReason || (
    totalExceptionsCount > 0
      ? `MSG04 / MSG05: Còn ${totalExceptionsCount} ngoại lệ chấm công / ca trực chưa xử lý hoặc xác nhận trước khi khóa sổ.`
      : null
  );

  return (
    <AttendanceShell
      title="Chốt bảng chấm công tháng"
      description="Tổng hợp ngày công chính, ca trực trưa/tối, giờ tăng ca và nghỉ phép toàn phòng khám trước khi khóa sổ tính lương (UC 4.14)."
      actions={
        <>
          {summary && (
            <span className={`att-badge ${summary.status === 'locked' ? 'confirmed' : summary.canLock ? 'ready' : 'warning'}`}>
              Kỳ {summary.payMonth}: {attendanceLabel(summary.status)} ({attendanceLabel(summary.windowStatus)})
            </span>
          )}
          <Link className="button" to={`/attendance/records`}>
            Bảng chấm công
          </Link>
          {canLock && summary && (
            <button
              id="lock-monthly-btn"
              type="button"
              className="button primary"
              disabled={!summary.canLock || locking || summary.status === 'locked'}
              onClick={openConfirmModal}
              title={blockingMessage || 'Chốt và khóa bảng chấm công tháng'}
            >
              {summary.status === 'locked' ? 'Đã khóa bảng công' : 'Khóa bảng công tháng'}
            </button>
          )}
        </>
      }
    >
      <ResourceState loading={resource.loading} error={resource.error} reload={resource.reload} />
      {error && <p className="alert error" role="alert" style={{ margin: '0 0 8px' }}>{error}</p>}
      {notice && <p className="alert success" role="status" style={{ margin: '0 0 8px' }}>{notice}</p>}

      {summary && (
        <>
          {summary.status === 'locked' ? (
            <div
              className="alert success"
              style={{
                margin: '0 0 8px',
                padding: '7px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <span>
                <strong>Bảng công tháng {summary.payMonth} đã được khóa cho kỳ tính lương.</strong> Người khóa:{' '}
                {summary.lockedByName || 'HR Staff'} · Thời điểm: {instant(summary.lockedAt)}
              </span>
              <span style={{ fontSize: 12 }}>
                Mở tổng hợp (GB-52): {shortDate(summary.consolidationOpenDate, true)} · Hạn khóa chuẩn: {shortDate(summary.standardLockDate, true)}
              </span>
            </div>
          ) : blockingMessage ? (
            <div
              className="alert warning"
              style={{
                margin: '0 0 8px',
                padding: '7px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <span>
                <strong>Trạng thái kiểm soát khóa sổ:</strong> {blockingMessage}
              </span>
              {summary.exceptions.length > 0 && activeTab !== 'exceptions' && (
                <button
                  type="button"
                  className="button"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={() => setActiveTab('exceptions')}
                >
                  Xem {summary.exceptions.length} ngoại lệ cần xử lý
                </button>
              )}
            </div>
          ) : null}

          {/* 6-Card Single-Row KPI Strip */}
          <div className="att-kpi-grid" style={{ marginBottom: 8 }}>
            <div className="att-kpi">
              <span>Nhân sự & Công chính</span>
              <strong>{summary.totals.confirmedMainDays} công</strong>
              <small>{summary.totals.totalStaff} nhân sự hoạt động</small>
            </div>
            <div className="att-kpi">
              <span>Trực Trưa / Tối xác nhận</span>
              <strong>
                {summary.totals.confirmedNoonDuties} / {summary.totals.confirmedEveningDuties}
              </strong>
              <small>Ca trực trưa / Ca trực tối</small>
            </div>
            <div className="att-kpi">
              <span>Tổng giờ & Tăng ca (OT)</span>
              <strong>{summary.totals.confirmedHours.toLocaleString('vi-VN')}h</strong>
              <small>Tăng ca (OT): {summary.totals.overtimeHours.toLocaleString('vi-VN')}h</small>
            </div>
            <div className="att-kpi">
              <span>Nghỉ phép được duyệt</span>
              <strong>
                {summary.totals.paidLeaveDays}P / {summary.totals.unpaidLeaveDays}KL
              </strong>
              <small>Có lương / Không lương (ngày)</small>
            </div>
            <div className="att-kpi">
              <span>Nguồn Máy / Thủ công</span>
              <strong>
                {summary.totals.machineRecords} / {summary.totals.manualRecords}
              </strong>
              <small>Bản ghi máy / Bản ghi giấy</small>
            </div>
            <div className="att-kpi">
              <span>Ngoại lệ chặn khóa</span>
              <strong style={{ color: totalExceptionsCount > 0 ? '#dc2626' : '#059669' }}>
                {totalExceptionsCount}
              </strong>
              <small>
                Flagged: {summary.totals.flaggedRecords} · Chờ XN: {summary.totals.unconfirmedRecords}
              </small>
            </div>
          </div>

          {/* Bounded Single-Viewport Card */}
          <section className="att-card operations-panel" style={{ margin: 0, padding: 12 }}>
            <div
              className="att-card-header"
              style={{ marginBottom: 8, paddingBottom: 8, flexWrap: 'wrap', gap: 10 }}
            >
              <div className="att-segmented" role="tablist" aria-label="Chế độ xem tổng hợp tháng">
                <button
                  type="button"
                  id="monthly-tab-staff"
                  role="tab"
                  aria-selected={activeTab === 'staff'}
                  className={activeTab === 'staff' ? 'active' : ''}
                  onClick={() => setActiveTab('staff')}
                >
                  Bảng công nhân viên ({summary.staffSummaries.length})
                </button>
                <button
                  type="button"
                  id="monthly-tab-scope"
                  role="tab"
                  aria-selected={activeTab === 'scope'}
                  className={activeTab === 'scope' ? 'active' : ''}
                  onClick={() => setActiveTab('scope')}
                >
                  Cơ sở & Khoa/Phòng ({summary.departmentTotals.length})
                </button>
                <button
                  type="button"
                  id="monthly-tab-exceptions"
                  role="tab"
                  aria-selected={activeTab === 'exceptions'}
                  className={activeTab === 'exceptions' ? 'active' : ''}
                  onClick={() => setActiveTab('exceptions')}
                >
                  Ngoại lệ cần xử lý ({summary.exceptions.length})
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <input
                  id="monthly-month-input"
                  aria-label="Kỳ chấm công tháng"
                  type="month"
                  value={month}
                  onChange={e => handleMonthChange(e.target.value)}
                  style={{
                    padding: '5px 8px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 12.5,
                  }}
                />
                {activeTab !== 'scope' && (
                  <select
                    id="monthly-dept-filter"
                    aria-label="Lọc theo khoa phòng"
                    value={deptFilter}
                    onChange={e => setDeptFilter(e.target.value)}
                    style={{
                      padding: '5px 8px',
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      fontSize: 12.5,
                    }}
                  >
                    <option value="">Tất cả khoa/phòng</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  id="monthly-search-input"
                  type="search"
                  placeholder="Tìm mã NV, họ tên, khoa..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 8,
                    border: '1px solid #cbd5e1',
                    fontSize: 12.5,
                    width: 190,
                  }}
                />
              </div>
            </div>

            {activeTab === 'staff' ? (
              <div className="att-table-viewport">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nhân viên</th>
                      <th>Khoa / Phòng</th>
                      <th>Công chính (XN / Lịch)</th>
                      <th>Trực Trưa / Tối</th>
                      <th>Giờ công / Tăng ca</th>
                      <th>Nghỉ phép (P / KL)</th>
                      <th>Nguồn (Máy / Giấy)</th>
                      <th>Trạng thái tính lương</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaff.map(row => (
                      <tr key={row.staffId}>
                        <td>
                          <strong>{row.staffName}</strong>
                          <small className="table-secondary">{row.staffCode}</small>
                        </td>
                        <td>{row.departmentName || 'Chưa phân khoa'}</td>
                        <td>
                          <strong>{row.confirmedMainDays}</strong> / {row.plannedMainDays} ngày
                        </td>
                        <td>
                          Trưa: <strong>{row.confirmedNoonDuties}</strong> · Tối: <strong>{row.confirmedEveningDuties}</strong>
                        </td>
                        <td>
                          {row.confirmedHours.toLocaleString('vi-VN')}h
                          {row.overtimeHours > 0 ? ` (+${row.overtimeHours.toLocaleString('vi-VN')}h OT)` : ''}
                        </td>
                        <td>
                          {row.paidLeaveDays} / {row.unpaidLeaveDays}
                        </td>
                        <td>
                          {row.machineRecordCount} / {row.manualRecordCount}
                        </td>
                        <td>
                          {row.readyForPayroll ? (
                            <span className="att-badge confirmed">Đủ điều kiện tính lương</span>
                          ) : (
                            <span className="att-badge flagged">
                              Cờ lỗi: {row.flaggedCount} · Chờ XN: {row.unconfirmedCount} · Thiếu: {row.unaccountedScheduleCount}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredStaff.length === 0 && (
                      <tr>
                        <td colSpan={8} className="empty-state">
                          Không có nhân sự phù hợp bộ lọc.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : activeTab === 'scope' ? (
              <div
                className="att-table-viewport"
                style={{
                  padding: 10,
                  display: 'grid',
                  gridTemplateColumns: '1fr 1.25fr',
                  gap: 12,
                }}
              >
                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: 13 }}>Tổng hợp theo Cơ sở phòng khám</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Cơ sở</th>
                        <th>Nhân sự</th>
                        <th>Công chính</th>
                        <th>Trực T/Tối</th>
                        <th>Giờ XN</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.facilityTotals.map(f => (
                        <tr key={f.id}>
                          <td><strong>{f.name}</strong></td>
                          <td>{f.staffCount}</td>
                          <td>{f.confirmedMainDays}</td>
                          <td>{f.confirmedNoonDuties} / {f.confirmedEveningDuties}</td>
                          <td>{f.confirmedHours.toLocaleString('vi-VN')}h</td>
                          <td>
                            {f.completed ? (
                              <span className="att-badge confirmed">Hoàn tất</span>
                            ) : (
                              <span className="att-badge warning">
                                Còn {f.flaggedCount + f.unconfirmedCount + f.unaccountedScheduleCount} ngoại lệ
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div>
                  <h3 style={{ margin: '0 0 6px', fontSize: 13 }}>Tổng hợp theo Khoa / Phòng ban</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Khoa / Phòng</th>
                        <th>Nhân sự</th>
                        <th>Công chính</th>
                        <th>Trực T/Tối</th>
                        <th>Nghỉ phép</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.departmentTotals.map(d => (
                        <tr key={d.id}>
                          <td><strong>{d.name}</strong></td>
                          <td>{d.staffCount}</td>
                          <td>{d.confirmedMainDays}</td>
                          <td>{d.confirmedNoonDuties} / {d.confirmedEveningDuties}</td>
                          <td>{d.paidLeaveDays} ngày</td>
                          <td>
                            {d.completed ? (
                              <span className="att-badge confirmed">Hoàn tất</span>
                            ) : (
                              <span className="att-badge warning">
                                Còn {d.flaggedCount + d.unconfirmedCount + d.unaccountedScheduleCount} ngoại lệ
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="att-table-viewport">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ngày</th>
                      <th>Nhân viên</th>
                      <th>Khoa / Cơ sở</th>
                      <th>Ca</th>
                      <th>Phân loại</th>
                      <th>Chi tiết ngoại lệ cần xử lý</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExceptions.map(ex => (
                      <tr key={ex.id}>
                        <td>{shortDate(ex.date, true)}</td>
                        <td>
                          <strong>{ex.staffName}</strong>
                          <small className="table-secondary">{ex.staffCode}</small>
                        </td>
                        <td>
                          <div>{ex.departmentName || 'Chưa phân khoa'}</div>
                          <small className="table-secondary">{ex.facilityName || '—'}</small>
                        </td>
                        <td>{attendanceLabel(ex.shiftType)}</td>
                        <td>
                          <span className={`att-badge ${ex.severity === 'error' ? 'error' : 'warning'}`}>
                            {attendanceLabel(ex.category)}
                          </span>
                        </td>
                        <td>{ex.message}</td>
                        <td>
                          {ex.targetUrl ? (
                            <Link className="button" style={{ padding: '4px 10px', fontSize: 12 }} to={ex.targetUrl}>
                              Mở xử lý
                            </Link>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredExceptions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="empty-state">
                          Không còn ngoại lệ chấm công nào trong kỳ {summary.payMonth}. Bảng công đã sẵn sàng chốt!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* Confirmation Modal */}
      <dialog
        ref={dialogRef}
        style={{
          border: '1px solid #cbd5e1',
          borderRadius: 12,
          padding: 20,
          maxWidth: 480,
          width: '92%',
          boxShadow: '0 20px 25px -5px rgba(15, 23, 42, 0.18)',
        }}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>
          Xác nhận khóa bảng chấm công tháng {month}
        </h3>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#475569', lineHeight: 1.45 }}>
          Sau khi khóa, toàn bộ hồ sơ chấm công và ca trực trong kỳ <strong>{month}</strong> sẽ được
          chuyển làm đầu vào chính thức cho Kế toán tính lương (GB-06, GB-09, GB-52) và không thể
          sửa trực tiếp nếu không mở khóa theo quy trình GB-26.
        </p>
        {summary && (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: 10,
              marginBottom: 12,
              fontSize: 12.5,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 6,
            }}
          >
            <div>
              Nhân sự tổng hợp: <strong>{summary.totals.totalStaff}</strong>
            </div>
            <div>
              Tổng ngày công chính: <strong>{summary.totals.confirmedMainDays}</strong>
            </div>
            <div>
              Trực trưa / tối:{' '}
              <strong>
                {summary.totals.confirmedNoonDuties} / {summary.totals.confirmedEveningDuties}
              </strong>
            </div>
            <div>
              Giờ công / Tăng ca:{' '}
              <strong>
                {summary.totals.confirmedHours.toLocaleString('vi-VN')}h / {summary.totals.overtimeHours.toLocaleString('vi-VN')}h
              </strong>
            </div>
          </div>
        )}
        <label htmlFor="lock-monthly-note" style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12.5, fontWeight: 500, marginBottom: 14 }}>
          Ghi chú bàn giao bảng công tháng (tùy chọn)
          <textarea
            id="lock-monthly-note"
            rows={2}
            value={lockNote}
            onChange={e => setLockNote(e.target.value)}
            placeholder="VD: Đã đối chiếu bảng chấm công giấy có chữ ký các trưởng khoa và dữ liệu máy vân tay 2 cơ sở."
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 13 }}
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="button" onClick={closeConfirmModal}>
            Hủy
          </button>
          <button
            id="confirm-lock-monthly-btn"
            type="button"
            className="button primary"
            disabled={locking}
            onClick={() => void handleLockMonthly()}
          >
            {locking ? 'Đang khóa bảng công...' : 'Xác nhận chốt & khóa bảng công'}
          </button>
        </div>
      </dialog>
    </AttendanceShell>
  );
}
