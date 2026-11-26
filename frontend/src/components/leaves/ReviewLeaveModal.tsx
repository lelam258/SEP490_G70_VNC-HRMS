import { useState, useEffect } from 'react';
import { leaveApprovalApi } from '../../services/leaveApprovalApi';
import type { LeaveApprovalDetail } from '../../types/leaveApproval';
import { useAuthStore } from '../../store/useAuthStore';
import Icon from '../ui/Icon';

interface ReviewLeaveModalProps {
  requestId: string;
  onClose: () => void;
  onSuccess: (updated: LeaveApprovalDetail) => void;
}

export default function ReviewLeaveModal({ requestId, onClose, onSuccess }: ReviewLeaveModalProps) {
  const { session } = useAuthStore();
  const userRole = session?.user?.role;
  const canDecide = userRole === 'department_head' || userRole === 'admin';

  const [detail, setDetail] = useState<LeaveApprovalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Reject mode state
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectedReason, setRejectedReason] = useState('');
  const [rejectError, setRejectError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchDetail = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await leaveApprovalApi.getDetail(requestId);
        if (mounted) {
          setDetail(data);
        }
      } catch (err: unknown) {
        if (mounted) {
          const msg = err instanceof Error ? err.message : 'Không thể tải chi tiết đơn nghỉ phép.';
          setError(msg);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void fetchDetail();
    return () => {
      mounted = false;
    };
  }, [requestId]);

  const handleApprove = async () => {
    if (!detail) return;
    try {
      setActionLoading(true);
      setError(null);
      const updated = await leaveApprovalApi.approve(detail.requestId);
      onSuccess(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Phê duyệt thất bại. Vui lòng thử lại.';
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!detail) return;
    const trimmed = rejectedReason.trim();
    if (trimmed.length < 5) {
      setRejectError('Vui lòng nhập lý do từ chối cụ thể (tối thiểu 5 ký tự).');
      return;
    }

    try {
      setActionLoading(true);
      setRejectError(null);
      const updated = await leaveApprovalApi.reject(detail.requestId, { rejectedReason: trimmed });
      onSuccess(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Từ chối thất bại. Vui lòng thử lại.';
      setRejectError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dtStr?: string | null) => {
    if (!dtStr) return '—';
    try {
      const d = new Date(dtStr);
      return d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dtStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <Icon name="clock" size={20} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">Chi tiết đơn xin nghỉ phép</h3>
              <p className="text-xs text-slate-500">Xem xét và phê duyệt đơn nghỉ của nhân viên</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
              <p className="mt-3 text-sm">Đang tải thông tin đơn...</p>
            </div>
          ) : error && !detail ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
              {error}
            </div>
          ) : detail ? (
            <>
              {error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  {error}
                </div>
              )}

              {/* Status Alert if not pending */}
              {detail.status === 'approved' && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-800 flex items-center justify-between">
                  <span className="font-medium">Đơn này đã được phê duyệt</span>
                  <span className="text-slate-500">
                    Bởi: {detail.approvedByName || 'Quản lý'} • {formatDateTime(detail.approvedAt)}
                  </span>
                </div>
              )}
              {detail.status === 'rejected' && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-800">
                  <div className="font-medium">Đơn này đã bị từ chối</div>
                  <div className="mt-1 text-slate-600">Lý do: {detail.rejectedReason || '—'}</div>
                  <div className="mt-1 text-slate-400">
                    Bởi: {detail.approvedByName || 'Quản lý'} • {formatDateTime(detail.approvedAt)}
                  </div>
                </div>
              )}
              {detail.status === 'withdrawn' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  Nhân viên đã tự rút đơn này.
                </div>
              )}

              {/* Employee Information Card */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-slate-800">{detail.staffName}</span>
                      <span className="rounded bg-teal-50 px-2 py-0.5 text-xs font-mono font-medium text-teal-700">
                        {detail.staffCode}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                      <span>Khoa/Phòng: <strong className="text-slate-700">{detail.departmentName}</strong></span>
                      {detail.positionName && (
                        <span>Chức danh: <strong className="text-slate-700">{detail.positionName}</strong></span>
                      )}
                    </div>
                  </div>
                  {detail.status === 'pending' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200/60">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Chờ duyệt
                    </span>
                  )}
                </div>
              </div>

              {/* Leave Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 p-3.5 bg-white">
                  <div className="text-xs text-slate-400">Loại nghỉ phép</div>
                  <div className="mt-1 font-semibold text-slate-800 text-sm">{detail.leaveTypeName}</div>
                  {detail.leaveType === 'annual' && (
                    <div className="mt-2 text-xs text-teal-700 bg-teal-50/70 rounded px-2 py-1 inline-block">
                      Số dư phép năm: <strong>{detail.annualLeaveRemaining}</strong> / {detail.annualLeaveEntitlement} ngày
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 p-3.5 bg-white">
                  <div className="text-xs text-slate-400">Thời gian xin nghỉ</div>
                  <div className="mt-1 font-semibold text-slate-800 text-sm">
                    {formatDate(detail.startDate)} → {formatDate(detail.endDate)}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    Tổng cộng: <strong className="text-slate-800 font-semibold">{detail.totalDays}</strong> ngày làm việc
                  </div>
                </div>
              </div>

              {/* Warnings (Conflicts) */}
              {detail.hasShiftConflict && detail.conflictingShifts.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                    <Icon name="clock" size={16} />
                    Cảnh báo xung đột lịch trực / ca làm việc:
                  </div>
                  <p className="mt-1 text-slate-600">
                    Nhân viên có ca trực trong khoảng thời gian xin nghỉ:
                  </p>
                  <ul className="mt-1.5 list-disc list-inside space-y-0.5 text-amber-900 font-medium">
                    {detail.conflictingShifts.map((cs, idx) => (
                      <li key={idx}>{cs}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-slate-500">
                    * Lưu ý: Cần điều chỉnh hoặc sắp xếp người thay thế ca trực trước khi phê duyệt.
                  </p>
                </div>
              )}

              {detail.hasLeaveConflict && detail.conflictingLeaves.length > 0 && (
                <div className="rounded-xl border border-orange-200 bg-orange-50/70 p-3.5 text-xs text-orange-900">
                  <div className="font-semibold text-orange-800">
                    Trùng lặp với đơn nghỉ phép khác đã duyệt:
                  </div>
                  <ul className="mt-1 list-disc list-inside space-y-0.5 text-orange-900">
                    {detail.conflictingLeaves.map((cl, idx) => (
                      <li key={idx}>{cl}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Reason Card */}
              <div>
                <label className="text-xs font-medium text-slate-600">Lý do xin nghỉ</label>
                <div className="mt-1 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {detail.reason || 'Không có lý do cụ thể.'}
                </div>
              </div>

              {/* Attachment if exists */}
              {detail.attachmentUrl && (
                <div>
                  <label className="text-xs font-medium text-slate-600">Minh chứng đính kèm</label>
                  <div className="mt-1">
                    <a
                      href={detail.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-teal-700 hover:bg-slate-50 hover:border-teal-300 transition shadow-sm"
                    >
                      <Icon name="fileText" size={16} />
                      <span>Xem tài liệu đính kèm</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Reject Reason Form (if toggled) */}
              {showRejectForm && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-rose-800">
                      Lý do từ chối đơn xin nghỉ <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowRejectForm(false);
                        setRejectError(null);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Hủy bỏ
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={rejectedReason}
                    onChange={(e) => {
                      setRejectedReason(e.target.value);
                      if (rejectError) setRejectError(null);
                    }}
                    placeholder="Nhập lý do từ chối (bắt buộc, tối thiểu 5 ký tự)..."
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-800 focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                  {rejectError && (
                    <p className="text-xs text-rose-600 font-medium">{rejectError}</p>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => setShowRejectForm(false)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Quay lại
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => void handleReject()}
                      className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 shadow-sm disabled:opacity-50"
                    >
                      {actionLoading ? 'Đang xử lý...' : 'Xác nhận từ chối'}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            Đóng
          </button>

          {detail && detail.status === 'pending' && !showRejectForm && canDecide && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setShowRejectForm(true)}
                className="rounded-lg border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 transition shadow-sm disabled:opacity-50"
              >
                Từ chối
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => void handleApprove()}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition shadow-sm disabled:opacity-50 flex items-center gap-1.5"
              >
                <Icon name="check" size={16} />
                {actionLoading ? 'Đang xử lý...' : 'Phê duyệt đơn'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

