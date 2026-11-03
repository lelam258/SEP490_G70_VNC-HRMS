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
            ? `Đã xác nhận phiếu ${slip.slipNumber} đạt yêu cầu và chuyển sang Kế toán.`
            : `Đã xác minh phiếu ${slip.slipNumber} thành công (Verified).`
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
    <Modal title={title} onClose={onClose} busy={submitting} maxWidth="620px">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        {/* Tóm tắt thông tin phiếu */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 text-sm space-y-2">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="font-semibold text-slate-900">{slip.serviceName}</span>
            <span className="font-mono text-xs text-slate-500">Ngày: {formatDateOnly(slip.procedureDate)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
            <div>
              Khoa/Phòng: <strong className="text-slate-800">{slip.departmentName || '—'}</strong>
            </div>
            <div>
              Mã bệnh nhân: <strong className="text-slate-800 font-mono">{slip.patientCode || '—'}</strong>
            </div>
            <div>
              Tiền thu viện phí: <strong className="text-slate-900">{formatVnd(slip.chargedAmount)}</strong>
            </div>
            <div>
              Chi phí trực tiếp: <strong className="text-slate-800">{formatVnd(slip.directCost)}</strong>
            </div>
            <div>
              Số nhân sự kíp: <strong className="text-slate-800">{slip.participantCount} người</strong>
            </div>
            <div>
              Tổng hoa hồng: <strong className="text-emerald-700">{formatVnd(slip.totalCommissionAmount)}</strong>
            </div>
          </div>
        </div>

        {/* Checklist đối soát */}
        <div className="bg-sky-50/70 border border-sky-200/80 rounded-lg p-3 text-xs text-sky-900 space-y-1">
          <div className="font-semibold text-sky-950">
            {isHr ? 'Tiêu chí HR kiểm tra (Bước 1):' : 'Tiêu chí Kế toán xác minh (Bước 2):'}
          </div>
          {isHr ? (
            <ul className="list-disc list-inside space-y-0.5 text-sky-800">
              <li>Nhân sự tham gia đúng danh sách phân công và chức danh chuyên môn.</li>
              <li>Vai trò thực hiện và định mức hoa hồng áp dụng đúng quy chế.</li>
              <li>Cờ ngoài giờ ({slip.isAfterHours ? 'Ca ngoài giờ' : 'Giờ hành chính'}) khớp với lịch trực.</li>
            </ul>
          ) : (
            <ul className="list-disc list-inside space-y-0.5 text-sky-800">
              <li>Số tiền thu viện phí ({formatVnd(slip.chargedAmount)}) khớp với hóa đơn thực thu của bệnh nhân.</li>
              <li>Chi phí trực tiếp ({formatVnd(slip.directCost)}) đã đối chiếu vật tư tiêu hao.</li>
              <li>Tổng hoa hồng ({formatVnd(slip.totalCommissionAmount)}) đủ điều kiện kết chuyển vào bảng lương tháng.</li>
            </ul>
          )}
        </div>

        {/* Lựa chọn Quyết định */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">Quyết định kiểm duyệt *</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDecision('approve')}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                decision === 'approve'
                  ? 'border-emerald-600 bg-emerald-50/80 text-emerald-900 ring-2 ring-emerald-500/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="font-semibold text-sm flex items-center gap-1.5">
                <span className="text-emerald-600">✓</span>
                <span>{isHr ? 'Đạt yêu cầu (Pass)' : 'Xác minh (Verify)'}</span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {isHr
                  ? 'Chuyển tiếp sang Kế toán thẩm định'
                  : 'Đổi trạng thái sang Verified để tính hoa hồng tháng'}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDecision('reject')}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                decision === 'reject'
                  ? 'border-rose-600 bg-rose-50/80 text-rose-900 ring-2 ring-rose-500/20'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="font-semibold text-sm flex items-center gap-1.5">
                <span className="text-rose-600">✕</span>
                <span>Từ chối (Reject)</span>
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                Đổi trạng thái sang Rejected và thông báo cho nhân viên y tế
              </div>
            </button>
          </div>
        </div>

        {decision === 'approve' ? (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
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
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
            />
          </div>
        ) : (
          <div>
            <label className="block text-sm font-medium text-rose-700 mb-1">
              Lý do từ chối (Bắt buộc - gửi thông báo cho nhân viên) *
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập rõ lý do từ chối để nhân viên y tế kiểm tra và cập nhật lại..."
              className="w-full rounded-lg border border-rose-300 px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <button
            type="button"
            className="button"
            disabled={submitting}
            onClick={onClose}
          >
            Hủy bỏ
          </button>
          <button
            type="submit"
            disabled={submitting}
            className={`button ${
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
