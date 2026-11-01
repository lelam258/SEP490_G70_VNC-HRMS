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
        setError(err instanceof Error ? err.message : 'Không tải được dữ liệu đơn nghỉ phép.');
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
      setError('Lý do nghỉ phép phải từ 10 đến 500 ký tự.');
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
        state: { notice: isEdit ? 'Cập nhật đơn nghỉ phép thành công.' : 'Gửi đơn nghỉ phép thành công.' },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : isEdit ? 'Không thể cập nhật đơn nghỉ phép.' : 'Không thể tạo đơn nghỉ phép.');
    } finally {
      setSubmitting(false);
    }
  };

  const reasonLength = reason.trim().length;
  const isReasonValid = reasonLength >= 10 && reasonLength <= 500;
  const isSubmitDisabled = submitting || !!notEditable || !isDirty || !!daysError || !workingDays || !isReasonValid;
  const existingAttachmentUrl = !attachment && !removeExistingAttachment ? original?.attachmentUrl ?? null : null;
  const selectedType = leaveTypes.find((t) => t.code === leaveType);

  return (
    <div className="panel leave-request-form-container" style={{ maxWidth: '680px', margin: '0 auto', padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border, #e5e7eb)', paddingBottom: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>
            {isEdit ? 'Sửa đơn nghỉ phép' : 'Tạo đơn nghỉ phép mới'}
          </h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted, #6b7280)' }}>
            {isEdit
              ? 'Chỉ sửa được khi đơn còn chờ duyệt'
              : 'Điền thông tin khoảng thời gian và lý do nghỉ phép'}
          </p>
        </div>
        <button
          type="button"
          className="button secondary small"
          onClick={() => navigate('/me/leave-requests')}
          disabled={submitting}
        >
          <Icon name="arrow" /> Quay lại
        </button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {notEditable && <Alert variant="error">{notEditable}</Alert>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div className="field">
          <label htmlFor="leave-type-select" style={{ fontWeight: 600, fontSize: '12px', marginBottom: '6px', display: 'block' }}>
            Loại nghỉ phép <span style={{ color: '#dc2626' }}>*</span>
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

          {selectedType && (
            <div style={{ marginTop: '0.5rem', padding: '0.625rem 0.75rem', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.8125rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: selectedType.description ? '0.375rem' : '0' }}>
                {selectedType.isPaid ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, backgroundColor: '#dcfce7', color: '#15803d' }}>
                    ● Hưởng 100% nguyên lương
                  </span>
                ) : selectedType.code === 'sick' || selectedType.code === 'maternity' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, backgroundColor: '#e0f2fe', color: '#0369a1' }}>
                    ● Hưởng trợ cấp BHXH
                  </span>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600, backgroundColor: '#fef3c7', color: '#92400e' }}>
                    ● Không hưởng lương
                  </span>
                )}
              </div>
              {selectedType.description && (
                <div style={{ color: '#475569', lineHeight: 1.45, fontSize: '0.8125rem' }}>
                  {selectedType.description}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="field">
            <label htmlFor="start-date" style={{ fontWeight: 600, fontSize: '12px', marginBottom: '6px', display: 'block' }}>
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
            <label htmlFor="end-date" style={{ fontWeight: 600, fontSize: '12px', marginBottom: '6px', display: 'block' }}>
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
          padding: '0.75rem 1rem',
          borderRadius: '6px',
          backgroundColor: daysError ? '#fef2f2' : '#f0fdf4',
          border: `1px solid ${daysError ? '#fecaca' : '#bbf7d0'}`,
          fontSize: '0.875rem',
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
          <label htmlFor="reason" style={{ fontWeight: 600, fontSize: '12px', marginBottom: '6px', display: 'block' }}>
            Lý do nghỉ phép <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <textarea
            id="reason"
            className="input"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Mô tả cụ thể lý do xin nghỉ phép..."
            disabled={submitting}
            required
            style={{ width: '100%', resize: 'vertical' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <small style={{
              fontSize: '11px',
              fontWeight: isReasonValid ? 400 : 600,
              color: isReasonValid ? '#748793' : '#dc2626',
              transition: 'color 0.15s ease',
            }}>
              {reasonLength} / 500 ký tự {!isReasonValid && reasonLength < 10 ? '(tối thiểu 10)' : ''}
            </small>
          </div>
        </div>

        {/* Custom File Upload Area */}
        <div className="field">
          <label style={{ fontWeight: 600, fontSize: '12px', marginBottom: '6px', display: 'block' }}>
            Tệp đính kèm (tùy chọn)
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
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              background: '#f8fafb',
              border: '1px solid #d9e3e8',
              borderRadius: '6px',
              padding: '7px 12px',
              maxWidth: '100%',
            }}>
              <Icon name="file" size={16} />
              <a
                href={existingAttachmentUrl}
                target="_blank"
                rel="noreferrer"
                style={{ fontSize: '12px', fontWeight: 500, color: '#294656', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}
                title={fileNameFromUrl(existingAttachmentUrl)}
              >
                {fileNameFromUrl(existingAttachmentUrl)}
              </a>
              <button
                type="button"
                className="button secondary small"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                style={{ minHeight: '28px', padding: '2px 10px', fontSize: '11px' }}
              >
                Thay tệp
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={() => setRemoveExistingAttachment(true)}
                disabled={submitting}
                title="Xóa tệp đính kèm"
                style={{ width: '24px', height: '24px', padding: '2px', color: '#cf7c66' }}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          ) : !attachment ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="button secondary small"
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                style={{ minHeight: '36px', padding: '6px 14px', fontSize: '12px' }}
              >
                <Icon name="file" size={16} /> Chọn tệp đính kèm
              </button>
              <span style={{ fontSize: '12px', color: '#748793' }}>
                Hỗ trợ PDF, JPG, PNG (tối đa 10 MB)
              </span>
              {removeExistingAttachment && (
                <button
                  type="button"
                  className="button secondary small"
                  onClick={() => setRemoveExistingAttachment(false)}
                  disabled={submitting}
                  style={{ minHeight: '28px', padding: '2px 10px', fontSize: '11px' }}
                >
                  Hoàn tác xóa tệp cũ
                </button>
              )}
            </div>
          ) : (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              background: '#f8fafb',
              border: '1px solid #d9e3e8',
              borderRadius: '6px',
              padding: '7px 12px',
              maxWidth: '100%',
            }}>
              <Icon name="file" size={16} />
              <span style={{ fontSize: '12px', fontWeight: 500, color: '#294656', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }} title={attachment.name}>
                {attachment.name}
              </span>
              <span style={{ fontSize: '11px', color: '#748793' }}>
                ({(attachment.size / (1024 * 1024)).toFixed(2)} MB)
              </span>
              <button
                type="button"
                className="icon-button"
                onClick={handleRemoveFile}
                disabled={submitting}
                title="Xóa tệp đính kèm"
                style={{ width: '24px', height: '24px', padding: '2px', marginLeft: '4px', color: '#cf7c66' }}
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
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
            style={{ minWidth: '165px' }}
          >
            {submitting ? (
              <>
                <span className="vnc-spinner" aria-hidden="true" />
                <span>{isEdit ? 'Đang lưu...' : 'Đang gửi đơn...'}</span>
              </>
            ) : isEdit ? (
              'Lưu thay đổi'
            ) : (
              'Gửi đơn nghỉ phép'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

