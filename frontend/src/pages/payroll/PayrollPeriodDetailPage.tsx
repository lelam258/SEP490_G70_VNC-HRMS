import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '../../components/ui/Alert';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import { payrollPeriodApi } from '../../services/payrollPeriodApi';
import type { PayrollPeriodDetail, PayslipSummaryItem } from '../../types/payrollPeriod';
import { formatDateOnly, formatVnd, todayVn } from '../../utils/format';

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
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [exceptionFilter, setExceptionFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedPayslip, setSelectedPayslip] = useState<PayslipSummaryItem | null>(null);

  // Modal Mở lại kỳ lương 
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopening, setReopening] = useState(false);
  const [reopenError, setReopenError] = useState('');

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

  const handleReopenPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!month || !reopenReason.trim()) {
      setReopenError('Vui lòng nhập lý do mở lại kỳ tính lương (bắt buộc).');
      return;
    }

    setReopening(true);
    setReopenError('');
    try {
      const updated = await payrollPeriodApi.reopenPeriod(month, {
        reason: reopenReason.trim(),
      });
      setDetail(updated);
      setReopenModalOpen(false);
      setReopenReason('');
      setNotice(
        `Kỳ lương ${formatMonthDisplay(
          month
        )} đã được mở lại thành công về trạng thái Bản nháp (được chuyển về Bản nháp).`
      );
    } catch (err: unknown) {
      setReopenError(err instanceof Error ? err.message : 'Không thể mở lại kỳ tính lương.');
    } finally {
      setReopening(false);
    }
  };

  // Danh sách các phòng ban duy nhất để lọc
  const departments = useMemo(() => {
    if (!detail?.payslips) return [];
    const set = new Set<string>();
    detail.payslips.forEach((p) => {
      if (p.departmentName) set.add(p.departmentName);
    });
    return Array.from(set).sort();
  }, [detail?.payslips]);

  const filteredPayslips = useMemo(() => {
    if (!detail?.payslips) return [];
    return detail.payslips.filter((p) => {
      // Lọc phòng ban
      if (departmentFilter !== 'all' && p.departmentName !== departmentFilter) {
        return false;
      }

      // Lọc ngoại lệ
      if (exceptionFilter === 'no_contract' && p.hasContract) return false;
      if (exceptionFilter === 'unconfirmed_attendance' && p.attendanceConfirmed) return false;
      if (exceptionFilter === 'unconfirmed_procedure' && p.procedureConfirmed) return false;
      if (exceptionFilter === 'has_exception' && p.hasContract && p.attendanceConfirmed && p.procedureConfirmed) {
        return false;
      }

      // Tìm kiếm từ khóa
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        return (
          p.staffName?.toLowerCase().includes(q) ||
          p.staffCode?.toLowerCase().includes(q) ||
          p.departmentName?.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [detail?.payslips, departmentFilter, exceptionFilter, searchTerm]);

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

  // Xuất bảng lương CSV
  const handleExportCsv = () => {
    if (!filteredPayslips.length || !detail) return;
    const header = [
      'Mã nhân viên',
      'Họ và tên',
      'Khoa phòng',
      'Loại HĐ',
      'Ngày công',
      'Ca trực',
      'Lương cơ bản (VND)',
      'Phụ cấp (VND)',
      'Hoa hồng TT (VND)',
      'Tổng Gross (VND)',
      'Giảm trừ BHXH (VND)',
      'Thuế TNCN (VND)',
      'Thực lĩnh Net (VND)',
      'Trạng thái',
    ];

    const rows = filteredPayslips.map((p) => [
      `"${p.staffCode || ''}"`,
      `"${p.staffName || ''}"`,
      `"${p.departmentName || ''}"`,
      `"${p.contractType || ''}"`,
      p.workDays || 0,
      p.onCallDays || 0,
      p.basePay || 0,
      p.allowanceTotal || 0,
      p.commissionTotal || 0,
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

  const isLockedOrFinalized =
    detail?.status === 'locked' || detail?.status === 'finalized' || detail?.status === 'approved';

  const columns: Column<PayslipSummaryItem>[] = [
    {
      key: 'staff',
      label: 'Nhân viên & Khoa phòng',
      sortable: true,
      sortValue: (r) => r.staffName || '',
      render: (r: PayslipSummaryItem) => {
        const hasWarning = !r.hasContract || !r.attendanceConfirmed || !r.procedureConfirmed;
        return (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-900 dark:text-white text-sm">{r.staffName || '—'}</span>
              {hasWarning && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
                  title={
                    !r.hasContract
                      ? 'Chưa có hợp đồng lao động'
                      : !r.attendanceConfirmed
                      ? 'Chưa chốt công'
                      : 'Thủ thuật y tế chờ duyệt'
                  }
                />
              )}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span className="font-mono">{r.staffCode || '—'}</span>
              {r.departmentName && <span>• {r.departmentName}</span>}
              {!r.hasContract && (
                <span className="text-[10px] text-rose-600 bg-rose-50 px-1 py-0.2 rounded border border-rose-200">
                  Thiếu HĐLĐ
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'basePay',
      label: 'Lương cơ bản',
      sortable: true,
      sortValue: (r) => r.basePay || 0,
      render: (r: PayslipSummaryItem) => (
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 tabular-nums">
          {formatVnd(r.basePay || 0)}
        </span>
      ),
    },
    {
      key: 'allowanceTotal',
      label: 'Phụ cấp',
      sortable: true,
      sortValue: (r) => r.allowanceTotal || 0,
      render: (r: PayslipSummaryItem) => (
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 tabular-nums">
          {formatVnd(r.allowanceTotal || 0)}
        </span>
      ),
    },
    {
      key: 'grossPay',
      label: 'Tổng Gross',
      sortable: true,
      sortValue: (r) => r.grossPay || 0,
      render: (r: PayslipSummaryItem) => (
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 tabular-nums">
          {formatVnd(r.grossPay || 0)}
        </span>
      ),
    },
    {
      key: 'insuranceDeduction',
      label: 'Khấu trừ BHXH',
      sortable: true,
      sortValue: (r) => r.insuranceDeduction || 0,
      render: (r: PayslipSummaryItem) => (
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 tabular-nums">
          {formatVnd(r.insuranceDeduction || 0)}
        </span>
      ),
    },
    {
      key: 'taxDeduction',
      label: 'Thuế TNCN',
      sortable: true,
      sortValue: (r) => r.taxDeduction || 0,
      render: (r: PayslipSummaryItem) => (
        <span className="text-sm font-medium text-slate-800 dark:text-slate-200 tabular-nums">
          {formatVnd(r.taxDeduction || 0)}
        </span>
      ),
    },
    {
      key: 'netPay',
      label: 'Thực lĩnh (Net)',
      sortable: true,
      sortValue: (r) => r.netPay || 0,
      render: (r: PayslipSummaryItem) => (
        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
          {formatVnd(r.netPay || 0)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (r: PayslipSummaryItem) => (
        <button
          type="button"
          className="text-xs font-semibold text-sky-700 hover:text-sky-800 hover:underline cursor-pointer flex items-center gap-1"
          onClick={() => setSelectedPayslip(r)}
        >
          <span>Chi tiết</span>
          <span aria-hidden="true">→</span>
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Navigation */}
      <div>
        <button
          type="button"
          className="text-xs font-medium text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer transition-colors"
          onClick={() => navigate('/payroll/periods')}
        >
          <span aria-hidden="true">←</span>
          <span>Quay lại danh sách kỳ lương</span>
        </button>
      </div>

      {notice && <Alert variant="success">{notice}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {/* Page Heading */}
      <div className="page-heading flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="eyebrow">QUẢN LÝ LƯƠNG & ĐÃI NGỘ</span>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <h1>Chi tiết kỳ lương {month ? formatMonthDisplay(month) : ''}</h1>
            {detail && (
              <>
                <span
                  className={`inline-block text-xs px-2.5 py-0.5 rounded-full font-medium ${getStatusBadgeClass(
                    detail.status
                  )}`}
                >
                  {STATUS_LABELS[detail.status] || detail.status}
                </span>

                {detail.isLate && (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300"
                    title="Kỳ lương được đánh dấu Trễ hạn."
                  >
                    Trễ hạn
                  </span>
                )}
              </>
            )}
          </div>
          <p className="muted mt-1">
            Bảng duyệt lương tổng hợp toàn phòng khám, kiểm tra trạng thái chốt công, hoa hồng thủ thuật và
            phát hiện các cảnh báo ngoại lệ nhân sự.
          </p>
        </div>

        {/* Action Button: Mở lại kỳ lương nếu đã khóa */}
        {detail && isLockedOrFinalized && (
          <button
            type="button"
            className="h-9 px-3.5 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
            onClick={() => {
              setReopenError('');
              setReopenReason('');
              setReopenModalOpen(true);
            }}
          >
            <Icon name="refresh" size={13} />
            <span>Mở lại kỳ lương</span>
          </button>
        )}
      </div>

      {/* Read-only notification if locked */}
      {isLockedOrFinalized && (
        <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold uppercase tracking-wider">
              Chế độ chỉ đọc (Read-only):
            </span>
            <span>
              Kỳ lương này đã được khóa/chốt. Dữ liệu bảng lương được bảo toàn để đảm bảo tính bất biến.
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Khóa lúc: {detail?.lockedAt ? formatDateOnly(detail.lockedAt) : 'Đã khóa'}
          </span>
        </div>
      )}

      {/* Readiness & Timeline Cards */}
      {detail && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Bảng công tháng */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-1">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
              1. Bảng chấm công tháng 
            </span>
            <div className="flex items-center gap-2 pt-1">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  detail.attendanceLocked ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span
                className={`text-sm font-semibold ${
                  detail.attendanceLocked ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {detail.attendanceLocked ? 'Đã xác nhận & Khóa công' : 'Chưa chốt công'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {detail.attendanceLocked
                ? 'Dữ liệu chấm công toàn cơ sở đã được HR chốt hợp lệ.'
                : 'Cần HR Staff hoàn thành khóa bảng công trước khi chốt lương.'}
            </p>
          </div>

          {/* Card 2: Xác nhận thủ thuật */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-1">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
              2. Hoa hồng thủ thuật 
            </span>
            <div className="flex items-center gap-2 pt-1">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  detail.proceduresVerified ? 'bg-emerald-500' : 'bg-amber-500'
                }`}
              />
              <span
                className={`text-sm font-semibold ${
                  detail.proceduresVerified ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {detail.proceduresVerified ? 'Đã duyệt toàn bộ thủ thuật' : 'Còn phiếu chưa duyệt'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {detail.proceduresVerified
                ? 'Tất cả phiếu chỉ định/thực hiện/phụ mổ đã kiểm tra.'
                : 'Chỉ các ca thủ thuật đã duyệt mới được tính hoa hồng.'}
            </p>
          </div>

          {/* Card 3: Thời hạn kỳ lương */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-1">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
              3. Thời hạn quy định 
            </span>
            <div className="text-xs space-y-1 pt-1 text-slate-600">
              <div className="flex justify-between">
                <span>Khóa chuẩn :</span>
                <strong className="text-slate-800">{formatDateOnly(detail.standardLockDate)}</strong>
              </div>
              <div className="flex justify-between">
                <span>Hạn điều chỉnh :</span>
                <strong className="text-amber-700">{formatDateOnly(detail.correctionDeadline)}</strong>
              </div>
            </div>
            {detail.reopenReason && (
              <p className="text-[11px] text-amber-700 pt-1 border-t border-slate-100">
                <strong>Lý do mở lại:</strong> {detail.reopenReason}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Financial Metrics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Tổng nhân sự
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{detail?.employeeCount || 0}</span>
            <span className="text-xs text-slate-400">người</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Tổng thu nhập Gross
          </span>
          <div className="mt-1 text-xl font-bold text-slate-900">
            {formatVnd(metrics.totalGross)}
          </div>
        </div>

        <div className="rounded-xl border border-rose-200/80 bg-rose-50/40 p-4 shadow-xs">
          <span className="text-xs font-medium text-rose-700 uppercase tracking-wider block">
            Tổng giảm trừ (BH & Thuế)
          </span>
          <div className="mt-1 text-xl font-bold text-rose-800">
            {formatVnd(metrics.totalDeductions)}
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-xs">
          <span className="text-xs font-medium text-emerald-700 uppercase tracking-wider block">
            Tổng thực lĩnh Net Pay
          </span>
          <div className="mt-1 text-xl font-bold text-emerald-800">
            {formatVnd(metrics.totalNet)}
          </div>
        </div>
      </div>

      {/* Main Staff Payslips Table */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        {/* Table Filters & Search - Thanh công cụ lọc gọn gàng, tinh tế, không bị vỡ dòng */}
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input */}
            <div className="flex items-center gap-2 pl-3 pr-2 h-9 w-52 sm:w-64 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 shadow-xs transition-all">
              <span className="shrink-0 text-slate-400 flex items-center pointer-events-none">
                <Icon name="search" size={14} />
              </span>
              <input
                type="text"
                placeholder="Tìm tên, mã nhân viên..."
                className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                style={{ padding: 0, minHeight: 'unset', border: 'none', background: 'transparent' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors cursor-pointer"
                  onClick={() => setSearchTerm('')}
                  title="Xóa tìm kiếm"
                >
                  <Icon name="close" size={12} />
                </button>
              )}
            </div>

            {/* Department Filter - w-auto không bị kéo dãn 100% */}
            <select
              className="h-9 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer shadow-xs transition-colors"
              style={{ width: 'auto', minWidth: '160px', height: '36px', minHeight: 'unset', padding: '0 28px 0 10px' }}
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="all">Tất cả khoa phòng</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            {/* Exception Filter - w-auto không bị kéo dãn 100% */}
            <select
              className="h-9 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer shadow-xs transition-colors"
              style={{ width: 'auto', minWidth: '150px', height: '36px', minHeight: 'unset', padding: '0 28px 0 10px' }}
              value={exceptionFilter}
              onChange={(e) => setExceptionFilter(e.target.value)}
            >
              <option value="all">Tất cả nhân sự</option>
              <option value="has_exception">Có cảnh báo ngoại lệ</option>
              <option value="no_contract">Thiếu HĐLĐ</option>
              <option value="unconfirmed_attendance">Chưa chốt công</option>
              <option value="unconfirmed_procedure">Chưa duyệt thủ thuật</option>
            </select>

            {/* Nút đặt lại bộ lọc nếu đang lọc */}
            {(searchTerm || departmentFilter !== 'all' || exceptionFilter !== 'all') && (
              <button
                type="button"
                className="h-9 px-2.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1"
                onClick={() => {
                  setSearchTerm('');
                  setDepartmentFilter('all');
                  setExceptionFilter('all');
                }}
                title="Đặt lại bộ lọc về mặc định"
              >
                <Icon name="refresh" size={12} />
                <span>Đặt lại lọc</span>
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-9 px-3.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 shadow-xs transition-colors text-xs font-medium whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
              onClick={handleExportCsv}
              disabled={!filteredPayslips.length}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              <span>Xuất CSV</span>
            </button>

            <button
              type="button"
              className="h-9 w-9 shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 shadow-xs flex items-center justify-center transition-colors cursor-pointer"
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
                className={`text-slate-500 dark:text-slate-400 ${loading ? 'animate-spin' : ''}`}
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </button>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="p-8 text-center text-slate-500">
            <p className="loading-state">Đang tải chi tiết bảng lương…</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={filteredPayslips}
            rowKey={(r) => r.payslipId}
            emptyMessage={
              searchTerm || departmentFilter !== 'all' || exceptionFilter !== 'all'
                ? 'Không có nhân sự nào phù hợp với bộ lọc.'
                : 'Kỳ tính lương này chưa có dữ liệu phiếu lương.'
            }
          />
        )}
      </section>

      {/* Modal Drill-down: Chi tiết phiếu lương cá nhân (Read-only) */}
      {selectedPayslip && detail && (
        <Modal
          title="Chi tiết phiếu lương nhân viên"
          subtitle={
            <span>
              Nhân viên: <strong className="text-slate-800">{selectedPayslip.staffName}</strong> (
              {selectedPayslip.staffCode}) · {selectedPayslip.departmentName || 'Chưa phân khoa'} · Kỳ{' '}
              {formatMonthDisplay(detail.payMonth)}
            </span>
          }
          maxWidth="640px"
          onClose={() => setSelectedPayslip(null)}
        >
          <div className="p-5 space-y-4">
            {/* Cảnh báo ngoại lệ nếu có */}
            {(!selectedPayslip.hasContract ||
              !selectedPayslip.attendanceConfirmed ||
              !selectedPayslip.procedureConfirmed) && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <div className="font-semibold text-amber-800">Cảnh báo tính lương nhân sự:</div>
                <ul className="list-disc list-inside text-amber-800/90 space-y-0.5">
                  {!selectedPayslip.hasContract && (
                    <li>Nhân sự chưa có hợp đồng lao động hiệu lực.</li>
                  )}
                  {!selectedPayslip.attendanceConfirmed && (
                    <li>Bảng chấm công tháng chưa được chốt xác nhận.</li>
                  )}
                  {!selectedPayslip.procedureConfirmed && (
                    <li>Phiếu thủ thuật y tế phát sinh trong tháng chưa được duyệt hết.</li>
                  )}
                </ul>
              </div>
            )}

            {/* Khối Thông tin công tác & Loại HĐ */}
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs grid grid-cols-2 md:grid-cols-3 gap-2">
              <div>
                <span className="text-slate-500 block">Loại hợp đồng:</span>
                <strong className="text-slate-800">
                  {selectedPayslip.contractType || 'Chưa thiết lập'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Ngày công tính lương:</span>
                <strong className="text-slate-800">{selectedPayslip.workDays || 0} công</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Số ca trực xác nhận:</span>
                <strong className="text-slate-800">{selectedPayslip.onCallDays || 0} ca</strong>
              </div>
            </div>

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
                  <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                    <span className="text-slate-600">Hoa hồng thủ thuật:</span>
                    <strong className="text-slate-800">
                      {formatVnd(selectedPayslip.commissionTotal)}
                    </strong>
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
                    <strong className="text-slate-800">
                      {formatVnd(selectedPayslip.insuranceDeduction)}
                    </strong>
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
                <span className="text-xs text-emerald-100 font-medium block">
                  THỰC LĨNH CHUYỂN KHOẢN (NET PAY)
                </span>
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

      {/* Modal Mở lại kỳ lương  */}
      {reopenModalOpen && (
        <Modal
          title={`Mở lại kỳ tính lương ${formatMonthDisplay(month || '')}`}
          subtitle="Quy trình hiệu chỉnh kỳ tính lương đã khóa"
          onClose={() => {
            if (!reopening) {
              setReopenModalOpen(false);
              setReopenReason('');
              setReopenError('');
            }
          }}
          busy={reopening}
          maxWidth="520px"
        >
          <div className="p-5 space-y-4">
            {reopenError && <Alert variant="error">{reopenError}</Alert>}

            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
              <div className="font-semibold flex items-center gap-1.5 text-amber-800">
                <span>Lưu ý khi mở lại kỳ lương:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-amber-800/90">
                <li>
                  Kỳ lương sẽ được chuyển về trạng thái <strong>Bản nháp</strong> để hiệu chỉnh và tính
                  toán lại.
                </li>
                <li>
                  Hệ thống sẽ gắn cờ <strong>Trễ hạn (Late)</strong> và ghi nhật ký kiểm toán (Audit Log)
                  người thực hiện và lý do.
                </li>
                <li>
                  Toàn bộ quá trình hiệu chỉnh và chốt lại phải hoàn thành trước{' '}
                  <strong>{detail ? formatDateOnly(detail.correctionDeadline) : 'ngày 12'}</strong>.
                </li>
              </ul>
            </div>

            <form onSubmit={handleReopenPeriod} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="reopen-reason-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  Lý do mở lại kỳ tính lương <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="reopen-reason-input"
                  rows={3}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none"
                  placeholder="Nhập chi tiết lý do cần mở lại kỳ lương (vd: Bổ sung ca trực xác nhận thiếu, điều chỉnh mức phụ cấp theo quyết định mới)..."
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  disabled={reopening}
                  maxLength={500}
                  required
                />
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Bắt buộc</span>
                  <span>{reopenReason.length}/500</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  className="h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium transition-colors cursor-pointer"
                  onClick={() => {
                    setReopenModalOpen(false);
                    setReopenReason('');
                    setReopenError('');
                  }}
                  disabled={reopening}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  disabled={reopening || !reopenReason.trim()}
                >
                  {reopening ? 'Đang xử lý…' : 'Xác nhận mở lại kỳ lương'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
