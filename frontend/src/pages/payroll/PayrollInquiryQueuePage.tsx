import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '../../components/ui/Alert';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import { payrollInquiryApi } from '../../services/payrollInquiryApi';
import {
  INQUIRY_TYPE_LABELS,
  type InquiryDepartmentOption,
  type PayrollInquiryListItem,
} from '../../types/payrollInquiry';
import { formatVietnamDateTime } from '../../utils/leaveRules';
import {
  formatPayMonthLabel,
  getInquiryStatusBadgeClass,
  getInquiryStatusLabel,
  getInquiryTypeLabel,
} from '../../utils/payrollInquiry';

const STATUS_TABS: Array<{ key: string; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'submitted', label: 'Đã gửi' },
  { key: 'in_review', label: 'Đang xem xét' },
  { key: 'resolved', label: 'Đã giải quyết' },
  { key: 'rejected', label: 'Từ chối' },
];

export default function PayrollInquiryQueuePage() {
  const navigate = useNavigate();

  const [items, setItems] = useState<PayrollInquiryListItem[]>([]);
  const [departments, setDepartments] = useState<InquiryDepartmentOption[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentId, setDepartmentId] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [payMonth, setPayMonth] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await payrollInquiryApi.listQueue({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        departmentId: departmentId || undefined,
        inquiryType: typeFilter !== 'all' ? typeFilter : undefined,
        payMonth: payMonth || undefined,
        search: appliedSearch || undefined,
        page,
        pageSize,
      });
      setItems(res.items);
      setTotal(res.total);
      setStatusCounts(res.statusCounts || {});
      if (res.departments?.length) {
        setDepartments(res.departments);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tải được hàng đợi thắc mắc lương.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, departmentId, typeFilter, payMonth, appliedSearch, page, pageSize]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const isFilterActive = Boolean(
    searchInput.trim() || statusFilter !== 'all' || departmentId || typeFilter !== 'all' || payMonth
  );

  const handleResetFilters = () => {
    setSearchInput('');
    setAppliedSearch('');
    setStatusFilter('all');
    setDepartmentId('');
    setTypeFilter('all');
    setPayMonth('');
    setPage(1);
  };

  const columns: Column<PayrollInquiryListItem>[] = [
    {
      key: 'inquiryCode',
      label: 'Mã & Thời gian chờ',
      render: (row) => (
        <div className="space-y-0.5">
          <div className="font-mono text-xs font-semibold text-teal-700">{row.inquiryCode}</div>
          {(row.status === 'submitted' || row.status === 'in_review') && (
            <div className="text-[11px] text-amber-700 font-medium tabular-nums">
              {row.ageDays === 0 ? 'Gửi hôm nay' : `Chờ ${row.ageDays} ngày`}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'staff',
      label: 'Nhân viên & Khoa',
      render: (row) => (
        <div className="space-y-0.5">
          <div className="text-xs font-semibold text-slate-900">
            {row.staffName}{' '}
            <span className="text-slate-500 font-normal">({row.staffCode})</span>
          </div>
          <div className="text-[11px] text-slate-500">{row.departmentName || 'Chưa phân khoa'}</div>
        </div>
      ),
    },
    {
      key: 'subject',
      label: 'Nội dung thắc mắc',
      render: (row) => (
        <div className="space-y-0.5 max-w-sm">
          <div className="text-xs font-semibold text-slate-900 truncate" title={row.subject}>
            {row.subject}
          </div>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
            <span>{getInquiryTypeLabel(row.inquiryType)}</span>
            {row.missingEvidence && (
              <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200/80 text-[10px] font-medium">
                Thiếu minh chứng
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'payMonth',
      label: 'Kỳ lương',
      render: (row) => (
        <div className="space-y-0.5 whitespace-nowrap">
          <div className="text-xs font-medium text-slate-800">{formatPayMonthLabel(row.payMonth)}</div>
          <div
            className={`text-[10px] font-semibold ${
              row.isPeriodFinalized ? 'text-emerald-700' : 'text-slate-500'
            }`}
          >
            {row.isPeriodFinalized ? 'Đã chốt chính thức' : 'Chưa chốt'}
          </div>
        </div>
      ),
    },
    {
      key: 'submittedAt',
      label: 'Ngày nhận',
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
          className="h-8 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-teal-50 hover:border-teal-300 text-xs font-semibold text-teal-700 cursor-pointer whitespace-nowrap"
          onClick={() => navigate(`/payroll/inquiries/${row.complaintId}`)}
        >
          {row.status === 'submitted' || row.status === 'in_review' ? 'Xem & Xử lý' : 'Xem lại'}
        </button>
      ),
    },
  ];

  return (
    <div className="workspace-list-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight m-0">
          Hàng đợi thắc mắc bảng lương
        </h1>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Tabs trạng thái */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2.5">
        {STATUS_TABS.map((tab) => {
          const active = statusFilter === tab.key;
          const count = statusCounts[tab.key] ?? 0;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setStatusFilter(tab.key);
                setPage(1);
              }}
              className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors border ${
                active
                  ? 'bg-teal-700 text-white border-teal-700'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] tabular-nums ${
                  active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bộ lọc chi tiết gọn 1 hàng trên desktop */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 items-end">
          <div className="sm:col-span-2 lg:col-span-4">
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Tìm kiếm
            </label>
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Mã hồ sơ, mã/tên nhân viên, tiêu đề..."
              className="w-full px-3 rounded-lg border border-slate-300 text-xs focus:outline-none focus:border-teal-600"
              style={{ height: '36px', minHeight: '36px', paddingTop: 0, paddingBottom: 0 }}
            />
          </div>

          <div className="lg:col-span-3">
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Khoa / Phòng ban
            </label>
            <select
              aria-label="Lọc khoa phòng"
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-700"
              style={{ height: '36px', minHeight: '36px', paddingTop: 0, paddingBottom: 0, lineHeight: '34px' }}
            >
              <option value="">Tất cả khoa/phòng</option>
              {departments.map((d) => (
                <option key={d.departmentId} value={d.departmentId}>
                  {d.name}
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
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
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

          <div className="lg:col-span-3 flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-medium text-slate-500 mb-1">
                Tháng lương
              </label>
              <input
                type="month"
                aria-label="Lọc tháng lương"
                value={payMonth}
                onChange={(e) => {
                  setPayMonth(e.target.value);
                  setPage(1);
                }}
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
            rows={items}
            rowKey={(row) => row.complaintId}
            emptyMessage="Không tìm thấy kết quả phù hợp."
            caption="Hàng đợi thắc mắc bảng lương"
          />
        )}
      </div>

      {total > 0 && (
        <Pagination
          total={total}
          page={page}
          pageSize={pageSize}
          pageSizeOptions={[10, 20, 50]}
          label="thắc mắc"
          disabled={loading}
          onPageChange={setPage}
          onPageSizeChange={(next) => {
            setPageSize(next);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}
