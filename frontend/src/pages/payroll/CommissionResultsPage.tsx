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
import { formatDateOnly, formatVnd } from '../../utils/format';
import { PROCEDURE_ROLE_LABELS } from '../../utils/procedureHelpers';

export default function CommissionResultsPage() {
  const user = useAuthStore((s) => s.session?.user);
  const role = user?.role || 'employee';

  const isAccountant = role === 'accountant';
  const isDeptHead = role === 'department_head';

  const now = useMemo(() => new Date(), []);
  const defaultMonth = useMemo(
    () => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    [now]
  );

  // Filters state
  const [payMonth, setPayMonth] = useState<string>(defaultMonth);
  const [departmentId, setDepartmentId] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

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

  // Export CSV
  const handleExportCsv = () => {
    if (!data || !data.items || data.items.length === 0) return;
    const headers = [
      'Mã nhân viên',
      'Họ và tên',
      'Khoa / Phòng ban',
      'Số ca thủ thuật',
      'Số lượt phân công',
      'Tổng hoa hồng (VNĐ)',
      'Trạng thái Bảng lương',
    ];
    const rows = data.items.map((item) => [
      item.staffCode,
      `"${item.staffName.replace(/"/g, '""')}"`,
      `"${(item.departmentName || 'N/A').replace(/"/g, '""')}"`,
      item.verifiedSlipCount,
      item.assignmentCount,
      item.totalCommissionAmount,
      item.linkedToPayslip ? 'Đã liên kết Payslip' : 'Chưa có Payslip',
    ]);

    const csvContent =
      '\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Hoa_hong_thu_thuat_${payMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
          {r.linkedToPayslip ? '✓ Đã cập nhật' : 'Chưa liên kết'}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Thao tác',
      render: (r: StaffMonthlyCommissionItem) => (
        <button
          type="button"
          onClick={() => void handleOpenDetail(r)}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 transition"
        >
          <Icon name="eye" size={14} />
          Xem chi tiết ca
        </button>
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
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Kết quả tính Hoa hồng Thủ thuật
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAccountant
              ? 'Tổng hợp và theo dõi hoa hồng ca thủ thuật đã được xác minh theo từng nhân sự và kỳ lương.'
              : 'Theo dõi bảng kết quả hoa hồng thủ thuật của nhân sự thuộc khoa bạn quản lý.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {data && data.items.length > 0 && (
            <button
              type="button"
              onClick={handleExportCsv}
              className="button bg-white text-slate-700 border-slate-300 hover:bg-slate-50 text-sm font-medium py-2 px-3.5 inline-flex items-center gap-1.5 shadow-xs"
            >
              <Icon name="fileText" size={16} />
              Xuất CSV
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
                className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-sky-500 focus:outline-none"
              />
              <span className="absolute left-3 top-2.5 text-slate-400">
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
              Trạng thái Đã xác minh
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

      {/* Main Table */}
      <div className="card bg-white shadow-xs border border-slate-200 rounded-xl overflow-hidden">
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
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>

      {/* Modal Drilldown: Chi tiết ca thủ thuật của nhân viên */}
      {selectedStaff && (
        <Modal
          title={`Chi tiết ca thủ thuật - ${selectedStaff.staffName} (${selectedStaff.staffCode})`}
          onClose={() => setSelectedStaff(null)}
          maxWidth="900px"
        >
          <div className="p-6 space-y-4">
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
                <span className="text-slate-500 block">Số ca thực hiện:</span>
                <strong className="text-sky-700 text-sm">
                  {selectedStaff.verifiedSlipCount} ca
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Tổng hoa hồng:</span>
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
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Mã phiếu</th>
                      <th className="py-2.5 px-3">Ngày làm</th>
                      <th className="py-2.5 px-3">Bệnh nhân</th>
                      <th className="py-2.5 px-3">Dịch vụ</th>
                      <th className="py-2.5 px-3">Vai trò</th>
                      <th className="py-2.5 px-3 text-right">Phí dịch vụ</th>
                      <th className="py-2.5 px-3 text-right">Hoa hồng nhận</th>
                      <th className="py-2.5 px-3 text-center">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {detailData.procedures.map((p) => (
                      <tr key={p.slipId + p.role} className="hover:bg-slate-50/70">
                        <td className="py-2 px-3 font-mono font-medium text-slate-800">
                          {p.slipNumber}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {formatDateOnly(p.procedureDate)}
                          {p.isAfterHours && (
                            <span className="ml-1 inline-block px-1.5 py-0.2 rounded text-[10px] bg-purple-50 text-purple-700 border border-purple-200">
                              Ngoài giờ
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {p.patientCode || '-'}
                        </td>
                        <td className="py-2 px-3">
                          <div className="font-medium text-slate-900">{p.serviceName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {p.serviceCode}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-sky-50 text-sky-700 border border-sky-100">
                            {PROCEDURE_ROLE_LABELS[p.role] || p.role}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600 font-mono">
                          {formatVnd(p.chargedAmount)}
                        </td>
                        <td className="py-2 px-3 text-right font-semibold text-emerald-700 font-mono">
                          {formatVnd(p.commissionAmount)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Đã xác minh
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-semibold border-t border-slate-200">
                    <tr>
                      <td colSpan={6} className="py-2.5 px-3 text-right text-slate-700">
                        Tổng cộng:
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-700 font-mono text-sm">
                        {formatVnd(detailData.totalCommissionAmount)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-slate-500">
                Không có chi tiết ca thủ thuật nào.
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
                <strong className="text-emerald-700">Đã xác minh (Verified)</strong> trong kỳ lương.
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
