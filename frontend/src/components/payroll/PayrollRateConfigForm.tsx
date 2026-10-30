import { useState, useMemo, useEffect, type FormEvent } from 'react';
import Alert from '../ui/Alert';
import MoneyInput from '../ui/MoneyInput';
import { useModal } from '../ui/Modal';
import type { PayrollRateConfig, SavePayrollRateConfigInput, PositionOption } from '../../types/payroll';
import { DEFAULT_STANDARD_WORKING_DAYS } from '../../hooks/useStandardWorkingDays';

interface PayrollRateConfigFormProps {
  initial?: PayrollRateConfig;
  positions: PositionOption[];
  staffList?: { id: string; code: string; name: string }[];
  onSave: (value: SavePayrollRateConfigInput) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  error?: string;
  onDirtyChange?: (dirty: boolean) => void;
}

const PRESET_CODES = [
  { code: 'duty_night', label: 'Trực tối', defaultUnit: 'vnd', defaultVal: 100000, desc: 'Trực tối 200.000 ₫ (Bác sĩ), 100.000 ₫ (Chung)' },
  { code: 'duty_noon', label: 'Trực trưa', defaultUnit: 'vnd', defaultVal: 50000, desc: 'Trực trưa 50.000 ₫/ca' },
  { code: 'duty_extra_hour_multiplier', label: 'Trực ngoài giờ', defaultUnit: 'percent', defaultVal: 150, desc: '150% lương giờ (Lương giờ = lương ngày ÷ 8)' },
  { code: 'union_fee', label: 'Đoàn phí công đoàn', defaultUnit: 'vnd', defaultVal: 100000, desc: '100.000 ₫/tháng cho đoàn viên' },
  { code: 'standard_working_days', label: 'Ngày công chuẩn', defaultUnit: 'days', defaultVal: DEFAULT_STANDARD_WORKING_DAYS, desc: `${DEFAULT_STANDARD_WORKING_DAYS} ngày công chuẩn mặc định` },
];

