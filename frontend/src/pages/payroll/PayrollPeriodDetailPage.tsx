import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '../../components/ui/Alert';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import { payrollPeriodApi } from '../../services/payrollPeriodApi';
import type { PayrollPeriodDetail, PayslipSummaryItem } from '../../types/payrollPeriod';
import { formatVnd, todayVn } from '../../utils/format';
import { formatVietnamDateTime } from '../../utils/leaveRules';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Bản nháp',
  pending_approval: 'Chờ duyệt',
  approved: 'Đã duyệt',
  locked: 'Đã khóa',
  finalized: 'Đã chốt',
  exported: 'Đã xuất ngân hàng',
};

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'approved':
    case 'finalized':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200/80';
    case 'pending_approval':
      return 'bg-amber-50 text-amber-700 border border-amber-200/80';
    case 'locked':
      return 'bg-rose-50 text-rose-700 border border-rose-200/80';
    case 'exported':
      return 'bg-sky-50 text-sky-700 border border-sky-200/80';
    case 'draft':
    default:
      return 'bg-slate-100 text-slate-600 border border-slate-200';
  }
}

function formatMonthDisplay(payMonth: string): string {
  const parts = payMonth.split('-');
  return parts.length === 2 ? `Tháng ${parts[1]}/${parts[0]}` : payMonth;
}

