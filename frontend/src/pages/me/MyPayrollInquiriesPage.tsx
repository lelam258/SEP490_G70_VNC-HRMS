import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Alert from '../../components/ui/Alert';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Icon from '../../components/ui/Icon';
import { payrollInquiryApi } from '../../services/payrollInquiryApi';
import {
  INQUIRY_STATUS_LABELS,
  INQUIRY_TYPE_LABELS,
  type PayrollInquiryListItem,
} from '../../types/payrollInquiry';
import { formatVietnamDateTime } from '../../utils/leaveRules';
import {
  formatPayMonthLabel,
  getInquiryStatusBadgeClass,
  getInquiryStatusLabel,
  getInquiryTypeLabel,
} from '../../utils/payrollInquiry';

export default function MyPayrollInquiriesPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [inquiries, setInquiries] = useState<PayrollInquiryListItem[]>([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<string>(
    (location.state as { notice?: string } | null)?.notice || ''
  );

  const loadInquiries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await payrollInquiryApi.listMyInquiries({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        inquiryType: typeFilter !== 'all' ? typeFilter : undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setInquiries(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách thắc mắc lương.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, fromDate, toDate]);

  useEffect(() => {
    void loadInquiries();
  }, [loadInquiries]);

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return inquiries;
    return inquiries.filter(
      (item) =>
        item.inquiryCode.toLowerCase().includes(q) ||
        item.subject.toLowerCase().includes(q) ||
        (item.payMonth || '').toLowerCase().includes(q) ||
        (item.responsePreview || '').toLowerCase().includes(q)
    );
  }, [inquiries, searchTerm]);

  const isFilterActive = Boolean(
    searchTerm.trim() || statusFilter !== 'all' || typeFilter !== 'all' || fromDate || toDate
  );

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTypeFilter('all');
    setFromDate('');
    setToDate('');
  };

  const columns: Column<PayrollInquiryListItem>[] = [
    {
      key: 'inquiryCode',
      label: 'Mã hồ sơ',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-teal-700">{row.inquiryCode}</span>
      ),
    },
    {
      key: 'subject',
      label: 'Tiêu đề & Phản hồi',
      render: (row) => (
        <div className="space-y-0.5 max-w-md">
          <div className="font-semibold text-slate-900 text-xs sm:text-sm truncate" title={row.subject}>
            {row.subject}
          </div>
          {row.responsePreview && (
            <div className="text-[11px] text-slate-500 truncate" title={row.responsePreview}>
              Phản hồi: {row.responsePreview}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'inquiryType',
      label: 'Phân loại',
      render: (row) => (
        <span className="text-xs text-slate-700">{getInquiryTypeLabel(row.inquiryType)}</span>
      ),
    },
    {
      key: 'payMonth',
      label: 'Kỳ lương',
      render: (row) => (
        <span className="text-xs font-medium text-slate-800 whitespace-nowrap">
          {formatPayMonthLabel(row.payMonth)}
        </span>
      ),
    },
    {
      key: 'submittedAt',
      label: 'Ngày gửi',
      render: (row) => (
        <span className="text-xs text-slate-600 tabular-nums whitespace-nowrap">
          {formatVietnamDateTime(row.submittedAt)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => (
        <span
          className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${getInquiryStatusBadgeClass(row.status)}`}
        >
          {getInquiryStatusLabel(row.status)}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Thao tác',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (row) => (
        <button
          type="button"
          className="h-8 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-teal-700 cursor-pointer"
          onClick={() => navigate(`/me/payroll-inquiries/${row.complaintId}`)}
        >
          Chi tiết
        </button>
      ),
    },
  ];

  return (
    <div className="workspace-list-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight m-0">
          Thắc mắc bảng lương của tôi
        </h1>
        <Link
          to="/me/payroll-inquiries/new"
          className="h-9 px-3.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs no-underline"
        >
          <Icon name="plus" size={14} />
          <span>Gửi thắc mắc mới</span>
        </Link>
      </div>

      {notice && (
        <Alert variant="success">
          <div className="flex items-center justify-between gap-3 w-full">
            <span>{notice}</span>
            <button
              type="button"
              className="text-xs underline bg-transparent border-0 cursor-pointer text-current"
              onClick={() => setNotice('')}
            >
              Đóng
            </button>
          </div>
        </Alert>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {/* Thanh tìm kiếm & lọc gọn 1 hàng trên desktop */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-end">
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Tìm kiếm
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Mã hồ sơ, tiêu đề, kỳ lương..."
              className="w-full px-3 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-teal-600"
              style={{ height: '36px', minHeight: '36px', paddingTop: 0, paddingBottom: 0 }}
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Trạng thái
            </label>
            <select
              aria-label="Lọc trạng thái"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-2.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-700"
              style={{ height: '36px', minHeight: '36px', paddingTop: 0, paddingBottom: 0, lineHeight: '34px' }}
            >
              <option value="all">Tất cả trạng thái</option>
              {Object.entries(INQUIRY_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Phân loại
            </label>
            <select
              aria-label="Lọc phân loại"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-2.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-700"
              style={{ height: '36px', minHeight: '36px', paddingTop: 0, paddingBottom: 0, lineHeight: '34px' }}
            >
              <option value="all">Tất cả phân loại</option>
              {Object.entries(INQUIRY_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Từ ngày
            </label>
            <input
              type="date"
              aria-label="Từ ngày"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-2.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-700"
              style={{ height: '36px', minHeight: '36px', paddingTop: 0, paddingBottom: 0 }}
            />
          </div>

          <div className="lg:col-span-2 flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Đến ngày
              </label>
              <input
                type="date"
                aria-label="Đến ngày"
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-2.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-700"
                style={{ height: '36px', minHeight: '36px', paddingTop: 0, paddingBottom: 0 }}
              />
            </div>

            {isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                title="Đặt lại bộ lọc"
                className="shrink-0 px-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-600 cursor-pointer"
                style={{ height: '36px' }}
              >
                Đặt lại
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="panel bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-2.5 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-slate-100 rounded" />
            ))}
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={filteredItems}
            rowKey={(row) => row.complaintId}
            emptyMessage="Không tìm thấy kết quả phù hợp."
            caption="Danh sách thắc mắc bảng lương của tôi"
          />
        )}
      </div>
    </div>
  );
}
