import { useState, useMemo, useEffect, type FormEvent } from 'react';
import Alert from '../ui/Alert';
import MoneyInput from '../ui/MoneyInput';
import { useModal } from '../ui/Modal';
import { formatDateOnly, formatVnd, todayVn } from '../../utils/format';
import type { ContractSummary, UpdateContractCompensationInput, SiteOption } from '../../types/payroll';

interface ContractCompensationFormProps {
  contract: ContractSummary;
  sites: SiteOption[];
  onSave: (value: UpdateContractCompensationInput) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  error?: string;
  onDirtyChange?: (dirty: boolean) => void;
  /** Configured standard working days, used when the contract has none. */
  defaultWorkingDays: number;
}

export default function ContractCompensationForm({
  contract,
  sites,
  onSave,
  onClose,
  busy,
  error,
  onDirtyChange,
  defaultWorkingDays,
}: ContractCompensationFormProps) {
  // A scheduled change is the latest salary entry, so the form edits it rather than today's salary.
  const pending = contract.pendingSalaryChange ?? null;
  const base = useMemo(() => ({
    salaryType: ((pending?.salaryType ?? contract.salaryType) || 'daily') as 'daily' | 'monthly',
    dailyRate: (pending ? pending.dailyRate : contract.dailyRate) || 0,
    monthlySalary: pending ? pending.monthlySalary : contract.monthlySalary,
    standardWorkingDays: (pending ? pending.standardWorkingDays : contract.standardWorkingDays) || defaultWorkingDays,
    taxMethod: ((pending?.taxMethod ?? contract.taxMethod) || 'progressive') as 'progressive' | 'flat_10',
    isInsuranceEligible: pending ? pending.insuranceSalaryBasis != null : contract.isInsuranceEligible,
    insuranceSalaryBasis: (pending ? pending.insuranceSalaryBasis : contract.insuranceSalaryBasis) ?? null,
  }), [contract, pending, defaultWorkingDays]);

  const [salaryType, setSalaryType] = useState<'daily' | 'monthly'>(base.salaryType);
  const [standardWorkingDays, setStandardWorkingDays] = useState<string>(String(base.standardWorkingDays));
  const [dailyRate, setDailyRate] = useState<number | null>(base.dailyRate);
  const [monthlySalary, setMonthlySalary] = useState<number | null>(
    base.monthlySalary ? base.monthlySalary : base.dailyRate * base.standardWorkingDays
  );
  const [taxMethod, setTaxMethod] = useState<'progressive' | 'flat_10'>(base.taxMethod);
  const [siteId, setSiteId] = useState<string>(contract.siteId || (sites[0]?.id || ''));
  const [isUnionMember, setIsUnionMember] = useState<boolean>(contract.isUnionMember ?? true);
  const [isInsuranceEligible, setIsInsuranceEligible] = useState<boolean>(base.isInsuranceEligible);
  const [insuranceSalaryBasis, setInsuranceSalaryBasis] = useState<number | null>(base.insuranceSalaryBasis);

  const today = todayVn();
  // The new salary must start inside the contract period and not before a scheduled change.
  const minEffectiveDate = pending ? pending.effectiveFrom : contract.effectiveFrom;
  const maxEffectiveDate = contract.effectiveTo ?? undefined;
  const [effectiveFrom, setEffectiveFrom] = useState<string>(() => {
    if (pending) return pending.effectiveFrom;
    if (today < contract.effectiveFrom) return contract.effectiveFrom;
    if (contract.effectiveTo && today > contract.effectiveTo) return contract.effectiveTo;
    return today;
  });
  const [note, setNote] = useState<string>('');

  function handleSalaryTypeChange(type: 'daily' | 'monthly') {
    setSalaryType(type);
    const days = Number(standardWorkingDays) || defaultWorkingDays;
    if (type === 'monthly') {
      const currentDaily = dailyRate || 0;
      setMonthlySalary(currentDaily * days);
    } else {
      const currentMonthly = monthlySalary || 0;
      setDailyRate(Math.round(currentMonthly / days));
    }
  }

  function handleDailyRateChange(val: number | null) {
    setDailyRate(val);
    const days = Number(standardWorkingDays) || defaultWorkingDays;
    setMonthlySalary(Math.round((val || 0) * days));
  }

  function handleMonthlySalaryChange(val: number | null) {
    setMonthlySalary(val);
    const days = Number(standardWorkingDays) || defaultWorkingDays;
    setDailyRate(Math.round((val || 0) / days));
  }

  const isDirty = useMemo(() => {
    if (salaryType !== base.salaryType) return true;
    if (Number(standardWorkingDays) !== base.standardWorkingDays) return true;
    if (dailyRate !== base.dailyRate) return true;
    if (monthlySalary !== (base.monthlySalary ?? base.dailyRate * base.standardWorkingDays)) return true;
    if (taxMethod !== base.taxMethod) return true;
    if ((siteId || '') !== (contract.siteId || (sites[0]?.id || ''))) return true;
    if (isUnionMember !== (contract.isUnionMember ?? true)) return true;
    if (isInsuranceEligible !== base.isInsuranceEligible) return true;
    if (insuranceSalaryBasis !== base.insuranceSalaryBasis) return true;
    if (note.trim() !== '') return true;

    return false;
  }, [contract, base, salaryType, standardWorkingDays, dailyRate, monthlySalary, taxMethod, siteId, sites, isUnionMember, isInsuranceEligible, insuranceSalaryBasis, note]);

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

    void onSave({
      salaryType,
      dailyRate: dailyRate || 0,
      monthlySalary: monthlySalary || 0,
      standardWorkingDays: Number(standardWorkingDays) || defaultWorkingDays,
      isInsuranceEligible,
      insuranceSalaryBasis: isInsuranceEligible ? insuranceSalaryBasis : null,
      taxMethod,
      siteId: siteId || null,
      isUnionMember,
      effectiveFrom: effectiveFrom || null,
      note: note.trim() || null,
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col">
      {/* Form Body */}
      <div className="space-y-6">
        {/* Contract Info Banner */}
        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 p-3.5 text-xs text-slate-700 dark:text-slate-300 grid grid-cols-2 gap-2">
          <div>
            <span className="text-slate-400 block mb-0.5">Nhân viên</span>
            <strong className="text-sm text-slate-900 dark:text-slate-100">{contract.staffName}</strong> ({contract.staffCode})
          </div>
          <div>
            <span className="text-slate-400 block mb-0.5">Hợp đồng</span>
            <strong className="text-sm text-slate-900 dark:text-slate-100">{contract.contractCode || 'Chưa có mã'}</strong> ({contract.contractType})
          </div>
        </div>

        {pending && (
          <div className="rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 p-3.5 text-xs text-sky-900 dark:text-sky-200 leading-relaxed">
            Đang áp dụng: <strong>{contract.salaryType === 'monthly' ? `${formatVnd(contract.monthlySalary)}/tháng` : `${formatVnd(contract.dailyRate)}/ngày`}</strong>.
            {' '}Đã lên lịch mức lương mới từ <strong>{formatDateOnly(pending.effectiveFrom)}</strong>; form dưới đây đang hiển thị mức lương mới đó.
            Giữ nguyên ngày để sửa lần điều chỉnh này.
          </div>
        )}

        {/* GROUP 1: MỨC LƯƠNG CHÍNH */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-3.5">
            Mức lương chính & Ngày công
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
            <div>
              <label htmlFor="comp-salarytype" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Kiểu lương hợp đồng <span className="text-rose-500">*</span>
              </label>
              <select
                id="comp-salarytype"
                value={salaryType}
                onChange={e => handleSalaryTypeChange(e.target.value as any)}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
              >
                <option value="daily">Theo ngày (Bác sĩ, KTV, Kế toán)</option>
                <option value="monthly">Theo tháng (Điều dưỡng, Dược sĩ, Y tá)</option>
              </select>
            </div>

            <div>
              <label htmlFor="comp-standarddays" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Số ngày công chuẩn <span className="text-rose-500">*</span>
              </label>
              <div className="relative w-full">
                <input
                  id="comp-standarddays"
                  type="number"
                  min="1"
                  max="31"
                  required
                  value={standardWorkingDays}
                  onChange={e => {
                    const days = e.target.value;
                    setStandardWorkingDays(days);
                    const d = Number(days) || defaultWorkingDays;
                    if (salaryType === 'daily') {
                      setMonthlySalary((dailyRate || 0) * d);
                    } else {
                      setDailyRate(Math.round((monthlySalary || 0) / d));
                    }
                  }}
                  style={{ paddingRight: '56px', boxSizing: 'border-box' }}
                  className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-right font-[tabular-nums] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
                />
                <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-xs font-medium select-none">
                  ngày
                </span>
              </div>
            </div>

            <div>
              <label htmlFor="comp-dailyrate" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Đơn giá lương ngày {salaryType === 'daily' ? <span className="text-rose-500">*</span> : <span className="text-slate-400">(Tự quy đổi)</span>}
              </label>
              <MoneyInput
                id="comp-dailyrate"
                value={dailyRate}
                onChange={handleDailyRateChange}
                disabled={salaryType === 'monthly'}
              />
            </div>

            <div>
              <label htmlFor="comp-monthlysalary" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Mức lương tháng {salaryType === 'monthly' ? <span className="text-rose-500">*</span> : <span className="text-slate-400">(Ước tính)</span>}
              </label>
              <MoneyInput
                id="comp-monthlysalary"
                value={monthlySalary}
                onChange={handleMonthlySalaryChange}
                disabled={salaryType === 'daily'}
              />
            </div>
          </div>
        </div>

        {/* GROUP 2: THUẾ, BẢO HIỂM & CƠ SỞ */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-3.5">
            Thuế, Bảo hiểm & Cơ sở
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
            <div>
              <label htmlFor="comp-taxmethod" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Phương pháp tính thuế TNCN <span className="text-rose-500">*</span>
              </label>
              <select
                id="comp-taxmethod"
                value={taxMethod}
                onChange={e => setTaxMethod(e.target.value as any)}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
              >
                <option value="progressive">Lũy tiến từng phần (HĐ dài hạn)</option>
                <option value="flat_10">Khấu trừ cố định 10% (HĐ thử việc/thời vụ)</option>
              </select>
            </div>

            <div>
              <label htmlFor="comp-site" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Cơ sở làm việc
              </label>
              <select
                id="comp-site"
                value={siteId}
                onChange={e => setSiteId(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
              >
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>

            {/* Toggles */}
            <div className="col-span-1 sm:col-span-2 space-y-4 pt-1">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isUnionMember}
                  onClick={() => setIsUnionMember(!isUnionMember)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
                    isUnionMember ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isUnionMember ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <div className="flex flex-col">
                  <span
                    onClick={() => setIsUnionMember(!isUnionMember)}
                    className="text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer select-none"
                  >
                    Đoàn viên công đoàn
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Thu đoàn phí công đoàn 100.000 ₫/tháng vào quỹ công đoàn cơ sở
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isInsuranceEligible}
                  onClick={() => setIsInsuranceEligible(!isInsuranceEligible)}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 ${
                    isInsuranceEligible ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      isInsuranceEligible ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
                <div className="flex flex-col">
                  <span
                    onClick={() => setIsInsuranceEligible(!isInsuranceEligible)}
                    className="text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer select-none"
                  >
                    Đóng bảo hiểm bắt buộc
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Tham gia đóng BHXH, BHYT, BHTN theo tỷ lệ quy định
                  </span>
                </div>
              </div>
            </div>

            {/* Insurance basis if eligible */}
            {isInsuranceEligible && (
              <div className="col-span-1 sm:col-span-2">
                <label htmlFor="comp-insbasis" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Mức lương làm căn cứ đóng BHXH/BHYT/BHTN <span className="text-rose-500">*</span>
                </label>
                <MoneyInput
                  id="comp-insbasis"
                  value={insuranceSalaryBasis}
                  onChange={setInsuranceSalaryBasis}
                />
              </div>
            )}
          </div>
        </div>

        {/* GROUP 3: HIỆU LỰC & GHI CHÚ */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 pb-1.5 border-b border-slate-200 dark:border-slate-800 mb-3.5">
            Thời hạn & Ghi chú
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
            <div>
              <label htmlFor="comp-eff-date" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Ngày bắt đầu áp dụng mức lương mới <span className="text-rose-500">*</span>
              </label>
              <input
                id="comp-eff-date"
                type="date"
                required
                min={minEffectiveDate}
                max={maxEffectiveDate}
                value={effectiveFrom}
                onChange={e => setEffectiveFrom(e.target.value)}
                className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
              />
              <p className="text-[11px] text-slate-400 mt-1">Lưu vết lịch sử điều chỉnh lương từ ngày này.</p>
            </div>

            <div>
              <label htmlFor="comp-note" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Ghi chú điều chỉnh
              </label>
              <input
                id="comp-note"
                type="text"
                maxLength={200}
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="VD: Điều chỉnh theo thỏa thuận mới"
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
          <span>{busy ? 'Đang lưu…' : 'Lưu đãi ngộ & Lịch sử'}</span>
        </button>
      </div>
    </form>
  );
}
