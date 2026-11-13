import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '../../components/ui/Alert';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import ProcedureReviewModal from '../../components/payroll/ProcedureReviewModal';
import { procedureSlipApi } from '../../services/procedureSlipApi';
import { useAuthStore } from '../../store/useAuthStore';
import type {
  CalculateMonthlyCommissionResult,
  ProcedureLookups,
  ProcedureSlipListItem,
  ProcedureSlipListResponse,
} from '../../types/procedureSlip';
import { formatDateOnly, formatVnd } from '../../utils/format';
import {
  getProcedureStatusBadgeClass,
  PROCEDURE_STATUS_LABELS,
} from '../../utils/procedureHelpers';

type PeriodMode = 'month' | 'quarter' | 'year' | 'all' | 'custom';

export default function ProcedureListPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.session?.user);
  const role = user?.role || 'employee';

  // Phân nhóm vai trò:
  // - HR Staff & Accountant: Chỉ xem và kiểm duyệt (Bảng Phiếu chờ xử lý + Bảng Lịch sử duyệt), không lập/sửa phiếu
  // - Medical Staff, Department Head, HR Manager: Xem cá nhân (hoặc theo khoa) và lập/sửa phiếu của mình
  const isAccountant = role === 'accountant';
  const isHrStaff = role === 'hr_staff';
  const isReviewerRole = isHrStaff || isAccountant;
  const isDeptHead = role === 'department_head';

  const now = useMemo(() => new Date(), []);

  // ============================================================================
  // STATE DÀNH CHO MEDICAL STAFF / DEPARTMENT HEAD / HR MANAGER (CHẾ ĐỘ CÁ NHÂN)
  // ============================================================================
  const [viewScope, setViewScope] = useState<'mine' | 'department'>(
    isDeptHead ? 'department' : 'mine'
  );
  const [periodMode, setPeriodMode] = useState<PeriodMode>('month');
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(
    Math.floor(now.getMonth() / 3) + 1
  );
  const [serviceId, setServiceId] = useState<string>('');
  const [afterHoursFilter, setAfterHoursFilter] = useState<string>('all');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);

  // ============================================================================
  // STATE BỘ LỌC LỊCH SỬ DUYỆT DÀNH CHO HR STAFF & ACCOUNTANT
  // ============================================================================
  const [historyIndicatingQuery, setHistoryIndicatingQuery] = useState<string>('');
  const [historyPerformingQuery, setHistoryPerformingQuery] = useState<string>('');
  const [historyMonth, setHistoryMonth] = useState<string>(''); // '' = Tất cả tháng, hoặc 'YYYY-MM'
  const [historyStatus, setHistoryStatus] = useState<string>('all'); // 'all' | 'verified' | 'rejected' | 'hr_checked'
  const [historyPage, setHistoryPage] = useState<number>(1);
  const [historyPageSize, setHistoryPageSize] = useState<number>(5);

  // Common data state
  const [lookups, setLookups] = useState<ProcedureLookups | null>(null);
  const [data, setData] = useState<ProcedureSlipListResponse | null>(null);
  const [allReviewerItems, setAllReviewerItems] = useState<ProcedureSlipListItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [notice, setNotice] = useState<string>('');

  // Quick review modal state
  const [reviewModalSlip, setReviewModalSlip] = useState<ProcedureSlipListItem | null>(null);
  const [reviewMode, setReviewMode] = useState<'hr_check' | 'accountant_verify'>('accountant_verify');
  const [reviewDefaultDecision, setReviewDefaultDecision] = useState<'approve' | 'reject'>('approve');

  // Monthly commission calculation modal state (Accountant)
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

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isReviewerRole) {
        // Tải toàn bộ phiếu để tách rõ: Bảng 1 (Phiếu chờ duyệt) & Bảng 2 (Lịch sử đã xử lý)
        const res = await procedureSlipApi.listSlips({
          periodType: 'all',
          scope: 'all',
          page: 1,
          pageSize: 200,
        });
        setData(res);
        setAllReviewerItems(res.items);
      } else {
        const res = await procedureSlipApi.listSlips({
          periodType: periodMode === 'custom' ? undefined : periodMode,
          year:
            periodMode === 'month' || periodMode === 'quarter' || periodMode === 'year'
              ? selectedYear
              : undefined,
          month: periodMode === 'month' ? selectedMonth : undefined,
          quarter: periodMode === 'quarter' ? selectedQuarter : undefined,
          serviceId: serviceId || undefined,
          isAfterHours:
            afterHoursFilter === 'after_hours'
              ? true
              : afterHoursFilter === 'in_hours'
              ? false
              : undefined,
          scope: isDeptHead ? viewScope : 'mine',
          page,
          pageSize,
        });
        setData(res);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách phiếu thủ thuật.');
    } finally {
      setLoading(false);
    }
  }, [
    isReviewerRole,
    periodMode,
    selectedYear,
    selectedMonth,
    selectedQuarter,
    serviceId,
    afterHoursFilter,
    isDeptHead,
    viewScope,
    page,
    pageSize,
  ]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ============================================================================
  // DỮ LIỆU TÁCH BẢNG CHO HR STAFF & ACCOUNTANT
  // ============================================================================

  // Bảng 1: Danh sách phiếu đang chờ xử lý của vai trò hiện tại
  // - HR Staff: chỉ hiện phiếu 'pending' (khi duyệt hoặc từ chối sẽ biến mất khỏi bảng này)
  // - Accountant: chỉ hiện phiếu 'hr_checked' (khi xác minh hoặc từ chối sẽ biến mất khỏi bảng này)
  const pendingQueueItems = useMemo(() => {
    if (!isReviewerRole) return [];
    if (isHrStaff) {
      return allReviewerItems.filter((item) => item.status === 'pending');
    }
    return allReviewerItems.filter((item) => item.status === 'hr_checked');
  }, [isReviewerRole, isHrStaff, allReviewerItems]);

  // Bảng 2: Lịch sử các phiếu đã xử lý (lọc theo BS chỉ định, Người thực hiện chính, Tháng, Trạng thái)
  const filteredHistoryItems = useMemo(() => {
    if (!isReviewerRole) return [];

    // Tập phiếu đã qua xử lý
    const baseHistory = allReviewerItems.filter((item) => {
      if (isHrStaff) {
        return (
          item.status === 'hr_checked' ||
          item.status === 'verified' ||
          item.status === 'rejected'
        );
      }
      // Accountant: xem các phiếu đã xác minh hoặc đã bị từ chối
      return item.status === 'verified' || item.status === 'rejected';
    });

    return baseHistory.filter((item) => {
      // 1. Lọc theo Bác sĩ chỉ định (tên hoặc mã)
      if (historyIndicatingQuery.trim()) {
        const q = historyIndicatingQuery.trim().toLowerCase();
        const indName = (item.indicatingStaffName || item.recordedByName || '').toLowerCase();
        const indCode = (item.indicatingStaffCode || '').toLowerCase();
        const combined = `${indCode} - ${indName}`.toLowerCase();
        if (!indName.includes(q) && !indCode.includes(q) && !combined.includes(q)) {
          return false;
        }
      }

      // 2. Lọc theo Người thực hiện chính (tên hoặc mã)
      if (historyPerformingQuery.trim()) {
        const q = historyPerformingQuery.trim().toLowerCase();
        const perfName = (item.performingStaffName || '').toLowerCase();
        const perfCode = (item.performingStaffCode || '').toLowerCase();
        const combined = `${perfCode} - ${perfName}`.toLowerCase();
        if (!perfName.includes(q) && !perfCode.includes(q) && !combined.includes(q)) {
          return false;
        }
      }

      // 3. Lọc theo Tháng (YYYY-MM)
      if (historyMonth.trim()) {
        if (!item.procedureDate.startsWith(historyMonth.trim())) {
          return false;
        }
      }

      // 4. Lọc theo Trạng thái (Đã xác minh / Bị từ chối / Đã chuyển Kế toán)
      if (historyStatus !== 'all') {
        if (item.status !== historyStatus) {
          return false;
        }
      }

      return true;
    });
  }, [
    isReviewerRole,
    isHrStaff,
    allReviewerItems,
    historyIndicatingQuery,
    historyPerformingQuery,
    historyMonth,
    historyStatus,
  ]);

  const pagedHistoryItems = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return filteredHistoryItems.slice(start, start + historyPageSize);
  }, [filteredHistoryItems, historyPage, historyPageSize]);

  const handleOpenReview = (
    slip: ProcedureSlipListItem,
    mode: 'hr_check' | 'accountant_verify',
    decision: 'approve' | 'reject'
  ) => {
    setReviewModalSlip(slip);
    setReviewMode(mode);
    setReviewDefaultDecision(decision);
  };

  const handleCalculateMonthlyCommission = async (e: React.FormEvent) => {
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
        `Đã tổng hợp hoa hồng tháng ${res.payMonth}: ${res.verifiedSlipCount} phiếu hợp lệ, cập nhật ${res.updatedPayslipCount} phiếu lương (Tổng: ${formatVnd(
          res.totalCommissionCalculated
        )}).`
      );
      void loadData();
    } catch (err: unknown) {
      setCalcError(err instanceof Error ? err.message : 'Không thể tính hoa hồng tháng.');
    } finally {
      setCalculating(false);
    }
  };

  // ============================================================================
  // CỘT BẢNG 1 (PHIẾU CHỜ DUYỆT) DÀNH CHO HR STAFF & ACCOUNTANT
  // ============================================================================
  const pendingQueueColumns: Column<ProcedureSlipListItem>[] = [
    {
      key: 'slipNumber',
      label: 'Số phiếu & Ngày thực hiện',
      render: (r) => (
        <div>
          <button
            type="button"
            onClick={() => navigate(`/procedures/${r.slipId}`)}
            className="font-mono font-semibold text-sky-700 hover:text-sky-900 hover:underline text-sm cursor-pointer"
          >
            {r.slipNumber}
          </button>
          <div className="text-xs text-slate-500 mt-0.5">
            Ngày: <span className="font-medium text-slate-700">{formatDateOnly(r.procedureDate)}</span>
            {r.patientCode ? ` • BN: ${r.patientCode}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'service',
      label: 'Thủ thuật & Khoa/Phòng',
      render: (r) => (
        <div>
          <div className="font-medium text-slate-900 text-sm">{r.serviceName}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            <span className="font-mono">{r.serviceCode}</span>
            {' • '}
            <span className="text-slate-700">{r.departmentName || 'Chưa phân khoa'}</span>
            {r.isAfterHours && (
              <span className="ml-1.5 inline-block px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 font-medium text-[11px]">
                Ngoài giờ
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'doctors',
      label: 'BS chỉ định & Thực hiện chính',
      render: (r) => (
        <div className="text-xs space-y-1">
          <div>
            <span className="text-slate-500">BS chỉ định: </span>
            <strong className="text-slate-900">
              {r.indicatingStaffName || r.recordedByName || '—'}
            </strong>
          </div>
          <div>
            <span className="text-slate-500">Thực hiện chính: </span>
            <strong className="text-sky-800">
              {r.performingStaffName || '—'}
            </strong>
            <span className="text-slate-400"> ({r.participantCount} người trong kíp)</span>
          </div>
        </div>
      ),
    },
    {
      key: 'transferFlow',
      label: 'Chuyển đến từ ai',
      render: (r) => (
        <div className="text-xs space-y-1">
          <div>
            <span className="text-slate-500">Người lập: </span>
            <span className="font-medium text-slate-800">
              {r.recordedByName || r.indicatingStaffName || 'Nhân viên y tế'}
            </span>
          </div>
          {isAccountant && (
            <div className="text-emerald-700 font-medium">
              → HR kiểm tra: {r.hrCheckedByName || 'Nhân sự (HR)'}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'financials',
      label: 'Viện phí & Hoa hồng',
      render: (r) => (
        <div className="text-right font-[tabular-nums]">
          <div className="text-xs text-slate-500">
            Thu: <strong className="text-slate-800">{formatVnd(r.chargedAmount)}</strong>
          </div>
          <div className="text-xs font-bold text-emerald-700 mt-0.5">
            HH: {formatVnd(r.totalCommissionAmount)}
          </div>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Đánh giá & Xử lý',
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => navigate(`/procedures/${r.slipId}`)}
            className="button text-xs py-1 px-2.5"
          >
            Xem chi tiết
          </button>

          {!r.isPeriodLocked && isHrStaff && r.status === 'pending' && (
            <>
              <button
                type="button"
                onClick={() => handleOpenReview(r, 'hr_check', 'approve')}
                className="button text-xs py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
              >
                ✓ Duyệt
              </button>
              <button
                type="button"
                onClick={() => handleOpenReview(r, 'hr_check', 'reject')}
                className="button text-xs py-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300"
              >
                ✕ Từ chối
              </button>
            </>
          )}

          {!r.isPeriodLocked && isAccountant && r.status === 'hr_checked' && (
            <>
              <button
                type="button"
                onClick={() => handleOpenReview(r, 'accountant_verify', 'approve')}
                className="button text-xs py-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600"
              >
                ✓ Xác minh
              </button>
              <button
                type="button"
                onClick={() => handleOpenReview(r, 'accountant_verify', 'reject')}
                className="button text-xs py-1 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300"
              >
                ✕ Từ chối
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  // ============================================================================
  // CỘT BẢNG 2 (LỊCH SỬ DUYỆT & LUỒNG CHUYỂN TIẾP) DÀNH CHO HR STAFF & ACCOUNTANT
  // ============================================================================
  const historyColumns: Column<ProcedureSlipListItem>[] = [
    {
      key: 'slipNumber',
      label: 'Số phiếu & Ngày tháng',
      render: (r) => (
        <div>
          <button
            type="button"
            onClick={() => navigate(`/procedures/${r.slipId}`)}
            className="font-mono font-semibold text-sky-700 hover:text-sky-900 hover:underline text-sm cursor-pointer"
          >
            {r.slipNumber}
          </button>
          <div className="text-xs text-slate-500 mt-0.5">
            Ngày: <span className="font-medium text-slate-700">{formatDateOnly(r.procedureDate)}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'service',
      label: 'Thủ thuật & Khoa/Phòng',
      render: (r) => (
        <div>
          <div className="font-medium text-slate-900 text-sm">{r.serviceName}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {r.departmentName || 'Chưa phân khoa'} • HH:{' '}
            <strong className="text-emerald-700">{formatVnd(r.totalCommissionAmount)}</strong>
          </div>
        </div>
      ),
    },
    {
      key: 'doctors',
      label: 'Bác sĩ chỉ định & Thực hiện chính',
      render: (r) => (
        <div className="text-xs space-y-1">
          <div>
            <span className="text-slate-500">BS chỉ định: </span>
            <strong className="text-slate-900">
              {r.indicatingStaffName || r.recordedByName || '—'}
            </strong>
            {r.indicatingStaffCode ? (
              <span className="text-slate-400 font-mono"> ({r.indicatingStaffCode})</span>
            ) : null}
          </div>
          <div>
            <span className="text-slate-500">Thực hiện chính: </span>
            <strong className="text-sky-800">
              {r.performingStaffName || '—'}
            </strong>
            {r.performingStaffCode ? (
              <span className="text-slate-400 font-mono"> ({r.performingStaffCode})</span>
            ) : null}
          </div>
        </div>
      ),
    },
    {
      key: 'handoverChain',
      label: 'Hành trình phiếu (Từ ai → Sang ai)',
      render: (r) => (
        <div className="text-xs space-y-1 leading-relaxed">
          <div className="text-slate-700">
            <span className="text-slate-400">1. Người lập:</span>{' '}
            <strong className="text-slate-900">
              {r.recordedByName || r.indicatingStaffName || 'NV Y tế'}
            </strong>
          </div>
          <div className="text-slate-700">
            <span className="text-slate-400">2. Sang HR:</span>{' '}
            <strong className="text-sky-800">
              {r.hrCheckedByName || 'Phòng Nhân sự'}
            </strong>
          </div>
          <div className="text-slate-700">
            <span className="text-slate-400">3. Sang Kế toán:</span>{' '}
            <strong className="text-emerald-800">
              {r.verifiedByName ||
                (r.status === 'hr_checked'
                  ? 'Đang chờ Kế toán xác minh'
                  : r.status === 'rejected' && r.rejectedReason?.startsWith('[HR')
                  ? 'Dừng tại bước HR'
                  : 'Phòng Kế toán')}
            </strong>
          </div>
        </div>
      ),
    },
    {
      key: 'statusAndReason',
      label: 'Kết quả duyệt & Lý do từ chối',
      render: (r) => (
        <div className="max-w-xs">
          <span
            className={`inline-block text-xs px-2.5 py-0.5 rounded-full font-semibold ${getProcedureStatusBadgeClass(
              r.status
            )}`}
          >
            {PROCEDURE_STATUS_LABELS[r.status] || r.status}
          </span>
          {r.status === 'rejected' && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-2 py-1 mt-1.5">
              <strong>Lý do:</strong> {r.rejectedReason || 'Không đạt yêu cầu kiểm duyệt.'}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Chi tiết',
      render: (r) => (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => navigate(`/procedures/${r.slipId}`)}
            className="button text-xs py-1 px-2.5 text-sky-700 border-sky-200 bg-sky-50/70 hover:bg-sky-100"
          >
            Xem chi tiết
          </button>
        </div>
      ),
    },
  ];

  // ============================================================================
  // CỘT BẢNG DÀNH CHO MEDICAL STAFF / DEPARTMENT HEAD / HR MANAGER
  // ============================================================================
  const personalSlipColumns: Column<ProcedureSlipListItem>[] = [
    {
      key: 'slipNumber',
      label: 'Số phiếu / Ngày',
      render: (r) => (
        <div>
          <button
            type="button"
            onClick={() => navigate(`/procedures/${r.slipId}`)}
            className="font-mono font-semibold text-sky-700 hover:text-sky-900 hover:underline text-sm cursor-pointer"
          >
            {r.slipNumber}
          </button>
          <div className="text-xs text-slate-500">{formatDateOnly(r.procedureDate)}</div>
        </div>
      ),
    },
    {
      key: 'serviceName',
      label: 'Dịch vụ kỹ thuật / Bệnh nhân',
      render: (r) => (
        <div>
          <div className="font-medium text-slate-900 text-sm">{r.serviceName}</div>
          <div className="text-xs text-slate-500">
            Mã DV: <span className="font-mono">{r.serviceCode}</span>
            {r.patientCode && (
              <>
                {' • '}BN: <span className="font-mono font-medium text-slate-700">{r.patientCode}</span>
              </>
            )}
            {r.isAfterHours && (
              <span className="ml-2 inline-block px-1.5 py-0.2 rounded bg-purple-100 text-purple-700 font-medium text-[11px]">
                Ngoài giờ
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'doctors',
      label: 'BS chỉ định & Thực hiện chính',
      render: (r) => (
        <div className="text-xs space-y-0.5">
          <div>
            BS chỉ định: <strong>{r.indicatingStaffName || r.recordedByName || '—'}</strong>
          </div>
          <div className="text-slate-500">
            Thực hiện chính: <strong className="text-slate-700">{r.performingStaffName || '—'}</strong>
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái duyệt',
      render: (r) => (
        <div>
          <span
            className={`inline-block text-xs px-2.5 py-0.5 rounded-full font-medium ${getProcedureStatusBadgeClass(
              r.status
            )}`}
          >
            {PROCEDURE_STATUS_LABELS[r.status] || r.status}
          </span>
          {r.status === 'rejected' && r.rejectedReason && (
            <div className="text-[11px] text-rose-600 mt-1 max-w-[240px]" title={r.rejectedReason}>
              Lý do: {r.rejectedReason}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Thao tác',
      render: (r) => (
        <div className="flex items-center gap-1.5 justify-end">
          <button
            type="button"
            onClick={() => navigate(`/procedures/${r.slipId}`)}
            className="button text-xs py-1 px-2.5"
          >
            Chi tiết
          </button>
          {!r.isPeriodLocked &&
            r.recordedBy === user?.id &&
            (r.status === 'pending' || r.status === 'rejected') && (
              <button
                type="button"
                onClick={() => navigate(`/procedures/${r.slipId}/edit`)}
                className="button text-xs py-1 px-2.5 text-sky-700 border-sky-200 bg-sky-50 hover:bg-sky-100"
              >
                Sửa
              </button>
            )}
        </div>
      ),
    },
  ];

  const years = useMemo(() => {
    const cur = now.getFullYear();
    return [cur - 2, cur - 1, cur, cur + 1];
  }, [now]);

  // ============================================================================
  // GIAO DIỆN DÀNH RIÊNG CHO HR STAFF & ACCOUNTANT
  // ============================================================================
  if (isReviewerRole) {
    return (
      <div className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        {notice && <Alert variant="success">{notice}</Alert>}

        {/* BẢNG 1: DANH SÁCH PHIẾU CHỜ XỬ LÝ (ẨN HOÀN TOÀN NẾU KHÔNG CÓ PHIẾU CHỜ) */}
        {pendingQueueItems.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-5 py-3 bg-amber-50/60 border-b border-amber-200/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-500 text-white font-bold text-xs">
                  !
                </span>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 m-0">
                    {isHrStaff
                      ? 'Danh sách phiếu chờ HR kiểm tra'
                      : 'Danh sách phiếu chờ Kế toán xác minh'}
                  </h2>
                  <p className="text-xs text-slate-600 m-0">
                    Chỉ hiển thị các phiếu đang chờ bạn đánh giá. Ngay khi bấm Duyệt hoặc Từ chối, phiếu sẽ chuyển sang bảng Lịch sử duyệt bên dưới.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                {pendingQueueItems.length} phiếu đang chờ
              </span>
            </div>

            <div className="p-4 procedure-table-wrap procedure-slip-scroll-box">
              <DataTable<ProcedureSlipListItem>
                columns={pendingQueueColumns}
                rows={pendingQueueItems}
                rowKey={(r) => r.slipId}
                emptyMessage=""
              />
            </div>
          </div>
        )}

        {/* BẢNG 2: LỊCH SỬ DUYỆT & TRA CỨU TÌNH HÌNH PHIẾU */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-sky-700 text-white font-bold text-xs">
                ✓
              </span>
              <div>
                <h2 className="text-sm font-bold text-slate-900 m-0">
                  Bảng lịch sử duyệt & Kiểm tra tình hình phiếu
                </h2>
                <p className="text-xs text-slate-500 m-0">
                  Tra cứu các phiếu đã xử lý theo Bác sĩ chỉ định, Người thực hiện chính, Tháng thực hiện, hoặc trạng thái Đã xác minh / Từ chối.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {pendingQueueItems.length > 0 && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                  {pendingQueueItems.length} chờ xử lý
                </span>
              )}
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-200/80 text-slate-700">
                {filteredHistoryItems.length} phiếu trong lịch sử
              </span>
              {isAccountant && (
                <button
                  type="button"
                  onClick={() => {
                    setCalcResult(null);
                    setCalcError('');
                    setCalcModalOpen(true);
                  }}
                  className="button primary text-xs py-1.5 px-3 min-h-[34px]"
                >
                  Tính hoa hồng tháng
                </button>
              )}
            </div>
          </div>

          {/* Bộ lọc tìm kiếm cho Bảng Lịch sử duyệt */}
          <div className="px-5 py-3 bg-slate-50/50 border-b border-slate-200">
            <datalist id="procedure-staff-options">
              {lookups?.staff.map((st) => (
                <option key={st.staffId} value={`${st.staffCode} - ${st.fullName}`}>
                  {st.positionName ? `${st.fullName} (${st.positionName})` : st.fullName}
                </option>
              ))}
            </datalist>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              {/* 1. Bác sĩ chỉ định */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Bác sĩ chỉ định (Chọn hoặc điền)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    list="procedure-staff-options"
                    value={historyIndicatingQuery}
                    onChange={(e) => {
                      setHistoryIndicatingQuery(e.target.value);
                      setHistoryPage(1);
                    }}
                    placeholder="Chọn hoặc nhập tên / mã BS chỉ định..."
                    className="w-full h-9 min-h-[36px] rounded-lg border border-slate-300 pl-3 pr-8 py-1.5 text-xs bg-white"
                  />
                  {historyIndicatingQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryIndicatingQuery('');
                        setHistoryPage(1);
                      }}
                      title="Xóa để chọn lại từ danh sách"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* 2. Người thực hiện chính */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Người thực hiện chính (Chọn hoặc điền)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    list="procedure-staff-options"
                    value={historyPerformingQuery}
                    onChange={(e) => {
                      setHistoryPerformingQuery(e.target.value);
                      setHistoryPage(1);
                    }}
                    placeholder="Chọn hoặc nhập tên / mã người thực hiện..."
                    className="w-full h-9 min-h-[36px] rounded-lg border border-slate-300 pl-3 pr-8 py-1.5 text-xs bg-white"
                  />
                  {historyPerformingQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setHistoryPerformingQuery('');
                        setHistoryPage(1);
                      }}
                      title="Xóa để chọn lại từ danh sách"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* 3. Tìm theo tháng */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Tìm theo tháng thực hiện
                </label>
                <input
                  type="month"
                  value={historyMonth}
                  onChange={(e) => {
                    setHistoryMonth(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="w-full h-9 min-h-[36px] rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white"
                />
              </div>

              {/* 4. Tìm theo trạng thái Đã xác minh / Từ chối */}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Trạng thái kết quả
                  </label>
                  <select
                    value={historyStatus}
                    onChange={(e) => {
                      setHistoryStatus(e.target.value);
                      setHistoryPage(1);
                    }}
                    className="w-full h-9 min-h-[36px] rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white"
                  >
                    <option value="all">Tất cả phiếu đã xử lý</option>
                    {isHrStaff && (
                      <option value="hr_checked">Đã duyệt chuyển Kế toán</option>
                    )}
                    <option value="verified">Đã xác minh (Verified)</option>
                    <option value="rejected">Bị từ chối (Rejected)</option>
                  </select>
                </div>

                {(historyIndicatingQuery ||
                  historyPerformingQuery ||
                  historyMonth ||
                  historyStatus !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryIndicatingQuery('');
                      setHistoryPerformingQuery('');
                      setHistoryMonth('');
                      setHistoryStatus('all');
                      setHistoryPage(1);
                    }}
                    className="button text-xs py-1.5 px-3 min-h-[36px] text-slate-600 hover:text-slate-900 shrink-0"
                  >
                    Đặt lại
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="px-5 py-3 procedure-table-wrap procedure-slip-scroll-box">
            {loading ? (
              <div className="p-6 text-center text-slate-500 text-sm">
                Đang tải lịch sử duyệt phiếu...
              </div>
            ) : (
              <>
                <DataTable<ProcedureSlipListItem>
                  columns={historyColumns}
                  rows={pagedHistoryItems}
                  rowKey={(r) => r.slipId}
                  emptyMessage="Chưa có phiếu thủ thuật nào khớp với điều kiện tra cứu lịch sử."
                />

                {filteredHistoryItems.length > 0 && (
                  <div className="mt-2">
                    <Pagination
                      page={historyPage}
                      pageSize={historyPageSize}
                      total={filteredHistoryItems.length}
                      label="phiếu trong lịch sử"
                      onPageChange={setHistoryPage}
                      onPageSizeChange={(sz) => {
                        setHistoryPageSize(sz);
                        setHistoryPage(1);
                      }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Modal Duyệt / Từ chối */}
        <ProcedureReviewModal
          open={Boolean(reviewModalSlip)}
          mode={reviewMode}
          slip={reviewModalSlip}
          defaultDecision={reviewDefaultDecision}
          onClose={() => setReviewModalSlip(null)}
          onSuccess={(_updated, msg) => {
            setReviewModalSlip(null);
            setNotice(msg);
            void loadData();
          }}
        />

        {/* Modal Tính hoa hồng tháng vào bảng lương (Dành cho Kế toán) */}
        {calcModalOpen && (
          <Modal
            title="Tổng hợp Hoa hồng Thủ thuật vào Bảng lương tháng"
            onClose={() => setCalcModalOpen(false)}
            maxWidth="680px"
            className="vnc-modal-no-scroll"
          >
            <form onSubmit={handleCalculateMonthlyCommission} className="px-6 py-4 space-y-4">
              <div className="text-xs text-slate-600 bg-sky-50 border border-sky-200 rounded-lg p-3">
                Hệ thống sẽ tổng hợp toàn bộ các phiếu thủ thuật đã ở trạng thái{' '}
                <strong className="text-emerald-700">Đã xác minh (Verified)</strong> trong kỳ lương
                được chọn để cập nhật trường <code>TotalCommissionAmount</code> trên phiếu lương của
                từng nhân sự tham gia.
              </div>

              {calcError && <Alert variant="error">{calcError}</Alert>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kỳ lương tháng (YYYY-MM) *
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
                    Phạm vi Khoa / Phòng ban
                  </label>
                  <select
                    value={calcDeptId}
                    onChange={(e) => setCalcDeptId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    <option value="">Toàn bộ các Khoa / Phòng ban</option>
                    {lookups?.departments.map((d) => (
                      <option key={d.departmentId} value={d.departmentId}>
                        {d.name} ({d.deptCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {calcResult && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 space-y-2 text-xs">
                  <div className="font-bold text-emerald-900 text-sm">
                    ✓ Kết quả tổng hợp kỳ {calcResult.payMonth}:
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-white p-2 rounded border border-emerald-100">
                      <span className="text-slate-500 block">Phiếu hợp lệ</span>
                      <strong className="text-sm text-slate-900">
                        {calcResult.verifiedSlipCount} phiếu
                      </strong>
                    </div>
                    <div className="bg-white p-2 rounded border border-emerald-100">
                      <span className="text-slate-500 block">Nhân sự hưởng</span>
                      <strong className="text-sm text-slate-900">
                        {calcResult.staffCount} người
                      </strong>
                    </div>
                    <div className="bg-white p-2 rounded border border-emerald-100">
                      <span className="text-slate-500 block">Tổng hoa hồng</span>
                      <strong className="text-sm text-emerald-700">
                        {formatVnd(calcResult.totalCommissionCalculated)}
                      </strong>
                    </div>
                    <div className="bg-white p-2 rounded border border-emerald-100">
                      <span className="text-slate-500 block">Payslip cập nhật</span>
                      <strong className="text-sm text-sky-700">
                        {calcResult.updatedPayslipCount} bảng lương
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCalcModalOpen(false)}
                  className="button"
                  disabled={calculating}
                >
                  Đóng
                </button>
                <button type="submit" className="button primary" disabled={calculating}>
                  {calculating ? 'Đang tính toán...' : 'Thực hiện tổng hợp hoa hồng'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </div>
    );
  }

  // ============================================================================
  // GIAO DIỆN DÀNH CHO MEDICAL STAFF, DEPARTMENT HEAD & HR MANAGER
  // ============================================================================
  return (
    <div className="space-y-6">
      <div className="page-heading flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1>
            {isDeptHead
              ? 'Phiếu thủ thuật cá nhân & Khoa quản lý'
              : 'Phiếu thủ thuật y tế của tôi'}
          </h1>
          <p className="muted">
            {isDeptHead
              ? 'Xem tổng số ca thủ thuật của cá nhân hoặc trong khoa bạn phụ trách và lập phiếu thủ thuật mới.'
              : 'Theo dõi các ca thủ thuật của cá nhân theo thủ thuật, tháng/quý/năm, khung giờ và lập phiếu mới.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/procedures/new')}
            className="button primary"
          >
            + Lập phiếu thủ thuật mới
          </button>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}

      {/* Bộ lọc gọn gàng cho chế độ cá nhân / trưởng khoa */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
        {isDeptHead && (
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-600 mr-1">Phạm vi xem:</span>
            <button
              type="button"
              onClick={() => {
                setViewScope('mine');
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                viewScope === 'mine'
                  ? 'bg-sky-700 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${
                viewScope === 'department'
                  ? 'bg-sky-700 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Theo khoa của tôi
            </button>
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Thủ thuật y tế
              </label>
              <select
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white min-w-[220px]"
              >
                <option value="">Tất cả thủ thuật</option>
                {lookups?.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.code}] {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">
                Kỳ thống kê
              </label>
              <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-50">
                {(
                  [
                    { key: 'month', label: 'Theo Tháng' },
                    { key: 'quarter', label: 'Theo Quý' },
                    { key: 'year', label: 'Theo Năm' },
                    { key: 'all', label: 'Tất cả' },
                  ] as { key: PeriodMode; label: string }[]
                ).map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => {
                      setPeriodMode(m.key);
                      setPage(1);
                    }}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition cursor-pointer ${
                      periodMode === m.key
                        ? 'bg-sky-700 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {(periodMode === 'month' || periodMode === 'quarter' || periodMode === 'year') && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Năm</label>
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    setSelectedYear(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      Năm {y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {periodMode === 'month' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tháng</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
                >
                  {Array.from({ length: 12 }, (_, idx) => idx + 1).map((m) => (
                    <option key={m} value={m}>
                      Tháng {String(m).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {periodMode === 'quarter' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Quý</label>
                <select
                  value={selectedQuarter}
                  onChange={(e) => {
                    setSelectedQuarter(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
                >
                  {[1, 2, 3, 4].map((q) => (
                    <option key={q} value={q}>
                      Quý {q}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Khung giờ</label>
              <select
                value={afterHoursFilter}
                onChange={(e) => {
                  setAfterHoursFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
              >
                <option value="all">Tất cả khung giờ</option>
                <option value="in_hours">Trong giờ hành chính</option>
                <option value="after_hours">Ngoài giờ / Trực</option>
              </select>
            </div>
          </div>

          {/* Thẻ hiển thị Tổng số ca */}
          <div className="bg-sky-50 border border-sky-200 rounded-xl px-5 py-2.5 flex items-center gap-4">
            <div>
              <span className="text-xs font-medium text-sky-800 block">
                {isDeptHead && viewScope === 'department'
                  ? 'Tổng số ca của Khoa'
                  : 'Tổng số ca của tôi'}
              </span>
              <strong className="text-2xl font-extrabold text-sky-900 font-[tabular-nums]">
                {data?.allCount ?? 0} ca
              </strong>
            </div>
            <div className="text-xs text-slate-600 border-l border-sky-200 pl-3 space-y-0.5">
              <div>
                Đã xác minh:{' '}
                <strong className="text-emerald-700">{data?.verifiedCount ?? 0}</strong>
              </div>
              <div>
                Chờ duyệt:{' '}
                <strong className="text-amber-700">
                  {(data?.pendingCount ?? 0) + (data?.hrCheckedCount ?? 0)}
                </strong>
              </div>
              {(data?.rejectedCount ?? 0) > 0 && (
                <div>
                  Từ chối: <strong className="text-rose-700">{data?.rejectedCount ?? 0}</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bảng danh sách phiếu cá nhân / theo khoa */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs procedure-table-wrap procedure-slip-scroll-box">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            Đang tải dữ liệu phiếu thủ thuật...
          </div>
        ) : (
          <>
            <DataTable<ProcedureSlipListItem>
              columns={personalSlipColumns}
              rows={data?.items ?? []}
              rowKey={(r) => r.slipId}
              emptyMessage="Không tìm thấy phiếu thủ thuật nào phù hợp với bộ lọc."
            />

            {(data?.total ?? 0) > 0 && (
              <div className="mt-4">
                <Pagination
                  page={data?.page ?? page}
                  pageSize={data?.pageSize ?? pageSize}
                  total={data?.total ?? 0}
                  label="phiếu thủ thuật"
                  onPageChange={(p) => setPage(p)}
                  onPageSizeChange={(sz) => {
                    setPageSize(sz);
                    setPage(1);
                  }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
