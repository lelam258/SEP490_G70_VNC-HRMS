import { useState, type FormEvent } from 'react';
import Modal from '../ui/Modal';
import Alert from '../ui/Alert';
import { todayVn } from '../../utils/format';

interface DeactivateModalProps {
  open: boolean;
  title: string;
  itemName: string;
  effectiveFrom?: string;
  onConfirm: (effectiveTo?: string) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  error?: string;
}

export default function DeactivateModal({
  open,
  title,
  itemName,
  effectiveFrom,
  onConfirm,
  onClose,
  busy,
  error,
}: DeactivateModalProps) {
  const today = todayVn();
  // A future-dated record cannot end before it starts, so default to its start date.
  const [effectiveTo, setEffectiveTo] = useState(effectiveFrom && effectiveFrom > today ? effectiveFrom : today);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    void onConfirm(effectiveTo || undefined);
  }

  if (!open) return null;

  return (
    <Modal title={title} onClose={onClose} busy={busy} maxWidth="500px">
      <form onSubmit={submit} className="flex flex-col h-full">
        <div className="px-6 py-5 space-y-4 flex-1">
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3.5 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
            Bạn có chắc chắn muốn ngừng áp dụng tham số <strong className="font-semibold underline decoration-amber-400">{itemName}</strong> không?
          </div>

          <div>
            <label htmlFor="deactivate-effective-to" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
              Ngày kết thúc hiệu lực <span className="text-rose-500">*</span>
            </label>
            <input
              id="deactivate-effective-to"
              type="date"
              required
              min={effectiveFrom}
              value={effectiveTo}
              onChange={e => setEffectiveTo(e.target.value)}
              className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Mặc định là ngày hôm nay. Không được chọn ngày rơi vào kỳ lương đã khóa.
            </p>
          </div>

          {error && <Alert variant="error">{error}</Alert>}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="h-10 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium text-sm transition-colors focus:outline-none"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={busy}
            className="h-10 px-5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-1"
          >
            {busy && (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
            )}
            <span>{busy ? 'Đang xử lý…' : 'Xác nhận ngừng áp dụng'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
