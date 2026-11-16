import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '../../components/ui/Alert';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import { payrollPeriodApi } from '../../services/payrollPeriodApi';
import type { PayrollPeriod } from '../../types/payrollPeriod';
import { formatDateOnly, formatVnd } from '../../utils/format';
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

export default function PayrollPeriodsPage() {
  const navigate = useNavigate();

  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Modal Tạo kỳ lương 
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Modal Mở lại kỳ lương 
  const [reopenTarget, setReopenTarget] = useState<PayrollPeriod | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [reopening, setReopening] = useState(false);
  const [reopenError, setReopenError] = useState('');

  const loadPeriods = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await payrollPeriodApi.listPeriods();
      setPeriods(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách kỳ tính lương.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPeriods();
  }, [loadPeriods]);

  const handleCreatePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMonth) return;

    setCreating(true);
    setCreateError('');
    try {
      const created = await payrollPeriodApi.createPeriod({ payMonth: selectedMonth });
      setCreateModalOpen(false);
      setNotice(`Tạo thành công kỳ tính lương ${formatMonthDisplay(created.payMonth)}.`);
      navigate(`/payroll/periods/${created.payMonth}`);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Không thể tạo kỳ tính lương.');
    } finally {
      setCreating(false);
    }
  };

  const handleReopenPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reopenTarget) return;
    if (!reopenReason.trim()) {
      setReopenError('Vui lòng nhập lý do mở lại kỳ tính lương (bắt buộc).');
      return;
    }

    setReopening(true);
    setReopenError('');
    try {
      await payrollPeriodApi.reopenPeriod(reopenTarget.payMonth, {
        reason: reopenReason.trim(),
      });
      setReopenTarget(null);
      setReopenReason('');
      setNotice(
        `Đã mở lại kỳ tính lương ${formatMonthDisplay(
          reopenTarget.payMonth
        )}. Kỳ lương được chuyển về Bản nháp và đánh dấu Trễ hạn (Late). Vui lòng hoàn thành điều chỉnh và khóa lại trước hạn chót.`
      );
      await loadPeriods();
    } catch (err: unknown) {
      setReopenError(err instanceof Error ? err.message : 'Không thể mở lại kỳ tính lương.');
    } finally {
      setReopening(false);
    }
  };

  const counts = useMemo(() => {
    return {
      all: periods.length,
      draft: periods.filter((p) => p.status === 'draft').length,
      pending_approval: periods.filter((p) => p.status === 'pending_approval').length,
      approved: periods.filter((p) => p.status === 'approved').length,
      locked: periods.filter((p) => p.status === 'locked' || p.status === 'finalized').length,
      late: periods.filter((p) => p.isLate).length,
    };
  }, [periods]);

  const filteredPeriods = useMemo(() => {
    return periods.filter((p) => {
      // Lọc trạng thái
      if (statusFilter === 'locked') {
        if (p.status !== 'locked' && p.status !== 'finalized') return false;
      } else if (statusFilter === 'late') {
        if (!p.isLate) return false;
      } else if (statusFilter !== 'all') {
        if (p.status !== statusFilter) return false;
      }

      // Lọc tìm kiếm theo tháng
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const display = formatMonthDisplay(p.payMonth).toLowerCase();
        if (!p.payMonth.toLowerCase().includes(q) && !display.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [periods, statusFilter, searchTerm]);

  const columns: Column<PayrollPeriod>[] = [
    {
      key: 'payMonth',
      label: 'Kỳ tính lương',
      sortable: true,
      sortValue: (r) => r.payMonth,
      render: (r: PayrollPeriod) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 text-sm">
              {formatMonthDisplay(r.payMonth)}
            </span>
            {r.isLate && (
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300"
                title="Kỳ lương được đánh dấu Trễ hạn. Cần hoàn tất điều chỉnh trước ngày 12."
              >
                Trễ hạn
              </span>
            )}
          </div>
          <div className="text-xs text-slate-400 font-mono">Mã kỳ: {r.payMonth}</div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      sortable: true,
      sortValue: (r) => r.status,
      render: (r: PayrollPeriod) => (
        <span
          className={`inline-block text-[11px] px-2.5 py-0.5 rounded-full font-medium ${getStatusBadgeClass(
            r.status
          )}`}
        >
          {STATUS_LABELS[r.status] || r.status}
        </span>
      ),
    },
    {
      key: 'readiness',
      label: 'Tiến độ sẵn sàng',
      render: (r: PayrollPeriod) => (
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                r.attendanceLocked ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span className={r.attendanceLocked ? 'text-slate-700' : 'text-amber-700 font-medium'}>
              {r.attendanceLocked ? 'Đã chốt công' : 'Chưa chốt công'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                r.proceduresVerified ? 'bg-emerald-500' : 'bg-amber-500'
              }`}
            />
            <span className={r.proceduresVerified ? 'text-slate-700' : 'text-amber-700 font-medium'}>
              {r.proceduresVerified ? 'Đã duyệt thủ thuật' : 'Chưa duyệt hết TT'}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'employeeCount',
      label: 'Nhân sự',
      sortable: true,
      sortValue: (r) => r.employeeCount,
      render: (r: PayrollPeriod) => (
        <div>
          <strong className="text-slate-800">{r.employeeCount}</strong>{' '}
          <span className="text-xs text-slate-500">nhân sự</span>
        </div>
      ),
    },
    {
      key: 'totalGrossPay',
      label: 'Tổng Gross',
      sortable: true,
      sortValue: (r) => r.totalGrossPay,
      render: (r: PayrollPeriod) => (
        <span className="font-medium text-slate-800 text-sm">{formatVnd(r.totalGrossPay)}</span>
      ),
    },
    {
      key: 'totalNetPay',
      label: 'Tổng thực lĩnh',
      sortable: true,
      sortValue: (r) => r.totalNetPay,
      render: (r: PayrollPeriod) => (
        <span className="font-semibold text-emerald-700 text-sm">{formatVnd(r.totalNetPay)}</span>
      ),
    },
    {
      key: 'timeline',
      label: 'Thời hạn',
      render: (r: PayrollPeriod) => (
        <div className="text-[11px] text-slate-500 space-y-0.5">
          <div>
            Khóa chuẩn: <strong className="text-slate-700">{formatDateOnly(r.standardLockDate)}</strong>
          </div>
          <div>
            Hạn sửa: <span className="text-slate-600">{formatDateOnly(r.correctionDeadline)}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (r: PayrollPeriod) => {
        const canReopen =
          r.status === 'locked' || r.status === 'approved' || r.status === 'finalized';
        return (
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="text-xs font-semibold text-sky-700 hover:text-sky-800 hover:underline flex items-center gap-1 cursor-pointer"
              onClick={() => navigate(`/payroll/periods/${r.payMonth}`)}
            >
              <span>Xem chi tiết</span>
              <span aria-hidden="true">→</span>
            </button>

            {canReopen && (
              <button
                type="button"
                className="text-[11px] font-medium text-amber-700 hover:text-amber-800 hover:underline cursor-pointer border border-amber-300 bg-amber-50 px-2 py-0.5 rounded"
                title="Mở lại kỳ lương để hiệu chỉnh"
                onClick={() => {
                  setReopenError('');
                  setReopenReason('');
                  setReopenTarget(r);
                }}
              >
                Mở lại
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <span className="eyebrow">QUẢN LÝ LƯƠNG & ĐÃI NGỘ</span>
          <h1>Kỳ tính lương</h1>
          <p className="muted">
            Quản lý danh sách các kỳ tính lương hàng tháng, theo dõi tiến độ chốt công, xác nhận thủ thuật,
            và kiểm soát thời hạn khóa/mở lại kỳ lương theo quy định.
          </p>
        </div>
      </div>

      {notice && <Alert variant="success">{notice}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
            Tổng số kỳ lương
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{counts.all}</span>
            <span className="text-xs text-slate-400">kỳ</span>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-xs">
          <span className="text-xs font-medium text-amber-700 uppercase tracking-wider block">
            Bản nháp / Đang xử lý
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-800">
              {counts.draft + counts.pending_approval}
            </span>
            <span className="text-xs text-amber-600">kỳ đang mở</span>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-xs">
          <span className="text-xs font-medium text-emerald-700 uppercase tracking-wider block">
            Đã khóa / Đã chốt
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-800">{counts.locked + counts.approved}</span>
            <span className="text-xs text-emerald-600">kỳ hoàn tất</span>
          </div>
        </div>

        <div className="rounded-xl border border-rose-200/80 bg-rose-50/40 p-4 shadow-xs">
          <span className="text-xs font-medium text-rose-700 uppercase tracking-wider block">
            Kỳ có cờ trễ hạn (Late)
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-800">{counts.late}</span>
            <span className="text-xs text-rose-600">kỳ mở lại</span>
          </div>
        </div>
      </div>

      {/* Main Section */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        {/* Filter and Action Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Tabs Trạng thái */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'all', label: 'Tất cả', count: counts.all },
              { id: 'draft', label: 'Bản nháp', count: counts.draft },
              { id: 'pending_approval', label: 'Chờ duyệt', count: counts.pending_approval },
              { id: 'approved', label: 'Đã duyệt', count: counts.approved },
              { id: 'locked', label: 'Đã khóa / Chốt', count: counts.locked },
              { id: 'late', label: 'Trễ hạn', count: counts.late },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === tab.id
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                onClick={() => setStatusFilter(tab.id)}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    statusFilter === tab.id
                      ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search + Action Buttons */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 pl-3 pr-2 h-9 w-52 sm:w-60 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 shadow-xs transition-all">
              <span className="shrink-0 text-slate-400 flex items-center pointer-events-none">
                <Icon name="search" size={14} />
              </span>
              <input
                type="text"
                placeholder="Tìm theo tháng (YYYY-MM)..."
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

            <button
              type="button"
              className="h-9 px-3.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-colors text-xs font-medium whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
              onClick={() => {
                setCreateError('');
                setCreateModalOpen(true);
              }}
            >
              <Icon name="plus" size={14} />
              <span>Tạo kỳ tính lương</span>
            </button>

            <button
              type="button"
              className="h-9 w-9 shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 shadow-xs flex items-center justify-center transition-colors cursor-pointer"
              title="Làm mới dữ liệu"
              aria-label="Làm mới"
              onClick={() => void loadPeriods()}
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

        {loading ? (
          <div className="p-8 text-center text-slate-500">
            <p className="loading-state">Đang tải danh sách kỳ tính lương…</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={filteredPeriods}
            rowKey={(r) => r.lockId}
            emptyMessage={
              statusFilter !== 'all' || searchTerm
                ? 'Không có kỳ tính lương nào phù hợp với bộ lọc.'
                : 'Chưa có kỳ tính lương nào.'
            }
          />
        )}
      </section>

      {/* Modal Tạo kỳ tính lương */}
      {createModalOpen && (
        <Modal
          title="Tạo kỳ tính lương mới"
          subtitle="Khởi tạo bảng lương tháng cho toàn bộ nhân sự theo chu kỳ hàng tháng"
          onClose={() => setCreateModalOpen(false)}
          busy={creating}
          maxWidth="500px"
        >
          <div className="p-5 space-y-4">
            {createError && <Alert variant="error">{createError}</Alert>}

            <form onSubmit={handleCreatePeriod} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="period-month-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  Chọn tháng lương <span className="text-rose-500">*</span>
                </label>
                <input
                  id="period-month-input"
                  type="month"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  disabled={creating}
                  required
                />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Mỗi tháng (YYYY-MM) chỉ tạo duy nhất 1 kỳ tính lương. Kỳ mới tạo
                  sẽ ở trạng thái <strong>Bản nháp</strong>.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  className="h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium transition-colors cursor-pointer"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={creating}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  disabled={creating || !selectedMonth}
                >
                  {creating ? 'Đang tạo…' : 'Tạo kỳ lương'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Modal Mở lại kỳ lương */}
      {reopenTarget && (
        <Modal
          title={`Mở lại kỳ tính lương ${formatMonthDisplay(reopenTarget.payMonth)}`}
          subtitle="Quy trình hiệu chỉnh kỳ tính lương đã khóa"
          onClose={() => {
            if (!reopening) {
              setReopenTarget(null);
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
                  <strong>{formatDateOnly(reopenTarget.correctionDeadline)}</strong> (hết ngày 12).
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
                    setReopenTarget(null);
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
