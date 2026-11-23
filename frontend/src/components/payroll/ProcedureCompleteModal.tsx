import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Alert from '../ui/Alert';
import { procedureSlipApi } from '../../services/procedureSlipApi';
import type { ProcedureSlipDetail, ProcedureSlipListItem } from '../../types/procedureSlip';
import { formatDateOnly } from '../../utils/format';

interface ProcedureCompleteModalProps {
  open: boolean;
  slip: ProcedureSlipListItem | ProcedureSlipDetail | null;
  onClose: () => void;
  onSuccess: (updated: ProcedureSlipDetail, message: string) => void;
}

export default function ProcedureCompleteModal({
  open,
  slip,
  onClose,
  onSuccess,
}: ProcedureCompleteModalProps) {
  const [note, setNote] = useState('');
  const [actualMinutes, setActualMinutes] = useState<number>(() => {
    return slip?.durationHours ? Math.round(slip.durationHours * 60) : 30;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && slip) {
      setNote('');
      setError('');
      setActualMinutes(slip.durationHours ? Math.round(slip.durationHours * 60) : 30);
    }
  }, [open, slip?.slipId, slip?.durationHours]);

  if (!open || !slip) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const actualDurationHours = actualMinutes > 0 ? Math.round((actualMinutes / 60) * 100) / 100 : undefined;
      const updated = await procedureSlipApi.completeSlip(slip.slipId, {
        note: note.trim() || undefined,
        actualDurationHours,
      });
      const message = `Bác sĩ đã xác nhận hoàn thành ca thủ thuật ${slip.slipNumber} thành công!`;
      setNote('');
      onSuccess(updated, message);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Không thể xác nhận hoàn thành ca thủ thuật.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      title={`Xác nhận hoàn thành ca thủ thuật: ${slip.slipNumber}`}
      onClose={onClose}
      busy={submitting}
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-sm">
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-1.5 text-xs text-emerald-950">
          <div className="font-bold text-sm text-emerald-900">
            Ca thủ thuật đã được Kế toán duyệt viện phí
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 text-slate-700">
            <div>
              <span className="text-slate-500">Dịch vụ:</span>{' '}
              <strong>{slip.serviceName}</strong>
            </div>
            <div>
              <span className="text-slate-500">Mã bệnh nhân:</span>{' '}
              <strong className="font-mono">{slip.patientCode || '—'}</strong>
            </div>
            <div>
              <span className="text-slate-500">Ngày thực hiện:</span>{' '}
              <strong>{formatDateOnly(slip.procedureDate)}</strong>
            </div>
            <div>
              <span className="text-slate-500">Khoa / Phòng:</span>{' '}
              <strong>{slip.departmentName || '—'}</strong>
            </div>
          </div>
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Thời lượng thực tế ca thủ thuật (Phút) *
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={1440}
              required
              value={actualMinutes}
              onChange={(e) => setActualMinutes(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-32 rounded-lg border border-slate-300 p-2 text-sm font-bold text-slate-900"
            />
            <span className="text-xs text-slate-500 font-medium">phút ({(actualMinutes / 60).toFixed(2)} giờ)</span>
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="text-[11px] text-slate-500">Chọn nhanh:</span>
            {[15, 30, 45, 60, 90, 120].map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => setActualMinutes(mins)}
                className={`text-[11px] px-2 py-0.5 rounded border font-medium cursor-pointer transition-colors ${
                  actualMinutes === mins
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {mins}p
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Ghi chú kết quả / Hoàn thành ca thủ thuật (Tùy chọn)
          </label>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="VD: Ca thủ thuật đã thực hiện thành công, bệnh nhân ổn định và ra về an toàn..."
            className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <button
            type="button"
            className="button"
            disabled={submitting}
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="button primary bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
          >
            {submitting ? 'Đang xác nhận...' : 'Xác nhận hoàn thành ca'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
