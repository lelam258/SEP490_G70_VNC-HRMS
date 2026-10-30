import { useCallback, useEffect, useMemo, useState } from 'react';
import { compensationApi } from '../../services/compensationApi';
import { payrollParameterApi } from '../../services/payrollParameterApi';
import type {
  ContractSummary,
  ContractCompensation,
  UpdateContractCompensationInput,
  StaffAllowance,
  SaveStaffAllowanceInput,
  AllowanceType,
  SiteOption,
  ContractSalaryHistory,
} from '../../types/payroll';
import Alert from '../../components/ui/Alert';
import Icon from '../../components/ui/Icon';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { formatVnd, formatDate, formatDateOnly, todayVn } from '../../utils/format';
import ContractCompensationForm from '../../components/payroll/ContractCompensationForm';
import StaffAllowanceForm from '../../components/payroll/StaffAllowanceForm';
import DeactivateModal from '../../components/payroll/DeactivateModal';
import { useStandardWorkingDays } from '../../hooks/useStandardWorkingDays';

export default function CompensationPage() {
  const [allContracts, setAllContracts] = useState<ContractSummary[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const defaultWorkingDays = useStandardWorkingDays();
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [affectedWarning, setAffectedWarning] = useState<string[] | null>(null);

  // Compensation details modal
  const [selectedContract, setSelectedContract] = useState<ContractCompensation | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [savingContract, setSavingContract] = useState(false);
  const [contractError, setContractError] = useState('');

  // Staff Allowance modal
  const [allowanceTypes, setAllowanceTypes] = useState<AllowanceType[]>([]);
  const [allowanceModalOpen, setAllowanceModalOpen] = useState(false);
  const [editingAllowance, setEditingAllowance] = useState<StaffAllowance | undefined>();
  const [savingAllowance, setSavingAllowance] = useState(false);
  const [allowanceError, setAllowanceError] = useState('');

  // Allowance deactivation modal
  const [deactivatingAllowance, setDeactivatingAllowance] = useState<StaffAllowance | null>(null);
  const [deactivatingAllowanceBusy, setDeactivatingAllowanceBusy] = useState(false);
  const [deactivatingAllowanceError, setDeactivatingAllowanceError] = useState('');

  // Salary history modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyContract, setHistoryContract] = useState<ContractSummary | null>(null);
  const [salaryHistories, setSalaryHistories] = useState<ContractSalaryHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const loadContracts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const list = await compensationApi.listContracts({});
      setAllContracts(list);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được danh sách hợp đồng.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadContracts();
  }, [loadContracts]);

  // Đếm số lượng hợp đồng theo từng trạng thái
  const counts = useMemo(() => {
    const total = allContracts.length;
    const active = allContracts.filter(c => c.status === 'active').length;
    const inactive = allContracts.filter(c => c.status === 'inactive').length;
    return { total, active, inactive };
  }, [allContracts]);

  // Lọc hợp đồng theo trạng thái & từ khóa tìm kiếm (lọc tức thì ở client)
  const filteredContracts = useMemo<ContractSummary[]>(() => {
    let list: ContractSummary[] = allContracts;
    if (statusFilter !== 'all') {
      list = list.filter(c => c.status === statusFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        c =>
          c.staffName.toLowerCase().includes(q) ||
          c.staffCode.toLowerCase().includes(q) ||
          (c.contractCode && c.contractCode.toLowerCase().includes(q)) ||
          (c.departmentName && c.departmentName.toLowerCase().includes(q)) ||
          (c.siteName && c.siteName.toLowerCase().includes(q))
      );
    }
    return list;
  }, [allContracts, statusFilter, searchTerm]);

  // Load allowance types & sites once
  useEffect(() => {
    void payrollParameterApi.listAllowances({ status: 'active' }).then(setAllowanceTypes).catch(() => {});
    void payrollParameterApi.listSites().then(setSites).catch(() => {});
  }, []);

  async function openDetails(contractId: string) {
    setContractError('');
    try {
      const details = await compensationApi.getContract(contractId);
      setSelectedContract(details);
      setDetailsModalOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được chi tiết đãi ngộ.');
    }
  }

  async function openSalaryHistory(contract: ContractSummary) {
    setHistoryContract(contract);
    setHistoryError('');
    setLoadingHistory(true);
    setHistoryModalOpen(true);
    try {
      const data = await compensationApi.listSalaryHistories(contract.contractId);
      setSalaryHistories(data);
    } catch (cause) {
      setHistoryError(cause instanceof Error ? cause.message : 'Không tải được lịch sử lương.');
    } finally {
      setLoadingHistory(false);
    }
  }

  // Bumped after each save so the form re-initialises from the saved values.
  const [contractFormVersion, setContractFormVersion] = useState(0);

  async function handleUpdateContract(input: UpdateContractCompensationInput) {
    if (!selectedContract) return;
    setSavingContract(true);
    setContractError('');
    try {
      const updated = await compensationApi.updateContract(selectedContract.contractId, input);
      setSelectedContract(updated);
      setContractFormVersion(v => v + 1);
      setNotice(updated.pendingSalaryChange
        ? `Đã lên lịch mức lương mới từ ${formatDateOnly(updated.pendingSalaryChange.effectiveFrom)}.`
        : 'Đã cập nhật đãi ngộ hợp đồng.');
      setAffectedWarning(updated.affectedOpenPeriods && updated.affectedOpenPeriods.length > 0 ? updated.affectedOpenPeriods : null);
      await loadContracts();
    } catch (cause) {
      setContractError(cause instanceof Error ? cause.message : 'Lỗi khi cập nhật đãi ngộ.');
    } finally {
      setSavingContract(false);
    }
  }

  function openCreateAllowanceModal() {
    setEditingAllowance(undefined);
    setAllowanceError('');
    setAllowanceModalOpen(true);
  }

  function openEditAllowanceModal(allowance: StaffAllowance) {
    setEditingAllowance(allowance);
    setAllowanceError('');
    setAllowanceModalOpen(true);
  }

  async function handleSaveStaffAllowance(input: SaveStaffAllowanceInput) {
    if (!selectedContract) return;
    setSavingAllowance(true);
    setAllowanceError('');
    try {
      const res = editingAllowance
        ? await compensationApi.updateStaffAllowance(
            selectedContract.contractId,
            editingAllowance.staffAllowanceId,
            input
          )
        : await compensationApi.createStaffAllowance(selectedContract.contractId, input);
      setAllowanceModalOpen(false);
      // Refresh selected contract
      const refreshed = await compensationApi.getContract(selectedContract.contractId);
      setSelectedContract(refreshed);
      setNotice('Đã lưu phụ cấp nhân viên.');
      setAffectedWarning(res.affectedOpenPeriods && res.affectedOpenPeriods.length > 0 ? res.affectedOpenPeriods : null);
    } catch (cause) {
      setAllowanceError(cause instanceof Error ? cause.message : 'Lỗi khi lưu phụ cấp nhân viên.');
    } finally {
      setSavingAllowance(false);
    }
  }

  async function handleDeactivateStaffAllowance(effectiveTo?: string) {
    if (!selectedContract || !deactivatingAllowance) return;
    setDeactivatingAllowanceBusy(true);
    setDeactivatingAllowanceError('');
    try {
      const res = await compensationApi.deactivateStaffAllowance(
        selectedContract.contractId,
        deactivatingAllowance.staffAllowanceId,
        { effectiveTo }
      );
      setDeactivatingAllowance(null);
      const refreshed = await compensationApi.getContract(selectedContract.contractId);
      setSelectedContract(refreshed);
      setNotice('Đã ngừng áp dụng phụ cấp cho nhân viên.');
      setAffectedWarning(res.affectedOpenPeriods && res.affectedOpenPeriods.length > 0 ? res.affectedOpenPeriods : null);
    } catch (cause) {
      setDeactivatingAllowanceError(cause instanceof Error ? cause.message : 'Lỗi khi ngừng áp dụng phụ cấp.');
    } finally {
      setDeactivatingAllowanceBusy(false);
    }
  }

  function formatCalcMethod(method?: string) {
    switch (method) {
      case 'prorate_by_workday':
        return 'Theo ngày công';
      case 'seniority':
        return 'Thâm niên (50k/năm)';
      case 'percent_salary':
        return '% Lương cơ bản';
      case 'fixed':
      default:
        return 'Cố định trọn tháng';
    }
  }

  function handleExportCsv() {
    if (filteredContracts.length === 0) return;
    const header = [
      'Mã hợp đồng',
      'Mã nhân viên',
      'Họ và tên',
      'Khoa phòng',
      'Cơ sở',
      'Loại hợp đồng',
      'Kiểu lương',
      'Lương tháng (VND)',
      'Lương ngày (VND)',
      'Công chuẩn',
      'Đóng BHXH',
      'Lương đóng BHXH (VND)',
      'Phương pháp thuế',
      'Đoàn viên',
      'Từ ngày',
      'Đến ngày',
      'Trạng thái'
    ];

    const rows = filteredContracts.map((c: ContractSummary) => [
      `"${c.contractCode || ''}"`,
      `"${c.staffCode}"`,
      `"${c.staffName}"`,
      `"${c.departmentName || ''}"`,
      `"${c.siteName || ''}"`,
      `"${c.contractType || ''}"`,
      c.salaryType === 'daily' ? 'Lương ngày' : 'Lương tháng',
      c.monthlySalary ?? '',
      c.dailyRate ?? '',
      c.standardWorkingDays ?? defaultWorkingDays,
      c.isInsuranceEligible ? 'Có' : 'Không',
      c.insuranceSalaryBasis ?? '',
      c.taxMethod === 'flat_10' ? 'Khấu trừ 10%' : 'Biểu lũy tiến',
      c.isUnionMember ? 'Đoàn viên' : 'Không',
      c.effectiveFrom || '',
      c.effectiveTo || '',
      c.status === 'active' ? 'Đang hoạt động' : 'Đã kết thúc'
    ]);

    const csvContent = '\uFEFF' + [header.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `VNC_HopDong_DaiNgo_${todayVn()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">QUẢN LÝ LƯƠNG & ĐÃI NGỘ</span>
          <h1>Đãi ngộ hợp đồng & Phụ cấp nhân viên</h1>
          <p className="muted">
            Quản lý kiểu lương (theo ngày/theo tháng), đơn giá lương, công chuẩn, căn cứ đóng BHXH, cơ sở và các phụ cấp gắn liền với hợp đồng nhân viên.
          </p>
        </div>
      </div>

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {notice && <div className="mb-4"><Alert variant="success">{notice}</Alert></div>}
      {affectedWarning && affectedWarning.length > 0 && (
        <div className="mb-4">
          <Alert variant="warning">
            <strong>Cảnh báo:</strong> Thay đổi đãi ngộ ảnh hưởng đến các kỳ lương chưa chốt: <strong>{affectedWarning.join(', ')}</strong>. Cần tính toán lại lương cho các kỳ này.
          </Alert>
        </div>
      )}

      <section className="panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm overflow-hidden">
        {/* Card Header 1 hàng đồng bộ chuẩn SaaS */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap xl:flex-nowrap items-center justify-between gap-3">
          {/* Trái: Tiêu đề + Quick Filter Tabs 1 chạm */}
          <div className="flex items-center gap-3.5 flex-wrap">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
              Danh sách hợp đồng nhân sự
            </h2>

            {/* Quick Filter Tabs Segmented Control */}
            <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/60 text-xs">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Tất cả</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                  statusFilter === 'all'
                    ? 'bg-sky-100 dark:bg-sky-900/60 text-sky-700 dark:text-sky-200'
                    : 'bg-slate-200/80 dark:bg-slate-600/60 text-slate-600 dark:text-slate-300'
                }`}>
                  {counts.total}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === 'active'
                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Đang hoạt động</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                  statusFilter === 'active'
                    ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-200'
                    : 'bg-slate-200/80 dark:bg-slate-600/60 text-slate-600 dark:text-slate-300'
                }`}>
                  {counts.active}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('inactive')}
                className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === 'inactive'
                    ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-xs font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <span>Đã kết thúc</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                  statusFilter === 'inactive'
                    ? 'bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200'
                    : 'bg-slate-200/80 dark:bg-slate-600/60 text-slate-500 dark:text-slate-400'
                }`}>
                  {counts.inactive}
                </span>
              </button>
            </div>
          </div>

          {/* Phải: Tìm kiếm độc lập rộng rãi · Xuất CSV · Làm mới */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            {/* Ô input tìm kiếm độc lập */}
            <div className="flex items-center gap-1.5 pl-3 pr-2 h-9 w-60 sm:w-72 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 shadow-xs transition-all">
              <span className="shrink-0 text-slate-400 flex items-center pointer-events-none">
                <Icon name="search" size={14} />
              </span>
              <input
                type="text"
                placeholder="Tìm mã HĐ, tên/mã nhân viên..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ padding: 0, minHeight: 'unset', border: 'none', background: 'transparent' }}
                className="w-full bg-transparent text-xs sm:text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors cursor-pointer"
                  onClick={() => setSearchTerm('')}
                  title="Xóa tìm kiếm"
                >
                  <Icon name="close" size={12} />
                </button>
              )}
            </div>

            {/* Nút Xuất CSV */}
            <button
              type="button"
              className="h-9 px-3 shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 shadow-xs transition-colors text-xs font-medium whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
              title="Xuất danh sách hợp đồng ra tệp CSV (Excel)"
              onClick={handleExportCsv}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-slate-500 dark:text-slate-400">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <span>Xuất CSV</span>
            </button>

            {/* Nút Làm mới */}
            <button
              type="button"
              className="h-9 w-9 shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 shadow-xs flex items-center justify-center transition-colors cursor-pointer"
              title="Làm mới dữ liệu"
              aria-label="Làm mới"
              onClick={() => void loadContracts()}
              disabled={loading}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={`text-slate-500 dark:text-slate-400 ${loading ? 'animate-spin' : ''}`}
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <p className="loading-state">Đang tải dữ liệu…</p>
        ) : (
          <DataTable<ContractSummary>
            rows={filteredContracts}
            rowKey={c => c.contractId}
            emptyMessage={
              searchTerm || statusFilter !== 'all'
                ? 'Không tìm thấy hợp đồng nào phù hợp với bộ lọc.'
                : 'Chưa có hợp đồng nào.'
            }
            columns={[
              {
                key: 'staff',
                label: 'Nhân viên & Cơ sở',
                sortable: true,
                sortValue: c => c.staffName || '',
                render: c => (
                  <div>
                    <div className="font-semibold text-slate-900">{c.staffName}</div>
                    <div className="text-xs text-slate-500">
                      <span className="font-mono">{c.staffCode}</span> • {c.departmentName || 'Chưa phân khoa'}
                    </div>
                    {c.siteName && (
                      <span className="inline-block mt-0.5 text-[11px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-medium">
                        📍 {c.siteName}
                      </span>
                    )}
                  </div>
                ),
              },
              {
                key: 'contract',
                label: 'Hợp đồng',
                sortable: true,
                sortValue: c => c.contractCode || '',
                render: c => (
                  <div>
                    <span className="font-mono text-xs font-semibold">{c.contractCode || 'Chưa có mã'}</span>
                    <div className="text-xs text-slate-600">{c.contractType}</div>
                  </div>
                ),
              },
              {
                key: 'salaryType',
                label: 'Kiểu & Mức lương',
                sortable: true,
                sortValue: c => (c.salaryType === 'monthly' ? (c.monthlySalary || 0) : ((c.dailyRate || 0) * (c.standardWorkingDays || defaultWorkingDays))),
                render: c => (
                  <div>
                    <div className="mb-0.5">
                      <span className={`inline-block text-[11px] px-1.5 py-0.5 rounded font-semibold ${c.salaryType === 'daily' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {c.salaryType === 'daily' ? 'Lương ngày' : 'Lương tháng'}
                      </span>
                    </div>
                    {c.salaryType === 'daily' ? (
                      <div>
                        <strong>{formatVnd(c.dailyRate)}</strong>
                        <span className="text-xs text-slate-500"> /ngày</span>
                      </div>
                    ) : (
                      <div>
                        <strong>{formatVnd(c.monthlySalary || 0)}</strong>
                        <span className="text-xs text-slate-500"> /tháng</span>
                        <div className="text-[11px] text-slate-500">
                          (~{formatVnd(c.dailyRate)}/ngày)
                        </div>
                      </div>
                    )}
                    {c.pendingSalaryChange && (
                      <div className="mt-1 text-[11px] text-sky-700" title={c.pendingSalaryChange.note || undefined}>
                        Từ {formatDateOnly(c.pendingSalaryChange.effectiveFrom)}:{' '}
                        <strong>
                          {c.pendingSalaryChange.salaryType === 'monthly'
                            ? `${formatVnd(c.pendingSalaryChange.monthlySalary)}/tháng`
                            : `${formatVnd(c.pendingSalaryChange.dailyRate)}/ngày`}
                        </strong>
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'standardDays',
                label: 'Công chuẩn',
                sortable: true,
                sortValue: c => c.standardWorkingDays ?? defaultWorkingDays,
                render: c => (
                  <div className="text-center font-medium">
                    {c.standardWorkingDays ?? defaultWorkingDays} <span className="text-xs text-slate-500">ngày</span>
                  </div>
                ),
              },
              {
                key: 'insuranceTax',
                label: 'BHXH & Thuế TNCN',
                render: c => (
                  <div className="text-xs space-y-0.5">
                    <div>
                      <span className="text-slate-500">BHXH: </span>
                      {c.isInsuranceEligible ? (
                        <span className="font-semibold text-emerald-700">
                          {c.insuranceSalaryBasis ? formatVnd(c.insuranceSalaryBasis) : 'Có'}
                        </span>
                      ) : (
                        <span className="text-slate-400">Không đóng</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-500">Thuế: </span>
                      <span className="font-medium text-slate-700">
                        {c.taxMethod === 'flat_10' ? 'Khấu trừ 10%' : 'Biểu lũy tiến'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Đoàn: </span>
                      <span className={c.isUnionMember ? 'text-blue-700 font-medium' : 'text-slate-400'}>
                        {c.isUnionMember ? 'Đoàn viên' : 'Không'}
                      </span>
                    </div>
                  </div>
                ),
              },
              {
                key: 'period',
                label: 'Thời hạn & Trạng thái',
                sortable: true,
                sortValue: c => c.effectiveFrom || '',
                render: c => (
                  <div>
                    <div className="text-xs text-slate-700 whitespace-nowrap">
                      {c.effectiveTo ? (
                        <span>
                          <span className="font-medium text-slate-800">{formatDateOnly(c.effectiveFrom)}</span>
                          <span className="text-slate-400 mx-1">→</span>
                          <span className="font-medium text-slate-800">{formatDateOnly(c.effectiveTo)}</span>
                        </span>
                      ) : (
                        <span>
                          <span className="text-slate-500">Từ </span>
                          <strong className="font-medium text-slate-800">{formatDateOnly(c.effectiveFrom)}</strong>
                        </span>
                      )}
                    </div>
                    <span className={`inline-block text-[11px] px-2 py-0.5 rounded font-medium mt-1 ${c.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                      {c.status === 'active' ? 'Đang hoạt động' : 'Đã kết thúc'}
                    </span>
                  </div>
                ),
              },
              {
                key: 'actions',
                label: 'Thao tác',
                render: c => (
                  <div className="flex flex-col gap-1 items-start">
                    <button
                      className="button text-button font-medium text-sky-700 hover:underline"
                      onClick={() => void openDetails(c.contractId)}
                    >
                      Đãi ngộ & Phụ cấp
                    </button>
                    <button
                      className="button text-button font-medium text-slate-600 hover:text-slate-900"
                      onClick={() => void openSalaryHistory(c)}
                    >
                      🕒 Lịch sử lương
                    </button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </section>

      {/* Main Details Modal: Contract compensation & list of staff allowances */}
      {detailsModalOpen && selectedContract && (
        <Modal
          title={`Thiết lập đãi ngộ - ${selectedContract.staffName} (${selectedContract.staffCode})`}
          busy={savingContract}
          maxWidth="640px"
          onClose={() => setDetailsModalOpen(false)}
        >
          <div className="px-6 py-4 space-y-6">
            {/* Part 1: Contract base compensation form */}
            <div>
              <h3 className="font-semibold text-slate-900 border-b pb-2 mb-3">1. Mức lương & Bảo hiểm hợp đồng</h3>
              <ContractCompensationForm
                key={contractFormVersion}
                contract={selectedContract}
                defaultWorkingDays={defaultWorkingDays}
                sites={sites}
                onSave={handleUpdateContract}
                onClose={() => setDetailsModalOpen(false)}
                busy={savingContract}
                error={contractError}
              />
            </div>

            {/* Part 2: Staff allowances table */}
            <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900">2. Các khoản phụ cấp đã gán cho nhân viên</h3>
                <button
                  type="button"
                  className="button text-button text-sm"
                  onClick={openCreateAllowanceModal}
                >
                  + Gán phụ cấp mới
                </button>
              </div>

              {selectedContract.allowances.length === 0 ? (
                <p className="text-sm text-slate-500 italic py-2">Nhân viên này chưa có khoản phụ cấp nào.</p>
              ) : (
                <div className="table-scroll">
                  <table className="text-sm">
                    <thead>
                      <tr>
                        <th>Mã</th>
                        <th>Tên phụ cấp</th>
                        <th>Cách tính</th>
                        <th>Mức phụ cấp</th>
                        <th>Hiệu lực</th>
                        <th>Trạng thái</th>
                        <th>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedContract.allowances.map(a => (
                        <tr key={a.staffAllowanceId}>
                          <td><strong>{a.allowanceCode}</strong></td>
                          <td>{a.allowanceName}</td>
                          <td>
                            <span className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                              {formatCalcMethod(a.calcMethod)}
                            </span>
                          </td>
                          <td>
                            <strong>
                              {a.valueType === 'fixed' ? formatVnd(a.amountValue) : `${a.amountValue}%`}
                            </strong>
                          </td>
                          <td>
                            {a.effectiveTo ? (
                              <span>{formatDateOnly(a.effectiveFrom)} → {formatDateOnly(a.effectiveTo)}</span>
                            ) : (
                              <span>Từ {formatDateOnly(a.effectiveFrom)}</span>
                            )}
                          </td>
                          <td>
                            <span className={`inline-block text-[11px] px-2 py-0.5 rounded font-medium ${a.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                              {a.status === 'active' ? 'Đang áp dụng' : 'Đã ngừng'}
                            </span>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="text-button text-xs"
                                onClick={() => openEditAllowanceModal(a)}
                              >
                                Sửa
                              </button>
                              {a.status === 'active' && (
                                <button
                                  type="button"
                                  className="text-button text-xs text-rose-600 hover:text-rose-800"
                                  onClick={() => {
                                    setDeactivatingAllowance(a);
                                    setDeactivatingAllowanceError('');
                                  }}
                                >
                                  Ngừng
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Sub-modal: Create or Edit Staff Allowance */}
      {allowanceModalOpen && selectedContract && (
        <Modal
          title={editingAllowance ? 'Chỉnh sửa phụ cấp nhân viên' : 'Gán phụ cấp cho nhân viên'}
          busy={savingAllowance}
          onClose={() => setAllowanceModalOpen(false)}
        >
          <StaffAllowanceForm
            initial={editingAllowance}
            allowanceTypes={allowanceTypes}
            onSave={handleSaveStaffAllowance}
            onClose={() => setAllowanceModalOpen(false)}
            busy={savingAllowance}
            error={allowanceError}
          />
        </Modal>
      )}

      {/* Deactivate Staff Allowance Modal */}
      {deactivatingAllowance && (
        <DeactivateModal
          open={true}
          title="Ngừng áp dụng phụ cấp nhân viên"
          itemName={deactivatingAllowance.allowanceName}
          effectiveFrom={deactivatingAllowance.effectiveFrom}
          busy={deactivatingAllowanceBusy}
          error={deactivatingAllowanceError}
          onConfirm={handleDeactivateStaffAllowance}
          onClose={() => setDeactivatingAllowance(null)}
        />
      )}

      {/* Salary History Modal */}
      {historyModalOpen && historyContract && (
        <Modal
          title={`Lịch sử mức lương hợp đồng`}
          subtitle={
            <span>
              Nhân viên: <strong className="text-slate-700">{historyContract.staffName}</strong> ({historyContract.staffCode}) · Hợp đồng: <strong className="text-slate-700">{historyContract.contractCode || 'Chưa có mã'}</strong> ({historyContract.contractType})
            </span>
          }
          busy={loadingHistory}
          maxWidth="920px"
          onClose={() => setHistoryModalOpen(false)}
        >
          <div className="p-5 space-y-4">
            {historyError && <Alert>{historyError}</Alert>}

            {loadingHistory ? (
              <p className="loading-state">Đang tải lịch sử…</p>
            ) : salaryHistories.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <p className="text-sm italic">Chưa có bản ghi lịch sử điều chỉnh lương nào.</p>
              </div>
            ) : (
              <div className="table-scroll border border-slate-200 rounded-lg overflow-hidden">
                <table className="text-sm w-full">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 text-left">Giai đoạn hiệu lực</th>
                      <th className="py-2.5 px-3 text-left">Kiểu lương</th>
                      <th className="py-2.5 px-3 text-right">Lương ngày</th>
                      <th className="py-2.5 px-3 text-right">Lương tháng</th>
                      <th className="py-2.5 px-3 text-center">Công chuẩn</th>
                      <th className="py-2.5 px-3 text-right">Căn cứ BHXH</th>
                      <th className="py-2.5 px-3 text-left">Cách tính thuế</th>
                      <th className="py-2.5 px-3 text-left">Ghi chú</th>
                      <th className="py-2.5 px-3 text-left">Ngày ghi nhận</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {salaryHistories.map(h => (
                      <tr key={h.historyId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <strong className="text-slate-800">{formatDateOnly(h.effectiveFrom)}</strong>
                          <span className="text-slate-400 mx-1">→</span>
                          <span className={h.effectiveTo ? 'text-slate-600' : 'text-emerald-600 font-semibold'}>
                            {h.effectiveTo ? formatDateOnly(h.effectiveTo) : 'Hiện tại'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span className={`inline-block text-[11px] px-2 py-0.5 rounded font-medium ${h.salaryType === 'daily' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {h.salaryType === 'daily' ? 'Theo ngày' : 'Theo tháng'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-800 whitespace-nowrap">
                          {formatVnd(h.dailyRate)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-medium text-slate-700 whitespace-nowrap">
                          {h.monthlySalary ? formatVnd(h.monthlySalary) : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-700">
                          {h.standardWorkingDays ?? defaultWorkingDays}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-700 whitespace-nowrap">
                          {h.insuranceSalaryBasis ? formatVnd(h.insuranceSalaryBasis) : <span className="text-slate-400 italic">Không đóng</span>}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                          {h.taxMethod === 'flat_10' ? 'Khấu trừ 10%' : 'Biểu lũy tiến'}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-600 max-w-[200px] truncate" title={h.note || ''}>
                          {h.note || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">
                          {formatDate(h.createdAt, '-')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}
    </section>
  );
}