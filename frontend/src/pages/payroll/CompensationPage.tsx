import { useCallback, useEffect, useState } from 'react';
import { compensationApi } from '../../services/compensationApi';
import { payrollParameterApi } from '../../services/payrollParameterApi';
import type {
  ContractSummary,
  ContractCompensation,
  UpdateContractCompensationInput,
  StaffAllowance,
  SaveStaffAllowanceInput,
  AllowanceType,
} from '../../types/payroll';
import Alert from '../../components/ui/Alert';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { formatVnd, formatDateOnly } from '../../utils/format';
import ContractCompensationForm from '../../components/payroll/ContractCompensationForm';
import StaffAllowanceForm from '../../components/payroll/StaffAllowanceForm';

export default function CompensationPage() {
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
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

  const loadContracts = useCallback(async () => {
    setLoading(true);
    setError('');
    const status = statusFilter === 'all' ? undefined : statusFilter;
    const q = searchTerm.trim() ? searchTerm.trim() : undefined;
    try {
      const list = await compensationApi.listContracts({ q, status });
      setContracts(list);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được danh sách hợp đồng.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    void loadContracts();
  }, [loadContracts]);

  // Load allowance types once for dropdown
  useEffect(() => {
    void payrollParameterApi.listAllowances({ status: 'active' }).then(setAllowanceTypes).catch(() => {});
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

  async function handleUpdateContract(input: UpdateContractCompensationInput) {
    if (!selectedContract) return;
    setSavingContract(true);
    setContractError('');
    try {
      const updated = await compensationApi.updateContract(selectedContract.contractId, input);
      setSelectedContract(updated);
      setNotice('Đã cập nhật đãi ngộ hợp đồng.');
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

  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">QUẢN LÝ LƯƠNG & ĐÃI NGỘ</span>
          <h1>Đãi ngộ hợp đồng & Phụ cấp nhân viên</h1>
          <p className="muted">Quản lý mức lương ngày, căn cứ đóng BHXH và các phụ cấp gắn liền với hợp đồng nhân viên.</p>
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

      <section className="panel mb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label htmlFor="filter-contract-status" className="sr-only">Trạng thái</label>
              <select
                id="filter-contract-status"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Đã kết thúc</option>
              </select>
            </div>
            <div>
              <input
                type="search"
                placeholder="Tìm mã HĐ, tên/mã nhân viên..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm w-72"
              />
            </div>
          </div>
          <button className="text-button" disabled={loading} onClick={() => void loadContracts()}>
            Làm mới
          </button>
        </div>
      </section>

      <section className="panel">
        <div className="list-heading">
          <h2>Danh sách hợp đồng nhân sự <span className="count-badge">{contracts.length}</span></h2>
        </div>

        {loading ? (
          <p className="loading-state">Đang tải dữ liệu…</p>
        ) : (
          <DataTable
            rows={contracts}
            rowKey={c => c.contractId}
            emptyMessage="Chưa có hợp đồng nào."
            columns={[
              {
                key: 'staff',
                label: 'Nhân viên',
                render: c => (
                  <div>
                    <strong>{c.staffName}</strong>
                    <div className="text-xs text-slate-500">{c.staffCode} - {c.departmentName || 'Chưa phân khoa'}</div>
                  </div>
                ),
              },
              {
                key: 'contract',
                label: 'Hợp đồng',
                render: c => (
                  <div>
                    <span className="font-mono text-xs">{c.contractCode || 'Chưa có mã'}</span>
                    <div className="text-xs text-slate-600">{c.contractType}</div>
                  </div>
                ),
              },
              {
                key: 'dailyRate',
                label: 'Lương ngày',
                render: c => <strong>{formatVnd(c.dailyRate)}</strong>,
              },
              {
                key: 'insurance',
                label: 'Đóng BHXH',
                render: c => (
                  <div>
                    <span className={c.isInsuranceEligible ? 'text-emerald-700' : 'text-slate-500'}>
                      {c.isInsuranceEligible ? 'Có đóng' : 'Không'}
                    </span>
                    {c.isInsuranceEligible && c.insuranceSalaryBasis && (
                      <div className="text-xs text-slate-600">Lương: {formatVnd(c.insuranceSalaryBasis)}</div>
                    )}
                  </div>
                ),
              },
              {
                key: 'period',
                label: 'Thời hạn',
                render: c => `${formatDateOnly(c.effectiveFrom)} → ${formatDateOnly(c.effectiveTo)}`,
              },
              {
                key: 'status',
                label: 'Trạng thái',
                render: c => (
                  <span className={`badge ${c.status === 'active' ? 'badge-success' : 'badge-inactive'}`}>
                    {c.status === 'active' ? 'Hiệu lực' : 'Hết hạn'}
                  </span>
                ),
              },
              {
                key: 'actions',
                label: '',
                render: c => (
                  <button
                    className="button text-button font-medium text-sky-700"
                    onClick={() => void openDetails(c.contractId)}
                  >
                    Đãi ngộ & Phụ cấp
                  </button>
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
          onClose={() => setDetailsModalOpen(false)}
        >
          <div className="max-h-[80vh] overflow-y-auto px-6 py-4 space-y-6">
            {/* Part 1: Contract base compensation form */}
            <div>
              <h3 className="font-semibold text-slate-900 border-b pb-2 mb-3">1. Mức lương & Bảo hiểm hợp đồng</h3>
              <ContractCompensationForm
                contract={selectedContract}
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
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedContract.allowances.map(a => (
                        <tr key={a.staffAllowanceId}>
                          <td><strong>{a.allowanceCode}</strong></td>
                          <td>{a.allowanceName}</td>
                          <td>{a.valueType === 'fixed' ? 'Cố định' : '%'}</td>
                          <td>
                            <strong>
                              {a.valueType === 'fixed' ? formatVnd(a.amountValue) : `${a.amountValue}%`}
                            </strong>
                          </td>
                          <td>{formatDateOnly(a.effectiveFrom)} → {formatDateOnly(a.effectiveTo)}</td>
                          <td>
                            <span className={`badge ${a.status === 'active' ? 'badge-success' : 'badge-inactive'}`}>
                              {a.status === 'active' ? 'Hoạt động' : 'Ngừng'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="text-button text-xs"
                              onClick={() => openEditAllowanceModal(a)}
                            >
                              Sửa
                            </button>
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
    </section>
  );
}