export default function PayrollPeriodDetailPage() {
  const { month } = useParams<{ month: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<PayrollPeriodDetail | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipSummaryItem | null>(null);

  const loadDetail = useCallback(async () => {
    if (!month) return;
    setLoading(true);
    setError('');
    try {
      const data = await payrollPeriodApi.getPeriodDetail(month);
      setDetail(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tải được chi tiết kỳ tính lương.');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const filteredPayslips = useMemo(() => {
    if (!detail?.payslips) return [];
    if (!searchTerm.trim()) return detail.payslips;
    const q = searchTerm.trim().toLowerCase();
    return detail.payslips.filter((p) => {
      return (
        p.staffName?.toLowerCase().includes(q) ||
        p.staffCode?.toLowerCase().includes(q) ||
        p.departmentName?.toLowerCase().includes(q)
      );
    });
  }, [detail?.payslips, searchTerm]);

  // Tổng hợp metrics
  const metrics = useMemo(() => {
    if (!detail?.payslips) {
      return { totalGross: 0, totalDeductions: 0, totalNet: detail?.totalNetPay || 0 };
    }
    const totalGross = detail.payslips.reduce((acc, p) => acc + (p.grossPay || 0), 0);
    const totalDeductions = detail.payslips.reduce(
      (acc, p) => acc + (p.insuranceDeduction || 0) + (p.taxDeduction || 0),
      0
    );
    return {
      totalGross,
      totalDeductions,
      totalNet: detail.totalNetPay,
    };
  }, [detail]);

  // Xuất bảng thanh toán lương CSV
  const handleExportCsv = () => {
    if (!filteredPayslips.length || !detail) return;
    const header = [
      'Mã nhân viên',
      'Họ và tên',
      'Khoa phòng',
      'Lương cơ bản (VND)',
      'Phụ cấp (VND)',
      'Tổng thu nhập Gross (VND)',
      'Khấu trừ BHXH (VND)',
      'Thuế TNCN (VND)',
      'Thực lĩnh Net (VND)',
      'Trạng thái',
    ];

    const rows = filteredPayslips.map((p) => [
      `"${p.staffCode || ''}"`,
      `"${p.staffName || ''}"`,
      `"${p.departmentName || ''}"`,
      p.basePay || 0,
      p.allowanceTotal || 0,
      p.grossPay || 0,
      p.insuranceDeduction || 0,
      p.taxDeduction || 0,
      p.netPay || 0,
      STATUS_LABELS[p.status || ''] || p.status || '',
    ]);

    const csvContent = '\uFEFF' + [header.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `BangLuong_${detail.payMonth}_${todayVn()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const columns: Column<PayslipSummaryItem>[] = [
    {
      key: 'staff',
      label: 'Nhân viên & Khoa phòng',
      sortable: true,
      sortValue: (r) => r.staffName || '',
      render: (r: PayslipSummaryItem) => (
        <div>
          <div className="font-semibold text-slate-900 text-sm">{r.staffName || '—'}</div>
          <div className="text-xs text-slate-500">
            <span className="font-mono font-medium text-slate-700">{r.staffCode || '—'}</span>
            {r.departmentName && ` • ${r.departmentName}`}
          </div>
        </div>
      ),
    },
    {
      key: 'basePay',
      label: 'Lương cơ bản',
      sortable: true,
      sortValue: (r) => r.basePay || 0,
      render: (r: PayslipSummaryItem) => (
        <span className="text-sm font-medium text-slate-700">{formatVnd(r.basePay)}</span>
      ),
    },
    {
      key: 'allowanceTotal',
      label: 'Phụ cấp',
      sortable: true,
      sortValue: (r) => r.allowanceTotal || 0,
      render: (r: PayslipSummaryItem) => (
        <span className="text-sm text-slate-700">{formatVnd(r.allowanceTotal)}</span>
      ),
    },
    {
      key: 'grossPay',
      label: 'Tổng Gross',
      sortable: true,
      sortValue: (r) => r.grossPay || 0,
      render: (r: PayslipSummaryItem) => (
        <span className="text-sm font-semibold text-slate-800">{formatVnd(r.grossPay)}</span>
      ),
    },
    {
      key: 'insuranceDeduction',
      label: 'Khấu trừ BHXH',
      sortable: true,
      sortValue: (r) => r.insuranceDeduction || 0,
      render: (r: PayslipSummaryItem) => (
        <span className="text-sm text-slate-600">
          {r.insuranceDeduction > 0 ? formatVnd(r.insuranceDeduction) : <span className="text-slate-400 italic">0 ₫</span>}
        </span>
      ),
    },
    {
      key: 'taxDeduction',
      label: 'Thuế TNCN',
      sortable: true,
      sortValue: (r) => r.taxDeduction || 0,
      render: (r: PayslipSummaryItem) => (
        <span className="text-sm text-slate-600">
          {r.taxDeduction > 0 ? formatVnd(r.taxDeduction) : <span className="text-slate-400 italic">0 ₫</span>}
        </span>
      ),
    },
    {
      key: 'netPay',
      label: 'Thực lĩnh (Net)',
      sortable: true,
      sortValue: (r) => r.netPay || 0,
      render: (r: PayslipSummaryItem) => (
        <strong className="text-sm font-semibold text-emerald-700">{formatVnd(r.netPay)}</strong>
      ),
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (r: PayslipSummaryItem) => (
        <button
          type="button"
          className="button text-button text-xs font-medium text-sky-700 hover:text-sky-800 hover:underline cursor-pointer"
          onClick={() => setSelectedPayslip(r)}
        >
          Phiếu lương
        </button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="panel p-12 text-center text-slate-500">
        <p className="loading-state">Đang tải chi tiết bảng lương kỳ…</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="panel p-6 space-y-4">
        <Alert variant="error">{error || 'Không tìm thấy kỳ tính lương.'}</Alert>
        <button
          type="button"
          className="h-9 px-4 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer"
          onClick={() => navigate('/payroll/periods')}
        >
          <Icon name="arrow" size={14} />
          <span>Quay lại danh sách kỳ lương</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <section className="panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="h-9 w-9 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
              onClick={() => navigate('/payroll/periods')}
              title="Quay lại danh sách"
            >
              <Icon name="arrow" size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 m-0">
                  Kỳ tính lương {formatMonthDisplay(detail.payMonth)}
                </h1>
                <span className={`inline-block text-xs px-2.5 py-0.5 rounded-full font-medium ${getStatusBadgeClass(detail.status)}`}>
                  {STATUS_LABELS[detail.status] || detail.status}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Kỳ: <strong className="text-slate-700 font-mono">{detail.payMonth}</strong> · Tạo lúc: {formatVietnamDateTime(detail.createdAt)}
                {detail.lockedAt && ` · Đã khóa: ${formatVietnamDateTime(detail.lockedAt)}`}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              className="h-9 px-3.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              onClick={handleExportCsv}
              disabled={filteredPayslips.length === 0}
              title="Xuất bảng lương ra tệp CSV (Excel)"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-slate-500">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>Xuất CSV</span>
            </button>

            <button
              type="button"
              className="h-9 w-9 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 shadow-xs flex items-center justify-center transition-colors cursor-pointer"
              title="Làm mới dữ liệu"
              aria-label="Làm mới"
              onClick={() => void loadDetail()}
              disabled={loading}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={`text-slate-500 ${loading ? 'animate-spin' : ''}`}
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
            </button>
          </div>
        </div>

        {/* 4 Thẻ KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Tổng số nhân sự</span>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {detail.employeeCount} <span className="text-xs font-normal text-slate-500">người</span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Tổng thu nhập Gross</span>
            <div className="text-xl font-bold text-slate-800 dark:text-slate-100">
              {formatVnd(metrics.totalGross)}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">Tổng giảm trừ (BHXH + Thuế)</span>
            <div className="text-xl font-bold text-amber-700 dark:text-amber-400">
              {formatVnd(metrics.totalDeductions)}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/60">
            <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300 block mb-1">Tổng thực lĩnh (Net Pay)</span>
            <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
              {formatVnd(metrics.totalNet)}
            </div>
          </div>
        </div>
      </section>

      {/* Payslips Table Card */}
      <section className="panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 m-0">
              Danh sách phiếu lương chi tiết
            </h2>
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-semibold rounded-full bg-sky-50 text-sky-700 border border-sky-200">
              {filteredPayslips.length}
            </span>
          </div>

          {/* Ô tìm kiếm độc lập */}
          <div className="flex items-center gap-1.5 pl-3 pr-2 h-9 w-64 sm:w-72 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 shadow-xs transition-all">
            <span className="shrink-0 text-slate-400 flex items-center pointer-events-none">
              <Icon name="search" size={14} />
            </span>
            <input
              type="text"
              placeholder="Tìm theo tên, mã NV, phòng ban..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: 0, minHeight: 'unset', border: 'none', background: 'transparent' }}
              className="w-full bg-transparent text-xs sm:text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none"
            />
            {searchTerm && (
              <button
                type="button"
                className="shrink-0 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                onClick={() => setSearchTerm('')}
                title="Xóa tìm kiếm"
              >
                <Icon name="close" size={12} />
              </button>
            )}
          </div>
        </div>

        {detail.payslips.length === 0 ? (
          <div className="text-center py-12 px-4 text-slate-500">
            <div className="text-3xl mb-2">📄</div>
            <h3 className="text-base font-semibold text-slate-700 mb-1">Chưa có phiếu lương nào</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Kỳ tính lương này hiện chưa có dữ liệu bảng lương phát sinh.
            </p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={filteredPayslips}
            rowKey={(r) => r.payslipId}
            emptyMessage={
              searchTerm ? 'Không tìm thấy phiếu lương phù hợp với từ khóa.' : 'Chưa có phiếu lương nào.'
            }
          />
        )}
      </section>

      {/* Modal Chi tiết Phiếu lương cá nhân (Payslip Breakdown) */}
      {selectedPayslip && (
        <Modal
          title={`Phiếu lương cá nhân`}
          subtitle={
            <span>
              Nhân viên: <strong className="text-slate-700">{selectedPayslip.staffName}</strong> ({selectedPayslip.staffCode}) · {selectedPayslip.departmentName || 'Chưa phân khoa'} · Kỳ {formatMonthDisplay(detail.payMonth)}
            </span>
          }
          maxWidth="640px"
          onClose={() => setSelectedPayslip(null)}
        >
          <div className="p-5 space-y-4">
            {/* 2 Cột: Thu nhập & Khấu trừ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Cột Thu nhập (+) */}
              <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 space-y-2">
                <h4 className="text-xs font-semibold text-emerald-800 uppercase tracking-wide border-b border-slate-200 pb-1.5 flex items-center justify-between">
                  <span>1. Thu nhập (+):</span>
                  <span className="text-[11px] font-normal text-slate-500">VND</span>
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                    <span className="text-slate-600">Lương cơ bản / ngày công:</span>
                    <strong className="text-slate-800">{formatVnd(selectedPayslip.basePay)}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                    <span className="text-slate-600">Tổng phụ cấp:</span>
                    <strong className="text-slate-800">{formatVnd(selectedPayslip.allowanceTotal)}</strong>
                  </div>
                  <div className="flex justify-between py-1.5 font-semibold text-slate-900 bg-emerald-50/70 px-2 rounded">
                    <span>Tổng thu nhập Gross:</span>
                    <span className="text-emerald-700">{formatVnd(selectedPayslip.grossPay)}</span>
                  </div>
                </div>
              </div>

              {/* Cột Khấu trừ (-) */}
              <div className="border border-slate-200 rounded-lg p-3.5 bg-slate-50/50 space-y-2">
                <h4 className="text-xs font-semibold text-rose-800 uppercase tracking-wide border-b border-slate-200 pb-1.5 flex items-center justify-between">
                  <span>2. Các khoản giảm trừ (-):</span>
                  <span className="text-[11px] font-normal text-slate-500">VND</span>
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                    <span className="text-slate-600">Bảo hiểm (BHXH, BHYT, BHTN):</span>
                    <strong className="text-slate-800">{formatVnd(selectedPayslip.insuranceDeduction)}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                    <span className="text-slate-600">Thuế thu nhập cá nhân (TNCN):</span>
                    <strong className="text-slate-800">{formatVnd(selectedPayslip.taxDeduction)}</strong>
                  </div>
                  <div className="flex justify-between py-1.5 font-semibold text-slate-900 bg-rose-50/70 px-2 rounded">
                    <span>Tổng các khoản trừ:</span>
                    <span className="text-rose-700">
                      {formatVnd(selectedPayslip.insuranceDeduction + selectedPayslip.taxDeduction)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Khối Thực lĩnh Net nổi bật */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-sm flex items-center justify-between">
              <div>
                <span className="text-xs text-emerald-100 font-medium block">THỰC LĨNH CHUYỂN KHOẢN (NET PAY)</span>
                <span className="text-xs opacity-80">Đã trừ các khoản đóng bảo hiểm và thuế TNCN</span>
              </div>
              <div className="text-2xl font-bold tracking-tight">
                {formatVnd(selectedPayslip.netPay)}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                className="h-9 px-4 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium transition-colors cursor-pointer"
                onClick={() => setSelectedPayslip(null)}
              >
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
