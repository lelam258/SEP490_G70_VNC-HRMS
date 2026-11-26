import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '../../components/ui/Alert';
import Icon from '../../components/ui/Icon';
import { leaveApi } from '../../services/leaveApi';
import type { LeaveRequestDetail, LeaveType } from '../../types/leave';
import { calculateWorkingDays, getTodayInVietnam } from '../../utils/leaveRules';

const MSG14 = 'Tệp đính kèm không hợp lệ. Vui lòng chọn tệp PDF, JPG hoặc PNG và dung lượng không vượt quá 10 MB.';

/** Original file name of a stored file URL: its last path segment without the "<timestamp>_<id>_" storage prefix. */
function fileNameFromUrl(url: string): string {
  const stored = decodeURIComponent(url.split('?')[0].split('/').pop() || url);
  return stored.replace(/^\d+_[0-9a-f]{32}_/i, '');
}

/** Creates a leave request, or edits a pending one when the route has an id. */
export default function LeaveRequestFormPage() {
  const navigate = useNavigate();
  const { id: requestId } = useParams<{ id: string }>();
  const isEdit = Boolean(requestId);
  const todayStr = getTodayInVietnam();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Edit mode: the request as loaded, and whether its current attachment is being dropped.
  const [original, setOriginal] = useState<LeaveRequestDetail | null>(null);
  const [removeExistingAttachment, setRemoveExistingAttachment] = useState(false);
  const [notEditable, setNotEditable] = useState('');

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveType, setLeaveType] = useState('annual');
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [reason, setReason] = useState('');
  const [reasonTouched, setReasonTouched] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);

  const [workingDays, setWorkingDays] = useState<number | null>(null);
  const [daysError, setDaysError] = useState<string>('');

  const [loadingTypes, setLoadingTypes] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [types, detail] = await Promise.all([
          leaveApi.getLeaveTypes(),
          requestId ? leaveApi.getLeaveRequestDetail(requestId) : Promise.resolve(null),
        ]);
        setLeaveTypes(types);
        if (detail) {
          setOriginal(detail);
          setLeaveType(detail.leaveType);
          setStartDate(detail.startDate);
          setEndDate(detail.endDate);
          setReason(detail.reason || '');
          if (detail.status !== 'pending') {
            setNotEditable('Chỉ có thể sửa đơn ở trạng thái chờ duyệt.');
          }
        } else if (types.length > 0) {
          setLeaveType(types[0].code);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Không tải được dữ liệu đơn xin nghỉ.');
      } finally {
        setLoadingTypes(false);
      }
    }
    void load();
  }, [requestId]);

  // Recalculate working days whenever startDate or endDate changes
  useEffect(() => {
    if (!startDate || !endDate) {
      setWorkingDays(null);
      setDaysError('');
      return;
    }

    try {
      const days = calculateWorkingDays(startDate, endDate, todayStr);
      setWorkingDays(days);
      setDaysError('');
    } catch (err: unknown) {
      setWorkingDays(null);
      setDaysError(err instanceof Error ? err.message : 'Khoảng ngày không hợp lệ.');
    }
  }, [startDate, endDate, todayStr]);

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (endDate && val > endDate) {
      setEndDate(val);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setAttachment(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(MSG14);
      e.target.value = '';
      setAttachment(null);
      return;
    }

    setError('');
    setAttachment(file);
  };

  const handleRemoveFile = () => {
    setAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isDirty = useMemo(() => {
    if (!original) return true;
    return (
      leaveType !== original.leaveType ||
      startDate !== original.startDate ||
      endDate !== original.endDate ||
      reason.trim() !== (original.reason || '').trim() ||
      attachment !== null ||
      removeExistingAttachment
    );
  }, [original, leaveType, startDate, endDate, reason, attachment, removeExistingAttachment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || notEditable) return; // Prevent double submit
    setError('');

    if (daysError || !workingDays || workingDays <= 0) {
      setError(daysError || 'Khoảng thời gian đã chọn không có ngày làm việc.');
      return;
    }

    const trimmedReason = reason.trim();
    if (trimmedReason.length < 10 || trimmedReason.length > 500) {
      setReasonTouched(true);
      setError('Lý do xin nghỉ phải từ 10 đến 500 ký tự.');
      return;
    }

    setSubmitting(true);
    try {
      const input = { leaveType, startDate, endDate, reason: trimmedReason, attachment };
      if (requestId) {
        await leaveApi.updateLeaveRequest(requestId, {
          ...input,
          removeAttachment: removeExistingAttachment && !attachment,
        });
      } else {
        await leaveApi.createLeaveRequest(input);
      }

      navigate('/me/leave-requests', {
        state: { notice: isEdit ? 'Cập nhật đơn xin nghỉ thành công.' : 'Gửi đơn xin nghỉ thành công.' },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : isEdit ? 'Không thể cập nhật đơn xin nghỉ.' : 'Không thể tạo đơn xin nghỉ.');
    } finally {
      setSubmitting(false);
    }
  };

  const reasonLength = reason.trim().length;
  const isReasonValid = reasonLength >= 10 && reasonLength <= 500;
  const showReasonError = (reasonTouched && !isReasonValid) || reasonLength > 500;
  const isSubmitDisabled = submitting || !!notEditable || !isDirty || !!daysError || !workingDays || !isReasonValid;
  const existingAttachmentUrl = !attachment && !removeExistingAttachment ? original?.attachmentUrl ?? null : null;
  const selectedType = leaveTypes.find((t) => t.code === leaveType);

  const leaveTypeCallout = useMemo(() => {
    if (!selectedType) return null;
    if (selectedType.code === 'maternity') {
      return {
        bg: '#f0f9ff',
        border: '#bae6fd',
        color: '#0369a1',
        text: 'Hưởng trợ cấp thai sản BHXH theo mức đóng BHXH × số tháng nghỉ (miễn BHXH & thuế TNCN).',
      };
    }
    if (selectedType.isPaid) {
      return {
        bg: '#f0fdf4',
        border: '#bbf7d0',
        color: '#15803d',
        text: selectedType.description || 'Hưởng 100% nguyên lương theo quy định.',
      };
    }
    return {
      bg: '#f8fafc',
      border: '#e2e8f0',
      color: '#475569',
      text: selectedType.description || 'Nghỉ không hưởng lương — công tính theo ngày đi làm thực tế.',
    };
  }, [selectedType]);

  return (
    <div className="panel leave-request-form-container workspace-content-page" style={{ maxWidth: '760px', margin: '0 auto', padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-border, #e5e7eb)', paddingBottom: '0.6rem' }}>
        <h1 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>
          {isEdit ? 'Sửa đơn xin nghỉ' : 'Tạo đơn xin nghỉ'}
        </h1>
        <button
          type="button"
          className="button secondary small"
          onClick={() => navigate('/me/leave-requests')}
          disabled={submitting}
        >
          <Icon name="arrow" size={14} /> Quay lại
        </button>
      </div>
      <div className="workspace-section-body">

        {error && <Alert variant="error">{error}</Alert>}
        {notEditable && <Alert variant="error">{notEditable}</Alert>}

        <form className="workspace-form-panel" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <div className="workspace-form-fields workspace-form-stack">
            <div className="field">
              <label htmlFor="leave-type-select" style={{ fontWeight: 600, fontSize: '12px', marginBottom: '4px', display: 'block' }}>
                Loại nghỉ <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                id="leave-type-select"
                className="input"
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value)}
                disabled={loadingTypes || submitting}
              >
                {leaveTypes.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>

              {leaveTypeCallout && (
            <div style={{
              marginTop: '0.4rem',
              padding: '0.35rem 0.65rem',
              borderRadius: '6px',
              backgroundColor: leaveTypeCallout.bg,
              border: `1px solid ${leaveTypeCallout.border}`,
              color: leaveTypeCallout.color,
              fontSize: '0.76rem',
              lineHeight: 1.4,
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <span>{leaveTypeCallout.text}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div className="field">
                <label htmlFor="start-date" style={{ fontWeight: 600, fontSize: '12px', marginBottom: '4px', display: 'block' }}>
                  Từ ngày <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="start-date"
                  type="date"
                  className="input"
                  value={startDate}
                  min={todayStr}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="end-date" style={{ fontWeight: 600, fontSize: '12px', marginBottom: '4px', display: 'block' }}>
                  Đến ngày <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="end-date"
                  type="date"
                  className="input"
                  value={endDate}
                  min={startDate || todayStr}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>
            </div>

        {/* Working Days Summary / Calculation */}
              <div style={{
                padding: '0.4rem 0.7rem',
                borderRadius: '6px',
                backgroundColor: daysError ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${daysError ? '#fecaca' : '#bbf7d0'}`,
                fontSize: '0.8rem',
              }}>
                {daysError ? (
                  <span style={{ color: '#dc2626', fontWeight: 500 }}>{daysError}</span>
                ) : (
                  <span style={{ color: '#166534' }}>
                    Tổng số ngày làm việc tính nghỉ: <strong>{workingDays} ngày</strong> (Không tính ngày Chủ Nhật)
                  </span>
                )}
              </div>

              {/* Reason Field with bottom-right dynamic counter */}
              <div className="field">
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label htmlFor="reason" style={{ fontWeight: 600, fontSize: '12px', margin: 0 }}>
                    Lý do xin nghỉ <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <small style={{
                    fontSize: '11px',
                    fontWeight: showReasonError ? 600 : 400,
                    color: showReasonError ? '#dc2626' : '#64748b',
                    transition: 'color 0.15s ease',
                  }}>
                    {reasonLength} / 500 ký tự {reasonLength < 10 ? '(tối thiểu 10)' : ''}
                  </small>
                </div>
                <textarea
                  id="reason"
                  className="input"
                  rows={3}
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    if (!reasonTouched) setReasonTouched(true);
                  }}
                  onBlur={() => setReasonTouched(true)}
                  placeholder="Mô tả cụ thể lý do xin nghỉ..."
                  disabled={submitting}
                  required
                />
              </div>

              {/* Compact horizontal File Upload bar */}
              <div className="field">
                <label style={{ fontWeight: 600, fontSize: '12px', marginBottom: '4px', display: 'block' }}>
                  Tệp đính kèm <span style={{ fontWeight: 400, color: '#64748b' }}>(tùy chọn)</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,image/png,image/jpeg"
                  onChange={handleFileChange}
                  disabled={submitting}
                  style={{ display: 'none' }}
                />
                {existingAttachmentUrl ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '6px 10px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <Icon name="file" size={15} />
                      <a
                        href={existingAttachmentUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: '12.5px', fontWeight: 500, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={fileNameFromUrl(existingAttachmentUrl)}
                      >
                        {fileNameFromUrl(existingAttachmentUrl)}
                      </a>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <button
                        type="button"
                        className="button secondary small"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={submitting}
                        style={{ minHeight: '28px', padding: '2px 10px', fontSize: '11.5px' }}
                      >
                        Thay tệp
                      </button>
                      <button
                        type="button"
                        className="icon-button"
                        onClick={() => setRemoveExistingAttachment(true)}
                        disabled={submitting}
                        title="Xóa tệp đính kèm"
                        style={{ width: '26px', height: '26px', padding: '2px', color: '#dc2626' }}
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                  </div>
                ) : !attachment ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexWrap: 'wrap',
                    background: '#f8fafc',
                    border: '1px dashed #cbd5e1',
                    borderRadius: '8px',
                    padding: '6px 10px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="button secondary small"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={submitting}
                        style={{ minHeight: '30px', padding: '4px 12px', fontSize: '12px' }}
                      >
                        <Icon name="file" size={14} /> Chọn tệp
                      </button>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>
                        Hỗ trợ PDF, JPG, PNG (tối đa 10 MB)
                      </span>
                    </div>
                    {removeExistingAttachment && (
                      <button
                        type="button"
                        className="button secondary small"
                        onClick={() => setRemoveExistingAttachment(false)}
                        disabled={submitting}
                        style={{ minHeight: '26px', padding: '2px 10px', fontSize: '11px' }}
                      >
                        Hoàn tác xóa tệp cũ
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    background: '#f8fafc',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    padding: '6px 10px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <Icon name="file" size={15} />
                      <span style={{ fontSize: '12.5px', fontWeight: 500, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={attachment.name}>
                        {attachment.name}
                      </span>
                      <span style={{ fontSize: '11.5px', color: '#64748b', flexShrink: 0 }}>
                        ({(attachment.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={handleRemoveFile}
                      disabled={submitting}
                      title="Xóa tệp đính kèm"
                      style={{ width: '26px', height: '26px', padding: '2px', color: '#dc2626', flexShrink: 0 }}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                )}
              </div>

            </div>
            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.15rem' }}>
              <button
                type="button"
                className="button secondary"
                onClick={() => navigate('/me/leave-requests')}
                disabled={submitting}
              >
                Hủy
              </button>
              <button
                type="submit"
                className="button primary"
                disabled={isSubmitDisabled}
                style={{ minWidth: '145px' }}
              >
                {submitting ? (
                  <>
                    <span className="vnc-spinner" aria-hidden="true" />
                    <span>{isEdit ? 'Đang lưu...' : 'Đang gửi đơn...'}</span>
                  </>
                ) : isEdit ? (
                  'Lưu thay đổi'
                ) : (
                  'Gửi đơn xin nghỉ'
                )}
              </button>
            </div>
        </form>
      </div>
    </div>
  );
}

