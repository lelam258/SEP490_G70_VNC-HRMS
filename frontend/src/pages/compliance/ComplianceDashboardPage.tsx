import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { complianceApi } from '../../services/complianceApi';
import { useAuthStore } from '../../store/useAuthStore';
import type {
  ComplianceAttentionRow,
  ComplianceCardFilter,
  ComplianceChartItem,
  ComplianceDepartmentOption,
  ComplianceKpiSummary,
  CompliancePositionOption,
  ComplianceSelectOption,
  OperationalComplianceFilterParams,
  OperationalKpiSummary,
} from '../../types/compliance';
import ReportFilterBar from '../../components/compliance/ReportFilterBar';
import Alert from '../../components/ui/Alert';
import Icon from '../../components/ui/Icon';

const EMPTY_KPIS: ComplianceKpiSummary = {
  totalStaff: 0,
  validCount: 0,
  expiringCount: 0,
  expiredCount: 0,
  legacyCount: 0,
  cmeAtRiskCount: 0,
  certExpiringThresholdDays: 90,
  cmeAlertThresholdDays: 180,
};

const EMPTY_OPERATIONAL_KPIS: OperationalKpiSummary = {
  totalActiveStaff: 0,
  expiringContractsCount: 0,
  pendingLeaveRequestsCount: 0,
  onCallShiftsCount: 0,
  totalWorkDaysInPeriod: 0,
};

const DEFAULT_FILTERS: OperationalComplianceFilterParams = {
  departmentId: 'all',
  position: 'all',
  staffStatus: 'active',
  contractType: 'all',
  keyword: '',
  fromDate: '',
  toDate: '',
  payMonth: 'all',
  itemType: 'all',
  maxDaysLeft: '',
  sortBy: 'daysLeft',
  sortDir: 'asc',
};

const DEFAULT_CONTRACT_TYPES: ComplianceSelectOption[] = [
  { value: 'probation', label: 'Hợp đồng thử việc' },
  { value: 'fixed_term', label: 'Hợp đồng xác định thời hạn' },
  { value: 'indefinite', label: 'Hợp đồng không xác định thời hạn' },
  { value: 'part_time', label: 'Hợp đồng bán thời gian / CTV' },
];

const DEFAULT_STAFF_STATUSES: ComplianceSelectOption[] = [
  { value: 'active', label: 'Đang làm việc' },
  { value: 'maternity_leave', label: 'Nghỉ thai sản' },
  { value: 'inactive', label: 'Tạm ngưng / Nghỉ việc' },
];

function sortByDaysLeftAsc(rows: ComplianceAttentionRow[]): ComplianceAttentionRow[] {
  return [...rows].sort((a, b) => {
    const aHasDays = a.daysLeft !== null && a.daysLeft !== undefined;
    const bHasDays = b.daysLeft !== null && b.daysLeft !== undefined;
    if (aHasDays && bHasDays) {
      if (a.daysLeft! !== b.daysLeft!) return a.daysLeft! - b.daysLeft!;
    } else if (aHasDays && !bHasDays) {
      return -1;
    } else if (!aHasDays && bHasDays) {
      return 1;
    }
    return a.staffName.localeCompare(b.staffName);
  });
}

function formatStatusLabelVi(status: string): string {
  switch (status) {
    case 'Expired':
    case 'Đã hết hạn':
      return 'Đã hết hạn';
    case 'Expiring':
    case 'Sắp hết hạn':
      return 'Sắp hết hạn';
    case 'Valid':
    case 'Còn hiệu lực':
      return 'Còn hiệu lực';
    case 'Legacy':
    case 'CCHN cũ':
      return 'CCHN cũ';
    case 'At risk':
    case 'Có nguy cơ':
      return 'Có nguy cơ';
    case 'On track':
    case 'Đúng tiến độ':
      return 'Đúng tiến độ';
    case 'Completed':
    case 'Đã hoàn thành':
      return 'Đã hoàn thành';
    default:
      return status;
  }
}

function formatPositionLabelVi(position: string): string {
  if (!position) return '—';
  const lower = position.trim().toLowerCase();
  if (lower === 'doctor' || lower === 'bs') return 'Bác sĩ';
  if (lower === 'nurse') return 'Điều dưỡng';
  if (lower === 'technician' || lower === 'ktv') return 'Kỹ thuật viên';
  return position;
}

function formatDeadlineDisplayVi(deadlineDisplay: string): string {
  if (!deadlineDisplay) return '-';
  if (deadlineDisplay === 'No expiry') return 'Không thời hạn';
  return deadlineDisplay;
}

