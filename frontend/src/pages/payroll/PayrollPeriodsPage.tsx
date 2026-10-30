import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '../../components/ui/Alert';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import { payrollPeriodApi } from '../../services/payrollPeriodApi';
import type { PayrollPeriod } from '../../types/payrollPeriod';
import { formatVnd } from '../../utils/format';
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

  const counts = useMemo(() => {
    return {
      all: periods.length,
      draft: periods.filter(p => p.status === 'draft').length,
      pending_approval: periods.filter(p => p.status === 'pending_approval').length,
      approved: periods.filter(p => p.status === 'approved').length,
      locked: periods.filter(p => p.status === 'locked' || p.status === 'finalized').length,
    };
  }, [periods]);

  const filteredPeriods = useMemo(() => {
    return periods.filter((p) => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'locked') return p.status === 'locked' || p.status === 'finalized';
      return p.status === statusFilter;
    });
  }, [periods, statusFilter]);

  const columns: Column<PayrollPeriod>[] = [
    {
      key: 'payMonth',
      label: 'Kỳ tính lương',
      sortable: true,
      sortValue: (r) => r.payMonth,
      render: (r: PayrollPeriod) => (
        <div>
          <div className="font-semibold text-slate-900 text-sm">{formatMonthDisplay(r.payMonth)}</div>
          <div className="text-xs text-slate-400 font-mono">Kỳ: {r.payMonth}</div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      sortable: true,
      sortValue: (r) => r.status,
      render: (r: PayrollPeriod) => (
        <span className={`inline-block text-[11px] px-2 py-0.5 rounded font-medium ${getStatusBadgeClass(r.status)}`}>
          {STATUS_LABELS[r.status] || r.status}
        </span>
      ),
    },
    {
      key: 'employeeCount',
      label: 'Số nhân viên',
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
      key: 'totalNetPay',
      label: 'Tổng thực lĩnh',
      sortable: true,
      sortValue: (r) => r.totalNetPay,
      render: (r: PayrollPeriod) => (
        <span className="font-semibold text-emerald-700 text-sm">
          {formatVnd(r.totalNetPay)}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Thời gian tạo',
      sortable: true,
      sortValue: (r) => r.createdAt || '',
      render: (r: PayrollPeriod) => (
        <span className="text-xs text-slate-500">{formatVietnamDateTime(r.createdAt)}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (r: PayrollPeriod) => (
        <button
          type="button"
          className="button text-button font-medium text-sky-700 hover:text-sky-800 hover:underline flex items-center gap-1 cursor-pointer"
          onClick={() => navigate(`/payroll/periods/${r.payMonth}`)}
        >
          <span>Bảng lương</span>
          <span aria-hidden="true">→</span>
        </button>
      ),
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
            Quản lý các kỳ tính lương hàng tháng, theo dõi tiến độ phê duyệt, chốt bảng lương và xuất dữ liệu ngân hàng.
          </p>
        </div>
      </div>

      {notice && <Alert variant="success">{notice}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <section className="panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm overflow-hidden">
        {/* Card Header với Quick Filter Tabs 1 chạm */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap xl:flex-nowrap items-center justify-between gap-3">
          {/* Trái: Tiêu đề + Quick Filter Tabs 1 chạm */}
          <div className="flex items-center gap-3.5 flex-wrap">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
              Danh sách kỳ lương
            </h2>

            {/* Quick Filter Tabs Segmented Control */}
            <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 text-xs flex-wrap gap-0.5">
              {[
                { value: 'all', label: 'Tất cả', count: counts.all, color: 'sky' },
                { value: 'draft', label: 'Bản nháp', count: counts.draft, color: 'slate' },
                { value: 'pending_approval', label: 'Chờ duyệt', count: counts.pending_approval, color: 'amber' },
                { value: 'approved', label: 'Đã duyệt', count: counts.approved, color: 'emerald' },
                { value: 'locked', label: 'Đã khóa / Chốt', count: counts.locked, color: 'rose' },
              ].map((tab) => {
                const isActive = statusFilter === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => setStatusFilter(tab.value)}
                    className={`px-2.5 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                      isActive
                        ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-xs font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                        isActive
                          ? 'bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-200'
                          : 'bg-slate-200/80 dark:bg-slate-600/60 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Phải: Nút Tạo kỳ lương & Làm mới */}
          <div className="flex items-center gap-2 shrink-0">
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
              statusFilter !== 'all'
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
          subtitle="Khởi tạo bảng lương tháng cho toàn bộ nhân sự trong hệ thống"
          onClose={() => setCreateModalOpen(false)}
          busy={creating}
          maxWidth="520px"
        >
          <div className="p-5 space-y-4">
            {createError && <Alert variant="error">{createError}</Alert>}

            <form onSubmit={handleCreatePeriod} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="period-month-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
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
                  Mỗi tháng chỉ có 1 kỳ tính lương duy nhất. Kỳ mới tạo sẽ ở trạng thái <strong>Bản nháp</strong>.
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
    </div>
  );
}
