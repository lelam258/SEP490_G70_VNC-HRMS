import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '../../components/ui/Alert';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Icon from '../../components/ui/Icon';
import { payrollPeriodApi } from '../../services/payrollPeriodApi';
import type { PayrollPeriodDetail, PayslipSummaryItem } from '../../types/payrollPeriod';
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

export default function PayrollPeriodDetailPage() {
  const { month } = useParams<{ month: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<PayrollPeriodDetail | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const filteredPayslips = (detail?.payslips || []).filter((p) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      p.staffName?.toLowerCase().includes(q) ||
      p.staffCode?.toLowerCase().includes(q) ||
      p.departmentName?.toLowerCase().includes(q)
    );
  });

  const columns: Column<PayslipSummaryItem>[] = [
    {
      key: 'staffCode',
      label: 'Mã NV',
      render: (r: PayslipSummaryItem) => <strong>{r.staffCode || '—'}</strong>,
    },
    {
      key: 'staffName',
      label: 'Họ và tên',
      render: (r: PayslipSummaryItem) => <span>{r.staffName || '—'}</span>,
    },
    {
      key: 'departmentName',
      label: 'Khoa/Phòng',
      render: (r: PayslipSummaryItem) => <span>{r.departmentName || '—'}</span>,
    },
    {
      key: 'basePay',
      label: 'Lương cơ bản',
      render: (r: PayslipSummaryItem) => <span>{formatVnd(r.basePay)}</span>,
    },
    {
      key: 'allowanceTotal',
      label: 'Phụ cấp',
      render: (r: PayslipSummaryItem) => <span>{formatVnd(r.allowanceTotal)}</span>,
    },
    {
      key: 'insuranceDeduction',
      label: 'Bảo hiểm',
      render: (r: PayslipSummaryItem) => <span>{formatVnd(r.insuranceDeduction)}</span>,
    },
    {
      key: 'taxDeduction',
      label: 'Thuế TNCN',
      render: (r: PayslipSummaryItem) => <span>{formatVnd(r.taxDeduction)}</span>,
    },
    {
      key: 'netPay',
      label: 'Thực lĩnh',
      render: (r: PayslipSummaryItem) => (
        <strong style={{ color: '#166534' }}>{formatVnd(r.netPay)}</strong>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="panel p-8 text-center">
        <p>Đang tải chi tiết kỳ tính lương...</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="panel space-y-4">
        <Alert variant="error">{error || 'Không tìm thấy kỳ tính lương.'}</Alert>
        <button
          type="button"
          className="button secondary"
          onClick={() => navigate('/payroll/periods')}
        >
          <Icon name="arrow" /> Quay lại danh sách
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Summary Card */}
      <div className="panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              type="button"
              className="button small secondary"
              onClick={() => navigate('/payroll/periods')}
              title="Quay lại"
            >
              <Icon name="arrow" />
            </button>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>
                  Kỳ tính lương {formatMonthDisplay(detail.payMonth)}
                </h1>
                <span className={`badge ${STATUS_BADGES[detail.status] || 'badge-secondary'}`}>
                  {STATUS_LABELS[detail.status] || detail.status}
                </span>
              </div>
              <small style={{ color: 'var(--color-text-muted, #6b7280)' }}>
                Tạo lúc: {formatVietnamDateTime(detail.createdAt)}
                {detail.lockedAt && ` • Đã khóa lúc: ${formatVietnamDateTime(detail.lockedAt)}`}
              </small>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="button primary"
              disabled
              title="Chức năng tính toán bảng lương tự động sẽ hoàn thiện ở FUNC 24"
            >
              <Icon name="sliders" /> Tính lương (FUNC 24)
            </button>
            <button
              type="button"
              className="button secondary"
              disabled
              title="Khóa bảng lương"
            >
              <Icon name="lock" /> Khóa bảng lương
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle, #f9fafb)', borderRadius: '6px', border: '1px solid var(--color-border, #e5e7eb)' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted, #6b7280)', display: 'block' }}>Tổng số nhân sự</span>
            <strong style={{ fontSize: '1.5rem' }}>{detail.employeeCount}</strong>
          </div>
          <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-subtle, #f9fafb)', borderRadius: '6px', border: '1px solid var(--color-border, #e5e7eb)' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted, #6b7280)', display: 'block' }}>Tổng thực lĩnh (SUM NetPay)</span>
            <strong style={{ fontSize: '1.5rem', color: '#166534' }}>{formatVnd(detail.totalNetPay)}</strong>
          </div>
        </div>
      </div>

      {/* Payslips Table */}
      <div className="panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>Danh sách phiếu lương chi tiết</h2>
          <div style={{ width: '280px' }}>
            <input
              type="search"
              className="input"
              placeholder="Tìm theo tên, mã NV, phòng ban..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {detail.payslips.length === 0 ? (
          <div className="empty-state" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <Icon name="file" size={40} />
            <h3 style={{ marginTop: '1rem', fontSize: '1.125rem', fontWeight: 600 }}>Chưa có phiếu lương nào</h3>
            <p style={{ color: 'var(--color-text-muted, #6b7280)', maxWidth: '420px', margin: '0.5rem auto 1rem' }}>
              Kỳ lương này chưa được tính toán. Khi chức năng tính lương (FUNC 24) hoàn thiện, các phiếu lương sẽ hiển thị tại đây.
            </p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={filteredPayslips}
            rowKey={(r) => r.payslipId}
            emptyMessage="Chưa có phiếu lương nào."
          />
        )}
      </div>
    </div>
  );
}