function formatItemLabelVi(item: string): string {
  if (!item) return '—';
  if (item === 'Practice license') return 'Giấy phép hành nghề';
  if (item === 'CCHN (legacy)') return 'CCHN (cũ)';
  return item.replace(/\(legacy\)/gi, '(cũ)');
}

function isStatusMatch(
  rawStatus: string,
  target: 'Valid' | 'Expiring' | 'Expired' | 'Legacy'
): boolean {
  switch (target) {
    case 'Valid':
      return rawStatus === 'Valid' || rawStatus === 'Còn hiệu lực';
    case 'Expiring':
      return rawStatus === 'Expiring' || rawStatus === 'Sắp hết hạn';
    case 'Expired':
      return rawStatus === 'Expired' || rawStatus === 'Đã hết hạn';
    case 'Legacy':
      return rawStatus === 'Legacy' || rawStatus === 'CCHN cũ';
  }
}

export default function ComplianceDashboardPage() {
  const user = useAuthStore(state => state.session?.user);
  const isDepartmentManager = user?.role === 'department_head';

  // Bộ lọc đang chỉnh sửa trên thanh Filter Bar (chờ bấm "Áp dụng")
  const [draftFilters, setDraftFilters] =
    useState<OperationalComplianceFilterParams>(DEFAULT_FILTERS);

  // Bộ lọc đang được áp dụng thực tế
  const [appliedFilters, setAppliedFilters] =
    useState<OperationalComplianceFilterParams>(DEFAULT_FILTERS);

  // Thẻ KPI đang được chọn ('attention' = mặc định chỉ hiện các mục cần chú ý)
  const [activeCard, setActiveCard] = useState<ComplianceCardFilter>('attention');
  const [showAllCme, setShowAllCme] = useState<boolean>(false);

  // Dữ liệu Dashboard từ API
  const [kpis, setKpis] = useState<ComplianceKpiSummary>(EMPTY_KPIS);
  const [operationalKpis, setOperationalKpis] =
    useState<OperationalKpiSummary>(EMPTY_OPERATIONAL_KPIS);
  const [staffItems, setStaffItems] = useState<ComplianceAttentionRow[]>([]);
  const [cmeItems, setCmeItems] = useState<ComplianceAttentionRow[]>([]);
  const [chartItems, setChartItems] = useState<ComplianceChartItem[]>([]);
  const [departments, setDepartments] = useState<ComplianceDepartmentOption[]>([]);
  const [positions, setPositions] = useState<CompliancePositionOption[]>([]);
  const [contractTypes, setContractTypes] =
    useState<ComplianceSelectOption[]>(DEFAULT_CONTRACT_TYPES);
  const [staffStatuses, setStaffStatuses] =
    useState<ComplianceSelectOption[]>(DEFAULT_STAFF_STATUSES);
  const [availablePayMonths, setAvailablePayMonths] = useState<string[]>([]);
  const [lockedDepartmentId, setLockedDepartmentId] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [sendingReminder, setSendingReminder] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [notice, setNotice] = useState<string>('');

  const cmeSectionRef = useRef<HTMLDivElement | null>(null);

  const fetchDashboard = useCallback(
    async (filterParams: OperationalComplianceFilterParams) => {
      setLoading(true);
      setError('');
      try {
        const data = await complianceApi.getDashboard(filterParams);
        setKpis(data.kpis);
        if (data.operationalKpis) {
          setOperationalKpis(data.operationalKpis);
        }
        setStaffItems(data.staffItems || []);
        setCmeItems(data.cmeItems || []);
        setChartItems(data.departmentChart || []);
        setDepartments(data.departments || []);
        setPositions(data.positions || []);
        if (data.contractTypes && data.contractTypes.length > 0) {
          setContractTypes(data.contractTypes);
        }
        if (data.staffStatuses && data.staffStatuses.length > 0) {
          setStaffStatuses(data.staffStatuses);
        }
        if (data.availablePayMonths) {
          setAvailablePayMonths(data.availablePayMonths);
        }
        setLockedDepartmentId(data.lockedDepartmentId);

        if (data.lockedDepartmentId) {
          setDraftFilters(prev => ({
            ...prev,
            departmentId: data.lockedDepartmentId!,
          }));
          setAppliedFilters(prev => ({
            ...prev,
            departmentId: data.lockedDepartmentId!,
          }));
        }
      } catch (cause) {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Không tải được dữ liệu bảng theo dõi vận hành & tuân thủ.'
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void fetchDashboard(DEFAULT_FILTERS);
  }, [fetchDashboard]);

  function handleChangeDraft(patch: Partial<OperationalComplianceFilterParams>) {
    setDraftFilters(prev => ({ ...prev, ...patch }));
  }

  function handleApplyFilters() {
    setNotice('');
    if (
      draftFilters.fromDate &&
      draftFilters.toDate &&
      draftFilters.fromDate > draftFilters.toDate
    ) {
      setError('Ngày bắt đầu ("Thời hạn từ ngày") không được lớn hơn "Thời hạn đến ngày".');
      return;
    }

    const nextApplied: OperationalComplianceFilterParams = {
      ...draftFilters,
      departmentId: lockedDepartmentId || draftFilters.departmentId || 'all',
    };
    setAppliedFilters(nextApplied);
    void fetchDashboard(nextApplied);
  }

  function handleResetFilters() {
    setNotice('');
    setError('');
    const resetState: OperationalComplianceFilterParams = {
      ...DEFAULT_FILTERS,
      departmentId: lockedDepartmentId || 'all',
    };
    setDraftFilters(resetState);
    setAppliedFilters(resetState);
    setActiveCard('attention');
    setShowAllCme(false);
    void fetchDashboard(resetState);
  }

  function handleRemoveAppliedFilter(
    key: keyof OperationalComplianceFilterParams | 'activeCard'
  ) {
    setNotice('');
    if (key === 'activeCard') {
      setActiveCard('attention');
      return;
    }

    const defaultVal = DEFAULT_FILTERS[key];
    const nextFilters: OperationalComplianceFilterParams = {
      ...appliedFilters,
      [key]: key === 'departmentId' && lockedDepartmentId ? lockedDepartmentId : defaultVal,
    };
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    void fetchDashboard(nextFilters);
  }

  function handleCardClick(card: ComplianceCardFilter) {
    setActiveCard(prev => {
      const next = prev === card ? 'attention' : card;
      if (next === 'cme_at_risk') {
        setTimeout(() => {
          cmeSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 60);
      }
      return next;
    });
  }

  // Phần 1: Danh sách chứng chỉ (xếp theo ngày hết hạn tăng dần)
  const displayedCertificateRows = useMemo(() => {
    if (appliedFilters.itemType === 'cme_cycle') return [];

    const filtered = staffItems.filter(row => {
      switch (activeCard) {
        case 'total':
          return true;
        case 'valid':
          return isStatusMatch(row.status, 'Valid') && !row.requiresAttention;
        case 'expiring':
          return isStatusMatch(row.status, 'Expiring');
        case 'expired':
          return isStatusMatch(row.status, 'Expired');
        case 'legacy':
          return isStatusMatch(row.status, 'Legacy');
        case 'cme_at_risk':
          return row.isCmeAtRisk;
        case 'attention':
        default:
          return row.requiresAttention;
      }
    });
    return sortByDaysLeftAsc(filtered);
  }, [staffItems, activeCard, appliedFilters.itemType]);

  // Phần 2: Danh sách chu kỳ CME (xếp theo hạn chu kỳ CME tăng dần)
  const displayedCmeRows = useMemo(() => {
    if (appliedFilters.itemType === 'certificate') return [];

    const filtered = cmeItems.filter(row => {
      if (activeCard === 'total' || showAllCme) return true;
      if (activeCard === 'valid') return !row.isCmeAtRisk;
      return row.isCmeAtRisk;
    });
    return sortByDaysLeftAsc(filtered);
  }, [cmeItems, activeCard, showAllCme, appliedFilters.itemType]);

  function getStatusBadgeClasses(status: string): string {
    switch (status) {
      case 'Expired':
      case 'Đã hết hạn':
        return 'border-red-300 bg-red-50/70 text-red-700';
      case 'Expiring':
      case 'Sắp hết hạn':
        return 'border-amber-300 bg-amber-50/70 text-amber-700';
      case 'At risk':
      case 'Có nguy cơ':
        return 'border-amber-400 bg-amber-50 text-amber-800';
      case 'Legacy':
      case 'CCHN cũ':
        return 'border-slate-200 bg-slate-50 text-slate-600';
      case 'Valid':
      case 'Còn hiệu lực':
      case 'On track':
      case 'Đúng tiến độ':
      case 'Completed':
      case 'Đã hoàn thành':
        return 'border-emerald-300 bg-emerald-50/70 text-emerald-700';
      default:
        return 'border-slate-300 bg-slate-50 text-slate-700';
    }
  }

  function handleExportReport() {
    const combinedRows = [...displayedCertificateRows, ...displayedCmeRows];
    if (combinedRows.length === 0) {
      setError('Không có dữ liệu trong danh sách hiện tại để xuất báo cáo.');
      return;
    }

    const headers = [
      'Phân mục',
      'Mã nhân viên',
      'Họ và tên',
      'Phòng ban / Khoa',
      'Chức danh',
      'Chứng chỉ / Chu kỳ',
      'Thời hạn',
      'Số ngày còn lại',
      'Tiến độ CME',
      'Trạng thái',
    ];

    const escapeCsv = (val: string | number | null | undefined) => {
      const str = val === null || val === undefined ? '-' : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvLines = [
      headers.join(','),
      ...displayedCertificateRows.map(r =>
        [
          escapeCsv('Chứng chỉ'),
          escapeCsv(r.staffCode),
          escapeCsv(r.staffName),
          escapeCsv(r.departmentName),
          escapeCsv(formatPositionLabelVi(r.position)),
          escapeCsv(formatItemLabelVi(r.item)),
          escapeCsv(formatDeadlineDisplayVi(r.deadlineDisplay)),
          escapeCsv(r.daysLeft !== null && r.daysLeft !== undefined ? r.daysLeft : '-'),
          escapeCsv(r.cmeDisplay),
          escapeCsv(formatStatusLabelVi(r.status)),
        ].join(',')
      ),
      ...displayedCmeRows.map(r =>
        [
          escapeCsv('Chu kỳ CME'),
          escapeCsv(r.staffCode),
          escapeCsv(r.staffName),
          escapeCsv(r.departmentName),
          escapeCsv(formatPositionLabelVi(r.position)),
          escapeCsv(formatItemLabelVi(r.item)),
          escapeCsv(formatDeadlineDisplayVi(r.deadlineDisplay)),
          escapeCsv(r.daysLeft !== null && r.daysLeft !== undefined ? r.daysLeft : '-'),
          escapeCsv(r.cmeDisplay),
          escapeCsv(formatStatusLabelVi(r.status)),
        ].join(',')
      ),
    ];

    const csvContent = '\uFEFF' + csvLines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute('download', `bao-cao-van-hanh-tuan-thu-${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setNotice(`Đã xuất báo cáo (${combinedRows.length} bản ghi) thành công.`);
  }

  async function handleSendReminder() {
    const attentionRows = [
      ...displayedCertificateRows.filter(
        r => r.requiresAttention || !isStatusMatch(r.status, 'Valid')
      ),
      ...displayedCmeRows.filter(r => r.isCmeAtRisk),
    ];

    if (attentionRows.length === 0) {
      setError('Không có chứng chỉ hoặc chu kỳ CME nào cần nhắc nhở trong bộ lọc hiện tại.');
      return;
    }

    setSendingReminder(true);
    setError('');
    setNotice('');
    try {
      const uniqueStaffIds = Array.from(new Set(attentionRows.map(r => r.staffId)));
      const deptId = lockedDepartmentId || appliedFilters.departmentId;
      const result = await complianceApi.sendReminder({
        staffIds: uniqueStaffIds,
        departmentId: deptId && deptId !== 'all' ? deptId : null,
        position:
          appliedFilters.position && appliedFilters.position !== 'all'
            ? appliedFilters.position
            : null,
        statusFilter: activeCard,
      });
      setNotice(result.message);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không gửi được thông báo nhắc nhở.'
      );
    } finally {
      setSendingReminder(false);
    }
  }

  const cardFilterLabel = useMemo(() => {
    switch (activeCard) {
      case 'total':
        return 'Đang lọc: Tất cả chứng chỉ & chu kỳ CME';
      case 'valid':
        return 'Đang lọc: Còn hiệu lực';
      case 'expiring':
        return `Đang lọc: Sắp hết hạn (<= ${kpis.certExpiringThresholdDays} ngày)`;
      case 'expired':
        return 'Đang lọc: Đã hết hạn';
      case 'legacy':
        return 'Đang lọc: CCHN cũ (Không thời hạn)';
      case 'cme_at_risk':
        return `Đang lọc: CME có nguy cơ (<= ${kpis.cmeAlertThresholdDays} ngày)`;
      default:
        return null;
    }
  }, [activeCard, kpis.certExpiringThresholdDays, kpis.cmeAlertThresholdDays]);

  const showCertificateSection = appliedFilters.itemType !== 'cme_cycle';
  const showCmeSection = appliedFilters.itemType !== 'certificate';

  return (
    <section className="max-w-6xl mx-auto space-y-6">
      {/* Tiêu đề trang */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Báo cáo Vận hành &amp; Tuân thủ (Chứng chỉ &amp; CME)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Giám sát tổng thể vận hành nhân sự, thời hạn chứng chỉ hành nghề và tiến độ đào tạo liên tục (CME).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportReport}
            disabled={
              loading ||
              (displayedCertificateRows.length === 0 && displayedCmeRows.length === 0)
            }
            className="px-3.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer disabled:opacity-50"
          >
            Xuất báo cáo (CSV)
          </button>
          <button
            type="button"
            onClick={() => void handleSendReminder()}
            disabled={loading || sendingReminder}
            className="px-3.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer disabled:opacity-50"
          >
            {sendingReminder ? 'Đang gửi…' : 'Gửi nhắc nhở'}
          </button>
        </div>
      </div>

      {/* Thanh Bộ lọc Báo cáo Vận hành & Tuân thủ (Operational & Compliance Report Filters) */}
      <ReportFilterBar
        draftFilters={draftFilters}
        appliedFilters={appliedFilters}
        activeCard={activeCard}
        departments={departments}
        positions={positions}
        contractTypes={contractTypes}
        staffStatuses={staffStatuses}
        availablePayMonths={availablePayMonths}
        lockedDepartmentId={lockedDepartmentId}
        isDepartmentManager={isDepartmentManager}
        loading={loading}
        certThresholdDays={kpis.certExpiringThresholdDays}
        cmeThresholdDays={kpis.cmeAlertThresholdDays}
        onChangeDraft={handleChangeDraft}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        onRemoveAppliedFilter={handleRemoveAppliedFilter}
      />

      {/* Thông báo lỗi / thành công */}
      {error && <Alert variant="error">{error}</Alert>}
      {notice && (
        <Alert variant="success">
          {notice}
          <button
            className="icon-button"
            style={{ marginLeft: 'auto' }}
            onClick={() => setNotice('')}
            aria-label="Đóng thông báo"
          >
            <Icon name="close" size={16} />
          </button>
        </Alert>
      )}

      {/* Chỉ số Vận hành nhanh (Operational Summary Strip) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50/80 border border-slate-200 rounded-md px-4 py-3 flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-medium text-slate-500">
              Nhân sự đang làm việc
            </span>
            <span className="text-lg font-bold text-slate-900">
              {operationalKpis.totalActiveStaff}
            </span>
          </div>
          <span className="text-slate-400">
            <Icon name="users" size={18} />
          </span>
        </div>

        <div className="bg-slate-50/80 border border-slate-200 rounded-md px-4 py-3 flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-medium text-slate-500">
              HĐ sắp đến hạn (&lt;= 60 ngày)
            </span>
            <span className="text-lg font-bold text-slate-900">
              {operationalKpis.expiringContractsCount}
            </span>
          </div>
          <span className="text-slate-400">
            <Icon name="fileText" size={18} />
          </span>
        </div>

        <div className="bg-slate-50/80 border border-slate-200 rounded-md px-4 py-3 flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-medium text-slate-500">
              Ca trực trong kỳ lọc
            </span>
            <span className="text-lg font-bold text-slate-900">
              {operationalKpis.onCallShiftsCount}
            </span>
          </div>
          <span className="text-slate-400">
            <Icon name="clock" size={18} />
          </span>
        </div>

        <div className="bg-slate-50/80 border border-slate-200 rounded-md px-4 py-3 flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-medium text-slate-500">
              Đơn nghỉ phép / Ngày công
            </span>
            <span className="text-lg font-bold text-slate-900">
              {operationalKpis.pendingLeaveRequestsCount} đơn /{' '}
              {operationalKpis.totalWorkDaysInPeriod} công
            </span>
          </div>
          <span className="text-slate-400">
            <Icon name="calendar" size={18} />
          </span>
        </div>
      </div>

      {/* 6 Thẻ chỉ số KPI Tuân thủ (Bấm vào để lọc danh sách) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* 1. Tổng nhân sự */}
        <button
          type="button"
          onClick={() => handleCardClick('total')}
          title="Tổng số nhân viên trong bộ lọc hiện tại. Mỗi nhân viên được tính 1 lần theo trạng thái rủi ro cao nhất."
          className={`flex flex-col items-center justify-center p-5 rounded-md border text-center transition cursor-pointer bg-white ${
            activeCard === 'total'
              ? 'border-slate-800 ring-2 ring-slate-800/15 shadow-sm'
              : 'border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <span className="text-3xl font-bold text-slate-900 leading-tight">
            {kpis.totalStaff}
          </span>
          <span className="text-xs text-slate-600 mt-1.5 font-medium">Tổng nhân sự</span>
        </button>

        {/* 2. Còn hiệu lực */}
        <button
          type="button"
          onClick={() => handleCardClick('valid')}
          title="Nhân viên có tất cả chứng chỉ đều đang còn hiệu lực (không Sắp hết hạn, Đã hết hạn hoặc CCHN cũ)."
          className={`flex flex-col items-center justify-center p-5 rounded-md border text-center transition cursor-pointer bg-white ${
            activeCard === 'valid'
              ? 'border-emerald-600 ring-2 ring-emerald-600/15 shadow-sm'
              : 'border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <span className="text-3xl font-bold text-slate-900 leading-tight">
            {kpis.validCount}
          </span>
          <span className="text-xs text-slate-600 mt-1.5 font-medium">Còn hiệu lực</span>
        </button>

        {/* 3. Sắp hết hạn */}
        <button
          type="button"
          onClick={() => handleCardClick('expiring')}
          title={`Nhân viên có chứng chỉ sắp hết hạn trong ngưỡng cảnh báo (<= ${kpis.certExpiringThresholdDays} ngày).`}
          className={`flex flex-col items-center justify-center p-5 rounded-md border text-center transition cursor-pointer bg-white ${
            activeCard === 'expiring'
              ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-sm'
              : 'border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <span className="text-3xl font-bold text-slate-900 leading-tight">
            {kpis.expiringCount}
          </span>
          <span className="text-xs text-slate-700 mt-1.5 font-medium">Sắp hết hạn</span>
        </button>

        {/* 4. Đã hết hạn */}
        <button
          type="button"
          onClick={() => handleCardClick('expired')}
          title="Nhân viên có chứng chỉ đã quá hạn nhưng chưa được cấp đổi/thay thế."
          className={`flex flex-col items-center justify-center p-5 rounded-md border text-center transition cursor-pointer bg-white ${
            activeCard === 'expired'
              ? 'border-red-500 ring-2 ring-red-500/20 shadow-sm'
              : 'border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <span className="text-3xl font-bold text-slate-900 leading-tight">
            {kpis.expiredCount}
          </span>
          <span className="text-xs text-slate-700 mt-1.5 font-medium">Đã hết hạn</span>
        </button>

        {/* 5. CCHN cũ */}
        <button
          type="button"
          onClick={() => handleCardClick('legacy')}
          title="Nhân viên chỉ có CCHN cũ (không ghi ngày hết hạn) và chưa chuyển đổi sang Giấy phép hành nghề mới (GB-C04)."
          className={`flex flex-col items-center justify-center p-5 rounded-md border text-center transition cursor-pointer bg-white ${
            activeCard === 'legacy'
              ? 'border-slate-500 ring-2 ring-slate-500/20 shadow-sm'
              : 'border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <span className="text-3xl font-bold text-slate-500 leading-tight">
            {kpis.legacyCount}
          </span>
          <span className="text-xs text-slate-500 mt-1.5 font-medium">CCHN cũ</span>
        </button>

        {/* 6. CME có nguy cơ */}
        <button
          type="button"
          onClick={() => handleCardClick('cme_at_risk')}
          title={`Nhân viên còn thiếu giờ/chỉ tiêu CME và thời gian còn lại của chu kỳ <= ${kpis.cmeAlertThresholdDays} ngày. Chu kỳ không có ngày kết thúc sẽ không tính.`}
          className={`flex flex-col items-center justify-center p-5 rounded-md border text-center transition cursor-pointer bg-white ${
            activeCard === 'cme_at_risk'
              ? 'border-slate-900 ring-2 ring-slate-900/15 shadow-sm'
              : 'border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <span className="text-3xl font-bold text-slate-900 leading-tight">
            {kpis.cmeAtRiskCount}
          </span>
          <span className="text-xs text-slate-700 mt-1.5 font-medium">CME có nguy cơ</span>
        </button>
      </div>

      {/* PHẦN 1: THEO DÕI CHỨNG CHỈ (Xét theo ngày hết hạn chứng chỉ) */}
      {showCertificateSection && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  1. Chứng chỉ chuyên môn / Hành nghề cần chú ý (Xét theo ngày hết hạn)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Hiển thị tất cả chứng chỉ của nhân viên được sắp xếp theo ngày hết hạn tăng dần (Đã hết hạn, Sắp hết hạn, CCHN cũ).
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-100 text-slate-700">
                {displayedCertificateRows.length} chứng chỉ
              </span>
              {cardFilterLabel && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {cardFilterLabel}
                  <button
                    type="button"
                    onClick={() => setActiveCard('attention')}
                    className="text-slate-500 hover:text-slate-800 font-bold ml-1 cursor-pointer bg-transparent border-0 p-0"
                    title="Bỏ lọc"
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Đang tải dữ liệu tuân thủ chứng chỉ…
            </div>
          ) : displayedCertificateRows.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded">
              Không có chứng chỉ nào khớp với bộ lọc hiện tại.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-200 text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-bold text-slate-800">
                    <th className="border border-slate-200 px-3.5 py-2.5">Nhân viên</th>
                    <th className="border border-slate-200 px-3.5 py-2.5">Khoa / Phòng</th>
                    <th className="border border-slate-200 px-3.5 py-2.5">Chức danh</th>
                    <th className="border border-slate-200 px-3.5 py-2.5">Chứng chỉ</th>
                    <th className="border border-slate-200 px-3.5 py-2.5">Ngày hết hạn</th>
                    <th className="border border-slate-200 px-3.5 py-2.5">Số ngày còn lại</th>
                    <th className="border border-slate-200 px-3.5 py-2.5">Trạng thái</th>
                    <th className="border border-slate-200 px-3.5 py-2.5">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedCertificateRows.map((row, idx) => (
                    <tr
                      key={
                        row.certificateId
                          ? `cert-${row.certificateId}`
                          : `staff-${row.staffId}-${idx}`
                      }
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="border border-slate-200 px-3.5 py-2.5 text-slate-800 font-medium">
                        <div>{row.staffName}</div>
                        <div className="text-xs text-slate-400 font-normal">
                          {row.staffCode}
                        </div>
                      </td>
                      <td className="border border-slate-200 px-3.5 py-2.5 text-slate-600">
                        {row.departmentName}
                      </td>
                      <td className="border border-slate-200 px-3.5 py-2.5 text-slate-600">
                        {formatPositionLabelVi(row.position)}
                      </td>
                      <td className="border border-slate-200 px-3.5 py-2.5 text-slate-700 font-medium">
                        {formatItemLabelVi(row.item)}
                      </td>
                      <td className="border border-slate-200 px-3.5 py-2.5 text-slate-700">
                        {formatDeadlineDisplayVi(row.deadlineDisplay)}
                      </td>
                      <td className="border border-slate-200 px-3.5 py-2.5 text-slate-700">
                        {row.daysLeft !== null && row.daysLeft !== undefined
                          ? `${row.daysLeft} ngày`
                          : '-'}
                      </td>
                      <td className="border border-slate-200 px-3.5 py-2.5">
                        <span
                          className={`inline-block px-3 py-0.5 rounded border text-xs font-medium text-center min-w-[84px] ${getStatusBadgeClasses(
                            row.status
                          )}`}
                        >
                          {formatStatusLabelVi(row.status)}
                        </span>
                      </td>
                      <td className="border border-slate-200 px-3.5 py-2.5">
                        <Link
                          to={row.actionUrl}
                          className="text-slate-900 font-medium underline hover:text-teal-700"
                        >
                          Mở
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* PHẦN 2: THEO DÕI CHU KỲ CME (Phần theo dõi chu kỳ & tiến độ CME riêng biệt) */}
      {showCmeSection && (
        <div
          ref={cmeSectionRef}
          className="bg-white border border-slate-200 rounded-lg p-6 shadow-2xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  2. Theo dõi Chu kỳ Đào tạo liên tục (CME)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Xét theo ngày kết thúc chu kỳ CME. Chứng chỉ không điền số tín chỉ CME yêu cầu sẽ hiển thị tiến độ 0 / 1 (hoặc 1 / 1).
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-100 text-slate-700">
                {displayedCmeRows.length} chu kỳ CME
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAllCme(prev => !prev)}
                className={`px-3 py-1.5 rounded border text-xs font-medium transition cursor-pointer ${
                  showAllCme
                    ? 'border-teal-600 bg-teal-50 text-teal-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {showAllCme ? 'Chỉ hiện CME có nguy cơ' : 'Xem tất cả chu kỳ CME'}
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Đang tải dữ liệu chu kỳ CME…
            </div>
          ) : displayedCmeRows.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded">
              Không có chu kỳ CME nào thuộc diện cảnh báo (Có nguy cơ). Bấm &ldquo;Xem tất cả chu kỳ CME&rdquo; để xem toàn bộ.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-200 text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs font-bold text-slate-800">
                    <th className="border border-slate-200 px-3.5 py-2.5">Nhân viên</th>
                    <th className="border border-slate-200 px-3.5 py-2.5">Khoa / Phòng</th>
                    <th className="border border-slate-200 px-3.5 py-2.5">Chức danh</th>
                    <th className="border border-slate-200 px-3.5 py-2.5">Chứng chỉ / Chu kỳ</th>
                    <th className="border border-slate-200 px-3.5 py-2.5">Hạn chu kỳ CME</th>
                    <th className="border border-slate-200 px-3.5 py-2.5">Số ngày còn lại</th>
                    <th className="border border-slate-200 px-3.5 py-2.5">Tiến độ CME</th>
                    <th className="border border-slate-200 px-3.5 py-2.5">Trạng thái</th>
                    <th className="border border-slate-200 px-3.5 py-2.5">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedCmeRows.map((row, idx) => (
                    <tr
                      key={
                        row.certificateId
                          ? `cme-${row.certificateId}`
                          : `cme-staff-${row.staffId}-${idx}`
                      }
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="border border-slate-200 px-3.5 py-2.5 text-slate-800 font-medium">
                        <div>{row.staffName}</div>
                        <div className="text-xs text-slate-400 font-normal">
                          {row.staffCode}
                        </div>
                      </td>
                      <td className="border border-slate-200 px-3.5 py-2.5 text-slate-600">
                        {row.departmentName}
                      </td>
                      <td className="border border-slate-200 px-3.5 py-2.5 text-slate-600">
                        {formatPositionLabelVi(row.position)}
                      </td>
                      <td className="border border-slate-200 px-3.5 py-2.5 text-slate-700 font-medium">
                        {formatItemLabelVi(row.item)}
                      </td>
                      <td className="border border-slate-200 px-3.5 py-2.5 text-slate-700">
                        {formatDeadlineDisplayVi(row.deadlineDisplay)}
                      </td>
                      <td className="border border-slate-200 px-3.5 py-2.5 text-slate-700">
                        {row.daysLeft !== null && row.daysLeft !== undefined
                          ? `${row.daysLeft} ngày`
                          : '-'}
                      </td>
                      <td className="border border-slate-200 px-3.5 py-2.5 text-slate-800 font-semibold">
                        {row.cmeDisplay}
                      </td>
                      <td className="border border-slate-200 px-3.5 py-2.5">
                        <span
                          className={`inline-block px-3 py-0.5 rounded border text-xs font-medium text-center min-w-[84px] ${getStatusBadgeClasses(
                            row.status
                          )}`}
                        >
                          {formatStatusLabelVi(row.status)}
                        </span>
                      </td>
                      <td className="border border-slate-200 px-3.5 py-2.5">
                        <Link
                          to={row.actionUrl}
                          className="text-slate-900 font-medium underline hover:text-teal-700"
                        >
                          Mở
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Biểu đồ tổng quan tuân thủ theo Phòng ban / Khoa */}
      {!loading && chartItems.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-800">
              Thống kê Tuân thủ theo Phòng ban / Khoa
            </h3>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" />
                Còn hiệu lực
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-400 inline-block" />
                Sắp hết hạn
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-red-500 inline-block" />
                Đã hết hạn
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-400 inline-block" />
                CCHN cũ
              </span>
            </div>
          </div>

          <div className="space-y-2.5">
            {chartItems.map(dept => {
              const total =
                dept.validCount +
                dept.expiringCount +
                dept.expiredCount +
                dept.legacyCount;
              const pct = (val: number) =>
                total > 0 ? Math.round((val / total) * 100) : 0;

              return (
                <div key={dept.departmentName} className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span className="font-medium">{dept.departmentName}</span>
                    <span className="text-slate-500">
                      {total} nhân viên (CME có nguy cơ: {dept.cmeAtRiskCount})
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                    {dept.validCount > 0 && (
                      <div
                        className="bg-emerald-500 h-full"
                        style={{ width: `${pct(dept.validCount)}%` }}
                        title={`Còn hiệu lực: ${dept.validCount}`}
                      />
                    )}
                    {dept.expiringCount > 0 && (
                      <div
                        className="bg-amber-400 h-full"
                        style={{ width: `${pct(dept.expiringCount)}%` }}
                        title={`Sắp hết hạn: ${dept.expiringCount}`}
                      />
                    )}
                    {dept.expiredCount > 0 && (
                      <div
                        className="bg-red-500 h-full"
                        style={{ width: `${pct(dept.expiredCount)}%` }}
                        title={`Đã hết hạn: ${dept.expiredCount}`}
                      />
                    )}
                    {dept.legacyCount > 0 && (
                      <div
                        className="bg-slate-400 h-full"
                        style={{ width: `${pct(dept.legacyCount)}%` }}
                        title={`CCHN cũ: ${dept.legacyCount}`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
