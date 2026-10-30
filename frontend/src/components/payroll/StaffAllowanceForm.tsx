import { useState, useMemo, useEffect, type FormEvent } from 'react';
import Alert from '../ui/Alert';
import MoneyInput from '../ui/MoneyInput';
import { useModal } from '../ui/Modal';
import type { StaffAllowance, SaveStaffAllowanceInput, AllowanceType } from '../../types/payroll';

interface StaffAllowanceFormProps {
  initial?: StaffAllowance;
  allowanceTypes: AllowanceType[];
  onSave: (value: SaveStaffAllowanceInput) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  error?: string;
  onDirtyChange?: (dirty: boolean) => void;
}

export default function StaffAllowanceForm({
  initial,
  allowanceTypes,
  onSave,
  onClose,
  busy,
  error,
  onDirtyChange,
}: StaffAllowanceFormProps) {
  const isEdit = Boolean(initial);

  const [allowanceId, setAllowanceId] = useState<string>(
    initial?.allowanceId || (allowanceTypes[0]?.id || '')
  );
  const [valueType, setValueType] = useState<string>(initial?.valueType || 'fixed');
  const [calcMethod, setCalcMethod] = useState<string>(initial?.calcMethod || 'fixed');

  const isMoney = valueType === 'fixed' || calcMethod === 'per_service_year';
  const [moneyValue, setMoneyValue] = useState<number | null>(
    isMoney && initial?.amountValue !== undefined ? initial.amountValue : 500000
  );
  const [percentVal, setPercentVal] = useState<string>(
    !isMoney && initial?.amountValue !== undefined ? String(initial.amountValue) : '10'
  );

  const [effectiveFrom, setEffectiveFrom] = useState(initial?.effectiveFrom || '2026-01-01');
  const [effectiveTo, setEffectiveTo] = useState(initial?.effectiveTo || '');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function onSelectAllowance(id: string) {
    setAllowanceId(id);
    const chosen = allowanceTypes.find(a => a.id === id);
    if (chosen) {
      setValueType(chosen.valueType);
      setCalcMethod(chosen.defaultCalcMethod || 'fixed');
      if (chosen.defaultValue) {
        if (chosen.valueType === 'fixed') {
          setMoneyValue(chosen.defaultValue);
        } else {
          setPercentVal(String(chosen.defaultValue));
        }
      }
    }
  }

  const isDirty = useMemo(() => {
    if (!initial) return true;
    if (allowanceId !== initial.allowanceId) return true;
    if (valueType !== initial.valueType) return true;
    if (calcMethod !== initial.calcMethod) return true;

    const currentVal = isMoney ? moneyValue : Number(percentVal);
    if (currentVal !== initial.amountValue) return true;

    if (effectiveFrom !== initial.effectiveFrom) return true;
    if ((effectiveTo || '') !== (initial.effectiveTo || '')) return true;

    return false;
  }, [initial, allowanceId, valueType, calcMethod, isMoney, moneyValue, percentVal, effectiveFrom, effectiveTo]);

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

    let finalVal = 0;
    if (isMoney) {
      finalVal = moneyValue ?? 0;
      if (finalVal < 0) {
        setFieldErrors({ value: 'Giá trị không được âm.' });
        return;
      }
    } else {
      finalVal = Number(percentVal);
      if (isNaN(finalVal) || finalVal < 0 || finalVal > 100) {
        setFieldErrors({ value: 'Tỷ lệ % phải từ 0 đến 100%.' });
        return;
      }
    }

    setFieldErrors({});

    void onSave({
      allowanceId,
      valueType,
      amountValue: finalVal,
      calcMethod,
      effectiveFrom,
      effectiveTo: effectiveTo ? effectiveTo : null,
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
              <strong>Phụ cấp này của nhân viên đang ngừng áp dụng.</strong> Để kích hoạt lại, vui lòng sử dụng nút <em>Kích hoạt</em> trên danh sách.
            </div>
          </div>
        )}

        {/* GROUP 1: LOẠI PHỤ CẤP & CÁCH TÍNH */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-3.5">
            Loại phụ cấp & Cách tính
          </div>
          <div className="space-y-4">
            <div>
              <label htmlFor="sa-type" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Loại phụ cấp <span className="text-rose-500">*</span>
              </label>
              <select
                id="sa-type"
                required
                value={allowanceId}
                onChange={e => onSelectAllowance(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
              >
                {allowanceTypes.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
              <div>
                <label htmlFor="sa-calcmethod" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Phương thức tính <span className="text-rose-500">*</span>
                </label>
                <select
                  id="sa-calcmethod"
                  value={calcMethod}
                  onChange={e => setCalcMethod(e.target.value)}
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
                >
                  <option value="fixed">Cố định hằng tháng</option>
                  <option value="prorate_by_workdays">Chia theo ngày công</option>
                  <option value="per_service_year">Theo số năm thâm niên</option>
                  <option value="percentage">Theo % lương</option>
                </select>
              </div>

              <div>
                <label htmlFor="sa-amount" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {calcMethod === 'per_service_year'
                    ? 'Đơn giá mỗi năm (VND/năm)'
                    : isMoney
                    ? 'Mức phụ cấp (VND)'
                    : 'Tỷ lệ phụ cấp (%)'} <span className="text-rose-500">*</span>
                </label>
                {isMoney ? (
                  <MoneyInput
                    id="sa-amount"
                    value={moneyValue}
                    onChange={val => {
                      setMoneyValue(val);
                      if (fieldErrors.value) setFieldErrors(prev => ({ ...prev, value: '' }));
                    }}
                    suffix={calcMethod === 'per_service_year' ? '₫/năm' : '₫'}
                    hasError={Boolean(fieldErrors.value)}
                  />
                ) : (
                  <div className="relative w-full">
                    <input
                      id="sa-amount"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={percentVal}
                      onChange={e => {
                        setPercentVal(e.target.value);
                        if (fieldErrors.value) setFieldErrors(prev => ({ ...prev, value: '' }));
                      }}
                      placeholder="VD: 10"
                      className={`w-full h-10 rounded-lg border ${
                        fieldErrors.value ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                      } bg-white dark:bg-slate-800 px-3 pr-8 text-sm text-right font-[tabular-nums] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border`}
                    />
                    <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-sm font-medium select-none">
                      %
                    </span>
                  </div>
                )}
                {fieldErrors.value && <p className="text-xs text-rose-500 mt-1">{fieldErrors.value}</p>}
              </div>
            </div>
          </div>
        </div>

        {/* GROUP 2: THỜI HẠN HIỆU LỰC */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-3.5">
            Thời hạn áp dụng
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
            <div>
              <label htmlFor="sa-from" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Từ ngày hiệu lực <span className="text-rose-500">*</span>
              </label>
              <input
                id="sa-from"
                type="date"
                required
                value={effectiveFrom}
                onChange={e => setEffectiveFrom(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
              />
            </div>

            <div>
              <label htmlFor="sa-to" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Đến ngày (tùy chọn)
              </label>
              <input
                id="sa-to"
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
          <span>{busy ? 'Đang lưu…' : isEdit ? 'Cập nhật phụ cấp' : 'Gán phụ cấp'}</span>
        </button>
      </div>
    </form>
  );
}
