import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Alert from '../ui/Alert';
import MoneyInput from '../ui/MoneyInput';
import { useModal } from '../ui/Modal';
import type { TaxPolicySummary, UpdateTaxDeductionsInput } from '../../types/payroll';

interface TaxDeductionsFormProps {
  initial: TaxPolicySummary;
  onSave: (value: UpdateTaxDeductionsInput) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  error?: string;
  onDirtyChange?: (dirty: boolean) => void;
}

export default function TaxDeductionsForm({
  initial,
  onSave,
  onClose,
  busy,
  error,
  onDirtyChange,
}: TaxDeductionsFormProps) {
  const [personalDeduction, setPersonalDeduction] = useState<number | null>(initial.personalDeduction);
  const [dependentDeduction, setDependentDeduction] = useState<number | null>(initial.dependentDeduction);
  const [taxFlatThreshold, setTaxFlatThreshold] = useState<number | null>(initial.taxFlatThreshold);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const isDirty = useMemo(() => {
    return (
      (personalDeduction ?? 0) !== initial.personalDeduction ||
      (dependentDeduction ?? 0) !== initial.dependentDeduction ||
      (taxFlatThreshold ?? 0) !== initial.taxFlatThreshold
    );
  }, [personalDeduction, dependentDeduction, taxFlatThreshold, initial]);

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

  function submit(e: FormEvent) {
    e.preventDefault();
    if (busy || !isDirty) return;

    const errors: Record<string, string> = {};
    const pVal = personalDeduction ?? 0;
    const dVal = dependentDeduction ?? 0;
    const tVal = taxFlatThreshold ?? 0;

    if (pVal <= 0) errors.personalDeduction = 'Mức giảm trừ bản thân phải lớn hơn 0.';
    if (dVal < 0) errors.dependentDeduction = 'Mức giảm trừ người phụ thuộc không được âm.';
    if (tVal < 0) errors.taxFlatThreshold = 'Ngưỡng khấu trừ vãng lai không được âm.';

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    void onSave({
      personalDeduction: pVal,
      dependentDeduction: dVal,
      taxFlatThreshold: tVal,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col">
      <div className="px-6 py-4 space-y-4">
        {/* 3 ô nhập tiền */}
        <div className="space-y-3.5">
          <div>
            <label htmlFor="tax-personal-deduction" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Giảm trừ bản thân (VNĐ/tháng) <span className="text-rose-500">*</span>
            </label>
            <MoneyInput
              id="tax-personal-deduction"
              value={personalDeduction}
              onChange={(val) => {
                setPersonalDeduction(val);
                if (fieldErrors.personalDeduction) setFieldErrors((prev) => ({ ...prev, personalDeduction: '' }));
              }}
              hasError={Boolean(fieldErrors.personalDeduction)}
            />
            {fieldErrors.personalDeduction && (
              <p className="text-xs text-rose-500 mt-1">{fieldErrors.personalDeduction}</p>
            )}
          </div>

          <div>
            <label htmlFor="tax-dependent-deduction" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Giảm trừ người phụ thuộc (VNĐ/người/tháng) <span className="text-rose-500">*</span>
            </label>
            <MoneyInput
              id="tax-dependent-deduction"
              value={dependentDeduction}
              onChange={(val) => {
                setDependentDeduction(val);
                if (fieldErrors.dependentDeduction) setFieldErrors((prev) => ({ ...prev, dependentDeduction: '' }));
              }}
              hasError={Boolean(fieldErrors.dependentDeduction)}
            />
            {fieldErrors.dependentDeduction && (
              <p className="text-xs text-rose-500 mt-1">{fieldErrors.dependentDeduction}</p>
            )}
          </div>

          <div>
            <label htmlFor="tax-flat-threshold" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Ngưỡng khấu trừ vãng lai 10% (VNĐ/lần chi trả) <span className="text-rose-500">*</span>
            </label>
            <MoneyInput
              id="tax-flat-threshold"
              value={taxFlatThreshold}
              onChange={(val) => {
                setTaxFlatThreshold(val);
                if (fieldErrors.taxFlatThreshold) setFieldErrors((prev) => ({ ...prev, taxFlatThreshold: '' }));
              }}
              hasError={Boolean(fieldErrors.taxFlatThreshold)}
            />
            {fieldErrors.taxFlatThreshold && (
              <p className="text-xs text-rose-500 mt-1">{fieldErrors.taxFlatThreshold}</p>
            )}
          </div>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          Thay đổi sẽ áp dụng cho các kỳ lương đang mở khi tính lại lương; các kỳ đã chốt sổ không bị ảnh hưởng.
        </p>

        {error && <Alert variant="error">{error}</Alert>}
      </div>

      {/* Modal Footer */}
      <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 flex items-center justify-end gap-2.5">
        <button
          type="button"
          disabled={busy}
          onClick={handleCancel}
          className="h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 font-medium text-xs transition-colors cursor-pointer"
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={busy || !isDirty}
          className="h-9 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold text-xs shadow-2xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
        >
          {busy && (
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin flex-shrink-0" />
          )}
          <span>{busy ? 'Đang lưu…' : 'Lưu thay đổi'}</span>
        </button>
      </div>
    </form>
  );
}
