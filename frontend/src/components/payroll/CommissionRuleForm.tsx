import { useState, useMemo, useEffect, type FormEvent } from 'react';
import Alert from '../ui/Alert';
import MoneyInput from '../ui/MoneyInput';
import { useModal } from '../ui/Modal';
import type { CommissionRule, SaveCommissionRuleInput, ProcedureServiceOption, PositionOption } from '../../types/payroll';

const ROLES = [
  { value: 'indicating', label: 'Bác sĩ chỉ định' },
  { value: 'performing', label: 'Bác sĩ / Người thực hiện' },
  { value: 'assisting', label: 'Kỹ thuật viên / Phụ tá' },
  { value: 'lab', label: 'KTV Xét nghiệm / Lab' },
  { value: 'typist', label: 'Nhập kết quả (Thư ký y khoa)' },
];

const VALUE_TYPES = [
  { value: 'fixed', label: 'Số tiền cố định (VND)' },
  { value: 'percent_service', label: '% Doanh thu dịch vụ' },
  { value: 'percent_profit', label: '% Lợi nhuận sau vật tư' },
  { value: 'per_hour', label: 'Đơn giá theo giờ (VND/giờ)' },
];

const TIME_CONDITIONS = [
  { value: 'all', label: 'Mọi khung giờ' },
  { value: 'in_hours', label: 'Trong giờ hành chính' },
  { value: 'after_hours', label: 'Ngoài giờ / Ca trực' },
];

interface CommissionRuleFormProps {
  initial?: CommissionRule;
  services: ProcedureServiceOption[];
  positions: PositionOption[];
  onSave: (value: SaveCommissionRuleInput) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  error?: string;
  onDirtyChange?: (dirty: boolean) => void;
}

