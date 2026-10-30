import { useState, useMemo, useEffect, type FormEvent } from 'react';
import Alert from '../ui/Alert';
import { useModal } from '../ui/Modal';
import type { InsuranceConfig, SaveInsuranceConfigInput } from '../../types/payroll';

interface InsuranceConfigFormProps {
  initial?: InsuranceConfig;
  onSave: (value: SaveInsuranceConfigInput) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  error?: string;
  onDirtyChange?: (dirty: boolean) => void;
}

export default function InsuranceConfigForm({
  initial,
  onSave,
  onClose,
  busy,
  error,
  onDirtyChange,
}: InsuranceConfigFormProps) {
  const isEdit = Boolean(initial);

  const [insuranceType, setInsuranceType] = useState<'social' | 'health' | 'unemployment' | 'accident'>(
    initial?.insuranceType || 'social'
  );
  const [payer, setPayer] = useState<'employee' | 'employer'>(initial?.payer || 'employee');
  const [ratePercent, setRatePercent] = useState<string>(
    initial?.ratePercent !== undefined ? String(initial.ratePercent) : '8'
  );
  const [appliesTo, setAppliesTo] = useState(initial?.appliesTo || 'all');
  const [effectiveFrom, setEffectiveFrom] = useState(initial?.effectiveFrom || '2026-01-01');
  const [effectiveTo, setEffectiveTo] = useState(initial?.effectiveTo || '');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isDirty = useMemo(() => {
    if (!initial) return true;
    if (insuranceType !== initial.insuranceType) return true;
    if (payer !== initial.payer) return true;
    if (Number(ratePercent) !== initial.ratePercent) return true;
    if (appliesTo !== initial.appliesTo) return true;
    if (effectiveFrom !== initial.effectiveFrom) return true;
    if ((effectiveTo || '') !== (initial.effectiveTo || '')) return true;

    return false;
  }, [initial, insuranceType, payer, ratePercent, appliesTo, effectiveFrom, effectiveTo]);

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

    const rate = Number(ratePercent);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      setFieldErrors({ rate: 'Tỷ lệ đóng phải từ 0% đến 100%.' });
      return;
    }

    setFieldErrors({});

    void onSave({
      insuranceType,
      payer,
      ratePercent: rate,
      appliesTo: appliesTo.trim() || 'all',
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
              <strong>Mức bảo hiểm này đang ngừng áp dụng.</strong> Để kích hoạt lại, vui lòng sử dụng nút <em>Kích hoạt</em> trên danh sách.
            </div>
          </div>
        )}

        {/* GROUP 1: LOẠI BẢO HIỂM & ĐỐI TƯỢNG */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-3.5">
            Loại bảo hiểm & Bên đóng
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
            <div>
              <label htmlFor="ins-type" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Loại bảo hiểm <span className="text-rose-500">*</span>
              </label>
              <select
                id="ins-type"
                value={insuranceType}
                onChange={e => setInsuranceType(e.target.value as any)}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
              >
                <option value="social">BH Xã hội (BHXH)</option>
                <option value="health">BH Y tế (BHYT)</option>
                <option value="unemployment">BH Thất nghiệp (BHTN)</option>
                <option value="accident">BH Tai nạn lao động (BHTNLĐ)</option>
              </select>
            </div>

            <div>
              <label htmlFor="ins-payer" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Bên đóng bảo hiểm <span className="text-rose-500">*</span>
              </label>
              <select
                id="ins-payer"
                value={payer}
                onChange={e => setPayer(e.target.value as any)}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
              >
                <option value="employee">Người lao động (Trừ lương)</option>
                <option value="employer">Người sử dụng lao động (Chi phí phòng khám)</option>
              </select>
            </div>
          </div>
        </div>

        {/* GROUP 2: TỶ LỆ ĐÓNG & HIỆU LỰC */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-3.5">
            Tỷ lệ trích đóng & Thời hạn
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
            <div className="col-span-1 sm:col-span-2">
              <label htmlFor="ins-rate" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tỷ lệ đóng (%) <span className="text-rose-500">*</span>
              </label>
              <div className="relative w-full">
                <input
                  id="ins-rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  required
                  value={ratePercent}
                  onChange={e => {
                    const val = e.target.value;
                    const num = Number(val);
                    if (val === '' || (num >= 0 && num <= 100)) {
                      setRatePercent(val);
                      if (fieldErrors.rate) setFieldErrors(prev => ({ ...prev, rate: '' }));
                    }
                  }}
                  placeholder="VD: 8"
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
              <label htmlFor="ins-from" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Từ ngày hiệu lực <span className="text-rose-500">*</span>
              </label>
              <input
                id="ins-from"
                type="date"
                required
                value={effectiveFrom}
                onChange={e => setEffectiveFrom(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
              />
            </div>

            <div>
              <label htmlFor="ins-to" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Đến ngày (tùy chọn)
              </label>
              <input
                id="ins-to"
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
          <span>{busy ? 'Đang lưu…' : isEdit ? 'Cập nhật' : 'Lưu mức bảo hiểm'}</span>
        </button>
      </div>
    </form>
  );
}
