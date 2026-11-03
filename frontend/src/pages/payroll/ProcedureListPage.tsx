import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '../../components/ui/Alert';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import ProcedureReviewModal from '../../components/payroll/ProcedureReviewModal';
import { procedureSlipApi } from '../../services/procedureSlipApi';
import { useAuthStore } from '../../store/useAuthStore';
import type {
  CalculateMonthlyCommissionResult,
  ProcedureDepartmentSummary,
  ProcedureLookups,
  ProcedurePeriodBreakdown,
  ProcedureSlipListItem,
  ProcedureSlipListResponse,
} from '../../types/procedureSlip';
import { formatDateOnly, formatVnd, todayVn } from '../../utils/format';
import {
  getProcedureStatusBadgeClass,
  PROCEDURE_STATUS_LABELS,
} from '../../utils/procedureHelpers';

type ViewTab = 'records' | 'departments' | 'periods';
type PeriodMode = 'month' | 'quarter' | 'year' | 'all' | 'custom';

export default function ProcedureListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.session?.user);
  const role = user?.role || 'employee';

  // Chỉ HR Staff và Accountant mới được xem toàn bộ và xem thống kê quản lý
  const isAccountant = role === 'accountant';
  const isHrStaff = role === 'hr_staff';
  const isFullManager = isHrStaff || isAccountant;
  const isDeptHead = role === 'department_head';

  // Scope cho Trưởng khoa (department_head): xem của cá nhân hoặc xem theo khoa của mình
  const [viewScope, setViewScope] = useState<'mine' | 'department'>(
    isDeptHead ? 'department' : 'mine'
  );

  // Period filter state (Month / Quarter / Year / All / Custom)
  const now = useMemo(() => new Date(), []);
  const [periodType, setPeriodType] = useState<PeriodMode>('month');
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [quarter, setQuarter] = useState<number>(Math.floor(now.getMonth() / 3) + 1);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Dimension filters
  const [departmentId, setDepartmentId] = useState<string>('');
  const [serviceId, setServiceId] = useState<string>('');
  const [staffId, setStaffId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [afterHoursFilter, setAfterHoursFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Active tab (Records table vs Department summary vs Period summary - chỉ dành cho HR Staff & Accountant)
  const [activeTab, setActiveTab] = useState<ViewTab>('records');

  // Data state
  const [lookups, setLookups] = useState<ProcedureLookups | null>(null);
  const [data, setData] = useState<ProcedureSlipListResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [notice, setNotice] = useState<string>('');

  // Quick review modal state
  const [reviewModalSlip, setReviewModalSlip] = useState<ProcedureSlipListItem | null>(null);
  const [reviewMode, setReviewMode] = useState<'hr_check' | 'accountant_verify'>('accountant_verify');
  const [reviewDefaultDecision, setReviewDefaultDecision] = useState<'approve' | 'reject'>('approve');

  // Monthly commission calculation modal state
  const [calcModalOpen, setCalcModalOpen] = useState<boolean>(false);
  const [calcMonth, setCalcMonth] = useState<string>(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  const [calcDeptId, setCalcDeptId] = useState<string>('');
  const [calculating, setCalculating] = useState<boolean>(false);
  const [calcError, setCalcError] = useState<string>('');
  const [calcResult, setCalcResult] = useState<CalculateMonthlyCommissionResult | null>(null);

  useEffect(() => {
    procedureSlipApi
      .getLookups()
      .then(setLookups)
      .catch(() => {
        // Non-blocking lookup load error
      });
  }, []);

  const loadSlips = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await procedureSlipApi.listSlips({
        periodType,
        year: periodType !== 'all' && periodType !== 'custom' ? year : undefined,
        month: periodType === 'month' ? month : undefined,
        quarter: periodType === 'quarter' ? quarter : undefined,
        fromDate: isFullManager && periodType === 'custom' && fromDate ? fromDate : undefined,
        toDate: isFullManager && periodType === 'custom' && toDate ? toDate : undefined,
        departmentId: isFullManager && departmentId ? departmentId : undefined,
        serviceId: serviceId || undefined,
        staffId: isFullManager && staffId ? staffId : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        isAfterHours:
          afterHoursFilter === 'after_hours'
            ? true
            : afterHoursFilter === 'in_hours'
            ? false
            : undefined,
        q: isFullManager && searchQuery.trim() ? searchQuery.trim() : undefined,
        scope: isFullManager ? 'all' : isDeptHead ? viewScope : 'mine',
        page,
        pageSize,
      });
      setData(response);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách phiếu thủ thuật.');
    } finally {
      setLoading(false);
    }
  }, [
    isFullManager,
    isDeptHead,
    viewScope,
    periodType,
    year,
    month,
    quarter,
    fromDate,
    toDate,
    departmentId,
    serviceId,
    staffId,
    statusFilter,
    afterHoursFilter,
    searchQuery,
    page,
    pageSize,
  ]);

  useEffect(() => {
    void loadSlips();
  }, [loadSlips]);

  const periodDescription = useMemo(() => {
    if (periodType === 'month') return `Tháng ${String(month).padStart(2, '0')}/${year}`;
    if (periodType === 'quarter') return `Quý ${quarter}/${year}`;
    if (periodType === 'year') return `Năm ${year}`;
    if (periodType === 'custom') {
      return `Từ ${fromDate ? formatDateOnly(fromDate) : '...'} đến ${toDate ? formatDateOnly(toDate) : '...'}`;
    }
    return 'Toàn thời gian';
  }, [periodType, year, month, quarter, fromDate, toDate]);

  const handleResetFilters = () => {
    setPeriodType('month');
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
    setQuarter(Math.floor(now.getMonth() / 3) + 1);
    setFromDate('');
    setToDate('');
    setDepartmentId('');
    setServiceId('');
    setStaffId('');
    setStatusFilter('all');
    setAfterHoursFilter('all');
    setSearchQuery('');
    setPage(1);
  };

  const handleExportCsv = () => {
    if (!data || data.items.length === 0) return;

    const header = [
      'Số phiếu',
      'Ngày thực hiện',
      'Mã bệnh nhân',
      'Mã dịch vụ',
      'Tên dịch vụ kỹ thuật',
      'Khoa/Phòng',
      'BS Chỉ định',
      'Ca ngoài giờ',
      'Thời lượng (giờ)',
      'Thu viện phí (VND)',
      'Chi phí trực tiếp (VND)',
      'Doanh thu thuần (VND)',
      'Số nhân sự kíp',
      'Tổng hoa hồng (VND)',
      'Trạng thái',
      'Người xác minh',
    ];

    const rows = data.items.map((item) => [
      `"${item.slipNumber}"`,
      `"${item.procedureDate}"`,
      `"${item.patientCode || ''}"`,
      `"${item.serviceCode}"`,
      `"${item.serviceName.replace(/"/g, '""')}"`,
      `"${item.departmentName || ''}"`,
      `"${item.indicatingStaffName || ''}"`,
      item.isAfterHours ? '"Ngoài giờ"' : '"Hành chính"',
      item.durationHours ?? '',
      item.chargedAmount,
      item.directCost,
      item.netRevenue,
      item.participantCount,
      item.totalCommissionAmount,
      `"${PROCEDURE_STATUS_LABELS[item.status] || item.status}"`,
      `"${item.verifiedByName || ''}"`,
    ]);

    const csvContent = '\uFEFF' + [header.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `PhieuThuThuat_${periodDescription.replace(/\s|\//g, '_')}_${todayVn()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRunMonthlyCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    setCalculating(true);
    setCalcError('');
    try {
      const res = await procedureSlipApi.calculateMonthlyCommission({
        payMonth: calcMonth,
        departmentId: calcDeptId || null,
      });
      setCalcResult(res);
      setNotice(
        `Đã tổng hợp hoa hồng tháng ${res.payMonth} từ ${res.verifiedSlipCount} phiếu đã xác minh (Tổng: ${formatVnd(
          res.totalCommissionCalculated
        )}).`
      );
      void loadSlips();
    } catch (err: unknown) {
      setCalcError(err instanceof Error ? err.message : 'Không thể tính hoa hồng tháng.');
    } finally {
      setCalculating(false);
    }
  };

  const recordColumns: Column<ProcedureSlipListItem>[] = useMemo(() => {
    const cols: Column<ProcedureSlipListItem>[] = [
      {
        key: 'slipNumber',
        label: 'Số phiếu & Ngày làm',
        sortable: true,
        sortValue: (r) => r.procedureDate + r.slipNumber,
        render: (r) => (
          <div>
            <button
              type="button"
              onClick={() => navigate(`/procedures/${r.slipId}`)}
              className="font-mono font-semibold text-sky-700 hover:text-sky-800 hover:underline text-sm cursor-pointer text-left"
            >
              {r.slipNumber}
            </button>
            <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
              <span>{formatDateOnly(r.procedureDate)}</span>
              {r.isAfterHours ? (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 font-medium">
                  Ngoài giờ
                </span>
              ) : (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                  Hành chính
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'patientAndDept',
        label: 'Bệnh nhân & Khoa phòng',
        sortable: true,
        sortValue: (r) => r.departmentName || '',
        render: (r) => (
          <div>
            <div className="text-sm font-medium text-slate-900">
              BN: <span className="font-mono">{r.patientCode || '—'}</span>
            </div>
            <div className="text-xs text-slate-500">{r.departmentName || 'Chưa phân khoa'}</div>
          </div>
        ),
      },
      {
        key: 'service',
        label: 'Thủ thuật / Dịch vụ kỹ thuật',
        sortable: true,
        sortValue: (r) => r.serviceName,
        render: (r) => (
          <div className="max-w-[260px]">
            <div className="font-medium text-slate-900 text-sm truncate" title={r.serviceName}>
              {r.serviceName}
            </div>
            <div className="text-xs text-slate-500">
              <span className="font-mono">{r.serviceCode}</span>
              {r.serviceCategory && ` • ${r.serviceCategory}`}
            </div>
          </div>
        ),
      },
    ];

    if (isFullManager) {
      cols.push(
        {
          key: 'chargedAmount',
          label: 'Viện phí & Doanh thu thuần',
          sortable: true,
          sortValue: (r) => r.chargedAmount,
          render: (r) => (
            <div>
              <div className="text-sm font-semibold text-slate-900 font-[tabular-nums]">
                {formatVnd(r.chargedAmount)}
              </div>
              <div className="text-xs text-slate-500 font-[tabular-nums]">
                Thuần: {formatVnd(r.netRevenue)} (CP: {formatVnd(r.directCost)})
              </div>
            </div>
          ),
        },
        {
          key: 'commission',
          label: 'Kíp & Hoa hồng',
          sortable: true,
          sortValue: (r) => r.totalCommissionAmount,
          render: (r) => (
            <div>
              <div className="text-sm font-semibold text-emerald-700 font-[tabular-nums]">
                {formatVnd(r.totalCommissionAmount)}
              </div>
              <div className="text-xs text-slate-500">
                {r.participantCount} nhân sự
                {r.indicatingStaffName ? ` • CĐ: ${r.indicatingStaffName}` : ''}
              </div>
            </div>
          ),
        }
      );
    }

    cols.push(
      {
        key: 'status',
        label: 'Trạng thái duyệt',
        sortable: true,
        sortValue: (r) => r.status,
        render: (r) => (
          <div>
            <span
              className={`inline-block text-[11px] px-2.5 py-0.5 rounded-full font-medium ${getProcedureStatusBadgeClass(
                r.status
              )}`}
            >
              {PROCEDURE_STATUS_LABELS[r.status] || r.status}
            </span>
            {r.status === 'rejected' && r.rejectedReason && (
              <div
                className="text-[11px] text-rose-600 mt-1 max-w-[180px] truncate"
                title={r.rejectedReason}
              >
                {r.rejectedReason}
              </div>
            )}
            {r.status === 'verified' && r.verifiedByName && (
              <div className="text-[11px] text-slate-400 mt-0.5">Bởi: {r.verifiedByName}</div>
            )}
          </div>
        ),
      },
      {
        key: 'actions',
        label: 'Thao tác',
        render: (r) => {
          const canEdit = !r.isPeriodLocked && (r.status === 'pending' || r.status === 'rejected');
          const canHrReview = !r.isPeriodLocked && isHrStaff && r.status === 'pending';
          const canAccVerify =
            !r.isPeriodLocked && isAccountant && (r.status === 'hr_checked' || r.status === 'pending');

          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => navigate(`/procedures/${r.slipId}`)}
                className="button text-xs py-1 px-2.5"
                title="Xem chi tiết phiếu thủ thuật"
              >
                Chi tiết
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => navigate(`/procedures/${r.slipId}/edit`)}
                  className="button text-xs py-1 px-2.5 text-sky-700 border-sky-200 hover:bg-sky-50"
                  title="Chỉnh sửa phiếu thủ thuật"
                >
                  Sửa
                </button>
              )}
              {canHrReview && (
                <button
                  type="button"
                  onClick={() => {
                    setReviewModalSlip(r);
                    setReviewMode('hr_check');
                    setReviewDefaultDecision('approve');
                  }}
                  className="button text-xs py-1 px-2.5 bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100"
                >
                  HR Kiểm tra
                </button>
              )}
              {canAccVerify && (
                <button
                  type="button"
                  onClick={() => {
                    setReviewModalSlip(r);
                    setReviewMode('accountant_verify');
                    setReviewDefaultDecision('approve');
                  }}
                  className="button text-xs py-1 px-2.5 bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                >
                  Xác minh
                </button>
              )}
            </div>
          );
        },
      }
    );

    return cols;
  }, [isFullManager, isHrStaff, isAccountant, navigate]);

  const departmentColumns: Column<ProcedureDepartmentSummary>[] = [
    {
      key: 'departmentName',
      label: 'Khoa / Phòng ban',
      sortable: true,
      sortValue: (r) => r.departmentName,
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-900 text-sm">{r.departmentName}</div>
          <div className="text-xs text-slate-500 font-mono">Mã: {r.departmentCode}</div>
        </div>
      ),
    },
    {
      key: 'totalSlips',
      label: 'Tổng số ca',
      sortable: true,
      sortValue: (r) => r.totalSlips,
      render: (r) => <span className="font-semibold text-slate-900">{r.totalSlips} ca</span>,
    },
    {
      key: 'statusBreakdown',
      label: 'Tiến độ kiểm duyệt',
      render: (r) => (
        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
            {r.verifiedCount} Đã xác minh
          </span>
          {r.hrCheckedCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
              {r.hrCheckedCount} Chờ KT
            </span>
          )}
          {r.pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
              {r.pendingCount} Chờ HR
            </span>
          )}
          {r.rejectedCount > 0 && (
            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
              {r.rejectedCount} Từ chối
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'totalChargedAmount',
      label: 'Tổng thu viện phí',
      sortable: true,
      sortValue: (r) => r.totalChargedAmount,
      render: (r) => (
        <span className="font-semibold text-slate-900 font-[tabular-nums]">
          {formatVnd(r.totalChargedAmount)}
        </span>
      ),
    },
    {
      key: 'totalNetRevenue',
      label: 'Doanh thu thuần',
      sortable: true,
      sortValue: (r) => r.totalNetRevenue,
      render: (r) => (
        <span className="text-slate-700 font-[tabular-nums]">{formatVnd(r.totalNetRevenue)}</span>
      ),
    },
    {
      key: 'totalCommissionAmount',
      label: 'Tổng hoa hồng trích lập',
      sortable: true,
      sortValue: (r) => r.totalCommissionAmount,
      render: (r) => (
        <div>
          <div className="font-semibold text-emerald-700 font-[tabular-nums]">
            {formatVnd(r.totalCommissionAmount)}
          </div>
          <div className="text-xs text-slate-500 font-[tabular-nums]">
            Đã Verified: {formatVnd(r.verifiedCommissionAmount)}
          </div>
        </div>
      ),
    },
    {
      key: 'filterAction',
      label: 'Xem chi tiết khoa',
      render: (r) => (
        <button
          type="button"
          onClick={() => {
            if (r.departmentId) {
              setDepartmentId(r.departmentId);
              setActiveTab('records');
              setPage(1);
            }
          }}
          disabled={!r.departmentId}
          className="button text-xs py-1 px-2.5 text-sky-700 hover:bg-sky-50"
        >
          Lọc danh sách phiếu →
        </button>
      ),
    },
  ];

  const periodColumns: Column<ProcedurePeriodBreakdown>[] = [
    {
      key: 'periodLabel',
      label: 'Kỳ thống kê',
      sortable: true,
      sortValue: (r) => r.periodKey,
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-900 text-sm">{r.periodLabel}</div>
          <div className="text-xs text-slate-400 font-mono">{r.periodKey}</div>
        </div>
      ),
    },
    {
      key: 'totalSlips',
      label: 'Tổng số phiếu',
      sortable: true,
      sortValue: (r) => r.totalSlips,
      render: (r) => <span className="font-semibold text-slate-800">{r.totalSlips} phiếu</span>,
    },
    {
      key: 'verifiedCount',
      label: 'Trạng thái xử lý',
      render: (r) => (
        <div className="text-xs flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
            {r.verifiedCount} Verified
          </span>
          <span className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-200">
            {r.hrCheckedCount} Chờ KT
          </span>
          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            {r.pendingCount} Chờ HR
          </span>
          <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
            {r.rejectedCount} Từ chối
          </span>
        </div>
      ),
    },
    {
      key: 'totalChargedAmount',
      label: 'Tổng thu viện phí',
      sortable: true,
      sortValue: (r) => r.totalChargedAmount,
      render: (r) => (
        <span className="font-semibold text-slate-900 font-[tabular-nums]">
          {formatVnd(r.totalChargedAmount)}
        </span>
      ),
    },
    {
      key: 'totalCommissionAmount',
      label: 'Tổng hoa hồng',
      sortable: true,
      sortValue: (r) => r.totalCommissionAmount,
      render: (r) => (
        <div>
          <div className="font-semibold text-emerald-700 font-[tabular-nums]">
            {formatVnd(r.totalCommissionAmount)}
          </div>
          <div className="text-xs text-slate-500 font-[tabular-nums]">
            Đã xác minh: {formatVnd(r.verifiedCommissionAmount)}
          </div>
        </div>
      ),
    },
  ];

  // Các tùy chọn chu kỳ: Cá nhân chỉ cần Tháng, Quý, Năm; HR Staff & Accountant có thêm Tất cả & Tùy chỉnh
  const periodOptions: { key: PeriodMode; label: string }[] = isFullManager
    ? [
        { key: 'month', label: 'Theo Tháng' },
        { key: 'quarter', label: 'Theo Quý' },
        { key: 'year', label: 'Theo Năm' },
        { key: 'all', label: 'Tất cả' },
        { key: 'custom', label: 'Tùy chỉnh ngày' },
      ]
    : [
        { key: 'month', label: 'Theo Tháng' },
        { key: 'quarter', label: 'Theo Quý' },
        { key: 'year', label: 'Theo Năm' },
      ];

  return (
    <div className="space-y-6">
      {/* Page Heading */}
      <div className="page-heading flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="eyebrow">
            {isFullManager ? 'QUẢN LÝ THỦ THUẬT Y TẾ & HOA HỒNG' : 'THEO DÕI CA THỦ THUẬT'}
          </span>
          <h1>
            {isFullManager
              ? 'Quản lý Phiếu Thủ Thuật Y Tế'
              : isDeptHead && viewScope === 'department'
              ? 'Phiếu Thủ Thuật Khoa / Phòng'
              : 'Phiếu Thủ Thuật Của Tôi'}
          </h1>
          <p className="muted">
            {isFullManager
              ? 'Kiểm tra quy chế nhân sự (HR Staff) và đối soát xác minh tài chính (Kế toán) theo từng khoa phòng, tháng, quý, năm.'
              : isDeptHead
              ? 'Xem và lập phiếu thủ thuật của cá nhân hoặc theo dõi các ca thủ thuật trong khoa/phòng phụ trách.'
              : 'Xem và lọc các ca thủ thuật của cá nhân theo loại thủ thuật, tháng, quý, năm và khung giờ.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {isDeptHead && (
            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
              <button
                type="button"
                onClick={() => {
                  setViewScope('mine');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                  viewScope === 'mine'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Của cá nhân tôi
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewScope('department');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer ${
                  viewScope === 'department'
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                Theo khoa của tôi
              </button>
            </div>
          )}

          {isAccountant && (
            <button
              type="button"
              onClick={() => {
                setCalcResult(null);
                setCalcError('');
                setCalcModalOpen(true);
              }}
              className="button bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 flex items-center gap-1.5"
            >
              <Icon name="calendar" />
              <span>Tính hoa hồng tháng</span>
            </button>
          )}

          {isFullManager && (
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!data || data.items.length === 0}
              className="button flex items-center gap-1.5"
            >
              <Icon name="fileText" />
              <span>Xuất CSV</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => navigate('/procedures/new')}
            className="button primary flex items-center gap-1.5"
          >
            <Icon name="plus" />
            <span>+ Lập phiếu thủ thuật</span>
          </button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {/* Khối Bộ Lọc */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 mr-1">
              Kỳ xem:
            </span>
            {periodOptions.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setPeriodType(item.key);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  periodType === item.key
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Bộ chọn Năm / Tháng / Quý động */}
          <div className="flex items-center gap-2 flex-wrap">
            {(periodType === 'month' || periodType === 'quarter' || periodType === 'year') && (
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-slate-600">Năm:</label>
                <select
                  aria-label="Chọn năm"
                  value={year}
                  onChange={(e) => {
                    setYear(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium bg-white"
                >
                  {[now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(
                    (y) => (
                      <option key={y} value={y}>
                        Năm {y}
                      </option>
                    )
                  )}
                </select>
              </div>
            )}

            {periodType === 'month' && (
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-slate-600">Tháng:</label>
                <select
                  aria-label="Chọn tháng"
                  value={month}
                  onChange={(e) => {
                    setMonth(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium bg-white"
                >
                  {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                    <option key={m} value={m}>
                      Tháng {String(m).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {periodType === 'quarter' && (
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-slate-600">Quý:</label>
                <select
                  aria-label="Chọn quý"
                  value={quarter}
                  onChange={(e) => {
                    setQuarter(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium bg-white"
                >
                  <option value={1}>Quý 1 (Tháng 01 - 03)</option>
                  <option value={2}>Quý 2 (Tháng 04 - 06)</option>
                  <option value={3}>Quý 3 (Tháng 07 - 09)</option>
                  <option value={4}>Quý 4 (Tháng 10 - 12)</option>
                </select>
              </div>
            )}

            {isFullManager && periodType === 'custom' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => {
                    setFromDate(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs"
                />
                <span className="text-xs text-slate-400">→</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => {
                    setToDate(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs"
                />
              </div>
            )}
          </div>
        </div>

        {/* Bộ lọc chi tiết: Cá nhân chỉ lọc theo Thủ thuật & Khung giờ; HR Staff & Accountant có đầy đủ Khoa phòng, Nhân sự, Tìm kiếm */}
        {isFullManager ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Khoa / Phòng ban</label>
              <select
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
              >
                <option value="">Tất cả khoa/phòng</option>
                {lookups?.departments.map((d) => (
                  <option key={d.departmentId} value={d.departmentId}>
                    {d.name} ({d.deptCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Dịch vụ thủ thuật</label>
              <select
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
              >
                <option value="">Tất cả dịch vụ kỹ thuật</option>
                {lookups?.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nhân sự thực hiện / CĐ</label>
              <select
                value={staffId}
                onChange={(e) => {
                  setStaffId(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
              >
                <option value="">Tất cả nhân sự</option>
                {lookups?.staff.map((st) => (
                  <option key={st.staffId} value={st.staffId}>
                    {st.staffCode} - {st.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Khung giờ làm</label>
              <select
                value={afterHoursFilter}
                onChange={(e) => {
                  setAfterHoursFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
              >
                <option value="all">Tất cả khung giờ</option>
                <option value="in_hours">Trong giờ hành chính</option>
                <option value="after_hours">Ca ngoài giờ / Trực</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Tìm kiếm nhanh</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Số phiếu, Mã BN, Dịch vụ..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="button text-xs py-1.5 px-2.5 shrink-0"
                  title="Đặt lại bộ lọc"
                >
                  Đặt lại
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Lọc theo Thủ thuật (Dịch vụ kỹ thuật)
              </label>
              <select
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
              >
                <option value="">Tất cả thủ thuật</option>
                {lookups?.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} - {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Lọc theo Khung giờ
              </label>
              <select
                value={afterHoursFilter}
                onChange={(e) => {
                  setAfterHoursFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
              >
                <option value="all">Tất cả khung giờ</option>
                <option value="in_hours">Trong giờ hành chính</option>
                <option value="after_hours">Ca ngoài giờ / Trực</option>
              </select>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleResetFilters}
                className="button text-xs py-1.5 px-3"
              >
                Đặt lại bộ lọc
              </button>
            </div>
          </div>
        )}
      </div>

      {/* KPI Summary: Cá nhân chỉ xem Tổng số ca; HR Staff & Accountant xem đầy đủ 4 thẻ thống kê */}
      {isFullManager ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-xs font-medium text-slate-500 uppercase">
              Tổng số ca ({periodDescription})
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-1">
              {data?.allCount ?? 0} <span className="text-sm font-normal text-slate-500">phiếu</span>
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
              <span className="text-emerald-700 font-medium">{data?.verifiedCount ?? 0} đã xác minh</span>
              <span>•</span>
              <span className="text-amber-700">{(data?.pendingCount ?? 0) + (data?.hrCheckedCount ?? 0)} chờ xử lý</span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-xs font-medium text-slate-500 uppercase">Tổng doanh thu viện phí</div>
            <div className="text-2xl font-bold text-slate-900 mt-1 font-[tabular-nums]">
              {formatVnd(data?.totalChargedAmount ?? 0)}
            </div>
            <div className="text-xs text-slate-500 mt-1 font-[tabular-nums]">
              Chi phí trực tiếp: {formatVnd(data?.totalDirectCost ?? 0)}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-xs font-medium text-slate-500 uppercase">Doanh thu thuần thủ thuật</div>
            <div className="text-2xl font-bold text-sky-700 mt-1 font-[tabular-nums]">
              {formatVnd(data?.totalNetRevenue ?? 0)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Sau khi trừ chi phí vật tư trực tiếp
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-xs font-medium text-slate-500 uppercase">Tổng quỹ hoa hồng</div>
            <div className="text-2xl font-bold text-emerald-700 mt-1 font-[tabular-nums]">
              {formatVnd(data?.totalCommissionAmount ?? 0)}
            </div>
            <div className="text-xs text-emerald-700 mt-1 font-medium font-[tabular-nums]">
              Đủ ĐK tính lương (Verified): {formatVnd(data?.verifiedCommissionAmount ?? 0)}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-slate-500 uppercase">
              Tổng số ca thủ thuật ({periodDescription})
            </div>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              {data?.total ?? 0} <span className="text-sm font-normal text-slate-500">ca thủ thuật</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
              Đã xác minh: {data?.verifiedCount ?? 0} ca
            </span>
            <span className="px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200 font-medium">
              Chờ Kế toán: {data?.hrCheckedCount ?? 0} ca
            </span>
            <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">
              Chờ HR: {data?.pendingCount ?? 0} ca
            </span>
            <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-medium">
              Bị từ chối: {data?.rejectedCount ?? 0} ca
            </span>
          </div>
        </div>
      )}

      {/* Chuyển đổi Chế độ xem (HR Staff & Accountant có thêm tab Quản lý theo Phòng ban & Tháng/Quý) & Lọc trạng thái */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-200 pb-3">
        {isFullManager ? (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('records')}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'records'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Danh sách phiếu ({data?.total ?? 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('departments')}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'departments'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Quản lý theo Phòng ban ({data?.byDepartment.length ?? 0} khoa)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('periods')}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'periods'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Tổng hợp theo Tháng / Quý ({data?.byPeriod.length ?? 0} kỳ)
            </button>
          </div>
        ) : (
          <div className="text-sm font-semibold text-slate-800">
            Danh sách ca thủ thuật ({data?.total ?? 0})
          </div>
        )}

        {(!isFullManager || activeTab === 'records') && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { key: 'all', label: 'Tất cả', count: data?.allCount ?? 0 },
                { key: 'pending', label: 'Chờ HR kiểm tra', count: data?.pendingCount ?? 0 },
                { key: 'hr_checked', label: 'Chờ Kế toán xác minh', count: data?.hrCheckedCount ?? 0 },
                { key: 'verified', label: 'Đã xác minh', count: data?.verifiedCount ?? 0 },
                { key: 'rejected', label: 'Bị từ chối', count: data?.rejectedCount ?? 0 },
              ] as const
            ).map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => {
                  setStatusFilter(st.key);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === st.key
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st.label} ({st.count})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading && !data ? (
        <div className="p-8 text-center text-slate-500">Đang tải danh sách phiếu thủ thuật...</div>
      ) : (
        <>
          {(!isFullManager || activeTab === 'records') && (
            <div className="space-y-4">
              <DataTable<ProcedureSlipListItem>
                columns={recordColumns}
                rows={data?.items ?? []}
                rowKey={(r) => r.slipId}
                emptyMessage="Không có phiếu thủ thuật nào khớp với điều kiện lọc hiện tại."
              />
              {data && data.total > 0 && (
                <Pagination
                  total={data.total}
                  page={page}
                  pageSize={pageSize}
                  label="phiếu thủ thuật"
                  disabled={loading}
                  onPageChange={setPage}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize);
                    setPage(1);
                  }}
                />
              )}
            </div>
          )}

          {isFullManager && activeTab === 'departments' && (
            <div className="space-y-3">
              <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 text-xs text-sky-900 flex items-center justify-between">
                <span>
                  Bảng phân tích tổng hợp số lượng phiếu thủ thuật, doanh thu viện phí và quỹ hoa hồng theo <strong>từng Khoa/Phòng ban</strong> trong kỳ <strong>{periodDescription}</strong>.
                </span>
                {departmentId && (
                  <button
                    type="button"
                    onClick={() => setDepartmentId('')}
                    className="text-sky-700 font-semibold underline cursor-pointer"
                  >
                    Xem tất cả phòng ban
                  </button>
                )}
              </div>
              <DataTable<ProcedureDepartmentSummary>
                columns={departmentColumns}
                rows={data?.byDepartment ?? []}
                rowKey={(r) => r.departmentId || r.departmentCode}
                emptyMessage="Chưa có dữ liệu thống kê theo phòng ban trong kỳ này."
              />
            </div>
          )}

          {isFullManager && activeTab === 'periods' && (
            <div className="space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-700">
                Bảng đối chiếu tiến độ xác minh và quỹ hoa hồng theo từng Tháng / Quý ({periodDescription}).
              </div>
              <DataTable<ProcedurePeriodBreakdown>
                columns={periodColumns}
                rows={data?.byPeriod ?? []}
                rowKey={(r) => r.periodKey}
                emptyMessage="Chưa có dữ liệu thống kê theo kỳ."
              />
            </div>
          )}
        </>
      )}

      {/* Modal Duyệt nhanh (HR Check / Accountant Verify) */}
      <ProcedureReviewModal
        open={Boolean(reviewModalSlip)}
        mode={reviewMode}
        slip={reviewModalSlip}
        defaultDecision={reviewDefaultDecision}
        onClose={() => setReviewModalSlip(null)}
        onSuccess={(_, message) => {
          setReviewModalSlip(null);
          setNotice(message);
          void loadSlips();
        }}
      />

      {/* Modal Tính hoa hồng hàng tháng từ các phiếu Verified */}
      {calcModalOpen && (
        <Modal
          title="Tính hoa hồng thủ thuật hàng tháng (Verified Slips)"
          onClose={() => setCalcModalOpen(false)}
          busy={calculating}
          maxWidth="720px"
        >
          <div className="space-y-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-900">
              Hệ thống sẽ tổng hợp toàn bộ các phiếu thủ thuật ở trạng thái <strong>Đã xác minh (Verified)</strong> trong tháng được chọn để tính tổng hoa hồng cho từng nhân sự và cập nhật vào bảng lương tháng (Payslip).
            </div>

            {calcError && <Alert variant="error">{calcError}</Alert>}

            <form onSubmit={handleRunMonthlyCommission} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tháng tính hoa hồng (YYYY-MM) *
                </label>
                <input
                  type="month"
                  required
                  value={calcMonth}
                  onChange={(e) => setCalcMonth(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Phạm vi Khoa/Phòng ban
                </label>
                <select
                  value={calcDeptId}
                  onChange={(e) => setCalcDeptId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="">Toàn phòng khám (Tất cả khoa)</option>
                  {lookups?.departments.map((d) => (
                    <option key={d.departmentId} value={d.departmentId}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={calculating}
                  className="button primary w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {calculating ? 'Đang tổng hợp...' : 'Chạy tổng hợp hoa hồng'}
                </button>
              </div>
            </form>

            {calcResult && (
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-slate-50 border rounded-lg p-2.5">
                    <div className="text-xs text-slate-500">Số phiếu Verified</div>
                    <div className="text-lg font-bold text-slate-900">{calcResult.verifiedSlipCount} phiếu</div>
                  </div>
                  <div className="bg-slate-50 border rounded-lg p-2.5">
                    <div className="text-xs text-slate-500">Nhân sự hưởng HH</div>
                    <div className="text-lg font-bold text-slate-900">{calcResult.staffCount} người</div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                    <div className="text-xs text-emerald-700">Tổng hoa hồng tháng</div>
                    <div className="text-lg font-bold text-emerald-800">
                      {formatVnd(calcResult.totalCommissionCalculated)}
                    </div>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600 uppercase">
                      <tr>
                        <th className="px-3 py-2">Nhân viên</th>
                        <th className="px-3 py-2">Khoa/Phòng</th>
                        <th className="px-3 py-2 text-center">Số ca / Vai trò</th>
                        <th className="px-3 py-2 text-right">Tổng hoa hồng</th>
                        <th className="px-3 py-2 text-center">Kết chuyển Payslip</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {calcResult.staffSummaries.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-slate-500">
                            Không có phiếu thủ thuật nào ở trạng thái Verified trong kỳ này.
                          </td>
                        </tr>
                      ) : (
                        calcResult.staffSummaries.map((st) => (
                          <tr key={st.staffId}>
                            <td className="px-3 py-2 font-medium text-slate-900">
                              {st.staffName} <span className="font-mono text-slate-500">({st.staffCode})</span>
                            </td>
                            <td className="px-3 py-2 text-slate-600">{st.departmentName || '—'}</td>
                            <td className="px-3 py-2 text-center">
                              {st.verifiedSlipCount} phiếu ({st.assignmentCount} lượt)
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                              {formatVnd(st.totalCommissionAmount)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {st.linkedToPayslip ? (
                                <span className="text-emerald-700 font-medium">Đã cập nhật Payslip</span>
                              ) : (
                                <span className="text-slate-500">Đã tổng hợp</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