export default function PayrollRateConfigForm({
  initial,
  positions,
  staffList = [],
  onSave,
  onClose,
  busy,
  error,
  onDirtyChange,
}: PayrollRateConfigFormProps) {
  const isEdit = Boolean(initial);

  // General & Target
  const [code, setCode] = useState(initial?.code || 'duty_night');
  const [targetType, setTargetType] = useState<'all' | 'position' | 'staff'>(
    initial?.staffId ? 'staff' : initial?.positionId ? 'position' : 'all'
  );
  const [positionId, setPositionId] = useState(initial?.positionId || '');
  const [staffId, setStaffId] = useState(initial?.staffId || '');

  // Rate Value
  const [unit, setUnit] = useState<'vnd' | 'percent' | 'days'>(initial?.unit || 'vnd');
  const [moneyValue, setMoneyValue] = useState<number | null>(
    initial?.unit === 'vnd' ? initial.value : 100000
  );
  const [percentVal, setPercentVal] = useState<string>(
    initial?.unit === 'percent' ? String(initial.value) : '150'
  );
  const [daysVal, setDaysVal] = useState<string>(
    initial?.unit === 'days' ? String(initial.value) : String(DEFAULT_STANDARD_WORKING_DAYS)
  );

  // Time & Note
  const [description, setDescription] = useState(initial?.description || '');
  const [effectiveFrom, setEffectiveFrom] = useState(initial?.effectiveFrom || '2026-01-01');
  const [effectiveTo, setEffectiveTo] = useState(initial?.effectiveTo || '');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function handleCodeChange(newCode: string) {
    setCode(newCode);
    const preset = PRESET_CODES.find(p => p.code === newCode);
    if (preset && !initial) {
      setUnit(preset.defaultUnit as 'vnd' | 'percent' | 'days');
      if (preset.defaultUnit === 'vnd') {
        setMoneyValue(preset.defaultVal);
      } else if (preset.defaultUnit === 'percent') {
        setPercentVal(String(preset.defaultVal));
      } else {
        setDaysVal(String(preset.defaultVal));
      }
      if (!description) setDescription(preset.desc);
    }
  }

  const isDirty = useMemo(() => {
    if (!initial) return true;
    const initialTargetType = initial.staffId ? 'staff' : initial.positionId ? 'position' : 'all';
    if (code !== initial.code) return true;
    if (targetType !== initialTargetType) return true;
    if (targetType === 'position' && positionId !== (initial.positionId || '')) return true;
    if (targetType === 'staff' && staffId !== (initial.staffId || '')) return true;
    if (unit !== initial.unit) return true;

    const currentVal = unit === 'vnd' ? moneyValue : unit === 'percent' ? Number(percentVal) : Number(daysVal);
    if (currentVal !== initial.value) return true;

    if ((description || '') !== (initial.description || '')) return true;
    if (effectiveFrom !== initial.effectiveFrom) return true;
    if ((effectiveTo || '') !== (initial.effectiveTo || '')) return true;

    return false;
  }, [code, targetType, positionId, staffId, unit, moneyValue, percentVal, daysVal, description, effectiveFrom, effectiveTo, initial]);

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
    if (targetType === 'position' && !positionId) {
      errors.positionId = 'Vui lòng chọn chức danh áp dụng.';
    }
    if (targetType === 'staff' && !staffId) {
      errors.staffId = 'Vui lòng chọn nhân viên áp dụng.';
    }

    let finalVal = 0;
    if (unit === 'vnd') {
      finalVal = moneyValue ?? 0;
      if (finalVal <= 0) {
        errors.value = 'Đơn giá phải lớn hơn 0.';
      }
    } else if (unit === 'percent') {
      finalVal = Number(percentVal);
      if (isNaN(finalVal) || finalVal < 0) {
        errors.value = 'Tỷ lệ phải từ 0% trở lên.';
      }
    } else {
      finalVal = Number(daysVal);
      if (isNaN(finalVal) || finalVal < 1 || finalVal > 31) {
        errors.value = 'Số ngày công chuẩn phải từ 1 đến 31.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    void onSave({
      code,
      positionId: targetType === 'position' ? positionId : null,
      staffId: targetType === 'staff' ? staffId : null,
      value: finalVal,
      unit,
      description: description.trim() || null,
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
              <strong>Tham số này đang ngừng áp dụng.</strong> Để kích hoạt lại, vui lòng sử dụng nút <em>Kích hoạt</em> trên danh sách.
            </div>
          </div>
        )}

        {/* GROUP 1: THÔNG TIN THAM SỐ */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-3.5">
            Thông tin tham số & Đối tượng áp dụng
          </div>
          <div className="space-y-4">
            {/* Loại đơn giá */}
            <div>
              <label htmlFor="rate-code" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Loại đơn giá / Tham số <span className="text-rose-500">*</span>
              </label>
              <select
                id="rate-code"
                required
                value={code}
                onChange={e => handleCodeChange(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
              >
                {PRESET_CODES.map(p => (
                  <option key={p.code} value={p.code}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Phạm vi áp dụng */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Phạm vi áp dụng <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <label className={`flex items-center justify-center h-9 px-3 border rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  targetType === 'all'
                    ? 'border-sky-600 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 font-semibold'
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}>
                  <input
                    type="radio"
                    name="targetType"
                    value="all"
                    checked={targetType === 'all'}
                    onChange={() => {
                      setTargetType('all');
                      setFieldErrors(prev => ({ ...prev, positionId: '', staffId: '' }));
                    }}
                    className="sr-only"
                  />
                  <span>Chung toàn PK</span>
                </label>

                <label className={`flex items-center justify-center h-9 px-3 border rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  targetType === 'position'
                    ? 'border-sky-600 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 font-semibold'
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}>
                  <input
                    type="radio"
                    name="targetType"
                    value="position"
                    checked={targetType === 'position'}
                    onChange={() => {
                      setTargetType('position');
                      setFieldErrors(prev => ({ ...prev, positionId: '', staffId: '' }));
                    }}
                    className="sr-only"
                  />
                  <span>Theo chức danh</span>
                </label>

                <label className={`flex items-center justify-center h-9 px-3 border rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  targetType === 'staff'
                    ? 'border-sky-600 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 font-semibold'
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}>
                  <input
                    type="radio"
                    name="targetType"
                    value="staff"
                    checked={targetType === 'staff'}
                    onChange={() => {
                      setTargetType('staff');
                      setFieldErrors(prev => ({ ...prev, positionId: '', staffId: '' }));
                    }}
                    className="sr-only"
                  />
                  <span>Theo nhân viên</span>
                </label>
              </div>
            </div>

            {/* Target Selectors */}
            {targetType === 'position' && (
              <div>
                <label htmlFor="rate-position" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Chức danh áp dụng <span className="text-rose-500">*</span>
                </label>
                <select
                  id="rate-position"
                  required
                  value={positionId}
                  onChange={e => {
                    setPositionId(e.target.value);
                    if (fieldErrors.positionId) setFieldErrors(prev => ({ ...prev, positionId: '' }));
                  }}
                  className={`w-full h-10 rounded-lg border ${
                    fieldErrors.positionId ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                  } bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border`}
                >
                  <option value="">-- Chọn chức danh --</option>
                  {positions.map(p => (
                    <option key={p.id} value={p.id}>{p.name + (p.scopeTag ? ' (' + p.scopeTag + ')' : '')}</option>
                  ))}
                </select>
                {fieldErrors.positionId && (
                  <p className="text-xs text-rose-500 mt-1">{fieldErrors.positionId}</p>
                )}
              </div>
            )}

            {targetType === 'staff' && (
              <div>
                <label htmlFor="rate-staff" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nhân viên áp dụng <span className="text-rose-500">*</span>
                </label>
                <select
                  id="rate-staff"
                  required
                  value={staffId}
                  onChange={e => {
                    setStaffId(e.target.value);
                    if (fieldErrors.staffId) setFieldErrors(prev => ({ ...prev, staffId: '' }));
                  }}
                  className={`w-full h-10 rounded-lg border ${
                    fieldErrors.staffId ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                  } bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border`}
                >
                  <option value="">-- Chọn nhân viên --</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
                {fieldErrors.staffId && (
                  <p className="text-xs text-rose-500 mt-1">{fieldErrors.staffId}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* GROUP 2: MỨC ÁP DỤNG & THỜI GIAN */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-3.5">
            Mức áp dụng & Thời hạn
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
            {/* Đơn vị tính */}
            <div>
              <label htmlFor="rate-unit" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Đơn vị tính <span className="text-rose-500">*</span>
              </label>
              <select
                id="rate-unit"
                value={unit}
                onChange={e => setUnit(e.target.value as any)}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
              >
                <option value="vnd">Số tiền (VND)</option>
                <option value="percent">Phần trăm (%)</option>
                <option value="days">Số ngày công (ngày)</option>
              </select>
            </div>

            {/* Giá trị */}
            <div>
              <label htmlFor="rate-value" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Mức đơn vị <span className="text-rose-500">*</span>
              </label>
              {unit === 'vnd' && (
                <MoneyInput
                  id="rate-value"
                  value={moneyValue}
                  onChange={val => {
                    setMoneyValue(val);
                    if (fieldErrors.value) setFieldErrors(prev => ({ ...prev, value: '' }));
                  }}
                  hasError={Boolean(fieldErrors.value)}
                />
              )}
              {unit === 'percent' && (
                <div className="relative w-full">
                  <input
                    id="rate-value"
                    type="number"
                    min="0"
                    step="0.1"
                    value={percentVal}
                    onChange={e => {
                      setPercentVal(e.target.value);
                      if (fieldErrors.value) setFieldErrors(prev => ({ ...prev, value: '' }));
                    }}
                    placeholder="150"
                    className={`w-full h-10 rounded-lg border ${
                      fieldErrors.value ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                    } bg-white dark:bg-slate-800 px-3 pr-8 text-sm text-right font-[tabular-nums] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border`}
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-sm font-medium select-none">
                    %
                  </span>
                </div>
              )}
              {unit === 'days' && (
                <div className="relative w-full">
                  <input
                    id="rate-value"
                    type="number"
                    min="1"
                    max="31"
                    step="1"
                    value={daysVal}
                    onChange={e => {
                      setDaysVal(e.target.value);
                      if (fieldErrors.value) setFieldErrors(prev => ({ ...prev, value: '' }));
                    }}
                    placeholder={String(DEFAULT_STANDARD_WORKING_DAYS)}
                    className={`w-full h-10 rounded-lg border ${
                      fieldErrors.value ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                    } bg-white dark:bg-slate-800 px-3 pr-14 text-sm text-right font-[tabular-nums] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border`}
                  />
                  <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-xs font-medium select-none">
                    ngày
                  </span>
                </div>
              )}
              {fieldErrors.value && (
                <p className="text-xs text-rose-500 mt-1">{fieldErrors.value}</p>
              )}
            </div>

            {/* Từ ngày */}
            <div>
              <label htmlFor="rate-effective-from" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Từ ngày hiệu lực <span className="text-rose-500">*</span>
              </label>
              <input
                id="rate-effective-from"
                type="date"
                required
                value={effectiveFrom}
                onChange={e => setEffectiveFrom(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
              />
            </div>

            {/* Đến ngày */}
            <div>
              <label htmlFor="rate-effective-to" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Đến ngày (tùy chọn)
              </label>
              <input
                id="rate-effective-to"
                type="date"
                min={effectiveFrom}
                value={effectiveTo}
                onChange={e => setEffectiveTo(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
              />
              <p className="text-[11px] text-slate-400 mt-1">Để trống nếu áp dụng vô thời hạn.</p>
            </div>

            {/* Mô tả / Ghi chú */}
            <div className="col-span-1 sm:col-span-2">
              <label htmlFor="rate-desc" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Ghi chú / Mô tả
              </label>
              <input
                id="rate-desc"
                type="text"
                maxLength={255}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="VD: Trực tối 200.000 ₫ cho Bác sĩ"
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
              />
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
          <span>{busy ? 'Đang lưu…' : isEdit ? 'Cập nhật' : 'Lưu đơn giá'}</span>
        </button>
      </div>
    </form>
  );
}
