import { useState, useEffect } from 'react';
import MoneyInput from '../ui/MoneyInput';
import { formatVnd } from '../../utils/format';
import { payrollParameterApi } from '../../services/payrollParameterApi';
import type { TaxPolicySummary, TaxCalculationResult } from '../../types/payroll';

interface TaxCalculatorCardProps {
  policy: TaxPolicySummary | null;
}

export default function TaxCalculatorCard({ policy }: TaxCalculatorCardProps) {
  // Preset defaults: Tổng thu nhập 30.000.000; Lương đóng BH 5.061.100; Đoàn viên: có; 1 người phụ thuộc
  const [tongThuNhap, setTongThuNhap] = useState<number | null>(30_000_000);
  const [luongDongBh, setLuongDongBh] = useState<number | null>(5_061_100);
  const [isUnionMember, setIsUnionMember] = useState<boolean>(true);
  const [dependentCount, setDependentCount] = useState<number>(1);
  const [taxMethod, setTaxMethod] = useState<'progressive' | 'flat_10'>('progressive');

  const [result, setResult] = useState<TaxCalculationResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Debounced API call to backend preview endpoint (Single source of truth in C# PayrollFormula)
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const data = await payrollParameterApi.previewTaxCalculation({
          totalIncome: tongThuNhap || 0,
          insuranceSalary: luongDongBh || 0,
          isUnionMember,
          dependentCount,
          taxMethod,
          otherDeductions: 0,
        });
        if (active) {
          setResult(data);
        }
      } catch (err) {
        console.error('Failed to preview tax calculation:', err);
      } finally {
        if (active) setLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [tongThuNhap, luongDongBh, isUnionMember, dependentCount, taxMethod, policy]);

  const flatTaxBase = policy?.flatTaxBase ?? 'gross';
  const roundingUnit = result?.roundingUnit ?? policy?.roundingUnit ?? 1000;

  return (
    <div className="border border-sky-200 dark:border-sky-900 bg-sky-50/50 dark:bg-sky-950/20 rounded-xl p-5 shadow-sm">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-sky-100 dark:border-sky-900/60 mb-5">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Công cụ tính thử thuế TNCN & Thực lĩnh</span>
            <span className="text-xs bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300 px-2.5 py-0.5 rounded-full font-medium">
              Mô phỏng tự động
            </span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Kết quả tính toán áp dụng chuẩn xác biểu thuế lũy tiến và chính sách giảm trừ gia cảnh của phòng khám
          </p>
        </div>
        {loading && (
          <span className="text-xs text-sky-600 dark:text-sky-400 font-medium animate-pulse flex items-center gap-1.5 self-start sm:self-center">
            <span className="inline-block w-2 h-2 rounded-full bg-sky-500 animate-ping" />
            Đang tính toán...
          </span>
        )}
      </div>

      {/* Input Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* Input 1: Tổng thu nhập */}
        <div className="lg:col-span-1">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Tổng thu nhập <span className="text-rose-500">*</span>
          </label>
          <MoneyInput
            value={tongThuNhap}
            onChange={setTongThuNhap}
            placeholder="30.000.000"
          />
        </div>

        {/* Input 2: Lương đóng BH */}
        <div className="lg:col-span-1">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Lương đóng BH <span className="text-rose-500">*</span>
          </label>
          <MoneyInput
            value={luongDongBh}
            onChange={setLuongDongBh}
            placeholder="5.061.100"
          />
        </div>

        {/* Input 3: Đoàn viên công đoàn (Toggle) */}
        <div className="lg:col-span-1 flex flex-col justify-between">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Đoàn viên công đoàn
          </label>
          <div className="flex items-center gap-2.5 h-10 px-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg">
            <button
              type="button"
              role="switch"
              aria-checked={isUnionMember}
              onClick={() => setIsUnionMember(!isUnionMember)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isUnionMember ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-600'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isUnionMember ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <span
              onClick={() => setIsUnionMember(!isUnionMember)}
              className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none"
            >
              {isUnionMember ? 'Đoàn viên (100k)' : 'Không tham gia'}
            </span>
          </div>
        </div>

        {/* Input 4: Số người phụ thuộc */}
        <div className="lg:col-span-1">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Số người phụ thuộc
          </label>
          <div className="relative w-full">
            <input
              type="number"
              min="0"
              max="20"
              step="1"
              value={dependentCount}
              onChange={e => setDependentCount(Math.max(0, Number(e.target.value) || 0))}
              className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 pr-14 text-sm text-right font-[tabular-nums] text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
            />
            <span className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400 text-xs font-medium select-none">
              người
            </span>
          </div>
        </div>

        {/* Input 5: Cách tính thuế */}
        <div className="lg:col-span-1">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            Cách tính thuế
          </label>
          <select
            value={taxMethod}
            onChange={e => setTaxMethod(e.target.value as any)}
            className="w-full h-10 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-sky-500 box-border"
          >
            <option value="progressive">Lũy tiến 5 bậc</option>
            <option value="flat_10">Khấu trừ cố định 10%</option>
          </select>
        </div>
      </div>

      {/* 6-Step Breakdown Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            Bảng diễn giải kết quả tính toán 6 bước
          </h4>
          <span className="text-xs text-slate-500">
            {taxMethod === 'progressive' ? 'Phương pháp: Lũy tiến từng phần' : `Phương pháp: Cố định 10% (Cơ sở: ${flatTaxBase === 'after_deductions' ? 'Thu nhập sau trừ' : 'Tổng thu nhập'})`}
          </span>
        </div>

        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-[tabular-nums]">
            {/* Bước 1: Tổng thu nhập */}
            <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
              <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 w-12">
                (1)
              </td>
              <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Tổng thu nhập</div>
                <div className="text-xs text-slate-500">Lương công + trực + hoa hồng + phụ cấp chịu thuế + thưởng</div>
              </td>
              <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-slate-100 text-base">
                {result ? formatVnd(result.totalIncome) : '...'}
              </td>
            </tr>

            {/* Bước 2: Khoản trừ trước thuế */}
            <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
              <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                (2)
              </td>
              <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Khoản trừ trước thuế</div>
                <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  <span>• BH NLĐ (10,5% × {formatVnd(luongDongBh || 0)}): <strong>{formatVnd(result?.insuranceDeduction || 0)}</strong></span>
                  {isUnionMember && (
                    <span>• Quỹ công đoàn: <strong>{formatVnd(result?.unionFeeDeduction || 0)}</strong></span>
                  )}
                  {(result?.otherBeforeTaxDeduction || 0) > 0 && (
                    <span>• Khoản khác: <strong>{formatVnd(result?.otherBeforeTaxDeduction || 0)}</strong></span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-rose-600 dark:text-rose-400">
                − {result ? formatVnd(result.beforeTaxDeductions) : '...'}
              </td>
            </tr>

            {/* Bước 3: Thu nhập sau trừ */}
            <tr className="bg-sky-50/30 dark:bg-sky-950/20 font-medium hover:bg-sky-50/50">
              <td className="px-4 py-3 text-sky-800 dark:text-sky-300 font-semibold">
                (3)
              </td>
              <td className="px-4 py-3 text-sky-900 dark:text-sky-200">
                <div className="font-semibold">Thu nhập sau trừ</div>
                <div className="text-xs text-sky-700/80 dark:text-sky-400">= (1) − (2)</div>
              </td>
              <td className="px-4 py-3 text-right font-bold text-sky-800 dark:text-sky-300 text-base">
                {result ? formatVnd(result.incomeAfterDeductions) : '...'}
              </td>
            </tr>

            {/* Bước 4: Thu nhập tính thuế */}
            <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
              <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">
                (4)
              </td>
              <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  {taxMethod === 'progressive' ? 'Thu nhập tính thuế' : 'Cơ sở tính thuế khấu trừ 10%'}
                </div>
                {taxMethod === 'progressive' ? (
                  <div className="text-xs text-slate-500 mt-0.5">
                    {result?.taxableIncomeNote || (
                      `= (3) − Giảm trừ bản thân (${formatVnd(result?.personalDeductionAmount || 0)}) − Giảm trừ ${dependentCount} người phụ thuộc (${formatVnd(result?.dependentDeductionAmount || 0)})`
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 mt-0.5">
                    Cơ sở: {flatTaxBase === 'after_deductions' ? 'Thu nhập sau trừ' : 'Tổng thu nhập'}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                {result ? formatVnd(result.taxableIncome) : '...'}
              </td>
            </tr>

            {/* Bước 5: Thuế TNCN & Bậc thuế */}
            <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
              <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100 align-top">
                (5)
              </td>
              <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                <div className="font-semibold text-slate-900 dark:text-slate-100">Thuế TNCN</div>
                {taxMethod === 'progressive' ? (
                  (result?.taxableIncome || 0) <= 0 ? (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                      ✓ Thu nhập tính thuế ≤ 0 → Không phát sinh thuế TNCN phải nộp
                    </div>
                  ) : (
                    <div className="mt-2 space-y-1">
                      {result?.bracketBreakdowns.map((b, i) => (
                        <div key={i} className="text-xs text-slate-600 dark:text-slate-400 flex items-center justify-between max-w-sm">
                          <span>Bậc {b.bracketIndex} [{b.rangeText}] ({b.ratePercent}%): {formatVnd(b.taxableAmount)}</span>
                          <strong className="text-slate-800 dark:text-slate-200">+{formatVnd(b.taxAmount)}</strong>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="text-xs text-slate-500 mt-0.5">
                    {result?.taxNote || `= 10% × ${formatVnd(result?.taxableIncome || 0)}`}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-right font-bold text-rose-600 dark:text-rose-400 text-base align-top">
                − {result ? formatVnd(result.pitTax) : '...'}
              </td>
            </tr>

            {/* Bước 6: Thực lĩnh */}
            <tr className="bg-emerald-50/40 dark:bg-emerald-950/20 font-medium hover:bg-emerald-50/60">
              <td className="px-4 py-3.5 text-emerald-800 dark:text-emerald-300 font-bold text-base">
                (6)
              </td>
              <td className="px-4 py-3.5 text-emerald-950 dark:text-emerald-200">
                <div className="font-bold text-emerald-950 dark:text-emerald-100 text-base">Thực lĩnh</div>
                <div className="text-xs text-emerald-700/80 dark:text-emerald-400">
                  = (3) Thu nhập sau trừ − (5) Thuế TNCN (Làm tròn đơn vị: {formatVnd(roundingUnit)})
                </div>
              </td>
              <td className="px-4 py-3.5 text-right font-black text-emerald-700 dark:text-emerald-300 text-xl">
                {result ? formatVnd(result.takeHome) : '...'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
