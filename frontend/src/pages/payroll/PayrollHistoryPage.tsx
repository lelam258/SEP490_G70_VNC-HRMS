import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../../components/ui/Alert';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import { payrollHistoryApi } from '../../services/payrollHistoryApi';
import { useAuthStore } from '../../store/useAuthStore';
import type {
  PayrollHistoryDepartmentOption,
  PayrollHistoryDetail,
  PayrollHistoryItem,
} from '../../types/payrollHistory';
import { formatVnd } from '../../utils/format';
import { formatVietnamDateTime } from '../../utils/leaveRules';

const STATUS_LABELS: Record<string, string> = {
  all: 'Tất cả trạng thái',
  finalized: 'Đã chốt',
  locked: 'Đã khóa',
  approved: 'Đã xác nhận',
  pending_approval: 'Chờ duyệt',
  draft: 'Bản nháp',
  open: 'Đang mở',
};

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'finalized':
    case 'approved':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200/80';
    case 'locked':
      return 'bg-rose-50 text-rose-700 border border-rose-200/80';
    case 'pending_approval':
      return 'bg-amber-50 text-amber-700 border border-amber-200/80';
    default:
      return 'bg-slate-100 text-slate-600 border border-slate-200';
  }
}

function getEventDotClass(action: string): string {
  switch (action.toLowerCase()) {
    case 'finalize':
    case 'confirm':
      return 'bg-emerald-500 ring-emerald-100';
    case 'calculate':
    case 'review_all_valid':
      return 'bg-teal-600 ring-teal-100';
    case 'reopen':
      return 'bg-amber-500 ring-amber-100';
    default:
      return 'bg-slate-400 ring-slate-100';
  }
}

function formatMonthLabel(payMonth: string): string {
  const parts = payMonth.split('-');
  return parts.length === 2 ? `Tháng ${Number(parts[1])}/${parts[0]}` : payMonth;
}

