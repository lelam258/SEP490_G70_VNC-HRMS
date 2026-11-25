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
    <Modal title={title} onClose={onClose} busy={busy} maxWidth="480px">
      <form onSubmit={submit} className="flex flex-col">
        <div className="px-6 py-4 space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/90 dark:border-amber-800 px-3.5 py-3 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
            >
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              Bạn có chắc chắn muốn ngừng áp dụng tham số{' '}
              <strong className="font-semibold text-amber-950 dark:text-amber-100">{itemName}</strong>?
            </div>
          </div>

          <div>
            <label htmlFor="deactivate-effective-to" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Ngày kết thúc hiệu lực <span className="text-rose-500">*</span>
            </label>
            <input
              id="deactivate-effective-to"
              type="date"
              required
              min={effectiveFrom}
              value={effectiveTo}
              onChange={e => setEffectiveTo(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 tabular-nums focus:outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 box-border"
            />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
              Mặc định là ngày hôm nay. Không được chọn ngày rơi vào kỳ lương đã khóa.
            </p>
          </div>

          {error && <Alert variant="error">{error}</Alert>}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-end gap-2.5 flex-shrink-0">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium text-xs transition-colors focus:outline-none cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={busy}
            className="h-9 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-semibold text-xs shadow-2xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 focus:outline-none cursor-pointer"
          >
            {busy && (
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
            )}
            <span>{busy ? 'Đang xử lý…' : 'Ngừng áp dụng'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
