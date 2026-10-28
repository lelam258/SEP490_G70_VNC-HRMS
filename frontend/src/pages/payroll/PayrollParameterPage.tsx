import { useCallback, useEffect, useState } from 'react';
import { payrollParameterApi } from '../../services/payrollParameterApi';
import type {
  AllowanceType,
  SaveAllowanceTypeInput,
  InsuranceConfig,
  SaveInsuranceConfigInput,
  TaxBracket,
  SaveTaxBracketInput,
  TaxDeductionPolicy,
  CommissionRule,
  SaveCommissionRuleInput,
  ProcedureServiceOption,
} from '../../types/payroll';
import Alert from '../../components/ui/Alert';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import { formatVnd, formatPercent, formatDateOnly } from '../../utils/format';
import AllowanceTypeForm from '../../components/payroll/AllowanceTypeForm';
import InsuranceConfigForm from '../../components/payroll/InsuranceConfigForm';
import TaxBracketForm from '../../components/payroll/TaxBracketForm';
import CommissionRuleForm from '../../components/payroll/CommissionRuleForm';

type Tab = 'allowances' | 'insurances' | 'tax-brackets' | 'commission-rules';

export default function PayrollParameterPage() {
  const [activeTab, setActiveTab] = useState<Tab>('allowances');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Data states
  const [allowances, setAllowances] = useState<AllowanceType[]>([]);
  const [insurances, setInsurances] = useState<InsuranceConfig[]>([]);
  const [taxBrackets, setTaxBrackets] = useState<TaxBracket[]>([]);
  const [taxPolicy, setTaxPolicy] = useState<TaxDeductionPolicy | null>(null);
  const [commissionRules, setCommissionRules] = useState<CommissionRule[]>([]);
  const [services, setServices] = useState<ProcedureServiceOption[]>([]);

  // Page states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [affectedWarning, setAffectedWarning] = useState<string[] | null>(null);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [editingItem, setEditingItem] = useState<any>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    const status = statusFilter === 'all' ? undefined : statusFilter;
    const q = searchTerm.trim() ? searchTerm.trim() : undefined;

    try {
      if (activeTab === 'allowances') {
        const data = await payrollParameterApi.listAllowances({ status, q });
        setAllowances(data);
      } else if (activeTab === 'insurances') {
        const data = await payrollParameterApi.listInsurances({ status, q });
        setInsurances(data);
      } else if (activeTab === 'tax-brackets') {
        const [data, policy] = await Promise.all([
          payrollParameterApi.listTaxBrackets({ status }),
          payrollParameterApi.getTaxDeductionPolicy(),
        ]);
        setTaxBrackets(data);
        setTaxPolicy(policy);
      } else if (activeTab === 'commission-rules') {
        const [rules, sList] = await Promise.all([
          payrollParameterApi.listCommissionRules({ status, q }),
          payrollParameterApi.listProcedureServices(),
        ]);
        setCommissionRules(rules);
        setServices(sList);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu tham số.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, statusFilter, searchTerm]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Handle Save
  async function handleSaveAllowance(input: SaveAllowanceTypeInput) {
    setSaving(true);
    setSaveError('');
    try {
      const res = editingItem
        ? await payrollParameterApi.updateAllowance(editingItem.id, input)
        : await payrollParameterApi.createAllowance(input);
      setModalOpen(false);
      setNotice('Đã lưu loại phụ cấp.');
      setAffectedWarning(res.affectedOpenPeriods && res.affectedOpenPeriods.length > 0 ? res.affectedOpenPeriods : null);
      await loadData();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Lỗi khi lưu loại phụ cấp.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveInsurance(input: SaveInsuranceConfigInput) {
    setSaving(true);
    setSaveError('');
    try {
      const res = editingItem
        ? await payrollParameterApi.updateInsurance(editingItem.id, input)
        : await payrollParameterApi.createInsurance(input);
      setModalOpen(false);
      setNotice('Đã lưu cấu hình bảo hiểm.');
      setAffectedWarning(res.affectedOpenPeriods && res.affectedOpenPeriods.length > 0 ? res.affectedOpenPeriods : null);
      await loadData();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Lỗi khi lưu cấu hình bảo hiểm.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTaxBracket(input: SaveTaxBracketInput) {
    setSaving(true);
    setSaveError('');
    try {
      const res = editingItem
        ? await payrollParameterApi.updateTaxBracket(editingItem.id, input)
        : await payrollParameterApi.createTaxBracket(input);
      setModalOpen(false);
      setNotice('Đã lưu bậc thuế TNCN.');
      setAffectedWarning(res.affectedOpenPeriods && res.affectedOpenPeriods.length > 0 ? res.affectedOpenPeriods : null);
      await loadData();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Lỗi khi lưu bậc thuế TNCN.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCommissionRule(input: SaveCommissionRuleInput) {
    setSaving(true);
    setSaveError('');
    try {
      const res = editingItem
        ? await payrollParameterApi.updateCommissionRule(editingItem.id, input)
        : await payrollParameterApi.createCommissionRule(input);
      setModalOpen(false);
      setNotice('Đã lưu quy tắc hoa hồng.');
      setAffectedWarning(res.affectedOpenPeriods && res.affectedOpenPeriods.length > 0 ? res.affectedOpenPeriods : null);
      await loadData();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Lỗi khi lưu quy tắc hoa hồng.');
    } finally {
      setSaving(false);
    }
  }

  function openCreateModal() {
    setEditingItem(null);
    setSaveError('');
    setModalOpen(true);
  }

  function openEditModal(item: any) {
    setEditingItem(item);
    setSaveError('');
    setModalOpen(true);
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">QUẢN LÝ LƯƠNG & ĐÃI NGỘ</span>
          <h1>Tham số tính lương</h1>
          <p className="muted">Cấu hình các loại phụ cấp, tỷ lệ bảo hiểm, biểu thuế TNCN và hoa hồng thủ thuật y tế.</p>
        </div>
        <button
          className="button primary"
          disabled={loading}
          onClick={openCreateModal}
        >
          {activeTab === 'allowances' && 'Thêm phụ cấp'}
          {activeTab === 'insurances' && 'Thêm cấu hình bảo hiểm'}
          {activeTab === 'tax-brackets' && 'Thêm bậc thuế'}
          {activeTab === 'commission-rules' && 'Thêm quy tắc hoa hồng'}
        </button>
      </div>

      {error && <div className="mb-4"><Alert>{error}</Alert></div>}
      {notice && <div className="mb-4"><Alert variant="success">{notice}</Alert></div>}
      {affectedWarning && affectedWarning.length > 0 && (
        <div className="mb-4">
          <Alert variant="warning">
            <strong>Cảnh báo:</strong> Thay đổi tham số ảnh hưởng đến các kỳ lương chưa chốt: <strong>{affectedWarning.join(', ')}</strong>. Cần tính toán lại lương cho các kỳ này.
          </Alert>
        </div>
      )}

      {/* Tabs */}
      <div className="tab-strip mb-4 flex border-b border-slate-200">
        <button
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'allowances'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
          onClick={() => { setActiveTab('allowances'); setSearchTerm(''); }}
        >
          1. Loại phụ cấp
        </button>
        <button
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'insurances'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
          onClick={() => { setActiveTab('insurances'); setSearchTerm(''); }}
        >
          2. Bảo hiểm bắt buộc
        </button>
        <button
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'tax-brackets'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
          onClick={() => { setActiveTab('tax-brackets'); setSearchTerm(''); }}
        >
          3. Thuế TNCN
        </button>
        <button
          className={`px-4 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'commission-rules'
              ? 'border-sky-600 text-sky-600'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
          onClick={() => { setActiveTab('commission-rules'); setSearchTerm(''); }}
        >
          4. Hoa hồng thủ thuật
        </button>
      </div>

      {/* Filter panel */}
      <section className="panel mb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label htmlFor="filter-status" className="sr-only">Trạng thái</label>
              <select
                id="filter-status"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="rounded border border-slate-300 px-3 py-1.5 text-sm"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Ngừng hoạt động</option>
              </select>
            </div>
            {activeTab !== 'tax-brackets' && (
              <div>
                <input
                  type="search"
                  placeholder="Tìm kiếm..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-sm"
                />
              </div>
            )}
          </div>
          <button className="text-button" disabled={loading} onClick={() => void loadData()}>
            Làm mới
          </button>
        </div>
      </section>

      {/* Content for TAB 1: Allowances */}
      {activeTab === 'allowances' && (
        <section className="panel">
          <div className="list-heading">
            <h2>Danh sách loại phụ cấp <span className="count-badge">{allowances.length}</span></h2>
          </div>
          {loading ? (
            <p className="loading-state">Đang tải dữ liệu…</p>
          ) : (
            <DataTable
              rows={allowances}
              rowKey={a => a.id}
              emptyMessage="Chưa có loại phụ cấp nào."
              columns={[
                { key: 'code', label: 'Mã phụ cấp', render: a => <strong>{a.code}</strong> },
                { key: 'name', label: 'Tên phụ cấp', render: a => a.name },
                {
                  key: 'type',
                  label: 'Cách tính',
                  render: a => (a.valueType === 'fixed' ? 'Cố định' : 'Phần trăm (%)'),
                },
                {
                  key: 'val',
                  label: 'Giá trị mặc định',
                  render: a =>
                    a.defaultValue !== null
                      ? a.valueType === 'fixed'
                        ? formatVnd(a.defaultValue)
                        : formatPercent(a.defaultValue)
                      : '-',
                },
                {
                  key: 'tax_ins',
                  label: 'Tính Thuế / BHXH',
                  render: a => (
                    <span className="text-xs text-slate-600">
                      Thuế: {a.isTaxable ? 'Có' : 'Không'} | BH: {a.isInsuranceBasis ? 'Có' : 'Không'}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  label: 'Trạng thái',
                  render: a => (
                    <span className={`badge ${a.status === 'active' ? 'badge-success' : 'badge-inactive'}`}>
                      {a.status === 'active' ? 'Hoạt động' : 'Ngừng'}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  label: '',
                  render: a => (
                    <button className="text-button" onClick={() => openEditModal(a)}>
                      Chỉnh sửa
                    </button>
                  ),
                },
              ]}
            />
          )}
        </section>
      )}

      {/* Content for TAB 2: Insurances */}
      {activeTab === 'insurances' && (
        <section className="panel">
          <div className="list-heading">
            <h2>Cấu hình bảo hiểm bắt buộc <span className="count-badge">{insurances.length}</span></h2>
          </div>
          {loading ? (
            <p className="loading-state">Đang tải dữ liệu…</p>
          ) : (
            <DataTable
              rows={insurances}
              rowKey={i => i.id}
              emptyMessage="Chưa có cấu hình bảo hiểm nào."
              columns={[
                {
                  key: 'type',
                  label: 'Loại bảo hiểm',
                  render: i => {
                    const map: Record<string, string> = {
                      social: 'BHXH',
                      health: 'BHYT',
                      unemployment: 'BHTN',
                      accident: 'BHTNLĐ-BNN',
                    };
                    return <strong>{map[i.insuranceType] || i.insuranceType}</strong>;
                  },
                },
                {
                  key: 'payer',
                  label: 'Bên đóng',
                  render: i => (i.payer === 'employee' ? 'Người lao động' : 'Đơn vị sử dụng'),
                },
                { key: 'rate', label: 'Tỷ lệ', render: i => <strong>{formatPercent(i.ratePercent)}</strong> },
                { key: 'appliesTo', label: 'Áp dụng cho', render: i => i.appliesTo },
                {
                  key: 'period',
                  label: 'Hiệu lực',
                  render: i => `${formatDateOnly(i.effectiveFrom)} → ${formatDateOnly(i.effectiveTo)}`,
                },
                {
                  key: 'status',
                  label: 'Trạng thái',
                  render: i => (
                    <span className={`badge ${i.status === 'active' ? 'badge-success' : 'badge-inactive'}`}>
                      {i.status === 'active' ? 'Hoạt động' : 'Ngừng'}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  label: '',
                  render: i => (
                    <button className="text-button" onClick={() => openEditModal(i)}>
                      Chỉnh sửa
                    </button>
                  ),
                },
              ]}
            />
          )}
        </section>
      )}

      {/* Content for TAB 3: Tax brackets */}
      {activeTab === 'tax-brackets' && (
        <div className="space-y-4">
          {/* Read-only system policy box */}
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-4">
            <h3 className="font-semibold text-sky-900">Mức giảm trừ gia cảnh quy định (Chính sách hệ thống)</h3>
            <p className="text-xs text-sky-700 mb-2">Được cấu hình trong System Policies, áp dụng giảm trừ trước khi tính thuế TNCN lũy tiến.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="rounded bg-white p-3 border border-sky-100">
                <span className="text-slate-500">Giảm trừ bản thân người nộp thuế:</span>
                <p className="text-lg font-bold text-sky-800">
                  {taxPolicy?.personalDeduction ? formatVnd(taxPolicy.personalDeduction) : '11.000.000 ₫'} / tháng
                </p>
              </div>
              <div className="rounded bg-white p-3 border border-sky-100">
                <span className="text-slate-500">Giảm trừ mỗi người phụ thuộc:</span>
                <p className="text-lg font-bold text-sky-800">
                  {taxPolicy?.dependentDeduction ? formatVnd(taxPolicy.dependentDeduction) : '4.400.000 ₫'} / tháng / người
                </p>
              </div>
            </div>
          </div>

          <section className="panel">
            <div className="list-heading">
              <h2>Biểu thuế thu nhập cá nhân (Lũy tiến từng phần) <span className="count-badge">{taxBrackets.length}</span></h2>
            </div>
            {loading ? (
              <p className="loading-state">Đang tải dữ liệu…</p>
            ) : (
              <DataTable
                rows={taxBrackets}
                rowKey={t => t.id}
                emptyMessage="Chưa có bậc thuế nào."
                columns={[
                  {
                    key: 'range',
                    label: 'Khoảng thu nhập tính thuế (VND/tháng)',
                    render: t =>
                      t.incomeTo
                        ? `${formatVnd(t.incomeFrom)} đến ${formatVnd(t.incomeTo)}`
                        : `Trên ${formatVnd(t.incomeFrom)}`,
                  },
                  { key: 'rate', label: 'Thuế suất', render: t => <strong>{formatPercent(t.taxRatePercent)}</strong> },
                  {
                    key: 'period',
                    label: 'Hiệu lực',
                    render: t => `${formatDateOnly(t.effectiveFrom)} → ${formatDateOnly(t.effectiveTo)}`,
                  },
                  {
                    key: 'status',
                    label: 'Trạng thái',
                    render: t => (
                      <span className={`badge ${t.status === 'active' ? 'badge-success' : 'badge-inactive'}`}>
                        {t.status === 'active' ? 'Hoạt động' : 'Ngừng'}
                      </span>
                    ),
                  },
                  {
                    key: 'actions',
                    label: '',
                    render: t => (
                      <button className="text-button" onClick={() => openEditModal(t)}>
                        Chỉnh sửa
                      </button>
                    ),
                  },
                ]}
              />
            )}
          </section>
        </div>
      )}

      {/* Content for TAB 4: Commission rules */}
      {activeTab === 'commission-rules' && (
        <section className="panel">
          <div className="list-heading">
            <h2>Quy tắc hoa hồng thủ thuật y tế <span className="count-badge">{commissionRules.length}</span></h2>
          </div>
          {loading ? (
            <p className="loading-state">Đang tải dữ liệu…</p>
          ) : (
            <DataTable
              rows={commissionRules}
              rowKey={c => c.id}
              emptyMessage="Chưa có quy tắc hoa hồng nào."
              columns={[
                {
                  key: 'service',
                  label: 'Dịch vụ thủ thuật',
                  render: c => (
                    <div>
                      <strong>{c.serviceCode}</strong> - {c.serviceName}
                    </div>
                  ),
                },
                {
                  key: 'role',
                  label: 'Vai trò',
                  render: c => {
                    const roleMap: Record<string, string> = {
                      indicating: 'Bác sĩ chỉ định',
                      performing: 'Bác sĩ thực hiện',
                      assisting: 'Phụ tá / Điều dưỡng',
                    };
                    return roleMap[c.role] || c.role;
                  },
                },
                {
                  key: 'type',
                  label: 'Cách tính',
                  render: c => {
                    if (c.valueType === 'fixed') return 'Cố định';
                    if (c.valueType === 'percent_service') return '% Doanh thu';
                    if (c.valueType === 'percent_profit') return '% Lợi nhuận';
                    return c.valueType;
                  },
                },
                {
                  key: 'val',
                  label: 'Mức hoa hồng',
                  render: c =>
                    c.valueType === 'fixed'
                      ? formatVnd(c.commissionValue)
                      : formatPercent(c.commissionValue),
                },
                {
                  key: 'period',
                  label: 'Hiệu lực',
                  render: c => `${formatDateOnly(c.effectiveFrom)} → ${formatDateOnly(c.effectiveTo)}`,
                },
                {
                  key: 'status',
                  label: 'Trạng thái',
                  render: c => (
                    <span className={`badge ${c.status === 'active' ? 'badge-success' : 'badge-inactive'}`}>
                      {c.status === 'active' ? 'Hoạt động' : 'Ngừng'}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  label: '',
                  render: c => (
                    <button className="text-button" onClick={() => openEditModal(c)}>
                      Chỉnh sửa
                    </button>
                  ),
                },
              ]}
            />
          )}
        </section>
      )}

      {/* MODALS */}
      {modalOpen && activeTab === 'allowances' && (
        <Modal
          title={editingItem ? 'Chỉnh sửa loại phụ cấp' : 'Thêm loại phụ cấp mới'}
          busy={saving}
          onClose={() => setModalOpen(false)}
        >
          <AllowanceTypeForm
            initial={editingItem}
            onSave={handleSaveAllowance}
            onClose={() => setModalOpen(false)}
            busy={saving}
            error={saveError}
          />
        </Modal>
      )}

      {modalOpen && activeTab === 'insurances' && (
        <Modal
          title={editingItem ? 'Chỉnh sửa cấu hình bảo hiểm' : 'Thêm cấu hình bảo hiểm mới'}
          busy={saving}
          onClose={() => setModalOpen(false)}
        >
          <InsuranceConfigForm
            initial={editingItem}
            onSave={handleSaveInsurance}
            onClose={() => setModalOpen(false)}
            busy={saving}
            error={saveError}
          />
        </Modal>
      )}

      {modalOpen && activeTab === 'tax-brackets' && (
        <Modal
          title={editingItem ? 'Chỉnh sửa bậc thuế TNCN' : 'Thêm bậc thuế TNCN mới'}
          busy={saving}
          onClose={() => setModalOpen(false)}
        >
          <TaxBracketForm
            initial={editingItem}
            onSave={handleSaveTaxBracket}
            onClose={() => setModalOpen(false)}
            busy={saving}
            error={saveError}
          />
        </Modal>
      )}

      {modalOpen && activeTab === 'commission-rules' && (
        <Modal
          title={editingItem ? 'Chỉnh sửa quy tắc hoa hồng' : 'Thêm quy tắc hoa hồng mới'}
          busy={saving}
          onClose={() => setModalOpen(false)}
        >
          <CommissionRuleForm
            initial={editingItem}
            services={services}
            onSave={handleSaveCommissionRule}
            onClose={() => setModalOpen(false)}
            busy={saving}
            error={saveError}
          />
        </Modal>
      )}
    </section>
  );
}
