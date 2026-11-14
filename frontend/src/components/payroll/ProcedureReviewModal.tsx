import { useEffect, useState } from 'react';
import Alert from '../ui/Alert';
import Modal from '../ui/Modal';
import { procedureSlipApi } from '../../services/procedureSlipApi';
import type { ProcedureSlipDetail, ProcedureSlipListItem } from '../../types/procedureSlip';
import { formatDateOnly, formatVnd } from '../../utils/format';

interface ProcedureReviewModalProps {
  open: boolean;
  mode: 'hr_check' | 'accountant_verify';
  slip: ProcedureSlipListItem | ProcedureSlipDetail | null;
  defaultDecision?: 'approve' | 'reject';
  onClose: () => void;
  onSuccess: (updated: ProcedureSlipDetail, message: string) => void;
}

export default function ProcedureReviewModal({
  open,
  mode,
  slip,
  defaultDecision = 'approve',
  onClose,
  onSuccess,
}: ProcedureReviewModalProps) {
  const [decision, setDecision] = useState<'approve' | 'reject'>(defaultDecision);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setDecision(defaultDecision);
      setError('');
    }
  }, [open, defaultDecision]);

  if (!open || !slip) return null;

  const isHr = mode === 'hr_check';
  const title = isHr
    ? `HR Kiểm tra phiếu thủ thuật: ${slip.slipNumber}`
    : `Kế toán Xác minh phiếu thủ thuật: ${slip.slipNumber}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (decision === 'reject' && reason.trim().length < 5) {
      setError('Vui lòng nhập lý do từ chối cụ thể (tối thiểu 5 ký tự) để thông báo cho nhân viên y tế.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        decision,
        note: decision === 'approve' ? note.trim() || undefined : undefined,
        reason: decision === 'reject' ? reason.trim() : undefined,
      };

      const updated = isHr
        ? await procedureSlipApi.hrCheckSlip(slip.slipId, payload)
        : await procedureSlipApi.verifySlip(slip.slipId, payload);

      const successMessage =
        decision === 'approve'
          ? isHr
            ? `Đã xác nhận phiếu ${slip.slipNumber} đạt yêu cầu.`
            : `Đã xác minh phiếu ${slip.slipNumber} thành công (Chuyển Bác sĩ thực hiện).`
          : `Đã từ chối phiếu ${slip.slipNumber} và gửi thông báo cho nhân viên y tế.`;

      setNote('');
      setReason('');
      onSuccess(updated, successMessage);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể thực hiện thao tác kiểm duyệt.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={title}
      onClose={onClose}
      busy={submitting}
      maxWidth="760px"
      className="vnc-modal-no-scroll"
    >
      <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3 overflow-hidden">
        {error && <Alert variant="error">{error}</Alert>}

        {/* Tóm tắt thông tin phiếu - bố cục 3 cột ngang gọn gàng */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs space-y-1.5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
            <span className="font-semibold text-slate-900 text-sm truncate pr-3">
              {slip.serviceName}
            </span>
            <span className="font-mono text-xs text-slate-500 shrink-0">
              Ngày: {formatDateOnly(slip.procedureDate)}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-xs text-slate-600 pt-0.5">
            <div className="truncate">
              Khoa/Phòng: <strong className="text-slate-800">{slip.departmentName || '—'}</strong>
            </div>
            <div className="truncate">
              Mã BN: <strong className="text-slate-800 font-mono">{slip.patientCode || '—'}</strong>
            </div>
            <div>
              Nhân sự kíp: <strong className="text-slate-800">{slip.participantCount} người</strong>
            </div>
            <div>
              Thu viện phí: <strong className="text-slate-900">{formatVnd(slip.chargedAmount)}</strong>
            </div>
            <div>
              Chi phí trực tiếp: <strong className="text-slate-800">{formatVnd(slip.directCost)}</strong>
            </div>
            <div>
              Tổng hoa hồng:{' '}
              <strong className="text-emerald-700">{formatVnd(slip.totalCommissionAmount)}</strong>
            </div>
          </div>
        </div>

        {/* Checklist đối soát thu gọn */}
        <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl px-4 py-2.5 text-xs text-sky-900">
          <div className="font-semibold text-sky-950 mb-1">
            Tiêu chí Kế toán xác minh viện phí:
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-sky-800">
            <li>
              Viện phí ({formatVnd(slip.chargedAmount)}) & chi phí trực tiếp (
              {formatVnd(slip.directCost)}) khớp hóa đơn thực thu.
            </li>
            <li>
              Tổng hoa hồng ({formatVnd(slip.totalCommissionAmount)}) đủ điều kiện kết chuyển kíp thực hiện.
            </li>
          </ul>
        </div>

        {/* Lựa chọn Quyết định */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 mb-0">
            Quyết định kiểm duyệt *
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDecision('approve')}
              className={`px-3.5 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                decision === 'approve'
                  ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="font-semibold text-sm flex items-center gap-1.5">
                <span className="text-emerald-600">✓</span>
                <span>{isHr ? 'Đạt yêu cầu (Pass)' : 'Xác minh (Verify)'}</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {isHr
                  ? 'Chuyển tiếp sang Kế toán thẩm định'
                  : 'Đổi trạng thái sang Verified để tính hoa hồng'}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDecision('reject')}
              className={`px-3.5 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                decision === 'reject'
                  ? 'border-rose-600 bg-rose-50/80 text-rose-900 ring-2 ring-rose-500/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="font-semibold text-sm flex items-center gap-1.5">
                <span className="text-rose-600">✕</span>
                <span>Từ chối (Reject)</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Đổi trạng thái sang Rejected và báo nhân viên y tế
              </div>
            </button>
          </div>
        </div>

        {decision === 'approve' ? (
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 mb-0">
              Ghi chú xác nhận (không bắt buộc)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                isHr
                  ? 'Ghi chú kiểm tra nhân sự/quy chế...'
                  : 'Ghi chú đối soát hóa đơn viện phí...'
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm resize-none focus:border-sky-500 focus:outline-none"
            />
          </div>
        ) : (
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-rose-700 mb-0">
              Lý do từ chối (Bắt buộc - gửi thông báo cho nhân viên) *
            </label>
            <textarea
              rows={2}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập rõ lý do từ chối để nhân viên y tế kiểm tra và cập nhật lại..."
              className="w-full rounded-xl border border-rose-300 px-3 py-2 text-sm resize-none focus:border-rose-500 focus:outline-none"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-2.5 border-t border-slate-200">
          <button
            type="button"
            className="button py-2 px-4 min-h-[38px]"
            disabled={submitting}
            onClick={onClose}
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={submitting}
            className={`button py-2 px-4 min-h-[38px] ${
              decision === 'approve'
                ? 'primary bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600'
            }`}
          >
            {submitting
              ? 'Đang xử lý...'
              : decision === 'approve'
              ? isHr
                ? 'Xác nhận Đạt & Chuyển Kế toán'
                : 'Xác minh phiếu (Verify)'
              : 'Xác nhận Từ chối & Gửi thông báo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
