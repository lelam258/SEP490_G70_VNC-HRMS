import { useCallback, useEffect, useState } from 'react';
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
  exported: 'Đã xuất',
};

const STATUS_BADGES: Record<string, string> = {
  draft: 'badge-secondary',
  pending_approval: 'badge-warning',
  approved: 'badge-success',
  locked: 'badge-danger',
  finalized: 'badge-primary',
  exported: 'badge-info',
};

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

  // Create Modal
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

  const filteredPeriods = periods.filter((p) => {
    if (statusFilter === 'all') return true;
    return p.status === statusFilter;
  });

  const columns: Column<PayrollPeriod>[] = [
    {
      key: 'payMonth',
      label: 'Kỳ lương',
      render: (r: PayrollPeriod) => (
        <div>
          <strong>{formatMonthDisplay(r.payMonth)}</strong>
          <small style={{ color: 'var(--color-text-muted, #6b7280)', display: 'block' }}>{r.payMonth}</small>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (r: PayrollPeriod) => (
        <span className={`badge ${STATUS_BADGES[r.status] || 'badge-secondary'}`}>
          {STATUS_LABELS[r.status] || r.status}
        </span>
      ),
    },
    {
      key: 'employeeCount',
      label: 'Số nhân viên',
      render: (r: PayrollPeriod) => <span>{r.employeeCount} nhân sự</span>,
    },
    {
      key: 'totalNetPay',
      label: 'Tổng thực lĩnh (SUM NetPay)',
      render: (r: PayrollPeriod) => <strong>{formatVnd(r.totalNetPay)}</strong>,
    },
    {
      key: 'createdAt',
      label: 'Ngày tạo (VN)',
      render: (r: PayrollPeriod) => <span>{formatVietnamDateTime(r.createdAt)}</span>,
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (r: PayrollPeriod) => (
        <button
          type="button"
          className="button small secondary"
          onClick={() => navigate(`/payroll/periods/${r.payMonth}`)}
        >
          Chi tiết
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {notice && <Alert variant="success">{notice}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <div className="panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Danh sách kỳ tính lương</h1>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted, #6b7280)' }}>
              Quản lý các kỳ tính lương hàng tháng, xem tổng hợp và xuất dữ liệu ngân hàng
            </p>
          </div>

          <button
            type="button"
            className="button primary"
            onClick={() => {
              setCreateError('');
              setCreateModalOpen(true);
            }}
          >
            <Icon name="plus" /> Tạo kỳ tính lương
          </button>
        </div>

        {/* Status filter tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {[
            { value: 'all', label: 'Tất cả' },
            { value: 'draft', label: 'Bản nháp' },
            { value: 'pending_approval', label: 'Chờ duyệt' },
            { value: 'approved', label: 'Đã duyệt' },
            { value: 'locked', label: 'Đã khóa' },
            { value: 'finalized', label: 'Đã chốt' },
          ].map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={`button small ${statusFilter === tab.value ? 'primary' : 'secondary'}`}
              onClick={() => setStatusFilter(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-8 text-center"><p>Đang tải danh sách kỳ tính lương...</p></div>
        ) : (
          <DataTable
            columns={columns}
            rows={filteredPeriods}
            rowKey={(r) => r.lockId}
            emptyMessage="Chưa có kỳ tính lương nào phù hợp."
          />
        )}
      </div>

      {/* Create Modal */}
      {createModalOpen && (
        <Modal
          title="Tạo kỳ tính lương mới"
          onClose={() => setCreateModalOpen(false)}
          busy={creating}
        >
          <div style={{ padding: '1rem 1.5rem' }}>
            {createError && <Alert variant="error">{createError}</Alert>}
            <form onSubmit={handleCreatePeriod} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="field">
                <label htmlFor="period-month-input" style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                  Chọn tháng lương <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  id="period-month-input"
                  type="month"
                  className="input"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  disabled={creating}
                  required
                />
                <small style={{ color: 'var(--color-text-muted, #6b7280)', marginTop: '0.25rem', display: 'block' }}>
                  Mỗi tháng chỉ có 1 kỳ tính lương duy nhất. Kỳ mới tạo sẽ ở trạng thái Bản nháp.
                </small>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={creating}
                >
                  Hủy
                </button>
                <button type="submit" className="button primary" disabled={creating || !selectedMonth}>
                  {creating ? 'Đang tạo...' : 'Tạo kỳ lương'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
