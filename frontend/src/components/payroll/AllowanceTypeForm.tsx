import { useState, useMemo, useEffect, useRef, type FormEvent } from 'react';
import Alert from '../ui/Alert';
import MoneyInput from '../ui/MoneyInput';
import { useModal } from '../ui/Modal';
import type { AllowanceType, SaveAllowanceTypeInput } from '../../types/payroll';
import { formatNumberWithDots } from '../../utils/format';
import { useStandardWorkingDays } from '../../hooks/useStandardWorkingDays';

interface AllowanceTypeFormProps {
  initial?: AllowanceType;
  onSave: (value: SaveAllowanceTypeInput) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  error?: string;
  onDirtyChange?: (dirty: boolean) => void;
}

export default function AllowanceTypeForm({
  initial,
  onSave,
  onClose,
  busy,
  error,
  onDirtyChange,
}: AllowanceTypeFormProps) {
  const isEdit = Boolean(initial);

  // Group 1: General Info
  const [code, setCode] = useState(initial?.code || '');
  const [name, setName] = useState(initial?.name || '');

  // Group 2: Calculation Method & Values
  const [defaultCalcMethod, setDefaultCalcMethod] = useState<'fixed' | 'prorate_by_workdays' | 'per_service_year' | 'percentage'>(
    initial?.defaultCalcMethod || 'fixed'
  );
  const [minServiceYears, setMinServiceYears] = useState<string>(
    initial?.minServiceYears !== null && initial?.minServiceYears !== undefined ? String(initial.minServiceYears) : '3'
  );

  const initialAmount = initial?.defaultValue !== null && initial?.defaultValue !== undefined ? initial.defaultValue : null;
  const isPercentage = defaultCalcMethod === 'percentage';

  const [moneyValue, setMoneyValue] = useState<number | null>(
    !isPercentage && initialAmount !== null ? initialAmount : (initial ? null : 500000)
  );
  const [percentValue, setPercentValue] = useState<string>(
    isPercentage && initialAmount !== null ? String(initialAmount) : '10'
  );

  // Group 3: Tax & Insurance toggles
  const [isTaxable, setIsTaxable] = useState(initial?.isTaxable ?? false);
  const [isInsuranceBasis, setIsInsuranceBasis] = useState(initial?.isInsuranceBasis ?? false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Focus ref for Name in edit mode
  const nameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isEdit) {
      nameInputRef.current?.focus();
    }
  }, [isEdit]);

  // Derived valueType based on method
  const valueType = defaultCalcMethod === 'percentage' ? 'percentage' : 'fixed';

  // Dirty check
  const isDirty = useMemo(() => {
    if (!initial) {
      return Boolean(code.trim() || name.trim() || (isPercentage ? percentValue : moneyValue !== null));
    }
    if (code !== initial.code) return true;
    if (name !== initial.name) return true;
    if (defaultCalcMethod !== initial.defaultCalcMethod) return true;

    const currentYears = defaultCalcMethod === 'per_service_year' ? (minServiceYears ? Number(minServiceYears) : null) : null;
    if (currentYears !== (initial.minServiceYears ?? null)) return true;

    const currentVal = isPercentage ? (percentValue ? Number(percentValue) : null) : moneyValue;
    if (currentVal !== (initial.defaultValue ?? null)) return true;

    if (isTaxable !== initial.isTaxable) return true;
    if (isInsuranceBasis !== initial.isInsuranceBasis) return true;

    return false;
  }, [initial, code, name, defaultCalcMethod, minServiceYears, isPercentage, percentValue, moneyValue, isTaxable, isInsuranceBasis]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  function handleCodeInput(val: string) {
    // Only uppercase A-Z, 0-9, and underscore; max 30 chars
    const cleaned = val.toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 30);
    setCode(cleaned);
    if (fieldErrors.code) setFieldErrors(prev => ({ ...prev, code: '' }));
  }

  function handleMethodChange(newMethod: 'fixed' | 'prorate_by_workdays' | 'per_service_year' | 'percentage') {
    setDefaultCalcMethod(newMethod);
    if (newMethod === 'per_service_year' && !minServiceYears) {
      setMinServiceYears('3');
    }
    if (fieldErrors.defaultValue) {
      setFieldErrors(prev => ({ ...prev, defaultValue: '' }));
    }
  }

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
    if (!code.trim()) errors.code = 'Mã phụ cấp không được để trống.';
    if (!name.trim()) errors.name = 'Tên phụ cấp không được để trống.';

    let parsedDefault: number | null = null;
    if (isPercentage) {
      if (percentValue.trim()) {
        parsedDefault = Number(percentValue);
        if (isNaN(parsedDefault) || parsedDefault < 0 || parsedDefault > 100) {
          errors.defaultValue = 'Tỷ lệ % phải từ 0 đến 100%.';
        }
      }
    } else {
      if (moneyValue !== null) {
        parsedDefault = moneyValue;
        if (parsedDefault < 0) {
          errors.defaultValue = 'Giá trị phụ cấp không được âm.';
        }
      }
    }

    if (defaultCalcMethod === 'per_service_year') {
      const yrs = Number(minServiceYears);
      if (isNaN(yrs) || yrs < 0) {
        errors.minServiceYears = 'Số năm tối thiểu không hợp lệ.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    void onSave({
      code: code.trim(),
      name: name.trim(),
      valueType,
      defaultValue: parsedDefault,
      appliesTo: initial?.appliesTo || 'all',
      defaultCalcMethod,
      minServiceYears: defaultCalcMethod === 'per_service_year' && minServiceYears.trim() ? Number(minServiceYears) : null,
      isTaxable,
      isInsuranceBasis,
      status: initial?.status || 'active',
    });
  }

  // Live dynamic calculation for example callout
  const standardDays = useStandardWorkingDays();
  const dynamicExampleText = useMemo(() => {
    if (defaultCalcMethod === 'fixed') {
      const display = moneyValue !== null ? `${formatNumberWithDots(moneyValue)} ₫` : '0 ₫';
      return `Nhân viên nhận đủ ${display} mỗi tháng, không phụ thuộc ngày công thực tế.`;
    }

    if (defaultCalcMethod === 'prorate_by_workdays') {
      const val = moneyValue || 0;
      const daily = Math.round(val / standardDays);
      const twentyDays = Math.round((val * 20) / standardDays);
      return `Lương ngày = ${formatNumberWithDots(val)} ₫ / ${standardDays} công ≈ ${formatNumberWithDots(daily)} ₫. Nếu tháng làm 20 công → nhận ~${formatNumberWithDots(twentyDays)} ₫.`;
    }

    if (defaultCalcMethod === 'per_service_year') {
      const val = moneyValue || 0;
      const minYears = Number(minServiceYears) || 3;
      const exampleYears = Math.max(5, minYears);
      const total = exampleYears * val;
      return `Ví dụ: làm ${exampleYears} năm (≥ ${minYears} năm) → nhận ${exampleYears} × ${formatNumberWithDots(val)} ₫ = ${formatNumberWithDots(total)} ₫/tháng.`;
    }

    if (defaultCalcMethod === 'percentage') {
      const pct = Number(percentValue) || 0;
      const sampleSalary = 10000000;
      const calcAmount = Math.round((sampleSalary * pct) / 100);
      return `Ví dụ: lương chính 10.000.000 ₫ × ${pct}% = ${formatNumberWithDots(calcAmount)} ₫/tháng.`;
    }

    return '';
  }, [defaultCalcMethod, moneyValue, minServiceYears, percentValue, standardDays]);

  return (
    <form onSubmit={submit} className="flex flex-col h-full">
      {/* Scrollable Body */}
      <div className="px-6 py-5 space-y-6 flex-1 overflow-y-auto max-h-[calc(85vh-130px)]">
        {/* Inactive Banner */}
        {initial?.status === 'inactive' && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
            <span className="text-base leading-none">⚠️</span>
            <div className="leading-relaxed">
              <strong>Phụ cấp này đang ngừng áp dụng.</strong> Để áp dụng lại cho nhân viên, vui lòng sử dụng nút <em>Kích hoạt</em> trên danh sách phụ cấp.
            </div>
          </div>
        )}

        {/* GROUP 1: THÔNG TIN CHUNG */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-3.5">
            Thông tin chung
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
            {/* Mã phụ cấp */}
            <div>
              <label htmlFor="allowance-code" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Mã phụ cấp {!isEdit && <span className="text-rose-500">*</span>}
              </label>
              {isEdit ? (
                <div>
                  <input
                    id="allowance-code"
                    type="text"
                    readOnly
                    value={code}
                    className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 px-3 text-sm font-mono text-slate-600 dark:text-slate-400 cursor-not-allowed select-none box-border"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Mã hệ thống không thể thay đổi.</p>
                </div>
              ) : (
                <div>
                  <input
                    id="allowance-code"
                    type="text"
                    required
                    maxLength={30}
                    value={code}
                    onChange={e => handleCodeInput(e.target.value)}
                    placeholder="VD: ALLOW_MEAL"
                    className={`w-full h-10 rounded-lg border ${
                      fieldErrors.code ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-slate-700 focus:ring-sky-500'
                    } bg-white dark:bg-slate-800 px-3 text-sm font-mono uppercase text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 box-border`}
                  />
                  {fieldErrors.code ? (
                    <p className="text-xs text-rose-500 mt-1">{fieldErrors.code}</p>
                  ) : (
                    <p className="text-[11px] text-slate-400 mt-1">In hoa, chữ cái A-Z, số 0-9, gạch dưới.</p>
                  )}
                </div>
              )}
            </div>

            {/* Tên loại phụ cấp */}
            <div>
              <label htmlFor="allowance-name" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tên loại phụ cấp <span className="text-rose-500">*</span>
              </label>
              <input
                ref={nameInputRef}
                id="allowance-name"
                type="text"
                required
                maxLength={100}
                value={name}
                onChange={e => {
                  setName(e.target.value);
                  if (fieldErrors.name) setFieldErrors(prev => ({ ...prev, name: '' }));
                }}
                placeholder="VD: Phụ cấp ăn trưa"
                className={`w-full h-10 rounded-lg border ${
                  fieldErrors.name ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-slate-700 focus:ring-sky-500'
                } bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 box-border`}
              />
              {fieldErrors.name && <p className="text-xs text-rose-500 mt-1">{fieldErrors.name}</p>}
            </div>
          </div>
        </div>

        {/* GROUP 2: CÁCH TÍNH */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-3.5">
            Cách tính & Mức hưởng
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
            {/* Phương thức tính */}
            <div>
              <label htmlFor="allowance-method" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Phương thức tính <span className="text-rose-500">*</span>
              </label>
              <select
                id="allowance-method"
                value={defaultCalcMethod}
                onChange={e => handleMethodChange(e.target.value as any)}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
              >
                <option value="fixed">Cố định hằng tháng</option>
                <option value="prorate_by_workdays">Chia theo ngày công</option>
                <option value="per_service_year">Theo số năm thâm niên</option>
                <option value="percentage">Theo % lương</option>
              </select>
            </div>

            {/* Số năm tối thiểu: ONLY IF per_service_year */}
            {defaultCalcMethod === 'per_service_year' ? (
              <div>
                <label htmlFor="allowance-minyears" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Số năm tối thiểu bắt đầu tính <span className="text-rose-500">*</span>
                </label>
                <div className="relative w-full">
                  <input
                    id="allowance-minyears"
                    type="number"
                    min="0"
                    max="50"
                    step="1"
                    required
                    value={minServiceYears}
                    onChange={e => {
                      setMinServiceYears(e.target.value);
                      if (fieldErrors.minServiceYears) setFieldErrors(prev => ({ ...prev, minServiceYears: '' }));
                    }}
                    placeholder="3"
                    className={`w-full h-10 rounded-lg border ${
                      fieldErrors.minServiceYears ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-slate-700 focus:ring-sky-500'
                    } bg-white dark:bg-slate-800 px-3 pr-14 text-sm text-right font-[tabular-nums] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 box-border`}
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-xs font-medium select-none">
                    năm
                  </span>
                </div>
                {fieldErrors.minServiceYears ? (
                  <p className="text-xs text-rose-500 mt-1">{fieldErrors.minServiceYears}</p>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-1">Bắt đầu tính khi đủ số năm này (mặc định 3).</p>
                )}
              </div>
            ) : (
              <div className="hidden sm:block" />
            )}

            {/* Mức phụ cấp / Tỷ lệ */}
            <div className="col-span-1 sm:col-span-2">
              <label htmlFor="allowance-value" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                {defaultCalcMethod === 'per_service_year'
                  ? 'Mức phụ cấp mỗi năm thâm niên'
                  : defaultCalcMethod === 'percentage'
                  ? 'Tỷ lệ phụ cấp (%)'
                  : 'Mức phụ cấp mặc định'}
              </label>

              {isPercentage ? (
                <div className="relative w-full">
                  <input
                    id="allowance-value"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={percentValue}
                    onChange={e => {
                      setPercentValue(e.target.value);
                      if (fieldErrors.defaultValue) setFieldErrors(prev => ({ ...prev, defaultValue: '' }));
                    }}
                    placeholder="VD: 10"
                    className={`w-full h-10 rounded-lg border ${
                      fieldErrors.defaultValue ? 'border-rose-500 focus:ring-rose-500' : 'border-slate-300 dark:border-slate-700 focus:ring-sky-500'
                    } bg-white dark:bg-slate-800 px-3 pr-8 text-sm text-right font-[tabular-nums] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 box-border`}
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-sm font-medium select-none">
                    %
                  </span>
                </div>
              ) : (
                <MoneyInput
                  id="allowance-value"
                  value={moneyValue}
                  onChange={val => {
                    setMoneyValue(val);
                    if (fieldErrors.defaultValue) setFieldErrors(prev => ({ ...prev, defaultValue: '' }));
                  }}
                  suffix={defaultCalcMethod === 'per_service_year' ? '₫/năm' : '₫'}
                  hasError={Boolean(fieldErrors.defaultValue)}
                />
              )}

              {fieldErrors.defaultValue && (
                <p className="text-xs text-rose-500 mt-1">{fieldErrors.defaultValue}</p>
              )}

              {/* Dynamic Example Callout */}
              {dynamicExampleText && (
                <div className="mt-2.5 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200/80 dark:border-sky-800/80 p-3 text-xs text-sky-900 dark:text-sky-200 flex items-start gap-2.5 shadow-sm">
                  <span className="text-sky-600 dark:text-sky-400 font-bold text-sm leading-none mt-0.5">ℹ</span>
                  <div className="leading-relaxed">{dynamicExampleText}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* GROUP 3: THUẾ & BẢO HIỂM */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-3.5">
            Thuế & Bảo hiểm
          </div>
          <div className="space-y-4 pt-1">
            {/* Toggle 1: Tính thuế TNCN */}
            <div className="flex items-start gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={isTaxable}
                onClick={() => setIsTaxable(!isTaxable)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
                  isTaxable ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isTaxable ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <div className="flex flex-col">
                <span
                  onClick={() => setIsTaxable(!isTaxable)}
                  className="text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer select-none"
                >
                  Tính thuế TNCN
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Phụ cấp này được cộng vào thu nhập chịu thuế khi tính lương
                </span>
              </div>
            </div>

            {/* Toggle 2: Tính đóng bảo hiểm */}
            <div className="flex items-start gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={isInsuranceBasis}
                onClick={() => setIsInsuranceBasis(!isInsuranceBasis)}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
                  isInsuranceBasis ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isInsuranceBasis ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <div className="flex flex-col">
                <span
                  onClick={() => setIsInsuranceBasis(!isInsuranceBasis)}
                  className="text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer select-none"
                >
                  Tính đóng bảo hiểm
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Phụ cấp này được cộng vào mức lương đóng BHXH/BHYT/BHTN
                </span>
              </div>
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
          <span>{busy ? 'Đang lưu…' : isEdit ? 'Cập nhật' : 'Thêm loại phụ cấp'}</span>
        </button>
      </div>
    </form>
  );
}
