import { useState, useMemo, useEffect, type FormEvent } from 'react';
import Alert from '../ui/Alert';
import MoneyInput from '../ui/MoneyInput';
import { useModal } from '../ui/Modal';
import type { TaxBracket, SaveTaxBracketInput } from '../../types/payroll';

interface TaxBracketFormProps {
  initial?: TaxBracket;
  onSave: (value: SaveTaxBracketInput) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  error?: string;
  onDirtyChange?: (dirty: boolean) => void;
}

export default function TaxBracketForm({
  initial,
  onSave,
  onClose,
  busy,
  error,
  onDirtyChange,
}: TaxBracketFormProps) {
  const isEdit = Boolean(initial);

  const [incomeFrom, setIncomeFrom] = useState<number | null>(
    initial?.incomeFrom !== undefined ? initial.incomeFrom : 0
  );
  const [incomeTo, setIncomeTo] = useState<number | null>(
    initial?.incomeTo !== null && initial?.incomeTo !== undefined ? initial.incomeTo : null
  );
  const [taxRatePercent, setTaxRatePercent] = useState<string>(
    initial?.taxRatePercent !== undefined ? String(initial.taxRatePercent) : '5'
  );
  const [effectiveFrom, setEffectiveFrom] = useState(initial?.effectiveFrom || '2026-01-01');
  const [effectiveTo, setEffectiveTo] = useState(initial?.effectiveTo || '');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isDirty = useMemo(() => {
    if (!initial) return true;
    if (incomeFrom !== initial.incomeFrom) return true;
    if (incomeTo !== (initial.incomeTo ?? null)) return true;
    if (Number(taxRatePercent) !== initial.taxRatePercent) return true;
    if (effectiveFrom !== initial.effectiveFrom) return true;
    if ((effectiveTo || '') !== (initial.effectiveTo || '')) return true;

    return false;
  }, [initial, incomeFrom, incomeTo, taxRatePercent, effectiveFrom, effectiveTo]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const modal = useModal();

  function handleCancel() {
    if (modal) {
      modal.requestClose();
    } else {
      onClose();
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !isDirty) return;

    const errors: Record<string, string> = {};
    const fromVal = incomeFrom ?? 0;
    const toVal = incomeTo;
    const rateVal = Number(taxRatePercent);

    if (fromVal < 0) errors.from = 'Thu nhập từ không được âm.';
    if (toVal !== null && toVal <= fromVal) errors.to = 'Thu nhập đến phải lớn hơn thu nhập từ.';
    if (isNaN(rateVal) || rateVal < 0 || rateVal > 100) errors.rate = 'Thuế suất phải từ 0% đến 100%.';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    void onSave({
      incomeFrom: fromVal,
      incomeTo: toVal,
      taxRatePercent: rateVal,
      effectiveFrom,
      effectiveTo: effectiveTo || null,
      status: initial?.status || 'active',
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col h-full">
      {/* Scrollable Body */}
      <div className="px-6 py-5 space-y-6 flex-1 overflow-y-auto max-h-[calc(85vh-130px)]">
        {/* Inactive Banner */}
        {initial?.status === 'inactive' && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <span className="text-base leading-none">⚠️</span>
            <div className="leading-relaxed">
              <strong>Bậc thuế này đang ngừng áp dụng.</strong> Để kích hoạt lại, vui lòng sử dụng nút <em>Kích hoạt</em> trên danh sách.
            </div>
          </div>
        )}

        {/* GROUP 1: KHOẢNG THU NHẬP TÍNH THUẾ */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-3.5">
            Khoảng thu nhập tính thuế
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
            <div>
              <label htmlFor="tax-from" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Thu nhập tính thuế từ <span className="text-rose-500">*</span>
              </label>
              <MoneyInput
                id="tax-from"
                value={incomeFrom}
                onChange={val => {
                  setIncomeFrom(val);
                  if (fieldErrors.from) setFieldErrors(prev => ({ ...prev, from: '' }));
                }}
                hasError={Boolean(fieldErrors.from)}
              />
              {fieldErrors.from && <p className="text-xs text-rose-500 mt-1">{fieldErrors.from}</p>}
            </div>

            <div>
              <label htmlFor="tax-to" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Thu nhập tính thuế đến
              </label>
              <MoneyInput
                id="tax-to"
                value={incomeTo}
                onChange={val => {
                  setIncomeTo(val);
                  if (fieldErrors.to) setFieldErrors(prev => ({ ...prev, to: '' }));
                }}
                hasError={Boolean(fieldErrors.to)}
              />
              {fieldErrors.to ? (
                <p className="text-xs text-rose-500 mt-1">{fieldErrors.to}</p>
              ) : (
                <p className="text-[11px] text-slate-400 mt-1">Để trống đối với bậc thuế cao nhất.</p>
              )}
            </div>
          </div>
        </div>

        {/* GROUP 2: THUẾ SUẤT & HIỆU LỰC */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-3.5">
            Thuế suất & Hiệu lực
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
            <div className="col-span-1 sm:col-span-2">
              <label htmlFor="tax-rate" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Thuế suất (%) <span className="text-rose-500">*</span>
              </label>
              <div className="relative w-full">
                <input
                  id="tax-rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  required
                  value={taxRatePercent}
                  onChange={e => {
                    const val = e.target.value;
                    const num = Number(val);
                    if (val === '' || (num >= 0 && num <= 100)) {
                      setTaxRatePercent(val);
                      if (fieldErrors.rate) setFieldErrors(prev => ({ ...prev, rate: '' }));
                    }
                  }}
                  placeholder="VD: 5"
                  className={`w-full h-10 rounded-lg border ${
                    fieldErrors.rate ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                  } bg-white dark:bg-slate-800 px-3 pr-8 text-sm text-right font-[tabular-nums] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border`}
                />
                <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-sm font-medium select-none">
                  %
                </span>
              </div>
              {fieldErrors.rate && <p className="text-xs text-rose-500 mt-1">{fieldErrors.rate}</p>}
            </div>

            <div>
              <label htmlFor="tax-eff-from" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Từ ngày hiệu lực <span className="text-rose-500">*</span>
              </label>
              <input
                id="tax-eff-from"
                type="date"
                required
                value={effectiveFrom}
                onChange={e => setEffectiveFrom(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
              />
            </div>

            <div>
              <label htmlFor="tax-eff-to" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Đến ngày (tùy chọn)
              </label>
              <input
                id="tax-eff-to"
                type="date"
                min={effectiveFrom}
                value={effectiveTo}
                onChange={e => setEffectiveTo(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
              />
              <p className="text-[11px] text-slate-400 mt-1">Để trống nếu áp dụng vô thời hạn.</p>
            </div>
          </div>
        </div>

        {error && <Alert variant="error">{error}</Alert>}
      </div>

      {/* Modal Footer */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-end gap-3 flex-shrink-0">
        <button
          type="button"
          disabled={busy}
          onClick={handleCancel}
          className="h-10 px-4 rounded-lg border border-sky-600 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950 font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1"
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={busy || !isDirty}
          className="h-10 px-5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium text-sm shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1"
        >
          {busy && (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
          <span>{busy ? 'Đang lưu…' : isEdit ? 'Cập nhật' : 'Lưu bậc thuế'}</span>
        </button>
      </div>
    </form>
  );
}
