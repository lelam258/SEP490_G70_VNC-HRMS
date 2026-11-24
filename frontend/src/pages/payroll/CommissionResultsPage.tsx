import { useCallback, useEffect, useMemo, useState } from 'react';
import Alert from '../../components/ui/Alert';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import { procedureSlipApi } from '../../services/procedureSlipApi';
import { useAuthStore } from '../../store/useAuthStore';
import type {
  CalculateMonthlyCommissionResult,
  CommissionResultsResponse,
  ProcedureLookups,
  StaffCommissionDetailResponse,
  StaffMonthlyCommissionItem,
} from '../../types/procedureSlip';
import { exportCommissionDetailsExcel } from '../../utils/commissionExcelExport';
import { formatDateOnly, formatVnd, todayVn } from '../../utils/format';
import { PROCEDURE_ROLE_LABELS } from '../../utils/procedureHelpers';

export default function CommissionResultsPage() {
  const user = useAuthStore((s) => s.session?.user);
  const role = user?.role || 'employee';

  const isAccountant = role === 'accountant';
  const isDeptHead = role === 'department_head';

  const defaultMonth = useMemo(() => todayVn().slice(0, 7), []);

  // Filters state
  const [payMonth, setPayMonth] = useState<string>(defaultMonth);
  const [departmentId, setDepartmentId] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // View tab & export state
  const [activeTab, setActiveTab] = useState<'staff' | 'department'>('staff');
  const [exportingDetails, setExportingDetails] = useState<boolean>(false);

  // Data state
  const [lookups, setLookups] = useState<ProcedureLookups | null>(null);
  const [data, setData] = useState<CommissionResultsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [notice, setNotice] = useState<string>('');

  // Drilldown modal state
  const [selectedStaff, setSelectedStaff] = useState<StaffMonthlyCommissionItem | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailData, setDetailData] = useState<StaffCommissionDetailResponse | null>(null);
  const [detailError, setDetailError] = useState<string>('');

  // Calculation modal state (Accountant only)
  const [calcModalOpen, setCalcModalOpen] = useState<boolean>(false);
  const [calcMonth, setCalcMonth] = useState<string>(defaultMonth);
  const [calcDeptId, setCalcDeptId] = useState<string>('');
  const [calculating, setCalculating] = useState<boolean>(false);
  const [calcError, setCalcError] = useState<string>('');
  const [calcResult, setCalcResult] = useState<CalculateMonthlyCommissionResult | null>(null);

  // Load lookups on mount
  useEffect(() => {
    procedureSlipApi
      .getLookups()
      .then(setLookups)
      .catch(() => {
        // Non-blocking lookup error
      });
  }, []);

  // Load commission results
  const loadResults = useCallback(async () => {
    if (!payMonth) return;
    setLoading(true);
    setError('');
    try {
      const res = await procedureSlipApi.getCommissionResults({
        payMonth,
        departmentId: isAccountant && departmentId ? departmentId : undefined,
        search: search.trim() || undefined,
        page,
        pageSize,
      });
      setData(res);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể tải bảng kết quả hoa hồng thủ thuật.'
      );
    } finally {
      setLoading(false);
    }
  }, [payMonth, departmentId, search, page, pageSize, isAccountant]);

  useEffect(() => {
    void loadResults();
  }, [loadResults]);

  // Handle drilldown click
  const handleOpenDetail = async (staff: StaffMonthlyCommissionItem) => {
    setSelectedStaff(staff);
    setDetailLoading(true);
    setDetailError('');
    setDetailData(null);
    try {
      const res = await procedureSlipApi.getStaffCommissionDetail(staff.staffId, payMonth);
      setDetailData(res);
    } catch (err: unknown) {
      setDetailError(
        err instanceof Error
          ? err.message
          : 'Không thể tải chi tiết ca thủ thuật của nhân viên.'
      );
    } finally {
      setDetailLoading(false);
    }
  };

  // Handle calculation submit (Accountant only)
  const handleCalculateCommission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAccountant) return;
    setCalculating(true);
    setCalcError('');
    try {
      const res = await procedureSlipApi.calculateMonthlyCommission({
        payMonth: calcMonth,
        departmentId: calcDeptId || null,
      });
      setCalcResult(res);
      setNotice(
        `Đã tổng hợp hoa hồng thành công cho kỳ ${res.payMonth}: ${res.verifiedSlipCount} ca hợp lệ, cập nhật ${res.updatedPayslipCount} phiếu lương (Tổng hoa hồng: ${formatVnd(
          res.totalCommissionCalculated
        )}).`
      );
      // Auto sync filter if calculated month matches or updates
      if (calcMonth === payMonth) {
        void loadResults();
      } else {
        setPayMonth(calcMonth);
      }
    } catch (err: unknown) {
      setCalcError(
        err instanceof Error
          ? err.message
          : 'Đã xảy ra lỗi khi tính toán hoa hồng.'
      );
    } finally {
      setCalculating(false);
    }
  };

  // Export styled Excel (.xlsx) for detailed procedure assignment rows
  const handleExportDetailExcel = async () => {
    if (!data) return;
    setExportingDetails(true);
    setError('');
    try {
      const detailRows = await procedureSlipApi.getCommissionExportDetails({
        payMonth,
        departmentId: isAccountant && departmentId ? departmentId : undefined,
        search: search.trim() || undefined,
      });
      if (detailRows.length === 0) return;

      let scopeLabel = 'Tất cả Khoa / Phòng ban';
      if (isDeptHead) {
        scopeLabel = data.departmentBreakdown?.[0]?.departmentName || 'Khoa / Phòng quản lý';
      } else if (departmentId) {
        const matched = lookups?.departments.find((d) => d.departmentId === departmentId);
        scopeLabel = matched ? `${matched.name} (${matched.deptCode})` : 'Khoa / Phòng đã chọn';
      }
      if (search.trim()) {
        scopeLabel += ` — Lọc: "${search.trim()}"`;
      }

      exportCommissionDetailsExcel({
        payMonth,
        scopeLabel,
        rows: detailRows,
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : 'Không thể xuất file Excel bảng kê chi tiết ca.'
      );
    } finally {
      setExportingDetails(false);
    }
  };

  // Columns definition
  const columns: Column<StaffMonthlyCommissionItem>[] = [
    {
      key: 'staffCode',
      label: 'Mã NV',
      render: (r: StaffMonthlyCommissionItem) => (
        <span className="font-mono text-xs font-semibold text-slate-800">
          {r.staffCode}
        </span>
      ),
    },
    {
      key: 'staffName',
      label: 'Họ và tên',
      render: (r: StaffMonthlyCommissionItem) => (
        <div>
          <span className="font-medium text-slate-900 block">{r.staffName}</span>
        </div>
      ),
    },
    {
      key: 'departmentName',
      label: 'Khoa / Phòng ban',
      render: (r: StaffMonthlyCommissionItem) => (
        <span className="text-slate-600 text-xs">
          {r.departmentName || 'Chưa phân khoa'}
        </span>
      ),
    },
    {
      key: 'verifiedSlipCount',
      label: 'Số ca thủ thuật',
      render: (r: StaffMonthlyCommissionItem) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
          {r.verifiedSlipCount} ca
        </span>
      ),
    },
    {
      key: 'assignmentCount',
      label: 'Lượt tham gia',
      render: (r: StaffMonthlyCommissionItem) => (
        <span className="text-xs text-slate-600">
          {r.assignmentCount} lượt
        </span>
      ),
    },
    {
      key: 'totalCommissionAmount',
      label: 'Tổng hoa hồng',
      render: (r: StaffMonthlyCommissionItem) => (
        <span className="font-semibold text-emerald-700 text-sm">
          {formatVnd(r.totalCommissionAmount)}
        </span>
      ),
    },
    {
      key: 'linkedToPayslip',
      label: 'Bảng lương (Payslip)',
      render: (r: StaffMonthlyCommissionItem) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
            r.linkedToPayslip
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}
        >
          {r.linkedToPayslip ? 'Đã cập nhật' : 'Chưa liên kết'}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Thao tác',
      className: 'col-nowrap text-right',
      headerClassName: 'col-nowrap text-right',
      render: (r: StaffMonthlyCommissionItem) => (
        <div className="proc-actions-group">
          <button
            type="button"
            onClick={() => void handleOpenDetail(r)}
            className="proc-action-btn"
          >
            Xem chi tiết ca
          </button>
        </div>
      ),
    },
  ];

  if (!isAccountant && !isDeptHead) {
    return (
      <div className="p-6">
        <Alert variant="error">
          Bạn không có quyền truy cập trang kết quả tính hoa hồng thủ thuật. Chức năng chỉ dành cho Kế toán và Trưởng khoa.
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto workspace-list-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Kết quả tính Hoa hồng Thủ thuật
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAccountant
              ? 'Tổng hợp và theo dõi hoa hồng ca thủ thuật đã hoàn thành theo từng nhân sự, khoa/phòng và kỳ lương.'
              : 'Theo dõi bảng kết quả hoa hồng thủ thuật của nhân sự thuộc khoa bạn quản lý.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {data && (data.summary.totalSlips > 0 || data.total > 0) && (
            <button
              type="button"
              disabled={exportingDetails}
              onClick={() => void handleExportDetailExcel()}
              className="button bg-white text-slate-700 border-slate-300 hover:bg-slate-50 text-sm font-medium py-2 px-3.5 inline-flex items-center gap-1.5 shadow-xs disabled:opacity-60"
            >
              <Icon name="fileText" size={16} />
              {exportingDetails ? 'Đang xuất Excel...' : 'Xuất Excel chi tiết ca'}
            </button>
          )}

          {isAccountant && (
            <button
              type="button"
              onClick={() => {
                setCalcResult(null);
                setCalcError('');
                setCalcMonth(payMonth);
                setCalcDeptId(departmentId);
                setCalcModalOpen(true);
              }}
              className="button bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 font-semibold py-2 px-4 shadow-xs inline-flex items-center gap-1.5"
            >
              <Icon name="refresh" size={16} />
              Kích hoạt tính hoa hồng
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-center justify-between">
          <span>{notice}</span>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {isDeptHead && (
        <div className="rounded-lg bg-sky-50/80 border border-sky-200 p-3 text-xs text-sky-800 flex items-center gap-2">
          <Icon name="building" size={16} />
          <span>
            Bạn đang xem bảng hoa hồng tự động lọc cho <strong>khoa/phòng ban của bạn</strong>.
          </span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="card p-4 bg-white shadow-xs border border-slate-200 rounded-xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Kỳ lương tháng (YYYY-MM) *
            </label>
            <input
              type="month"
              required
              value={payMonth}
              onChange={(e) => {
                setPayMonth(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
            />
          </div>

          {isAccountant && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Khoa / Phòng ban
              </label>
              <select
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none"
              >
                <option value="">Tất cả các Khoa / Phòng</option>
                {lookups?.departments.map((d) => (
                  <option key={d.departmentId} value={d.departmentId}>
                    {d.name} ({d.deptCode})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={isAccountant ? 'lg:col-span-2' : 'sm:col-span-2 lg:col-span-3'}>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Tìm kiếm nhân sự
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Nhập mã nhân viên hoặc họ tên..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                style={{ paddingLeft: '36px' }}
                className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none flex items-center">
                <Icon name="search" size={16} />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      {data?.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-xs">
            <span className="text-xs font-medium text-slate-500 block mb-1">
              Tổng hoa hồng kỳ {payMonth}
            </span>
            <strong className="text-xl font-bold text-emerald-700 block">
              {formatVnd(data.summary.totalCommissionAmount)}
            </strong>
            <span className="text-[11px] text-slate-400 mt-1 block">
              Doanh thu: {formatVnd(data.summary.totalChargedAmount)}
            </span>
          </div>

          <div className="bg-white rounded-xl border border-sky-200 p-4 shadow-xs">
            <span className="text-xs font-medium text-slate-500 block mb-1">
              Số ca thủ thuật hợp lệ
            </span>
            <strong className="text-xl font-bold text-sky-800 block">
              {data.summary.totalSlips} ca
            </strong>
            <span className="text-[11px] text-sky-600 mt-1 block">
              Trạng thái Đã hoàn thành
            </span>
          </div>

          <div className="bg-white rounded-xl border border-indigo-200 p-4 shadow-xs">
            <span className="text-xs font-medium text-slate-500 block mb-1">
              Nhân sự được hưởng
            </span>
            <strong className="text-xl font-bold text-indigo-900 block">
              {data.summary.totalStaff} người
            </strong>
            <span className="text-[11px] text-indigo-600 mt-1 block">
              Được phân công vai trò
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <span className="text-xs font-medium text-slate-500 block mb-1">
              Đồng bộ Bảng lương
            </span>
            <strong className="text-xl font-bold text-slate-800 block">
              {data.summary.linkedPayslipCount} / {data.summary.totalStaff}
            </strong>
            <span className="text-[11px] text-slate-500 mt-1 block">
              Phiếu lương đã cập nhật
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <span className="text-xs font-medium text-slate-500 block mb-1">
              Trạng thái kỳ lương
            </span>
            <div className="mt-1">
              {data.summary.isPayrollLocked ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  <Icon name="lock" size={13} />
                  Đã khóa (Locked)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ✓ Đang mở (Open)
                </span>
              )}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              {data.summary.isPayrollLocked
                ? 'Không thể chạy lại tính toán'
                : 'Có thể tổng hợp lại'}
            </span>
          </div>
        </div>
      )}

      {/* View Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('staff')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors inline-flex items-center gap-2 -mb-px ${
            activeTab === 'staff'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <span>Theo Nhân sự</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeTab === 'staff'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {data?.total ?? 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('department')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors inline-flex items-center gap-2 -mb-px ${
            activeTab === 'department'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
          }`}
        >
          <span>Tổng hợp theo Khoa/phòng</span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeTab === 'department'
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {data?.departmentBreakdown?.length ?? 0}
          </span>
        </button>
      </div>

      {/* Main Content */}
      {activeTab === 'staff' ? (
        <div className="card bg-white shadow-xs border border-slate-200 rounded-xl overflow-hidden workspace-list-panel">
          <DataTable
            columns={columns}
            rows={data?.items || []}
            rowKey={(r: StaffMonthlyCommissionItem) => r.staffId}
            emptyMessage={`Không có dữ liệu hoa hồng thủ thuật cho kỳ ${payMonth}.`}
          />

          {data && data.total > 0 && (
            <div className="p-4 border-t border-slate-200">
              <Pagination
                page={page}
                pageSize={pageSize}
                total={data.total}
                label="nhân sự"
                disabled={loading}
                onPageChange={setPage}
                onPageSizeChange={(nextSize) => {
                  setPageSize(nextSize);
                  setPage(1);
                }}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="card bg-white shadow-xs border border-slate-200 rounded-xl overflow-hidden">
          {!data?.departmentBreakdown || data.departmentBreakdown.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-500">
              Không có dữ liệu tổng hợp theo khoa/phòng cho kỳ {payMonth}.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Khoa / Phòng ban</th>
                    <th className="py-3 px-3 text-right">Số ca hoàn thành</th>
                    <th className="py-3 px-3 text-right">Số nhân sự</th>
                    <th className="py-3 px-3 text-right">Tổng viện phí</th>
                    <th className="py-3 px-3 text-right">Chi phí trực tiếp</th>
                    <th className="py-3 px-3 text-right">Doanh thu ròng</th>
                    <th className="py-3 px-3 text-right text-emerald-700">Tổng hoa hồng</th>
                    <th className="py-3 px-3 text-right">Tỷ lệ HH / VP</th>
                    {isAccountant && <th className="py-3 px-4 text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {data.departmentBreakdown.map((dept) => (
                    <tr
                      key={dept.departmentId ?? dept.departmentCode}
                      className="hover:bg-slate-50/70"
                    >
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{dept.departmentName}</div>
                        <div className="text-xs font-mono text-slate-500">{dept.departmentCode}</div>
                      </td>
                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                          {dept.completedSlipCount} ca
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-slate-700 whitespace-nowrap">
                        {dept.staffCount} người
                      </td>
                      <td className="py-3 px-3 text-right text-slate-800 whitespace-nowrap">
                        {formatVnd(dept.totalChargedAmount)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-600 whitespace-nowrap">
                        {formatVnd(dept.totalDirectCost)}
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-slate-800 whitespace-nowrap">
                        {formatVnd(dept.totalNetRevenue)}
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-emerald-700 whitespace-nowrap">
                        {formatVnd(dept.totalCommissionAmount)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-700 whitespace-nowrap">
                        {dept.commissionRatePercent.toFixed(2)}%
                      </td>
                      {isAccountant && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          {dept.departmentId && (
                            <button
                              type="button"
                              onClick={() => {
                                setDepartmentId(dept.departmentId!);
                                setPage(1);
                                setActiveTab('staff');
                              }}
                              className="proc-action-btn"
                            >
                              Xem nhân sự
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                {(() => {
                  const totalSlips = data.departmentBreakdown.reduce(
                    (acc, d) => acc + d.completedSlipCount,
                    0
                  );
                  const totalCharged = data.departmentBreakdown.reduce(
                    (acc, d) => acc + d.totalChargedAmount,
                    0
                  );
                  const totalDirect = data.departmentBreakdown.reduce(
                    (acc, d) => acc + d.totalDirectCost,
                    0
                  );
                  const totalNet = data.departmentBreakdown.reduce(
                    (acc, d) => acc + d.totalNetRevenue,
                    0
                  );
                  const totalComm = data.departmentBreakdown.reduce(
                    (acc, d) => acc + d.totalCommissionAmount,
                    0
                  );
                  const totalRate =
                    totalCharged > 0 ? (totalComm * 100) / totalCharged : 0;

                  return (
                    <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-slate-900">
                      <tr>
                        <td className="py-3 px-4">Tổng cộng ({data.departmentBreakdown.length} khoa/phòng)</td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">{totalSlips} ca</td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          {data.summary.totalStaff} người
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          {formatVnd(totalCharged)}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          {formatVnd(totalDirect)}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          {formatVnd(totalNet)}
                        </td>
                        <td className="py-3 px-3 text-right text-emerald-700 whitespace-nowrap">
                          {formatVnd(totalComm)}
                        </td>
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          {totalRate.toFixed(2)}%
                        </td>
                        {isAccountant && <td className="py-3 px-4" />}
                      </tr>
                    </tfoot>
                  );
                })()}
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Drilldown: Chi tiết ca thủ thuật của nhân viên */}
      {selectedStaff && (
        <Modal
          title={`Chi tiết hoa hồng ca thủ thuật - ${selectedStaff.staffName} (${selectedStaff.staffCode})`}
          onClose={() => setSelectedStaff(null)}
          maxWidth="1040px"
        >
          <div className="p-5 space-y-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <span className="text-slate-500 block">Khoa / Phòng:</span>
                <strong className="text-slate-800 text-sm">
                  {selectedStaff.departmentName || 'N/A'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Kỳ lương:</span>
                <strong className="text-slate-800 text-sm">{payMonth}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Số ca hoàn thành:</span>
                <strong className="text-sky-700 text-sm">
                  {selectedStaff.verifiedSlipCount} ca
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Tổng hoa hồng được hưởng:</span>
                <strong className="text-emerald-700 text-sm">
                  {formatVnd(selectedStaff.totalCommissionAmount)}
                </strong>
              </div>
            </div>

            {detailError && <Alert variant="error">{detailError}</Alert>}

            {detailLoading ? (
              <div className="py-8 text-center text-sm text-slate-500">
                Đang tải danh sách ca thủ thuật...
              </div>
            ) : detailData && detailData.procedures.length > 0 ? (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full table-fixed text-xs text-left">
                  <colgroup>
                    <col className="w-[15%]" />
                    <col className="w-[10%]" />
                    <col className="w-[11%]" />
                    <col className="w-[22%]" />
                    <col className="w-[14%]" />
                    <col className="w-[13%]" />
                    <col className="w-[15%]" />
                  </colgroup>
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-2.5">Mã phiếu</th>
                      <th className="py-2.5 px-2.5">Ngày làm</th>
                      <th className="py-2.5 px-2.5">Bệnh nhân</th>
                      <th className="py-2.5 px-2.5">Dịch vụ</th>
                      <th className="py-2.5 px-2.5">Vai trò</th>
                      <th className="py-2.5 px-2.5 text-right">Phí dịch vụ</th>
                      <th className="py-2.5 px-2.5 text-right text-emerald-700">Hoa hồng được hưởng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {detailData.procedures.map((p) => (
                      <tr key={p.slipId + p.role} className="hover:bg-slate-50/70">
                        <td className="py-2 px-2.5 font-mono font-medium text-slate-800 truncate" title={p.slipNumber}>
                          {p.slipNumber}
                        </td>
                        <td className="py-2 px-2.5 text-slate-600 whitespace-nowrap">
                          {formatDateOnly(p.procedureDate)}
                          {p.isAfterHours && (
                            <span className="block mt-0.5 w-fit px-1.5 py-0.2 rounded text-[10px] bg-purple-50 text-purple-700 border border-purple-200">
                              Ngoài giờ
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-slate-600 truncate" title={p.patientCode || ''}>
                          {p.patientCode || '-'}
                        </td>
                        <td className="py-2 px-2.5">
                          <div className="font-medium text-slate-900 truncate" title={p.serviceName}>
                            {p.serviceName}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono truncate">
                            {p.serviceCode}
                          </div>
                        </td>
                        <td className="py-2 px-2.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-100 truncate max-w-full">
                            {PROCEDURE_ROLE_LABELS[p.role] || p.role}
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-right text-slate-600 font-mono whitespace-nowrap">
                          {formatVnd(p.chargedAmount)}
                        </td>
                        <td className="py-2 px-2.5 text-right font-bold text-emerald-700 font-mono whitespace-nowrap">
                          {formatVnd(p.commissionAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-semibold border-t border-slate-200">
                    <tr>
                      <td colSpan={6} className="py-2.5 px-2.5 text-right text-slate-700">
                        Tổng hoa hồng được hưởng:
                      </td>
                      <td className="py-2.5 px-2.5 text-right text-emerald-700 font-mono text-sm whitespace-nowrap">
                        {formatVnd(detailData.totalCommissionAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-slate-500">
                Không có ca thủ thuật đã hoàn thành nào trong kỳ này.
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedStaff(null)}
                className="button bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Đóng
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Tính hoa hồng tháng (Chỉ dành cho Kế toán) */}
      {calcModalOpen && isAccountant && (
        <Modal
          title="Kích hoạt Tính toán Hoa hồng Thủ thuật"
          onClose={() => setCalcModalOpen(false)}
          maxWidth="640px"
        >
          <form onSubmit={handleCalculateCommission} className="p-6 space-y-4">
            <div className="text-xs text-slate-700 bg-sky-50 border border-sky-200 rounded-lg p-3 space-y-1">
              <div className="font-semibold text-sky-900">
                Quy trình tính toán tự động:
              </div>
              <p>
                1. Hệ thống sẽ quét toàn bộ các phiếu thủ thuật ở trạng thái{' '}
                <strong className="text-emerald-700">Đã hoàn thành (Completed)</strong> trong kỳ lương.
              </p>
              <p>
                2. Tổng hợp hoa hồng theo từng nhân sự và ghi đè cập nhật vào trường{' '}
                <code>CommissionTotal</code> trên phiếu lương của các nhân sự đã có phiếu lương chưa khóa.
              </p>
            </div>

            {calcError && <Alert variant="error">{calcError}</Alert>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Kỳ lương tính toán (YYYY-MM) *
                </label>
                <input
                  type="month"
                  required
                  value={calcMonth}
                  onChange={(e) => setCalcMonth(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Phạm vi Khoa / Phòng ban
                </label>
                <select
                  value={calcDeptId}
                  onChange={(e) => setCalcDeptId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">Toàn bộ bệnh viện</option>
                  {lookups?.departments.map((d) => (
                    <option key={d.departmentId} value={d.departmentId}>
                      {d.name} ({d.deptCode})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {calcResult && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-2 text-xs">
                <div className="font-bold text-emerald-900 text-sm flex items-center gap-1.5">
                  ✓ Kết quả tổng hợp kỳ {calcResult.payMonth}:
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-white p-2.5 rounded border border-emerald-100">
                    <span className="text-slate-500 block">Phiếu hợp lệ</span>
                    <strong className="text-sm text-slate-900">
                      {calcResult.verifiedSlipCount} ca
                    </strong>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-emerald-100">
                    <span className="text-slate-500 block">Nhân sự</span>
                    <strong className="text-sm text-slate-900">
                      {calcResult.staffCount} người
                    </strong>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-emerald-100">
                    <span className="text-slate-500 block">Tổng hoa hồng</span>
                    <strong className="text-sm text-emerald-700">
                      {formatVnd(calcResult.totalCommissionCalculated)}
                    </strong>
                  </div>
                  <div className="bg-white p-2.5 rounded border border-emerald-100">
                    <span className="text-slate-500 block">Bảng lương sync</span>
                    <strong className="text-sm text-sky-700">
                      {calcResult.updatedPayslipCount} phiếu
                    </strong>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setCalcModalOpen(false)}
                className="button bg-slate-100 hover:bg-slate-200 text-slate-700"
                disabled={calculating}
              >
                Đóng
              </button>
              <button
                type="submit"
                className="button bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                disabled={calculating}
              >
                {calculating ? 'Đang tính toán...' : 'Thực hiện tổng hợp hoa hồng'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