export default function CommissionRuleForm({
  initial,
  services,
  positions,
  onSave,
  onClose,
  busy,
  error,
  onDirtyChange,
}: CommissionRuleFormProps) {
  const isEdit = Boolean(initial);

  const [targetMode, setTargetMode] = useState<'service' | 'category'>(
    initial?.serviceCategory && !initial?.serviceId ? 'category' : 'service'
  );
  const [serviceId, setServiceId] = useState(initial?.serviceId || (services[0]?.id || ''));
  const [serviceCategory, setServiceCategory] = useState(initial?.serviceCategory || 'Chẩn đoán hình ảnh');
  const [positionId, setPositionId] = useState(initial?.positionId || '');
  const [role, setRole] = useState<'indicating' | 'performing' | 'assisting' | 'lab' | 'typist'>(
    initial?.role || 'performing'
  );
  const [timeCondition, setTimeCondition] = useState<'all' | 'in_hours' | 'after_hours'>(
    initial?.timeCondition || 'all'
  );
  const [valueType, setValueType] = useState<'fixed' | 'percent_service' | 'percent_profit' | 'per_hour'>(
    initial?.valueType || 'fixed'
  );

  const isMoney = valueType === 'fixed' || valueType === 'per_hour';

  const [moneyValue, setMoneyValue] = useState<number | null>(
    isMoney && initial?.commissionValue !== undefined ? initial.commissionValue : 45000
  );
  const [percentVal, setPercentVal] = useState<string>(
    !isMoney && initial?.commissionValue !== undefined ? String(initial.commissionValue) : '10'
  );

  const [effectiveFrom, setEffectiveFrom] = useState(initial?.effectiveFrom || '2026-01-01');
  const [effectiveTo, setEffectiveTo] = useState(initial?.effectiveTo || '');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const categories = useMemo(() => {
    const set = new Set(services.map(s => s.category).filter((c): c is string => Boolean(c)));
    set.add('Chẩn đoán hình ảnh');
    set.add('Thủ thuật ngoại khoa');
    set.add('Xét nghiệm');
    return Array.from(set);
  }, [services]);

  const isDirty = useMemo(() => {
    if (!initial) return true;
    const initialTargetMode = initial.serviceCategory && !initial.serviceId ? 'category' : 'service';
    if (targetMode !== initialTargetMode) return true;
    if (targetMode === 'service' && serviceId !== (initial.serviceId || '')) return true;
    if (targetMode === 'category' && serviceCategory !== (initial.serviceCategory || '')) return true;
    if ((positionId || '') !== (initial.positionId || '')) return true;
    if (role !== initial.role) return true;
    if (timeCondition !== initial.timeCondition) return true;
    if (valueType !== initial.valueType) return true;

    const currentVal = isMoney ? moneyValue : Number(percentVal);
    if (currentVal !== initial.commissionValue) return true;

    if (effectiveFrom !== initial.effectiveFrom) return true;
    if ((effectiveTo || '') !== (initial.effectiveTo || '')) return true;

    return false;
  }, [initial, targetMode, serviceId, serviceCategory, positionId, role, timeCondition, valueType, isMoney, moneyValue, percentVal, effectiveFrom, effectiveTo]);

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
    if (targetMode === 'service' && !serviceId) {
      errors.serviceId = 'Vui lòng chọn dịch vụ cụ thể.';
    }
    if (targetMode === 'category' && !serviceCategory) {
      errors.serviceCategory = 'Vui lòng chọn nhóm dịch vụ.';
    }

    let finalVal = 0;
    if (isMoney) {
      finalVal = moneyValue ?? 0;
      if (finalVal <= 0) {
        errors.value = 'Mức hoa hồng phải lớn hơn 0.';
      }
    } else {
      finalVal = Number(percentVal);
      if (isNaN(finalVal) || finalVal < 0 || finalVal > 100) {
        errors.value = 'Tỷ lệ phần trăm phải từ 0 đến 100%.';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    void onSave({
      serviceId: targetMode === 'service' ? serviceId : null,
      serviceCategory: targetMode === 'category' ? serviceCategory : null,
      positionId: positionId || null,
      role,
      timeCondition,
      valueType,
      commissionValue: finalVal,
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
              <strong>Quy tắc này đang ngừng áp dụng.</strong> Để kích hoạt lại, vui lòng sử dụng nút <em>Kích hoạt</em> trên danh sách.
            </div>
          </div>
        )}

        {/* GROUP 1: DỊCH VỤ & VAI TRÒ */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-3.5">
            Dịch vụ & Vai trò áp dụng
          </div>
          <div className="space-y-4">
            {/* Phạm vi áp dụng */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Phạm vi áp dụng <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className={`flex items-center justify-center h-9 px-3 border rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  targetMode === 'service'
                    ? 'border-sky-600 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 font-semibold'
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}>
                  <input
                    type="radio"
                    name="comm-target-mode"
                    checked={targetMode === 'service'}
                    onChange={() => setTargetMode('service')}
                    className="sr-only"
                  />
                  <span>Theo dịch vụ cụ thể</span>
                </label>
                <label className={`flex items-center justify-center h-9 px-3 border rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  targetMode === 'category'
                    ? 'border-sky-600 bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 font-semibold'
                    : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}>
                  <input
                    type="radio"
                    name="comm-target-mode"
                    checked={targetMode === 'category'}
                    onChange={() => setTargetMode('category')}
                    className="sr-only"
                  />
                  <span>Theo nhóm dịch vụ</span>
                </label>
              </div>
            </div>

            {/* Dịch vụ hoặc Nhóm */}
            {targetMode === 'service' ? (
              <div>
                <label htmlFor="comm-service" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Chọn dịch vụ kỹ thuật <span className="text-rose-500">*</span>
                </label>
                <select
                  id="comm-service"
                  value={serviceId}
                  onChange={e => {
                    setServiceId(e.target.value);
                    if (fieldErrors.serviceId) setFieldErrors(prev => ({ ...prev, serviceId: '' }));
                  }}
                  className={`w-full h-10 rounded-lg border ${
                    fieldErrors.serviceId ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                  } bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border`}
                >
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code}) - {s.category || 'Chung'}
                    </option>
                  ))}
                </select>
                {fieldErrors.serviceId && <p className="text-xs text-rose-500 mt-1">{fieldErrors.serviceId}</p>}
              </div>
            ) : (
              <div>
                <label htmlFor="comm-category" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Chọn nhóm dịch vụ <span className="text-rose-500">*</span>
                </label>
                <select
                  id="comm-category"
                  value={serviceCategory}
                  onChange={e => {
                    setServiceCategory(e.target.value);
                    if (fieldErrors.serviceCategory) setFieldErrors(prev => ({ ...prev, serviceCategory: '' }));
                  }}
                  className={`w-full h-10 rounded-lg border ${
                    fieldErrors.serviceCategory ? 'border-rose-500' : 'border-slate-300 dark:border-slate-700'
                  } bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border`}
                >
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {fieldErrors.serviceCategory && <p className="text-xs text-rose-500 mt-1">{fieldErrors.serviceCategory}</p>}
              </div>
            )}

            {/* Grid 2 col: Vai trò & Khung giờ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
              <div>
                <label htmlFor="comm-role" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Vai trò thực hiện <span className="text-rose-500">*</span>
                </label>
                <select
                  id="comm-role"
                  value={role}
                  onChange={e => setRole(e.target.value as any)}
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
                >
                  {ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="comm-time" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Khung giờ áp dụng <span className="text-rose-500">*</span>
                </label>
                <select
                  id="comm-time"
                  value={timeCondition}
                  onChange={e => setTimeCondition(e.target.value as any)}
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
                >
                  {TIME_CONDITIONS.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Chức danh áp dụng (tùy chọn) */}
            <div>
              <label htmlFor="comm-position" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Chức danh áp dụng (tùy chọn)
              </label>
              <select
                id="comm-position"
                value={positionId}
                onChange={e => setPositionId(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
              >
                <option value="">-- Mọi chức danh theo vai trò --</option>
                {positions.map(p => (
                  <option key={p.id} value={p.id}>{p.name + (p.scopeTag ? ' (' + p.scopeTag + ')' : '')}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* GROUP 2: MỨC HOA HỒNG & HIỆU LỰC */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-3.5">
            Mức hoa hồng & Hiệu lực
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
            {/* Hình thức giá trị */}
            <div>
              <label htmlFor="comm-valtype" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Hình thức giá trị <span className="text-rose-500">*</span>
              </label>
              <select
                id="comm-valtype"
                value={valueType}
                onChange={e => setValueType(e.target.value as any)}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
              >
                {VALUE_TYPES.map(v => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>

            {/* Mức hưởng */}
            <div>
              <label htmlFor="comm-value" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Mức hoa hồng <span className="text-rose-500">*</span>
              </label>
              {isMoney ? (
                <MoneyInput
                  id="comm-value"
                  value={moneyValue}
                  onChange={val => {
                    setMoneyValue(val);
                    if (fieldErrors.value) setFieldErrors(prev => ({ ...prev, value: '' }));
                  }}
                  suffix={valueType === 'per_hour' ? '₫/giờ' : '₫'}
                  hasError={Boolean(fieldErrors.value)}
                />
              ) : (
                <div className="relative w-full">
                  <input
                    id="comm-value"
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

            {/* Từ ngày */}
            <div>
              <label htmlFor="comm-from" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Từ ngày hiệu lực <span className="text-rose-500">*</span>
              </label>
              <input
                id="comm-from"
                type="date"
                required
                value={effectiveFrom}
                onChange={e => setEffectiveFrom(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
              />
            </div>

            {/* Đến ngày */}
            <div>
              <label htmlFor="comm-to" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Đến ngày (tùy chọn)
              </label>
              <input
                id="comm-to"
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
          <span>{busy ? 'Đang lưu…' : isEdit ? 'Cập nhật' : 'Lưu quy tắc'}</span>
        </button>
      </div>
    </form>
  );
}
