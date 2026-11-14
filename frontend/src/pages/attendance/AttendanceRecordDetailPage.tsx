import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import AttendanceShell from '../../components/attendance/AttendanceShell';
import ResourceState from '../../components/attendance/ResourceState';
import useApiResource from '../../hooks/useApiResource';
import { attendanceApi } from '../../services/attendanceApi';
import type { AttendanceDetail, ReconcileAttendanceInput } from '../../types/attendance';
import { useAuthStore } from '../../store/useAuthStore';
import { attendanceLabel, clockTime, instant } from '../../utils/attendance';
import { shortDate } from '../../utils/schedule';

export default function AttendanceRecordDetailPage() {
  const { id } = useParams();
  const location = useLocation();
  const resource = useApiResource<AttendanceDetail>(`/attendance/records/${id}`);
  const role = useAuthStore(state => state.session?.user.role || '');
  const isHrStaff = role === 'hr_staff';

  const data = resource.data;
  const item = data?.item;
  const actor = (actorId: string | null | undefined) => data?.actors.find(x => x.id === actorId)?.name || '—';

  const [activeTab, setActiveTab] = useState<'reconcile' | 'verify'>('reconcile');
  const [reconcileAction, setReconcileAction] = useState<ReconcileAttendanceInput['action']>('accept_machine');
  const [editPairs, setEditPairs] = useState<{ in: string; out: string }[]>([{ in: '07:00', out: '17:00' }]);
  const [reconcileReason, setReconcileReason] = useState('');
  const [supervisorConfirmed, setSupervisorConfirmed] = useState(false);
  const [supervisorEvidence, setSupervisorEvidence] = useState('');
  const [verifyDecision, setVerifyDecision] = useState<'confirm' | 'return'>('confirm');
  const [verifyReason, setVerifyReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<string>(location.state?.notice || '');

  useEffect(() => {
    if (!data) return;
    if (data.item.status === 'reconciled' || data.item.status === 'confirmed') {
      setActiveTab('verify');
    } else {
      setActiveTab('reconcile');
    }
    const initialPairs = data.pairs.length
      ? data.pairs.map(p => ({
          in: clockTime(p.in) !== '—' ? clockTime(p.in) : '07:00',
          out: clockTime(p.out) !== '—' ? clockTime(p.out) : '17:00',
        }))
      : [{ in: '07:00', out: '17:00' }];
    setEditPairs(initialPairs);
    setSupervisorConfirmed(Boolean(data.supervisorConfirmed));
    setSupervisorEvidence(data.supervisorEvidence || '');
    setReconcileAction(data.item.source === 'manual' ? 'accept_manual' : 'accept_machine');
  }, [data?.version, data?.item.status]);

  function updatePair(idx: number, field: 'in' | 'out', value: string) {
    setError('');
    setEditPairs(current => current.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }

  async function handleReconcile(event: FormEvent) {
    event.preventDefault();
    if (!data || !id || busy) return;
    if (!reconcileReason.trim()) {
      setError('MSG02: Vui lòng nhập lý do và căn cứ đối chiếu chấm công.');
      document.getElementById('reconcile-reason')?.focus();
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await attendanceApi.reconcile(id, {
        action: reconcileAction,
        pairs: reconcileAction === 'correct_time' || reconcileAction === 'accept_manual' ? editPairs : undefined,
        facilityId: data.item.facilityId,
        reason: reconcileReason.trim(),
        supervisorConfirmed,
        supervisorEvidence: supervisorEvidence.trim() || undefined,
        version: data.version || 'v1',
      });
      setNotice(result.message);
      setReconcileReason('');
      resource.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu kết quả đối chiếu.');
      if (cause instanceof Error && cause.message.includes('MSG44')) {
        resource.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(event: FormEvent) {
    event.preventDefault();
    if (!data || !id || busy) return;
    if (verifyDecision === 'return' && !verifyReason.trim()) {
      setError('MSG02: Vui lòng nhập lý do trả về để đối chiếu lại.');
      document.getElementById('verify-reason')?.focus();
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await attendanceApi.verifyRecord(id, {
        decision: verifyDecision,
        reason: verifyReason.trim() || undefined,
        supervisorEvidence: supervisorEvidence.trim() || undefined,
        version: data.version || 'v1',
      });
      setNotice(result.message);
      setVerifyReason('');
      resource.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể xác nhận bản ghi chấm công.');
      if (cause instanceof Error && cause.message.includes('MSG44')) {
        resource.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  const machinePairs = data?.machinePairs?.length ? data.machinePairs : data?.pairs || [];
  const scheduleList = data?.scheduleDetails?.length
    ? data.scheduleDetails
    : (data?.schedules || []).map(s => ({
        id: s.id,
        facilityId: s.facilityId,
        facilityName: data?.item.facilityName || 'Cơ sở phân công',
        date: s.date,
        shift: s.shift,
        start: '—',
        end: '—',
        patientConfirmed: false,
        patientEvidence: null,
        actualEndAt: null,
        endNote: null,
      }));
  const discrepancies = data?.discrepancies || [];
  const suggested = data?.suggestedClassification || (data?.item.status === 'flagged' ? 'source_mismatch' : 'matched');
  const lastOut = editPairs.map(p => p.out).filter(Boolean).sort().at(-1) || clockTime(item?.checkOut);
  const isEveningEarly = item?.shiftType === 'evening' && lastOut !== '—' && lastOut < '19:00';

  return (
    <AttendanceShell
      title="Chi tiết chấm công"
      description="Đối chiếu dữ liệu máy vân tay, khai báo thủ công, lịch phân công và xác nhận ngày công tính lương."
      actions={
        <>
          {isHrStaff && <Link className="button" to="/attendance/records/new">Nhập thủ công (4.12)</Link>}
          <Link className="button" to="/attendance/records">Danh sách chấm công</Link>
        </>
      }
    >
      <ResourceState {...resource} />
      {notice && <p className="alert success" role="status">{notice}</p>}
      {data && item && (
        <div className="att-split">
          {/* CỘT TRÁI: DỮ LIỆU ĐỐI CHIẾU SONG SONG (SIDE-BY-SIDE) */}
          <section className="att-card operations-panel" style={{ margin: 0 }}>
            <div className="att-card-header">
              <div>
                <h2 style={{ margin: 0, fontSize: 16 }}>
                  {item.staffName} · <span style={{ color: '#0d9488' }}>{item.staffCode}</span>
                </h2>
                <p className="att-card-sub">
                  {shortDate(item.workDate, true)} · <strong>{attendanceLabel(item.shiftType)}</strong> · {item.departmentName || 'Chưa phân khoa'} · {item.facilityName || 'Chưa xác định'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={`att-badge ${suggested === 'matched' ? 'ready' : 'warning'}`}>
                  Gợi ý: {attendanceLabel(suggested)}
                </span>
                <span className={`att-badge ${item.status}`}>
                  {attendanceLabel(item.status)}
                </span>
              </div>
            </div>

            {data.lockedReason && <p className="alert warning" style={{ margin: '6px 0' }}>{data.lockedReason}</p>}

            <div className="att-meta-bar">
              <span>Nguồn: <strong>{attendanceLabel(item.source)}</strong></span>
              <span>Mã máy: <strong>{data.deviceEnrollId || '—'}</strong></span>
              <span>Giờ ghi nhận: <strong>{item.actualHours?.toLocaleString('vi-VN') ?? '—'} giờ</strong></span>
              {data.batch && (
                <span>
                  Tệp: {['admin', 'hr_staff', 'hr_manager'].includes(role)
                    ? <Link to={`/attendance/imports/${data.batch.id}/preview`}>{data.batch.fileName}</Link>
                    : data.batch.fileName} ({data.batch.deviceSource || 'Máy chấm công'})
                </span>
              )}
              <span>Đối chiếu: <strong>{actor(data.reconciledBy)}</strong> ({instant(data.reconciledAt)})</span>
              <span>Xác nhận: <strong>{actor(data.confirmedBy)}</strong> ({instant(data.confirmedAt)})</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <h3 style={{ margin: '4px 0' }}>Các cặp vào / ra đang ghi nhận</h3>
              <div className="operations-actions">
                <Link className="button" style={{ padding: '4px 10px', fontSize: 12 }} to={`/schedules?date=${item.workDate}`}>Lịch tuần</Link>
                {item.onCallShiftId && <Link className="button" style={{ padding: '4px 10px', fontSize: 12 }} to={`/attendance/on-call/${item.onCallShiftId}`}>Hồ sơ trực</Link>}
              </div>
            </div>

            <div className="operations-stats" style={{ margin: '6px 0 10px' }}>
              {data.pairs.map((pair, index) => (
                <span key={index}>Lần {index + 1}: {clockTime(pair.in)} – {clockTime(pair.out)}</span>
              ))}
            </div>

            {/* BẢNG ĐỐI CHIẾU 3 NGUỒN SONG SONG (UC 4.11 STEP 2) */}
            <div className="att-compare-grid" id="side-by-side-reconciliation">
              <div className="att-source-box">
                <div className="att-source-head">
                  <span>1. Máy vân tay gốc</span>
                  <span>{machinePairs.length} cặp</span>
                </div>
                {machinePairs.length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {machinePairs.map((p, idx) => (
                      <span key={idx} className="att-time-chip">{clockTime(p.in)}–{clockTime(p.out)}</span>
                    ))}
                  </div>
                ) : (
                  <p className="operations-note" style={{ margin: 0 }}>Không có dữ liệu từ máy chấm công.</p>
                )}
                {data.importRow && (
                  <small style={{ fontSize: 11, color: '#64748b' }}>
                    Giờ máy: {data.importRow.reportedHours ?? '—'}h · Trễ: {data.importRow.lateMinutes ?? 0}p · Sớm: {data.importRow.earlyMinutes ?? 0}p
                    {data.importRow.attendanceSymbol ? ` · KH: ${data.importRow.attendanceSymbol}` : ''}
                  </small>
                )}
              </div>

              <div className={`att-source-box ${data.leaves?.length ? 'warn' : 'highlight'}`}>
                <div className="att-source-head">
                  <span>2. Lịch công bố & Nghỉ phép</span>
                  <span>{scheduleList.length} ca</span>
                </div>
                {scheduleList.length ? (
                  <div style={{ display: 'grid', gap: 4 }}>
                    {scheduleList.map(s => (
                      <span key={s.id} className="att-time-chip">
                        {attendanceLabel(s.shift)} ({s.start}–{s.end}) · {s.facilityName}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="operations-note" style={{ margin: 0 }}>Chưa có lịch phân công đã công bố.</p>
                )}
                {!!data.leaves?.length && (
                  <small style={{ fontSize: 11, color: '#b45309', fontWeight: 600 }}>
                    Nghỉ phép đã duyệt: {data.leaves.map(l => l.leaveType).join(', ')}
                  </small>
                )}
              </div>

              <div className="att-source-box">
                <div className="att-source-head">
                  <span>3. Khai báo & Xác nhận QL</span>
                  <span>{data.supervisorConfirmed ? 'Đã XN quản lý' : 'Bằng chứng'}</span>
                </div>
                <p className="operations-note" style={{ margin: 0, color: '#1e293b' }}>
                  {data.reconcileNote || data.note || 'Chưa có ghi chú khai báo thủ công.'}
                </p>
                {!!data.onCalls?.length && (
                  <small style={{ fontSize: 11, color: '#0369a1' }}>
                    Ca trực: {data.onCalls.map(o => `${attendanceLabel(o.category)} (${clockTime(o.start)}–${clockTime(o.end)} · ${attendanceLabel(o.status)})`).join('; ')}
                  </small>
                )}
              </div>
            </div>

            {/* PHÂN LOẠI SAI LỆCH (UC 4.11 STEP 3) */}
            <div className="att-discrepancy-bar">
              {discrepancies.length ? (
                discrepancies.map((d, i) => (
                  <span key={i} className={`att-badge ${d.severity === 'error' ? 'error' : 'warning'}`}>
                    {d.label}
                  </span>
                ))
              ) : (
                <span className="att-badge ready">Không phát hiện xung đột thời gian / nguồn chấm công</span>
              )}
            </div>

            {/* LỊCH SỬ DIỄN BIẾN GỌN TRONG 1 DÒNG */}
            <div className="att-events-inline">
              <strong>Diễn biến:</strong>
              {data.events.length ? (
                data.events.slice(0, 4).map(ev => (
                  <span key={ev.logId}>{instant(ev.createdAt)} · {attendanceLabel(ev.action)} · {ev.username || 'Hệ thống'}</span>
                ))
              ) : (
                <span>Chưa có sự kiện lịch sử riêng.</span>
              )}
            </div>
          </section>

          {/* CỘT PHẢI: KHUNG THAO TÁC ĐỐI CHIẾU (4.11) & XÁC NHẬN (4.13) */}
          <aside className="att-card operations-form" id="attendance-workflow-dock">
            <div className="att-card-header">
              <div>
                <h2 className="att-card-title">Nghiệp vụ xử lý ngày công</h2>
                <p className="att-card-sub">
                  {item.status === 'confirmed'
                    ? 'Bản ghi đã xác nhận và đủ điều kiện tính lương.'
                    : 'Đối chiếu sai lệch (4.11) trước khi Xác nhận tính lương (4.13).'}
                </p>
              </div>
              <div className="att-segmented" role="tablist" aria-label="Chế độ xử lý chấm công">
                <button
                  type="button"
                  role="tab"
                  id="tab-reconcile"
                  aria-selected={activeTab === 'reconcile'}
                  className={activeTab === 'reconcile' ? 'active' : ''}
                  onClick={() => { setError(''); setActiveTab('reconcile'); }}
                >
                  4.11 Đối chiếu
                </button>
                <button
                  type="button"
                  role="tab"
                  id="tab-verify"
                  aria-selected={activeTab === 'verify'}
                  className={activeTab === 'verify' ? 'active' : ''}
                  onClick={() => { setError(''); setActiveTab('verify'); }}
                >
                  4.13 Xác nhận
                </button>
              </div>
            </div>

            {error && <p className="alert error" role="alert" style={{ margin: '6px 0' }}>{error}</p>}

            {!isHrStaff ? (
              <div className="oncall-readiness">
                <strong>Chế độ xem ({role})</strong>
                <p>Chỉ nhân sự có vai trò <strong>HR Staff</strong> được thực hiện Đối chiếu (4.11) và Xác nhận chấm công (4.13) theo quy tắc GB-41.</p>
                {item.status !== 'confirmed' && <p className="operations-note">Bản ghi chưa xác nhận chưa được đưa vào bảng lương.</p>}
              </div>
            ) : activeTab === 'reconcile' ? (
              /* FORM 4.11: RECONCILE ATTENDANCE */
              <form id="reconcile-form" noValidate onSubmit={e => void handleReconcile(e)}>
                <fieldset disabled={busy || !!data.lockedReason || item.status === 'confirmed'}>
                  {item.status === 'confirmed' && (
                    <p className="alert warning" style={{ margin: '0 0 8px' }}>
                      Bản ghi đã xác nhận khóa. Nếu cần điều chỉnh, hãy chuyển sang tab <strong>4.13 Xác nhận</strong> và chọn <strong>Trả về đối chiếu</strong>.
                    </p>
                  )}

                  <div className="att-radio-cards" role="radiogroup" aria-label="Phương án đối chiếu">
                    {([
                      { id: 'accept_machine', title: 'Chấp nhận giờ máy', desc: 'Dùng cặp Vào/Ra từ máy vân tay (loại bỏ cặp lặp trùng)' },
                      { id: 'accept_manual', title: 'Chấp nhận khai báo tay', desc: 'Dùng giờ theo bảng chấm công giấy kèm bằng chứng' },
                      { id: 'correct_time', title: 'Chỉnh sửa giờ thực tế', desc: 'Điều chỉnh lại cặp giờ Vào/Ra đúng thực tế' },
                      { id: 'mark_unresolved', title: 'Giữ Flagged (Chưa rõ)', desc: 'Chưa đủ căn cứ; loại khỏi bảng lương (MSG04/05)' },
                    ] as const).map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        id={`reconcile-action-${opt.id}`}
                        className={`att-radio-card ${reconcileAction === opt.id ? 'selected' : ''}`}
                        onClick={() => { setError(''); setReconcileAction(opt.id); }}
                      >
                        <strong>{opt.title}</strong>
                        <small>{opt.desc}</small>
                      </button>
                    ))}
                  </div>

                  {(reconcileAction === 'correct_time' || reconcileAction === 'accept_manual') && (
                    <div className="att-compact-pairs">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: 12, color: '#334155' }}>Cặp giờ áp dụng ({item.workDate})</strong>
                        {editPairs.length < 3 && (
                          <button
                            type="button"
                            className="button"
                            style={{ padding: '2px 8px', fontSize: 11 }}
                            onClick={() => setEditPairs(curr => [...curr, { in: '13:30', out: '17:00' }])}
                          >
                            + Thêm cặp
                          </button>
                        )}
                      </div>
                      {editPairs.map((pair, idx) => (
                        <div key={idx} className="att-compact-pair">
                          <span>Lần {idx + 1}</span>
                          <input
                            id={`reconcile-in-${idx}`}
                            aria-label={`Đối chiếu giờ vào ${idx + 1}`}
                            type="time"
                            value={pair.in}
                            onChange={e => updatePair(idx, 'in', e.target.value)}
                          />
                          <input
                            id={`reconcile-out-${idx}`}
                            aria-label={`Đối chiếu giờ ra ${idx + 1}`}
                            type="time"
                            value={pair.out}
                            onChange={e => updatePair(idx, 'out', e.target.value)}
                          />
                          {editPairs.length > 1 ? (
                            <button
                              type="button"
                              className="button"
                              style={{ padding: '2px 7px', fontSize: 11 }}
                              onClick={() => setEditPairs(curr => curr.filter((_, i) => i !== idx))}
                            >
                              Xóa
                            </button>
                          ) : <span />}
                        </div>
                      ))}
                    </div>
                  )}

                  {(isEveningEarly || item.shiftType === 'evening') && reconcileAction !== 'mark_unresolved' && (
                    <div className="att-source-box warn" style={{ margin: '8px 0' }}>
                      <label className="operations-checkbox" style={{ margin: 0 }}>
                        <input
                          id="reconcile-supervisor-check"
                          type="checkbox"
                          checked={supervisorConfirmed}
                          onChange={e => setSupervisorConfirmed(e.target.checked)}
                        />
                        <span>
                          <strong>Xác nhận của Trưởng khoa / Quản lý trực (GB-13)</strong>: Ca tối kết thúc sớm do vắng bệnh nhân đã được quản lý xác nhận.
                        </span>
                      </label>
                      <input
                        id="reconcile-supervisor-evidence"
                        type="text"
                        maxLength={500}
                        value={supervisorEvidence}
                        onChange={e => setSupervisorEvidence(e.target.value)}
                        placeholder="Nhập người xác nhận và nội dung xác nhận quản lý (bắt buộc nếu về sớm)..."
                        style={{ width: '100%', padding: '5px 8px', fontSize: 12.5 }}
                      />
                    </div>
                  )}

                  <label htmlFor="reconcile-reason" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 500, marginTop: 6 }}>
                    Lý do & Bằng chứng đối chiếu (MSG02) *
                    <textarea
                      id="reconcile-reason"
                      required
                      rows={2}
                      maxLength={1000}
                      value={reconcileReason}
                      onChange={e => { setError(''); setReconcileReason(e.target.value); }}
                      placeholder="Ghi rõ căn cứ đối chiếu bảng chấm công giấy / xác nhận của khoa..."
                    />
                  </label>

                  <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                    <button
                      id="reconcile-submit"
                      className="button primary"
                      type="submit"
                      disabled={busy || !!data.lockedReason || item.status === 'confirmed'}
                    >
                      {busy
                        ? 'Đang xử lý…'
                        : reconcileAction === 'mark_unresolved'
                        ? 'Giữ trạng thái Flagged (Loại khỏi lương)'
                        : 'Lưu đối chiếu · Chuyển chờ xác nhận'}
                    </button>
                  </div>
                </fieldset>
              </form>
            ) : (
              /* FORM 4.13: VERIFY ATTENDANCE RECORD */
              <form id="verify-form" noValidate onSubmit={e => void handleVerify(e)}>
                <fieldset disabled={busy || !!data.lockedReason}>
                  <div className="att-source-box" style={{ marginBottom: 8 }}>
                    <div className="att-source-head">
                      <span>Tóm tắt kiểm tra trước xác nhận (GB-06, GB-08)</span>
                      <span>{item.actualHours?.toLocaleString('vi-VN') ?? '—'} giờ</span>
                    </div>
                    <div style={{ fontSize: 12.5, display: 'grid', gap: 3 }}>
                      <div>Phân loại ca tính công: <strong>{attendanceLabel(item.shiftType)}</strong> tại <strong>{item.facilityName || '—'}</strong></div>
                      <div>Người đối chiếu trước: <strong>{actor(data.reconciledBy)}</strong> · {instant(data.reconciledAt)}</div>
                      <div>Căn cứ lưu trữ: <span>{data.reconcileNote || data.note || 'Dữ liệu khớp nguồn máy'}</span></div>
                    </div>
                  </div>

                  {item.status === 'flagged' && verifyDecision === 'confirm' && (
                    <div className="alert warning" style={{ margin: '0 0 8px', fontSize: 12.5 }}>
                      <strong>MSG04 / MSG05:</strong> Bản ghi đang gắn cờ <em>Cần đối chiếu (Flagged)</em>. Hãy thực hiện{' '}
                      <button type="button" className="text-button" onClick={() => setActiveTab('reconcile')}>
                        4.11 Đối chiếu chấm công
                      </button>{' '}
                      trước khi xác nhận tính lương.
                    </div>
                  )}

                  <div className="att-radio-cards" role="radiogroup" aria-label="Quyết định xác nhận">
                    <button
                      type="button"
                      id="verify-decision-confirm"
                      className={`att-radio-card ${verifyDecision === 'confirm' ? 'selected' : ''}`}
                      onClick={() => { setError(''); setVerifyDecision('confirm'); }}
                    >
                      <strong>Xác nhận ngày công (Confirm)</strong>
                      <small>Chốt bản ghi đủ điều kiện tổng hợp bảng công tháng & tính lương (GB-09)</small>
                    </button>
                    <button
                      type="button"
                      id="verify-decision-return"
                      className={`att-radio-card ${verifyDecision === 'return' ? 'selected' : ''}`}
                      onClick={() => { setError(''); setVerifyDecision('return'); }}
                    >
                      <strong>Trả về đối chiếu lại (Return)</strong>
                      <small>Chuyển về trạng thái Flagged và yêu cầu bổ sung căn cứ</small>
                    </button>
                  </div>

                  {isEveningEarly && verifyDecision === 'confirm' && !data.supervisorConfirmed && (
                    <label htmlFor="verify-supervisor" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 500, marginBottom: 6 }}>
                      Xác nhận của Trưởng khoa / Quản lý cho ca tối kết thúc sớm (GB-13) *
                      <input
                        id="verify-supervisor"
                        type="text"
                        maxLength={500}
                        value={supervisorEvidence}
                        onChange={e => setSupervisorEvidence(e.target.value)}
                        placeholder="Nhập xác nhận của quản lý trực..."
                      />
                    </label>
                  )}

                  <label htmlFor="verify-reason" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, fontWeight: 500 }}>
                    {verifyDecision === 'return' ? 'Lý do trả về để đối chiếu lại (MSG02) *' : 'Ghi chú xác nhận (tùy chọn)'}
                    <textarea
                      id="verify-reason"
                      required={verifyDecision === 'return'}
                      rows={2}
                      maxLength={1000}
                      value={verifyReason}
                      onChange={e => { setError(''); setVerifyReason(e.target.value); }}
                      placeholder={
                        verifyDecision === 'return'
                          ? 'Nêu rõ điểm chưa khớp hoặc bằng chứng cần bổ sung...'
                          : 'Ghi chú kiểm tra cuối cùng (nếu có)...'
                      }
                    />
                  </label>

                  <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                    <button
                      id="verify-submit"
                      className="button primary"
                      type="submit"
                      disabled={busy || !!data.lockedReason || (verifyDecision === 'confirm' && item.status === 'confirmed')}
                    >
                      {busy
                        ? 'Đang lưu…'
                        : verifyDecision === 'return'
                        ? 'Trả về trạng thái Flagged'
                        : item.status === 'confirmed'
                        ? 'Đã xác nhận khóa'
                        : 'Xác nhận ngày công (Confirm)'}
                    </button>
                  </div>
                </fieldset>
              </form>
            )}
          </aside>
        </div>
      )}
    </AttendanceShell>
  );
}
