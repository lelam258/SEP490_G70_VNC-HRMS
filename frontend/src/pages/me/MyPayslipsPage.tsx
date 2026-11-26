import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../../components/ui/Alert';
import Icon from '../../components/ui/Icon';
import { myPayslipApi } from '../../services/myPayslipApi';
import type { MyPayslipMonthLookup, MyPayslipSummary } from '../../types/myPayslip';
import { formatDate, formatVnd } from '../../utils/format';

function formatMonthLabel(payMonth: string): string {
  const parts = payMonth.split('-');
  if (parts.length !== 2) return payMonth;
  return `Tháng ${Number(parts[1])}/${parts[0]}`;
}

function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function buildPayMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export default function MyPayslipsPage() {
  const initial = useMemo(() => getCurrentYearMonth(), []);
  const yearOptions = useMemo(() => {
    const cur = initial.year;
    return Array.from({ length: 6 }, (_, i) => cur + 1 - i);
  }, [initial.year]);

  const [selectedYear, setSelectedYear] = useState<number>(initial.year);
  const [selectedMonthNum, setSelectedMonthNum] = useState<number>(initial.month);

  const [history, setHistory] = useState<MyPayslipSummary[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [lookup, setLookup] = useState<MyPayslipMonthLookup | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [downloadingPdf, setDownloadingPdf] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [initializedMonth, setInitializedMonth] = useState<boolean>(false);

  const selectedPayMonth = useMemo(
    () => buildPayMonth(selectedYear, selectedMonthNum),
    [selectedYear, selectedMonthNum]
  );

  // Tải danh sách các kỳ lương đã chốt trong năm đang chọn
  const loadHistory = useCallback(async (year: number, autoPickLatest: boolean) => {
    setLoadingHistory(true);
    setError('');
    try {
      const items = await myPayslipApi.listMyPayslips(year);
      setHistory(items);
      if (autoPickLatest && items.length > 0) {
        const latestParts = items[0].payMonth.split('-');
        if (latestParts.length === 2) {
          setSelectedMonthNum(Number(latestParts[1]));
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được danh sách phiếu lương.');
      setHistory([]);
    } finally {
      setLoadingHistory(false);
      setInitializedMonth(true);
    }
  }, []);

  useEffect(() => {
    void loadHistory(selectedYear, !initializedMonth);
  }, [selectedYear, loadHistory, initializedMonth]);

  // Tra cứu phiếu lương theo tháng đang chọn (hỗ trợ Flow A1 MSG10 & A2 MSG01)
  const loadMonthDetail = useCallback(async (payMonth: string) => {
    setLoadingDetail(true);
    setError('');
    try {
      const res = await myPayslipApi.getMyPayslipByMonth(payMonth);
      setLookup(res);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được chi tiết phiếu lương.');
      setLookup(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (!initializedMonth) return;
    void loadMonthDetail(selectedPayMonth);
  }, [selectedPayMonth, initializedMonth, loadMonthDetail]);

  const handleSelectYear = (year: number) => {
    setSelectedYear(year);
    setInitializedMonth(false);
  };

  const handleSelectHistoryItem = (item: MyPayslipSummary) => {
    const parts = item.payMonth.split('-');
    if (parts.length === 2) {
      const y = Number(parts[0]);
      const m = Number(parts[1]);
      if (y !== selectedYear) setSelectedYear(y);
      setSelectedMonthNum(m);
    }
  };

  const payslip = lookup?.availability === 'available' ? lookup.payslip : null;

  const handleDownloadPdf = async () => {
    if (!payslip || downloadingPdf) return;
    setDownloadingPdf(true);
    setError('');
    try {
      const safeCode = (payslip.staffCode || 'NV').trim();
      await myPayslipApi.downloadMyPayslipPdf(
        payslip.payslipId,
        `PhieuLuong_${safeCode}_${payslip.payMonth}.pdf`
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải tệp PDF phiếu lương.');
    } finally {
      setDownloadingPdf(false);
    }
  };
  const totalDeductions = payslip
    ? payslip.insuranceDeduction + payslip.unionFeeDeduction + payslip.taxDeduction + payslip.otherDeduction
    : 0;

  // Tách trợ cấp thai sản BHXH ra khỏi danh sách phụ cấp thường để hiển thị rõ ràng
  const { maternityAllowances, regularAllowances } = useMemo(() => {
    if (!payslip) return { maternityAllowances: [], regularAllowances: [] };
    const maternity = payslip.allowances.filter(a => a.name.toLowerCase().includes('thai sản'));
    const regular = payslip.allowances.filter(a => !a.name.toLowerCase().includes('thai sản'));
    return { maternityAllowances: maternity, regularAllowances: regular };
  }, [payslip]);

  const selectedSummary = history.find(h => h.payMonth === selectedPayMonth);

  return (
    <div className="workspace-list-page my-payslips-page">
      {/* 1. Thanh tiêu đề + chọn tháng/năm + nút In/PDF */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight m-0">
            Phiếu lương của tôi
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 h-9 shadow-2xs">
            <span className="text-xs font-medium text-slate-500">Kỳ lương:</span>
            <select
              aria-label="Chọn tháng"
              value={selectedMonthNum}
              onChange={(e) => setSelectedMonthNum(Number(e.target.value))}
              className="bg-transparent border-0 text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer pr-1"
              style={{ minHeight: 'unset', padding: '2px 4px', width: 'auto', border: 'none' }}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  Tháng {m}
                </option>
              ))}
            </select>
            <span className="text-slate-300">|</span>
            <select
              aria-label="Chọn năm"
              value={selectedYear}
              onChange={(e) => handleSelectYear(Number(e.target.value))}
              className="bg-transparent border-0 text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              style={{ minHeight: 'unset', padding: '2px 4px', width: 'auto', border: 'none' }}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>

          <Link
            to={
              payslip
                ? `/me/payroll-inquiries/new?payslipId=${payslip.payslipId}&month=${payslip.payMonth}`
                : `/me/payroll-inquiries/new?month=${selectedPayMonth}`
            }
            className="h-9 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-colors no-underline"
            title="Gửi thắc mắc về bảng công hoặc phiếu lương kỳ này"
          >
            <Icon name="mail" size={14} />
            <span>Gửi thắc mắc</span>
          </Link>

          <button
            type="button"
            className="h-9 px-3.5 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
            disabled={!payslip || downloadingPdf}
            onClick={() => void handleDownloadPdf()}
            title={payslip ? 'Tải bản sao PDF phiếu lương về máy' : 'Chưa có phiếu lương để tải'}
          >
            <Icon name="fileText" size={14} />
            <span>{downloadingPdf ? 'Đang xuất PDF...' : 'Tải PDF'}</span>
          </button>
        </div>
      </div>

      {error && <div className="no-print"><Alert variant="error">{error}</Alert></div>}

      {/* 2. Bố cục 2 cột: Trái (Danh sách các kỳ đã chốt) | Phải (Chi tiết phiếu lương) */}
      <div className="my-payslips-layout">
        {/* Cột trái: Danh sách các tháng đã chốt trong năm */}
        <aside className="my-payslips-sidebar panel bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden no-print">
          <div className="px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600 m-0">
              Kỳ đã chốt ({selectedYear})
            </h2>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/80 text-slate-700">
              {history.length}
            </span>
          </div>

          <div className="my-payslips-sidebar-list">
            {loadingHistory ? (
              <div className="p-3 space-y-2 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-slate-100 rounded-md" />
                ))}
              </div>
            ) : history.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 leading-relaxed">
                Chưa có kỳ lương nào được chốt trong năm {selectedYear}.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 m-0 p-0 list-none">
                {history.map((item) => {
                  const isSelected = item.payMonth === selectedPayMonth;
                  return (
                    <li key={item.payslipId}>
                      <button
                        type="button"
                        onClick={() => handleSelectHistoryItem(item)}
                        className={`w-full text-left px-3.5 py-2.5 transition-colors cursor-pointer border-l-3 ${isSelected
                          ? 'bg-teal-50/80 border-l-teal-600'
                          : 'bg-white border-l-transparent hover:bg-slate-50'
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm font-semibold ${isSelected ? 'text-teal-800' : 'text-slate-800'}`}>
                            {formatMonthLabel(item.payMonth)}
                          </span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Đã chốt
                          </span>
                        </div>
                        <div className="mt-1 flex items-baseline justify-between gap-2">
                          <span className="text-[11px] text-slate-500">
                            {item.workDays} công
                          </span>
                          <span className="text-xs font-bold text-slate-900 tabular-nums">
                            {formatVnd(item.netPay)}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Cột phải: Khung hiển thị Phiếu lương chi tiết */}
        <section className="my-payslips-detail panel bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
          <div className="my-payslips-detail-scroll printable-payslip">
            {loadingDetail ? (
              <div className="p-6 space-y-4 animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-1/3" />
                <div className="grid grid-cols-3 gap-3">
                  <div className="h-16 bg-slate-100 rounded-lg" />
                  <div className="h-16 bg-slate-100 rounded-lg" />
                  <div className="h-16 bg-slate-100 rounded-lg" />
                </div>
                <div className="h-48 bg-slate-100 rounded-lg" />
              </div>
            ) : !lookup ? null : lookup.availability === 'not_finalized' ? (
              /* Alternative Flow A1 - MSG10: Kỳ lương chưa được chốt */
              <div className="p-10 text-center max-w-md mx-auto">
                <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mx-auto mb-3">
                  <Icon name="clock" size={22} />
                </div>
                <h2 className="text-base font-semibold text-slate-900 mb-1">
                  Phiếu lương {formatMonthLabel(lookup.payMonth)} chưa khả dụng
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {lookup.message || 'Bảng lương kỳ này chưa được chốt, phiếu lương chưa khả dụng.'}
                </p>
                {history.length > 0 && (
                  <button
                    type="button"
                    className="mt-4 h-9 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
                    onClick={() => handleSelectHistoryItem(history[0])}
                  >
                    Xem kỳ gần nhất ({formatMonthLabel(history[0].payMonth)})
                  </button>
                )}
              </div>
            ) : lookup.availability === 'not_found' || !payslip ? (
              /* Alternative Flow A2 - MSG01: Không có phiếu lương cho kỳ đã chọn */
              <div className="p-10 text-center max-w-md mx-auto">
                <div className="w-12 h-12 rounded-full bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center mx-auto mb-3">
                  <Icon name="fileText" size={22} />
                </div>
                <h2 className="text-base font-semibold text-slate-900 mb-1">
                  Không có phiếu lương {formatMonthLabel(lookup.payMonth)}
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  {lookup.message || 'Không tìm thấy phiếu lương phù hợp cho kỳ đã chọn.'}
                </p>
              </div>
            ) : (
              /* Phiếu lương chính thức đã chốt (Read-only) */
              <div className="p-4 sm:p-5 space-y-4">
                {/* Đầu phiếu */}
                <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
                      Phòng khám Đa khoa Việt Nhật — VNC HRMS
                    </div>
                    <h2 className="text-lg font-bold text-slate-900 mt-0.5">
                      PHIẾU LƯƠNG {formatMonthLabel(payslip.payMonth).toUpperCase()}
                    </h2>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {selectedSummary?.finalizedAt
                        ? `Ngày chốt sổ: ${formatDate(selectedSummary.finalizedAt)}`
                        : 'Trạng thái: Đã chốt sổ (Chỉ đọc)'}
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                    Đã chốt chính thức
                  </span>
                </div>

                {/* Thông tin nhân sự & Căn cứ lương + Ngày công */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/80 border border-slate-200/80 rounded-lg p-3.5 text-xs">
                  <div className="space-y-1.5">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Họ và tên:</span>
                      <span className="font-semibold text-slate-900">{payslip.staffName || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Mã nhân viên:</span>
                      <span className="font-mono font-semibold text-slate-800">{payslip.staffCode || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Khoa / Phòng:</span>
                      <span className="font-medium text-slate-800">{payslip.departmentName || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Chức vụ:</span>
                      <span className="font-medium text-slate-800">{payslip.positionName || '—'}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 md:border-l md:border-slate-200 md:pl-3.5">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Hợp đồng & Kiểu lương:</span>
                      <span className="font-medium text-slate-800">
                        {payslip.contractCode || '—'} ({payslip.salaryType === 'daily' ? 'Lương ngày' : 'Lương tháng'})
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Căn cứ lương:</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {payslip.salaryType === 'daily'
                          ? `${formatVnd(payslip.dailyRate)} /ngày`
                          : `${formatVnd(payslip.monthlySalary || 0)} /tháng (${payslip.standardWorkingDays} công chuẩn)`}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Lương đóng BHXH:</span>
                      <span className="font-medium text-slate-800 tabular-nums">
                        {payslip.isInsuranceEligible ? formatVnd(payslip.insuranceSalaryBase) : 'Không đóng'}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Công thực tế & Ca trực:</span>
                      <span className="font-medium text-slate-800 tabular-nums">
                        <strong>{payslip.workDays}</strong> công
                        {payslip.noonDutyCount > 0 ? ` · ${payslip.noonDutyCount} trực trưa` : ''}
                        {payslip.eveningDutyCount > 0 ? ` · ${payslip.eveningDutyCount} trực tối` : ''}
                        {payslip.overtimeHours > 0 ? ` · ${payslip.overtimeHours}h ngoài giờ` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3 thẻ tóm tắt tài chính */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
                    <div className="text-[11px] font-medium text-slate-500">Tổng thu nhập (Gross)</div>
                    <div className="text-base font-bold text-slate-900 mt-0.5 tabular-nums">
                      {formatVnd(payslip.grossPay)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-2.5">
                    <div className="text-[11px] font-medium text-slate-500">Tổng khấu trừ</div>
                    <div className="text-base font-bold text-rose-700 mt-0.5 tabular-nums">
                      -{formatVnd(totalDeductions)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-teal-200 bg-teal-50/70 px-3.5 py-2.5">
                    <div className="text-[11px] font-semibold text-teal-800">Thực lĩnh (Net Pay)</div>
                    <div className="text-base font-bold text-teal-800 mt-0.5 tabular-nums">
                      {formatVnd(payslip.netPay)}
                    </div>
                  </div>
                </div>

                {/* Chi tiết 2 cột: Thu nhập & Phụ cấp | Khấu trừ & Thuế TNCN */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Cột 1: Thu nhập & Phụ cấp */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                    <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wide text-slate-700">
                      1. Các khoản thu nhập &amp; Phụ cấp
                    </div>
                    <div className="p-3.5 space-y-2 text-xs flex-1">
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-700">
                          Lương theo ngày công ({payslip.workDays} công)
                        </span>
                        <span className="font-semibold text-slate-900 tabular-nums">
                          {formatVnd(payslip.basePay)}
                        </span>
                      </div>

                      {payslip.noonDutyPay > 0 && (
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-700">
                            Tiền trực trưa ({payslip.noonDutyCount} buổi)
                          </span>
                          <span className="font-medium text-slate-900 tabular-nums">
                            {formatVnd(payslip.noonDutyPay)}
                          </span>
                        </div>
                      )}

                      {payslip.eveningDutyPay > 0 && (
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-700">
                            Tiền trực tối ({payslip.eveningDutyCount} buổi)
                          </span>
                          <span className="font-medium text-slate-900 tabular-nums">
                            {formatVnd(payslip.eveningDutyPay)}
                          </span>
                        </div>
                      )}

                      {payslip.overtimePay > 0 && (
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-700">
                            Tiền trực ngoài giờ ({payslip.overtimeHours} giờ)
                          </span>
                          <span className="font-medium text-slate-900 tabular-nums">
                            {formatVnd(payslip.overtimePay)}
                          </span>
                        </div>
                      )}

                      {payslip.onCallPay > 0 && (
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-700">
                            Tiền trực chuyên môn ({payslip.onCallDays} ca)
                          </span>
                          <span className="font-medium text-slate-900 tabular-nums">
                            {formatVnd(payslip.onCallPay)}
                          </span>
                        </div>
                      )}

                      {regularAllowances.length > 0 && (
                        <div className="pt-1.5 border-t border-dashed border-slate-200 space-y-1.5">
                          <div className="text-[11px] font-semibold text-slate-500 uppercase">Phụ cấp</div>
                          {regularAllowances.map((a) => (
                            <div key={a.id} className="flex justify-between gap-2 pl-2">
                              <span className="text-slate-600">• {a.name}</span>
                              <span className="font-medium text-slate-900 tabular-nums">
                                {formatVnd(a.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {maternityAllowances.length > 0 && (
                        <div className="pt-1.5 border-t border-dashed border-sky-200 space-y-1.5">
                          {maternityAllowances.map((a) => (
                            <div key={a.id} className="flex justify-between gap-2 text-sky-800 bg-sky-50/70 px-2 py-1 rounded">
                              <span className="font-medium">{a.name}</span>
                              <span className="font-semibold tabular-nums">{formatVnd(a.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex justify-between gap-2 pt-1.5 border-t border-dashed border-slate-200">
                        <span className="text-slate-700">Hoa hồng thủ thuật &amp; CLS</span>
                        <span className="font-semibold text-slate-900 tabular-nums">
                          {formatVnd(payslip.commissionTotal)}
                        </span>
                      </div>
                    </div>

                    <div className="px-3.5 py-2.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-800">Tổng thu nhập (Gross)</span>
                      <span className="font-bold text-sm text-slate-900 tabular-nums">
                        {formatVnd(payslip.grossPay)}
                      </span>
                    </div>
                  </div>

                  {/* Cột 2: Khấu trừ & Thuế TNCN */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col">
                    <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 text-xs font-bold uppercase tracking-wide text-slate-700">
                      2. Các khoản khấu trừ &amp; Thuế TNCN
                    </div>
                    <div className="p-3.5 space-y-2 text-xs flex-1">
                      {payslip.deductions.length > 0 ? (
                        payslip.deductions.map((d) => (
                          <div key={d.payslipDeductionId} className="flex justify-between gap-2">
                            <span className="text-slate-700">
                              {d.deductionName}
                              {d.ratePercent != null ? ` (${d.ratePercent}%)` : ''}
                            </span>
                            <span className="font-medium text-rose-700 tabular-nums">
                              -{formatVnd(d.amount)}
                            </span>
                          </div>
                        ))
                      ) : (
                        <>
                          <div className="flex justify-between gap-2">
                            <span className="text-slate-700">BHXH, BHYT, BHTN (NLĐ đóng)</span>
                            <span className="font-medium text-rose-700 tabular-nums">
                              {payslip.insuranceDeduction > 0 ? `-${formatVnd(payslip.insuranceDeduction)}` : '0 ₫'}
                            </span>
                          </div>
                          {payslip.unionFeeDeduction > 0 && (
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-700">Đoàn phí công đoàn</span>
                              <span className="font-medium text-rose-700 tabular-nums">
                                -{formatVnd(payslip.unionFeeDeduction)}
                              </span>
                            </div>
                          )}
                          {payslip.otherDeduction > 0 && (
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-700">Khấu trừ khác</span>
                              <span className="font-medium text-rose-700 tabular-nums">
                                -{formatVnd(payslip.otherDeduction)}
                              </span>
                            </div>
                          )}
                        </>
                      )}

                      {/* Chi tiết Thuế TNCN & Giảm trừ gia cảnh */}
                      <div className="pt-2 border-t border-dashed border-slate-200 space-y-1.5">
                        <div className="flex justify-between gap-2">
                          <span className="font-semibold text-slate-800">Thuế thu nhập cá nhân (TNCN)</span>
                          <span className={`font-semibold tabular-nums ${payslip.taxDeduction > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                            {payslip.taxDeduction > 0 ? `-${formatVnd(payslip.taxDeduction)}` : '0 ₫'}
                          </span>
                        </div>

                        <div className="bg-slate-50 border border-slate-200/80 rounded-md p-2.5 space-y-1 text-[11px] text-slate-600">
                          <div className="flex justify-between">
                            <span>Giảm trừ bản thân:</span>
                            <span className="tabular-nums font-medium text-slate-800">{formatVnd(payslip.personalDeduction)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Giảm trừ người phụ thuộc ({payslip.dependentCount} người):</span>
                            <span className="tabular-nums font-medium text-slate-800">{formatVnd(payslip.dependentDeduction)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Thu nhập tính thuế:</span>
                            <span className="tabular-nums font-semibold text-slate-900">{formatVnd(payslip.taxableIncome)}</span>
                          </div>

                          {payslip.taxDeduction > 0 && payslip.taxBrackets.length > 0 && (
                            <div className="pt-1.5 mt-1 border-t border-slate-200 space-y-0.5">
                              {payslip.taxBrackets.map((b) => (
                                <div key={b.bracketIndex} className="flex justify-between">
                                  <span>Bậc {b.bracketIndex} ({b.ratePercent}% × {formatVnd(b.taxableAmount)}):</span>
                                  <span className="tabular-nums font-medium text-slate-800">{formatVnd(b.taxAmount)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="px-3.5 py-2.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-800">Tổng các khoản khấu trừ</span>
                      <span className="font-bold text-sm text-rose-700 tabular-nums">
                        -{formatVnd(totalDeductions)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Tổng Thực lĩnh nổi bật */}
                <div className="rounded-lg bg-teal-700 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-teal-100">
                    Số tiền thực lĩnh (Net Pay)
                  </div>
                  <div className="text-xl font-bold tabular-nums">
                    {formatVnd(payslip.netPay)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