function shiftMonth(year: number, month: number, delta: number): string {
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function resolveMonthRange(rangeKey: string): { fromMonth?: string; toMonth?: string } {
  if (!rangeKey || rangeKey === 'all') return {};
  if (rangeKey.startsWith('year:')) {
    const y = rangeKey.slice(5);
    return { fromMonth: `${y}-01`, toMonth: `${y}-12` };
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const toMonth = shiftMonth(y, m, 0);
  if (rangeKey === 'last_3') {
    return { fromMonth: shiftMonth(y, m, -2), toMonth };
  }
  if (rangeKey === 'last_6') {
    return { fromMonth: shiftMonth(y, m, -5), toMonth };
  }
  return {};
}

export default function PayrollHistoryPage() {
  const role = useAuthStore((s) => s.session?.user.role);
  const isAccountant = role === 'accountant';

  const [items, setItems] = useState<PayrollHistoryItem[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [departments, setDepartments] = useState<PayrollHistoryDepartmentOption[]>([]);
  const [timeRange, setTimeRange] = useState('all');
  const [departmentId, setDepartmentId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  // Modal chi tiết lịch sử 1 kỳ
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<PayrollHistoryDetail | null>(null);
  const [showAllEvents, setShowAllEvents] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { fromMonth, toMonth } = resolveMonthRange(timeRange);
      const res = await payrollHistoryApi.listHistory({
        fromMonth,
        toMonth,
        departmentId: departmentId || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setItems(res.items);
      setAvailableYears((prev) => {
        const merged = new Set([...prev, ...res.items.map((x) => x.payMonth.slice(0, 4))]);
        return Array.from(merged).sort((a, b) => b.localeCompare(a));
      });
      if (res.departments?.length) {
        setDepartments(res.departments);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tải được lịch sử tính lương.');
    } finally {
      setLoading(false);
    }
  }, [timeRange, departmentId, statusFilter]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleOpenDetail = async (payMonth: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setSelectedDetail(null);
    setShowAllEvents(false);
    try {
      const detail = await payrollHistoryApi.getMonthDetail(payMonth, departmentId || undefined);
      setSelectedDetail(detail);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tải được chi tiết lịch sử kỳ lương.');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleExportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    setError('');
    try {
      const { fromMonth, toMonth } = resolveMonthRange(timeRange);
      await payrollHistoryApi.exportCsv({
        fromMonth,
        toMonth,
        departmentId: departmentId || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể xuất file CSV lịch sử lương.');
    } finally {
      setExporting(false);
    }
  };

  const isFilterActive = Boolean(timeRange !== 'all' || departmentId || statusFilter !== 'all');

  const handleResetFilters = () => {
    setTimeRange('all');
    setDepartmentId('');
    setStatusFilter('all');
  };

  const columns: Column<PayrollHistoryItem>[] = [
    {
      key: 'payMonth',
      label: 'Kỳ lương',
      render: (row) => (
        <div className="space-y-0.5 whitespace-nowrap">
          <div className="text-xs font-semibold text-slate-900">{formatMonthLabel(row.payMonth)}</div>
          <div className="text-[11px] text-slate-500">
            {row.runCount > 0 ? `Tính lương: ${row.runCount} lần` : 'Chưa chạy tính lương'}
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-1">
          <span
            className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${getStatusBadgeClass(row.status)}`}
          >
            {STATUS_LABELS[row.status] || row.status}
          </span>
          {row.isLate && (
            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              Trễ hạn
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'employeeCount',
      label: 'Nhân sự / Công',
      className: 'text-right tabular-nums',
      headerClassName: 'text-right',
      render: (row) => (
        <div className="text-xs">
          <div className="font-semibold text-slate-800">{row.employeeCount} NV</div>
          <div className="text-[11px] text-slate-500">{row.totalWorkDays} công</div>
        </div>
      ),
    },
    {
      key: 'totalCommission',
      label: 'Hoa hồng',
      className: 'text-right tabular-nums text-xs',
      headerClassName: 'text-right',
      render: (row) => formatVnd(row.totalCommission),
    },
    {
      key: 'totalGrossPay',
      label: 'Tổng Gross',
      className: 'text-right tabular-nums text-xs font-medium text-slate-800',
      headerClassName: 'text-right',
      render: (row) => formatVnd(row.totalGrossPay),
    },
    {
      key: 'deductions',
      label: 'BH + Thuế TNCN',
      className: 'text-right tabular-nums text-xs text-slate-600',
      headerClassName: 'text-right',
      render: (row) => formatVnd(row.totalInsurance + row.totalTax),
    },
    {
      key: 'totalNetPay',
      label: 'Tổng Thực lĩnh',
      className: 'text-right tabular-nums text-xs font-bold text-teal-700',
      headerClassName: 'text-right',
      render: (row) => formatVnd(row.totalNetPay),
    },
    {
      key: 'lockedAt',
      label: 'Thời điểm chốt',
      render: (row) => (
        <div className="text-xs whitespace-nowrap">
          <div className="text-slate-700 tabular-nums">
            {formatVietnamDateTime(row.lockedAt || row.lastCalculatedAt)}
          </div>
          {row.lockedByName && (
            <div className="text-[11px] text-slate-500">{row.lockedByName}</div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Thao tác',
      className: 'text-right',
      headerClassName: 'text-right',
      render: (row) => (
        <div className="inline-flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void handleOpenDetail(row.payMonth)}
            className="h-8 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-teal-700 cursor-pointer whitespace-nowrap"
          >
            Lịch sử chạy
          </button>
          {isAccountant && (
            <Link
              to={`/payroll/periods/${row.payMonth}`}
              className="h-8 px-2.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center no-underline whitespace-nowrap"
            >
              Mở kỳ
            </Link>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="workspace-list-page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight m-0">
          Lịch sử tính lương
        </h1>
        <button
          type="button"
          disabled={exporting || loading || items.length === 0}
          onClick={() => void handleExportCsv()}
          className="h-9 px-3.5 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
        >
          <Icon name="fileText" size={14} />
          <span>{exporting ? 'Đang xuất...' : 'Xuất CSV'}</span>
        </button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {/* Thanh lọc 1 hàng ngang 3 ô cân đối */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Khoảng thời gian</label>
            <select
              aria-label="Khoảng thời gian"
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="w-full px-2.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-700"
              style={{ height: '36px', minHeight: '36px', paddingTop: 0, paddingBottom: 0, lineHeight: '34px' }}
            >
              <option value="all">Tất cả các kỳ</option>
              <option value="last_3">3 tháng gần nhất</option>
              <option value="last_6">6 tháng gần nhất</option>
              {availableYears.map((y) => (
                <option key={y} value={`year:${y}`}>
                  Năm {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">Khoa / Phòng ban</label>
            <select
              aria-label="Lọc khoa phòng"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
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

          <div className="flex items-end gap-2">
            <div className="flex-1 min-w-0">
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Trạng thái kỳ</label>
              <select
                aria-label="Lọc trạng thái"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-2.5 rounded-lg border border-slate-300 text-xs bg-white text-slate-700"
                style={{ height: '36px', minHeight: '36px', paddingTop: 0, paddingBottom: 0, lineHeight: '34px' }}
              >
                {Object.entries(STATUS_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {isFilterActive && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="shrink-0 px-3 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-xs font-medium text-slate-600 cursor-pointer"
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
            rowKey={(row) => row.lockId}
            emptyMessage="Không tìm thấy kết quả phù hợp."
            caption="Lịch sử các kỳ tính lương"
          />
        )}
      </div>

      {/* Modal chi tiết lịch sử chạy & phân bổ theo khoa */}
      {detailOpen && (
        <Modal
          title={
            selectedDetail
              ? `Chi tiết lịch sử ${formatMonthLabel(selectedDetail.summary.payMonth)}`
              : 'Đang tải chi tiết lịch sử...'
          }
          subtitle={
            selectedDetail && (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${getStatusBadgeClass(selectedDetail.summary.status)}`}
                >
                  {STATUS_LABELS[selectedDetail.summary.status] || selectedDetail.summary.status}
                </span>
                {selectedDetail.summary.isLate && (
                  <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    Trễ hạn
                  </span>
                )}
                <span className="text-xs text-slate-500">
                  {selectedDetail.summary.runCount} lần chạy tính lương
                </span>
                {selectedDetail.summary.hasWarning && selectedDetail.summary.warningMessage && (
                  <span className="text-xs text-amber-700">
                    · {selectedDetail.summary.warningMessage}
                  </span>
                )}
              </div>
            )
          }
          onClose={() => setDetailOpen(false)}
          maxWidth="820px"
        >
          {detailLoading ? (
            <div className="py-4 space-y-3 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-1/3" />
              <div className="h-24 bg-slate-100 rounded" />
            </div>
          ) : (
            selectedDetail && (
              <div className="space-y-5 text-xs">
                {/* Tổng hợp theo Khoa / Phòng ban */}
                <section className="space-y-2">
                  <h3 className="text-[13px] font-semibold text-slate-800 m-0">
                    Tổng hợp theo Khoa / Phòng ban
                  </h3>
                  {selectedDetail.departmentBreakdowns.length === 0 ? (
                    <p className="text-slate-500 italic m-0">Chưa có dữ liệu phiếu lương trong kỳ này.</p>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                          <tr>
                            <th className="font-semibold" style={{ padding: '8px 12px', height: 'auto' }}>Khoa / Phòng</th>
                            <th className="font-semibold text-right" style={{ padding: '8px 12px', height: 'auto' }}>NV</th>
                            <th className="font-semibold text-right" style={{ padding: '8px 12px', height: 'auto' }}>Công</th>
                            <th className="font-semibold text-right" style={{ padding: '8px 12px', height: 'auto' }}>Hoa hồng</th>
                            <th className="font-semibold text-right" style={{ padding: '8px 12px', height: 'auto' }}>Tổng Gross</th>
                            <th className="font-semibold text-right" style={{ padding: '8px 12px', height: 'auto' }}>Thực lĩnh</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {selectedDetail.departmentBreakdowns.map((b) => (
                            <tr key={b.departmentId || b.departmentName} className="hover:bg-slate-50/70">
                              <td className="font-medium text-slate-800" style={{ padding: '8px 12px', height: 'auto' }}>
                                {b.departmentName}
                              </td>
                              <td className="text-right tabular-nums text-slate-700" style={{ padding: '8px 12px', height: 'auto' }}>
                                {b.employeeCount}
                              </td>
                              <td className="text-right tabular-nums text-slate-700" style={{ padding: '8px 12px', height: 'auto' }}>
                                {b.totalWorkDays}
                              </td>
                              <td className="text-right tabular-nums text-slate-700" style={{ padding: '8px 12px', height: 'auto' }}>
                                {formatVnd(b.totalCommission)}
                              </td>
                              <td className="text-right tabular-nums text-slate-700" style={{ padding: '8px 12px', height: 'auto' }}>
                                {formatVnd(b.totalGrossPay)}
                              </td>
                              <td className="text-right tabular-nums font-semibold text-teal-700" style={{ padding: '8px 12px', height: 'auto' }}>
                                {formatVnd(b.totalNetPay)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50/80 border-t border-slate-200 font-semibold text-slate-900">
                          <tr>
                            <td style={{ padding: '8px 12px', height: 'auto' }}>Tổng cộng</td>
                            <td className="text-right tabular-nums" style={{ padding: '8px 12px', height: 'auto' }}>
                              {selectedDetail.summary.employeeCount}
                            </td>
                            <td className="text-right tabular-nums" style={{ padding: '8px 12px', height: 'auto' }}>
                              {selectedDetail.summary.totalWorkDays}
                            </td>
                            <td className="text-right tabular-nums" style={{ padding: '8px 12px', height: 'auto' }}>
                              {formatVnd(selectedDetail.summary.totalCommission)}
                            </td>
                            <td className="text-right tabular-nums" style={{ padding: '8px 12px', height: 'auto' }}>
                              {formatVnd(selectedDetail.summary.totalGrossPay)}
                            </td>
                            <td className="text-right tabular-nums text-teal-700" style={{ padding: '8px 12px', height: 'auto' }}>
                              {formatVnd(selectedDetail.summary.totalNetPay)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </section>

                {/* Timeline nhật ký chạy & chốt kỳ lương (không dùng scroll lồng) */}
                <section className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[13px] font-semibold text-slate-800 m-0">
                      Nhật ký các lần tính & chốt ({selectedDetail.events.length})
                    </h3>
                    {selectedDetail.events.length > 5 && (
                      <button
                        type="button"
                        onClick={() => setShowAllEvents((prev) => !prev)}
                        className="text-xs font-semibold text-teal-700 hover:text-teal-800 bg-transparent border-0 cursor-pointer p-0"
                      >
                        {showAllEvents
                          ? 'Thu gọn'
                          : `Xem tất cả (${selectedDetail.events.length})`}
                      </button>
                    )}
                  </div>

                  {selectedDetail.events.length === 0 ? (
                    <p className="text-slate-500 italic m-0">Chưa ghi nhận nhật ký chạy cho kỳ này.</p>
                  ) : (
                    <ol className="relative border-l border-slate-200 ml-2 pl-4 space-y-3 m-0 list-none">
                      {(showAllEvents
                        ? selectedDetail.events
                        : selectedDetail.events.slice(0, 5)
                      ).map((ev) => (
                        <li key={ev.logId} className="relative">
                          <span
                            aria-hidden="true"
                            className={`absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full ring-4 ${getEventDotClass(ev.action)}`}
                          />
                          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                            <span className="font-semibold text-slate-800">{ev.actionLabel}</span>
                            <span className="text-[11px] text-slate-500 tabular-nums">
                              {ev.actorName} · {formatVietnamDateTime(ev.createdAt)}
                            </span>
                          </div>
                          {ev.summary && (
                            <p className="text-[11px] text-slate-600 mt-0.5 mb-0 leading-relaxed">
                              {ev.summary}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </div>
            )
          )}
        </Modal>
      )}
    </div>
  );
}
