import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { payrollParameterApi } from '../../services/payrollParameterApi';
import { employeeApi } from '../../services/employeeApi';
import type {
  AllowanceType,
  InsuranceConfig,
  TaxBracket,
  TaxPolicySummary,
  UpdateTaxPolicyFlagsInput,
  PayrollRateConfig,
  CommissionRule,
  CommissionMatrix,
  StaffCommissionOverride,
  ProcedureServiceOption,
  PositionOption,
} from '../../types/payroll';
import Alert from '../../components/ui/Alert';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import { formatVnd, formatPercent, formatDateRange } from '../../utils/format';
import AllowanceTypeForm from '../../components/payroll/AllowanceTypeForm';
import InsuranceConfigForm from '../../components/payroll/InsuranceConfigForm';
import TaxBracketForm from '../../components/payroll/TaxBracketForm';
import PayrollRateConfigForm from '../../components/payroll/PayrollRateConfigForm';
import CommissionRuleForm from '../../components/payroll/CommissionRuleForm';
import CommissionMatrixView from '../../components/payroll/CommissionMatrixView';
import StaffCommissionOverrideForm from '../../components/payroll/StaffCommissionOverrideForm';
import DeactivateModal from '../../components/payroll/DeactivateModal';

type TabKey = 'allowances' | 'insurance' | 'tax' | 'commission' | 'rates';

export default function PayrollParameterPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Normalize initial tab from query param
  const rawTab = searchParams.get('tab') || 'allowances';
  const initialTab: TabKey =
    rawTab === 'insurance' || rawTab === 'insurances'
      ? 'insurance'
      : rawTab === 'tax' || rawTab === 'taxes'
      ? 'tax'
      : rawTab === 'commission' || rawTab === 'commissions'
      ? 'commission'
      : rawTab === 'rates'
      ? 'rates'
      : 'allowances';

  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  // Search & Filter state per card
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');

  // Commission sub-view (matrix / list / overrides)
  const [commSubTab, setCommSubTab] = useState<'matrix' | 'list' | 'overrides'>('matrix');

  // Loading & Messages
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [affectedWarning, setAffectedWarning] = useState<string[] | null>(null);

  // Domain data
  const [rateConfigs, setRateConfigs] = useState<PayrollRateConfig[]>([]);
  const [allowances, setAllowances] = useState<AllowanceType[]>([]);
  const [insurances, setInsurances] = useState<InsuranceConfig[]>([]);
  const [taxBrackets, setTaxBrackets] = useState<TaxBracket[]>([]);
  const [taxPolicy, setTaxPolicy] = useState<TaxPolicySummary | null>(null);
  const [commissionRules, setCommissionRules] = useState<CommissionRule[]>([]);
  const [commissionMatrix, setCommissionMatrix] = useState<CommissionMatrix | null>(null);
  const [commissionOverrides, setCommissionOverrides] = useState<StaffCommissionOverride[]>([]);

  // Dropdown data
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [services, setServices] = useState<ProcedureServiceOption[]>([]);
  const [staffList, setStaffList] = useState<{ id: string; code: string; name: string }[]>([]);

  // Modals state
  const [modalType, setModalType] = useState<
    'allowance' | 'insurance' | 'tax' | 'rate' | 'commission' | 'override' | null
  >(null);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isModalDirty, setIsModalDirty] = useState(false);
  useEffect(() => { setIsModalDirty(false); }, [modalType]);

  // Deactivation modal state
  const [deactivatingItem, setDeactivatingItem] = useState<{
    type: 'rate' | 'commission' | 'override' | 'allowance' | 'insurance' | 'tax';
    id: string;
    name: string;
    effectiveFrom?: string;
  } | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState('');

  // Tab change handler with URL sync
  function handleTabChange(tab: TabKey) {
    setActiveTab(tab);
    setSearchTerm('');
    setStatusFilter('active');
    setSearchParams({ tab });
  }

  // Load all parameters
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [
        ratesData,
        allowancesData,
        insurancesData,
        taxBracketsData,
        taxPolicyData,
        commRulesData,
        commMatrixData,
        commOverridesData,
        positionsData,
        servicesData,
      ] = await Promise.all([
        payrollParameterApi.listRateConfigs(),
        payrollParameterApi.listAllowances(),
        payrollParameterApi.listInsurances(),
        payrollParameterApi.listTaxBrackets(),
        payrollParameterApi.getTaxPolicySummary().catch(() => null),
        payrollParameterApi.listCommissionRules(),
        payrollParameterApi.getCommissionMatrix().catch(() => null),
        payrollParameterApi.listCommissionOverrides().catch(() => []),
        payrollParameterApi.listPositions().catch(() => []),
        payrollParameterApi.listProcedureServices().catch(() => []),
      ]);

      setRateConfigs(ratesData);
      setAllowances(allowancesData);
      setInsurances(insurancesData);
      setTaxBrackets(taxBracketsData);
      setTaxPolicy(taxPolicyData);
      setCommissionRules(commRulesData);
      setCommissionMatrix(commMatrixData);
      setCommissionOverrides(commOverridesData);
      setPositions(positionsData);
      setServices(servicesData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được danh sách tham số.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Load staff list once for rate config & overrides
  useEffect(() => {
    void employeeApi.list().then(list => {
      setStaffList(list.map(e => ({ id: e.id, code: e.code, name: e.name })));
    }).catch(() => {});
  }, []);

  // Compute active counts for tab chips (only counting currently active records)
  const counts = useMemo(() => {
    return {
      allowances: allowances.filter(a => a.status === 'active').length,
      insurance: insurances.filter(i => i.status === 'active').length,
      tax: taxBrackets.filter(t => t.status === 'active').length,
      commission: commissionRules.filter(c => c.status === 'active').length,
      rates: rateConfigs.filter(r => r.status === 'active').length,
    };
  }, [allowances, insurances, taxBrackets, commissionRules, rateConfigs]);

  // Card header titles & button labels
  const cardConfig = useMemo(() => {
    switch (activeTab) {
      case 'allowances':
        return {
          title: 'Danh mục phụ cấp',
          count: counts.allowances,
          addLabel: 'Thêm phụ cấp',
          emptyText: 'Chưa có loại phụ cấp nào',
          searchPlaceholder: 'Tìm theo mã, tên phụ cấp...',
          onAdd: () => {
            setEditingItem(null);
            setSaveError('');
            setModalType('allowance');
          },
        };
      case 'insurance':
        return {
          title: 'Tỷ lệ đóng bảo hiểm',
          count: counts.insurance,
          addLabel: 'Thêm cấu hình bảo hiểm',
          emptyText: 'Chưa có cấu hình bảo hiểm nào',
          searchPlaceholder: 'Tìm loại bảo hiểm, đối tượng nộp...',
          onAdd: () => {
            setEditingItem(null);
            setSaveError('');
            setModalType('insurance');
          },
        };
      case 'tax':
        return {
          title: 'Biểu thuế TNCN luỹ tiến',
          count: counts.tax,
          addLabel: 'Thêm bậc thuế',
          emptyText: 'Chưa có bậc thuế nào',
          searchPlaceholder: 'Tìm bậc thuế, thuế suất...',
          onAdd: () => {
            setEditingItem(null);
            setSaveError('');
            setModalType('tax');
          },
        };
      case 'commission':
        return {
          title: 'Quy tắc hoa hồng kỹ thuật & thủ thuật',
          count: counts.commission,
          addLabel: commSubTab === 'overrides' ? 'Thiết lập mức riêng' : 'Thêm quy tắc',
          emptyText: 'Chưa có quy tắc hoa hồng nào',
          searchPlaceholder: 'Tìm tên dịch vụ, kỹ thuật...',
          onAdd: () => {
            setEditingItem(null);
            setSaveError('');
            setModalType(commSubTab === 'overrides' ? 'override' : 'commission');
          },
        };
      case 'rates':
      default:
        return {
          title: 'Đơn giá trực & Tham số khác',
          count: counts.rates,
          addLabel: 'Thêm tham số',
          emptyText: 'Chưa có đơn giá trực hay tham số nào',
          searchPlaceholder: 'Tìm đơn giá trực, tham số...',
          onAdd: () => {
            setEditingItem(null);
            setSaveError('');
            setModalType('rate');
          },
        };
    }
  }, [activeTab, counts, commSubTab]);

  // Handle Save functions with affectedOpenPeriods check
  async function handleSaveRate(input: any) {
    setSaving(true);
    setSaveError('');
    try {
      const res = editingItem?.id
        ? await payrollParameterApi.updateRateConfig(editingItem.id, input)
        : await payrollParameterApi.createRateConfig(input);
      setModalType(null);
      setNotice('Đã lưu cấu hình đơn giá.');
      setAffectedWarning(res.affectedOpenPeriods && res.affectedOpenPeriods.length > 0 ? res.affectedOpenPeriods : null);
      await loadData();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Lỗi khi lưu đơn giá.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCommission(input: any) {
    setSaving(true);
    setSaveError('');
    try {
      const res = editingItem?.id
        ? await payrollParameterApi.updateCommissionRule(editingItem.id, input)
        : await payrollParameterApi.createCommissionRule(input);
      setModalType(null);
      setNotice('Đã lưu quy tắc hoa hồng thủ thuật.');
      setAffectedWarning(res.affectedOpenPeriods && res.affectedOpenPeriods.length > 0 ? res.affectedOpenPeriods : null);
      await loadData();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Lỗi khi lưu quy tắc hoa hồng.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveOverride(input: any) {
    setSaving(true);
    setSaveError('');
    try {
      const res = editingItem?.id
        ? await payrollParameterApi.updateCommissionOverride(editingItem.id, input)
        : await payrollParameterApi.createCommissionOverride(input);
      setModalType(null);
      setNotice('Đã lưu mức hoa hồng riêng cho nhân viên.');
      setAffectedWarning(res.affectedOpenPeriods && res.affectedOpenPeriods.length > 0 ? res.affectedOpenPeriods : null);
      await loadData();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Lỗi khi lưu hoa hồng riêng.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAllowance(input: any) {
    setSaving(true);
    setSaveError('');
    try {
      const res = editingItem?.id
        ? await payrollParameterApi.updateAllowance(editingItem.id, input)
        : await payrollParameterApi.createAllowance(input);
      setModalType(null);
      setNotice('Đã lưu loại phụ cấp.');
      setAffectedWarning(res.affectedOpenPeriods && res.affectedOpenPeriods.length > 0 ? res.affectedOpenPeriods : null);
      await loadData();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Lỗi khi lưu loại phụ cấp.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveInsurance(input: any) {
    setSaving(true);
    setSaveError('');
    try {
      const res = editingItem?.id
        ? await payrollParameterApi.updateInsurance(editingItem.id, input)
        : await payrollParameterApi.createInsurance(input);
      setModalType(null);
      setNotice('Đã lưu cấu hình bảo hiểm.');
      setAffectedWarning(res.affectedOpenPeriods && res.affectedOpenPeriods.length > 0 ? res.affectedOpenPeriods : null);
      await loadData();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Lỗi khi lưu cấu hình bảo hiểm.');
    } finally {
      setSaving(false);
    }
  }

    async function handleToggleTaxPolicyFlag(key: 'union' | 'other' | 'flat_base', value: any) {
    if (!taxPolicy) return;
    try {
      const payload: UpdateTaxPolicyFlagsInput = {};
      if (key === 'union') payload.deductUnionFeeBeforeTax = value;
      if (key === 'other') payload.deductOtherBeforeTax = value;
      if (key === 'flat_base') payload.flatTaxBase = value;

      const updated = await payrollParameterApi.updateTaxPolicyFlags(payload);
      setTaxPolicy(updated);
      setNotice('Đã lưu thành công chính sách khấu trừ thuế TNCN.');
    } catch {
      alert('Không thể cập nhật chính sách khấu trừ thuế.');
    }
  }

  // Export CSV for current active tab (Iteration 1 lightweight export)
  function handleExportCsv() {
    let filename = `tham-so-${activeTab}.csv`;
    let headers: string[] = [];
    let rows: string[][] = [];

    if (activeTab === 'allowances') {
      filename = 'danh-muc-phu-cap.csv';
      headers = ['Mã', 'Tên phụ cấp', 'Cách tính', 'Mức phụ cấp', 'Chịu thuế TNCN', 'Trạng thái'];
      rows = allowances.map(a => [
        a.code,
        `"${(a.name || '').replace(/"/g, '""')}"`,
        a.defaultCalcMethod,
        String(a.defaultValue ?? 0),
        a.isTaxable ? 'Có' : 'Không',
        a.status === 'active' ? 'Đang áp dụng' : 'Đã ngừng',
      ]);
    } else if (activeTab === 'insurance') {
      filename = 'ty-le-dong-bao-hiem.csv';
      headers = ['Loại bảo hiểm', 'Đối tượng nộp', 'Tỷ lệ (%)', 'Trạng thái'];
      rows = insurances.map(i => [
        i.insuranceType,
        i.payer === 'employee' ? 'Người lao động' : 'Người sử dụng lao động',
        String(i.ratePercent),
        i.status === 'active' ? 'Đang áp dụng' : 'Đã ngừng',
      ]);
    } else if (activeTab === 'tax') {
      filename = 'bieu-thue-tncn.csv';
      headers = ['Bậc thuế', 'Thu nhập từ (VNĐ)', 'Thu nhập đến (VNĐ)', 'Thuế suất (%)', 'Trạng thái'];
      rows = taxBrackets.map((t, idx) => [
        `Bậc ${idx + 1}`,
        String(t.incomeFrom),
        t.incomeTo ? String(t.incomeTo) : 'Không giới hạn',
        String(t.taxRatePercent),
        t.status === 'active' ? 'Đang áp dụng' : 'Đã ngừng',
      ]);
    } else if (activeTab === 'commission') {
      filename = 'hoa-hong-thu-thuat.csv';
      headers = ['Dịch vụ', 'Vai trò', 'Loại hoa hồng', 'Giá trị', 'Trạng thái'];
      rows = commissionRules.map(r => [
        `"${(r.serviceName || r.serviceCode || '').replace(/"/g, '""')}"`,
        `"${(r.positionName || r.role || 'Chung').replace(/"/g, '""')}"`,
        r.valueType === 'fixed' ? 'Cố định' : 'Tỷ lệ %',
        String(r.commissionValue),
        r.status === 'active' ? 'Đang áp dụng' : 'Đã ngừng',
      ]);
    } else {
      filename = 'don-gia-truc-tham-so.csv';
      headers = ['Mã tham số', 'Áp dụng cho', 'Đơn vị', 'Giá trị', 'Trạng thái'];
      rows = rateConfigs.map(r => [
        r.code,
        renderAppliesTo(r),
        r.unit,
        String(r.value),
        r.status === 'active' ? 'Đang áp dụng' : 'Đã ngừng',
      ]);
    }

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleSaveTaxBracket(input: any) {
    setSaving(true);
    setSaveError('');
    try {
      const res = editingItem?.id
        ? await payrollParameterApi.updateTaxBracket(editingItem.id, input)
        : await payrollParameterApi.createTaxBracket(input);
      setModalType(null);
      setNotice('Đã lưu bậc thuế TNCN.');
      setAffectedWarning(res.affectedOpenPeriods && res.affectedOpenPeriods.length > 0 ? res.affectedOpenPeriods : null);
      await loadData();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Lỗi khi lưu bậc thuế.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmDeactivate(effectiveTo?: string) {
    if (!deactivatingItem) return;
    setDeactivating(true);
    setDeactivateError('');
    try {
      let res: { affectedOpenPeriods?: string[] } = {};
      const { type, id } = deactivatingItem;
      if (type === 'rate') res = await payrollParameterApi.deactivateRateConfig(id, { effectiveTo });
      else if (type === 'commission') res = await payrollParameterApi.deactivateCommissionRule(id, { effectiveTo });
      else if (type === 'override') res = await payrollParameterApi.deactivateCommissionOverride(id, { effectiveTo });
      else if (type === 'allowance') res = await payrollParameterApi.deactivateAllowance(id, { effectiveTo });
      else if (type === 'insurance') res = await payrollParameterApi.deactivateInsurance(id, { effectiveTo });
      else if (type === 'tax') res = await payrollParameterApi.deactivateTaxBracket(id, { effectiveTo });

      setDeactivatingItem(null);
      setNotice('Đã ngừng áp dụng tham số.');
      setAffectedWarning(res.affectedOpenPeriods && res.affectedOpenPeriods.length > 0 ? res.affectedOpenPeriods : null);
      await loadData();
    } catch (cause) {
      setDeactivateError(cause instanceof Error ? cause.message : 'Lỗi khi ngừng áp dụng.');
    } finally {
      setDeactivating(false);
    }
  }

  // Filtered lists based on search & status
  const filteredAllowances = useMemo(() => {
    return allowances.filter(a => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return a.name.toLowerCase().includes(q) || a.code.toLowerCase().includes(q);
      }
      return true;
    });
  }, [allowances, statusFilter, searchTerm]);

  const filteredInsurances = useMemo(() => {
    return insurances.filter(i => {
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const typeNames: Record<string, string> = {
          social: 'bảo hiểm xã hội bhxh',
          health: 'bảo hiểm y tế bhyt',
          unemployment: 'bảo hiểm thất nghiệp bhtn',
          accident: 'tai nạn lao động bhtnlđ',
        };
        const text = `${typeNames[i.insuranceType] || ''} ${i.payer === 'employee' ? 'người lao động' : 'người sử dụng lao động'}`.toLowerCase();
        return text.includes(q);
      }
      return true;
    });
  }, [insurances, statusFilter, searchTerm]);

  const filteredTaxes = useMemo(() => {
    return taxBrackets.filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        return String(t.taxRatePercent).includes(q) || String(t.incomeFrom).includes(q);
      }
      return true;
    });
  }, [taxBrackets, statusFilter, searchTerm]);

  const filteredCommissionRules = useMemo(() => {
    return commissionRules.filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const text = `${c.serviceName || ''} ${c.serviceCategory || ''} ${c.serviceCode || ''} ${c.role} ${c.positionName || ''}`.toLowerCase();
        return text.includes(q);
      }
      return true;
    });
  }, [commissionRules, statusFilter, searchTerm]);

  const filteredOverrides = useMemo(() => {
    return commissionOverrides.filter(o => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const text = `${o.staffName} ${o.staffCode} ${o.serviceName || ''} ${o.serviceCategory || ''} ${o.role}`.toLowerCase();
        return text.includes(q);
      }
      return true;
    });
  }, [commissionOverrides, statusFilter, searchTerm]);

  // Tab 5 "Đơn giá trực & khác": split into 2 groups "Trực" and "Khác"
  const rateGroups = useMemo(() => {
    const list = rateConfigs.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const text = `${r.code} ${r.description || ''} ${r.positionName || ''} ${r.staffName || ''}`.toLowerCase();
        return text.includes(q);
      }
      return true;
    });

    const dutyItems = list.filter(r => r.code.startsWith('duty_'));
    const otherItems = list.filter(r => !r.code.startsWith('duty_'));

    // Sort duty items: Trực tối Bác sĩ, Trực tối Chung, Trực trưa, Trực ngoài giờ
    dutyItems.sort((a, b) => {
      if (a.code === 'duty_night' && b.code === 'duty_night') {
        return a.positionId ? -1 : 1;
      }
      if (a.code === 'duty_night') return -1;
      if (b.code === 'duty_night') return 1;
      if (a.code === 'duty_noon') return -1;
      if (b.code === 'duty_noon') return 1;
      return 0;
    });

    // Sort other items: union_fee, standard_working_days
    otherItems.sort((a, b) => (a.code === 'union_fee' ? -1 : 1));

    return { dutyItems, otherItems };
  }, [rateConfigs, statusFilter, searchTerm]);

  // Helper for applying scope label
  function renderAppliesTo(r: PayrollRateConfig) {
    if (r.staffName) return `${r.staffName} (${r.staffCode})`;
    if (r.positionName) return r.positionName;
    return 'Chung';
  }

  // Helper for Rate parameter name
  function renderRateParamName(r: PayrollRateConfig) {
    switch (r.code) {
      case 'duty_night':
        return 'Trực tối';
      case 'duty_noon':
        return 'Trực trưa';
      case 'duty_extra_hour_multiplier':
        return 'Trực ngoài giờ';
      case 'union_fee':
        return 'Đoàn phí công đoàn';
      case 'standard_working_days':
        return 'Ngày công chuẩn';
      default:
        return r.description || r.code;
    }
  }

  // Helper for Rate formatted value
  function renderRateValue(r: PayrollRateConfig) {
    if (r.code === 'duty_extra_hour_multiplier') {
      return (
        <div>
          <span className="font-[tabular-nums]">150% lương giờ</span>
          <div className="text-[11px] text-slate-500 font-normal">Lương giờ = lương ngày ÷ 8</div>
        </div>
      );
    }
    if (r.unit === 'percent') return <span className="font-[tabular-nums]">{r.value}%</span>;
    if (r.unit === 'days') return <span className="font-[tabular-nums]">{r.value} ngày</span>;
    return <span className="font-[tabular-nums]">{formatVnd(r.value)}</span>;
  }

  return (
    <div className="space-y-6">
      {/* 1. Đầu trang: Không hiển thị FUNC/UC, chuẩn cấu trúc design system */}
      <div className="page-heading">
        <div>
          <span className="eyebrow tracking-wider text-xs font-semibold text-sky-700 uppercase">
            QUẢN LÝ LƯƠNG & ĐÃI NGỘ
          </span>
          <h1 className="text-2xl lg:text-[28px] font-bold text-slate-900 mt-1">
            Tham số lương
          </h1>
          <p className="muted text-sm text-slate-500 mt-1">
            Cấu hình phụ cấp, bảo hiểm, thuế TNCN, hoa hồng thủ thuật và đơn giá trực.
          </p>
        </div>
      </div>

      {notice && <Alert variant="success">{notice}</Alert>}

      {affectedWarning && affectedWarning.length > 0 && (
        <Alert variant="warning">
          Thay đổi tham số này ảnh hưởng đến các kỳ lương đang mở:{' '}
          <strong>{affectedWarning.join(', ')}</strong>. Bảng lương các kỳ này sẽ được tính toán lại theo tham số mới.
        </Alert>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {/* 2. Tabs: Thứ tự Phụ cấp · Bảo hiểm · Thuế TNCN · Hoa hồng thủ thuật · Đơn giá trực & khác */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-8 overflow-x-auto">
          {/* Tab 1: Phụ cấp */}
          <button
            type="button"
            className={`tab-button flex items-center gap-2 py-3.5 border-b-2 text-[15px] transition-colors whitespace-nowrap ${
              activeTab === 'allowances'
                ? 'border-sky-600 text-sky-700 dark:text-sky-400 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900 font-medium'
            }`}
            onClick={() => handleTabChange('allowances')}
          >
            <span>Phụ cấp</span>
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {counts.allowances}
            </span>
          </button>

          {/* Tab 2: Bảo hiểm */}
          <button
            type="button"
            className={`tab-button flex items-center gap-2 py-3.5 border-b-2 text-[15px] transition-colors whitespace-nowrap ${
              activeTab === 'insurance'
                ? 'border-sky-600 text-sky-700 dark:text-sky-400 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900 font-medium'
            }`}
            onClick={() => handleTabChange('insurance')}
          >
            <span>Bảo hiểm</span>
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {counts.insurance}
            </span>
          </button>

          {/* Tab 3: Thuế TNCN */}
          <button
            type="button"
            className={`tab-button flex items-center gap-2 py-3.5 border-b-2 text-[15px] transition-colors whitespace-nowrap ${
              activeTab === 'tax'
                ? 'border-sky-600 text-sky-700 dark:text-sky-400 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900 font-medium'
            }`}
            onClick={() => handleTabChange('tax')}
          >
            <span>Thuế TNCN</span>
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {counts.tax}
            </span>
          </button>

          {/* Tab 4: Hoa hồng thủ thuật */}
          <button
            type="button"
            className={`tab-button flex items-center gap-2 py-3.5 border-b-2 text-[15px] transition-colors whitespace-nowrap ${
              activeTab === 'commission'
                ? 'border-sky-600 text-sky-700 dark:text-sky-400 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900 font-medium'
            }`}
            onClick={() => handleTabChange('commission')}
          >
            <span>Hoa hồng thủ thuật</span>
            {counts.commission > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {counts.commission}
              </span>
            )}
          </button>

          {/* Tab 5: Đơn giá trực & khác */}
          <button
            type="button"
            className={`tab-button flex items-center gap-2 py-3.5 border-b-2 text-[15px] transition-colors whitespace-nowrap ${
              activeTab === 'rates'
                ? 'border-sky-600 text-sky-700 dark:text-sky-400 font-semibold'
                : 'border-transparent text-slate-600 hover:text-slate-900 font-medium'
            }`}
            onClick={() => handleTabChange('rates')}
          >
            <span>Đơn giá trực & khác</span>
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {counts.rates}
            </span>
          </button>
        </nav>
      </div>

      {/* 3. Khung nội dung của mỗi Tab: Card nền trắng, viền mảnh, header 1 hàng chuẩn desktop */}
      <div className="panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm overflow-hidden">
        {/* Header của card: 1 hàng tinh giản chuẩn desktop, không thanh cuộn */}
        <div className="p-3.5 sm:p-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap xl:flex-nowrap items-center justify-between gap-3">
          {/* Trái: Nếu là tab Hoa hồng thì hiện cụm 3 nút chuyển nhanh; các tab khác hiện Tiêu đề + Badge */}
          {activeTab === 'commission' ? (
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 shrink-0">
              <button
                type="button"
                onClick={() => setCommSubTab('matrix')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  commSubTab === 'matrix'
                    ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Phân bổ vai trò
              </button>
              <button
                type="button"
                onClick={() => setCommSubTab('list')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  commSubTab === 'list'
                    ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Danh sách quy tắc ({filteredCommissionRules.length})
              </button>
              <button
                type="button"
                onClick={() => setCommSubTab('overrides')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  commSubTab === 'overrides'
                    ? 'bg-white dark:bg-slate-700 text-sky-700 dark:text-sky-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Mức riêng nhân viên ({filteredOverrides.length})
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5 shrink-0">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                {cardConfig.title}
              </h2>
              {cardConfig.count > 0 && (
                <span className="inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-semibold rounded-full bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/80 dark:border-sky-800/60 shadow-2xs">
                  {cardConfig.count}
                </span>
              )}
            </div>
          )}

          {/* Phải: Tìm kiếm độc lập · Lọc trạng thái riêng biệt · Xuất CSV · Làm mới · Nút "+ Thêm" */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
            {/* Ô input tìm kiếm độc lập */}
            <div className="flex items-center gap-1.5 pl-3 pr-2 h-9 w-48 sm:w-64 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 shadow-xs transition-all">
              <span className="shrink-0 text-slate-400 flex items-center pointer-events-none">
                <Icon name="search" size={14} />
              </span>
              <input
                type="text"
                placeholder={(cardConfig as any).searchPlaceholder || 'Tìm kiếm...'}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ padding: 0, minHeight: 'unset', border: 'none', background: 'transparent' }}
                className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none"
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

            {/* Dropdown trạng thái độc lập, không bị cắt chữ */}
            <div className="relative shrink-0">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                style={{ width: '135px', minWidth: '135px' }}
                className="h-9 pl-3 pr-7 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 shadow-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-all appearance-none"
              >
                <option value="active" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">Đang áp dụng</option>
                <option value="inactive" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">Đã ngừng</option>
                <option value="all" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">Tất cả</option>
              </select>
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-[10px]" aria-hidden="true">
                ▼
              </span>
            </div>

            {/* Cụm thao tác phụ: Xuất CSV & Làm mới */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                className="h-9 px-3 shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 shadow-xs transition-colors text-xs font-medium whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
                title="Xuất bảng tham số hiện tại ra tệp CSV (Excel)"
                onClick={handleExportCsv}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-slate-500 dark:text-slate-400">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                <span>Xuất CSV</span>
              </button>

              <button
                type="button"
                className="h-9 w-9 shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 shadow-xs flex items-center justify-center transition-colors cursor-pointer"
                title="Làm mới dữ liệu"
                aria-label="Làm mới"
                onClick={() => void loadData()}
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

            {/* Nút chính "+ Thêm" theo tab */}
            <button
              type="button"
              className="h-9 px-3.5 shrink-0 rounded-lg bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-medium text-xs sm:text-sm inline-flex items-center justify-center gap-1.5 shadow-sm shadow-sky-600/25 transition-all whitespace-nowrap cursor-pointer"
              onClick={cardConfig.onAdd}
            >
              <span className="text-base leading-none font-bold">+</span> {cardConfig.addLabel}
            </button>
          </div>
        </div>

        {/* 6. Trạng thái tải: Skeleton 5 dòng */}
        {loading ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-800 animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 px-4 flex items-center justify-between">
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/4"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/6"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/8"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/12"></div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            {/* ================= TAB 1: PHỤ CẤP ================= */}
            {activeTab === 'allowances' && (
              filteredAllowances.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="text-3xl text-slate-400 mb-2">📋</div>
                  <p className="text-slate-600 dark:text-slate-400 font-medium mb-3">{cardConfig.emptyText}</p>
                  <button className="h-10 px-4 rounded bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium" onClick={cardConfig.onAdd}>
                    + {cardConfig.addLabel}
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Tên phụ cấp</th>
                        <th className="px-4 py-3">Phương thức tính</th>
                        <th className="px-4 py-3 text-right">Mức phụ cấp</th>
                        <th className="px-4 py-3">Trạng thái</th>
                        <th className="px-4 py-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredAllowances.map(a => {
                        const methodMap: Record<string, string> = {
                          fixed: 'Cố định hàng tháng',
                          prorate_by_workdays: 'Theo ngày công thực tế',
                          per_service_year: `Thâm niên (${a.minServiceYears ?? 3}+ năm)`,
                          percentage: 'Theo % lương cơ bản',
                        };

                        let valDisplay: React.ReactNode = '-';
                        if (a.defaultValue !== null && a.defaultValue !== undefined) {
                          if (a.defaultValue === 0) {
                            valDisplay = (
                              <span className="text-slate-400 italic font-normal text-xs" title="Mức phụ cấp áp dụng riêng theo từng hợp đồng nhân viên">
                                Theo hợp đồng
                              </span>
                            );
                          } else if (a.defaultCalcMethod === 'per_service_year') {
                            valDisplay = `${formatVnd(a.defaultValue)}/năm`;
                          } else if (a.valueType === 'fixed') {
                            valDisplay = formatVnd(a.defaultValue);
                          } else {
                            valDisplay = formatPercent(a.defaultValue);
                          }
                        }

                        return (
                          <tr key={a.id} className="h-14 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3">
                              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {a.name}
                              </span>
                              <div className="flex gap-1.5 mt-0.5">
                                {a.isTaxable && (
                                  <span className="text-[10px] bg-red-50 text-red-700 border border-red-200 px-1 py-0.2 rounded font-medium">
                                    Thuế TNCN
                                  </span>
                                )}
                                {a.isInsuranceBasis && (
                                  <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-1 py-0.2 rounded font-medium">
                                    Đóng BHXH
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                              {methodMap[a.defaultCalcMethod] || a.defaultCalcMethod}
                            </td>
                            <td className="px-4 py-3 text-right font-[tabular-nums] text-slate-900 dark:text-slate-100">
                              {valDisplay}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                a.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                              }`}>
                                {a.status === 'active' ? 'Đang áp dụng' : 'Ngừng'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex items-center justify-end gap-3">
                                <button
                                  type="button"
                                  className="text-button text-xs font-medium text-sky-700 hover:underline"
                                  onClick={() => {
                                    setEditingItem(a);
                                    setSaveError('');
                                    setModalType('allowance');
                                  }}
                                >
                                  Sửa
                                </button>
                                {a.status === 'active' && (
                                  <button
                                    type="button"
                                    className="text-button text-xs font-medium text-rose-600 hover:underline"
                                    onClick={() => {
                                      setDeactivatingItem({
                                        type: 'allowance',
                                        id: a.id,
                                        name: a.name,
                                      });
                                      setDeactivateError('');
                                    }}
                                  >
                                    Ngừng
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* ================= TAB 2: BẢO HIỂM ================= */}
            {activeTab === 'insurance' && (
              filteredInsurances.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="text-3xl text-slate-400 mb-2">📋</div>
                  <p className="text-slate-600 dark:text-slate-400 font-medium mb-3">{cardConfig.emptyText}</p>
                  <button className="h-10 px-4 rounded bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium" onClick={cardConfig.onAdd}>
                    + {cardConfig.addLabel}
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Loại bảo hiểm</th>
                        <th className="px-4 py-3">Bên đóng</th>
                        <th className="px-4 py-3 text-right">Tỷ lệ đóng</th>
                        <th className="px-4 py-3">Hiệu lực</th>
                        <th className="px-4 py-3">Trạng thái</th>
                        <th className="px-4 py-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredInsurances.map(i => {
                        const map: Record<string, string> = {
                          social: 'Bảo hiểm Xã hội (BHXH)',
                          health: 'Bảo hiểm Y tế (BHYT)',
                          unemployment: 'Bảo hiểm Thất nghiệp (BHTN)',
                          accident: 'Bảo hiểm Tai nạn lao động (BHTNLĐ)',
                        };

                        return (
                          <tr key={i.id} className="h-14 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3">
                              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {map[i.insuranceType] || i.insuranceType}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                              {i.payer === 'employee' ? 'Người lao động' : 'Người sử dụng LĐ'}
                            </td>
                            <td className="px-4 py-3 text-right font-[tabular-nums] text-slate-900 dark:text-slate-100">
                              {formatPercent(i.ratePercent)}
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs font-[tabular-nums]">
                              {formatDateRange(i.effectiveFrom, i.effectiveTo)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                i.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                              }`}>
                                {i.status === 'active' ? 'Đang áp dụng' : 'Ngừng'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex items-center justify-end gap-3">
                                <button
                                  type="button"
                                  className="text-button text-xs font-medium text-sky-700 hover:underline"
                                  onClick={() => {
                                    setEditingItem(i);
                                    setSaveError('');
                                    setModalType('insurance');
                                  }}
                                >
                                  Sửa
                                </button>
                                {i.status === 'active' && (
                                  <button
                                    type="button"
                                    className="text-button text-xs font-medium text-rose-600 hover:underline"
                                    onClick={() => {
                                      setDeactivatingItem({
                                        type: 'insurance',
                                        id: i.id,
                                        name: `${map[i.insuranceType] || i.insuranceType} (${i.payer === 'employee' ? 'NLĐ' : 'NSDLĐ'})`,
                                        effectiveFrom: i.effectiveFrom,
                                      });
                                      setDeactivateError('');
                                    }}
                                  >
                                    Ngừng
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* ================= TAB 3: THUẾ TNCN ================= */}
            {activeTab === 'tax' && (
              <div>
                {/* 1. BẢNG BIỂU THUẾ LŨY TIẾN TỪNG PHẦN (Hiển thị ngay đầu tiên khớp với Toolbar) */}
                {filteredTaxes.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-slate-600 dark:text-slate-400 font-medium mb-3">{cardConfig.emptyText}</p>
                    <button className="h-10 px-4 rounded bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium" onClick={cardConfig.onAdd}>
                      + {cardConfig.addLabel}
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto border-b border-slate-200 dark:border-slate-800">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-4 py-3">Bậc thuế</th>
                          <th className="px-4 py-3 text-right">Thu nhập tính thuế tháng</th>
                          <th className="px-4 py-3 text-right">Thuế suất</th>
                          <th className="px-4 py-3">Hiệu lực</th>
                          <th className="px-4 py-3">Trạng thái</th>
                          <th className="px-4 py-3 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredTaxes.map((t, idx) => (
                          <tr key={t.id} className="h-14 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="px-4 py-3">
                              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                Bậc {idx + 1}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-[tabular-nums] text-slate-900 dark:text-slate-100">
                              {t.incomeTo ? `${formatVnd(t.incomeFrom)} → ${formatVnd(t.incomeTo)}` : `Trên ${formatVnd(t.incomeFrom)}`}
                            </td>
                            <td className="px-4 py-3 text-right font-[tabular-nums] text-slate-900 dark:text-slate-100">
                              {formatPercent(t.taxRatePercent)}
                            </td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs font-[tabular-nums]">
                              {formatDateRange(t.effectiveFrom, t.effectiveTo)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                t.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                              }`}>
                                {t.status === 'active' ? 'Đang áp dụng' : 'Đã ngừng áp dụng'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex items-center justify-end gap-3">
                                <button
                                  type="button"
                                  className="text-button text-xs font-medium text-sky-700 hover:underline"
                                  onClick={() => {
                                    setEditingItem(t);
                                    setSaveError('');
                                    setModalType('tax');
                                  }}
                                >
                                  Sửa
                                </button>
                                {t.status === 'active' && (
                                  <button
                                    type="button"
                                    className="text-button text-xs font-medium text-rose-600 hover:underline"
                                    onClick={() => {
                                      setDeactivatingItem({
                                        type: 'tax',
                                        id: t.id,
                                        name: `Bậc thuế ${t.taxRatePercent}%`,
                                        effectiveFrom: t.effectiveFrom,
                                      });
                                      setDeactivateError('');
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

                <div className="p-4 sm:p-6 space-y-6">
                  {/* 2. KHỐI THÔNG SỐ CHÍNH SÁCH GIẢM TRỪ GIA CẢNH & KHẤU TRỪ */}
                  <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/80 rounded-xl p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
                          Thông số giảm trừ gia cảnh & Chính sách khấu trừ
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Căn cứ giảm trừ thu nhập trước khi tính thuế TNCN theo quy chế phòng khám
                        </p>
                      </div>
                    </div>

                    {/* 3 Thẻ chỉ số mức giảm trừ */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-white dark:bg-slate-800 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Giảm trừ bản thân</span>
                        <div className="text-lg font-bold text-sky-700 dark:text-sky-400 mt-1">
                          {taxPolicy ? formatVnd(taxPolicy.personalDeduction) : '15.500.000 ₫'}
                          <span className="text-xs font-normal text-slate-400 ml-1">/tháng</span>
                        </div>
                        <span className="text-[11px] text-slate-400 mt-1 block">Áp dụng cho mọi nhân viên có ký HĐLĐ</span>
                      </div>

                      <div className="bg-white dark:bg-slate-800 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Giảm trừ người phụ thuộc</span>
                        <div className="text-lg font-bold text-sky-700 dark:text-sky-400 mt-1">
                          {taxPolicy ? formatVnd(taxPolicy.dependentDeduction) : '6.200.000 ₫'}
                          <span className="text-xs font-normal text-slate-400 ml-1">/người/tháng</span>
                        </div>
                        <span className="text-[11px] text-slate-400 mt-1 block">Đăng ký người phụ thuộc hợp lệ</span>
                      </div>

                      <div className="bg-white dark:bg-slate-800 p-3.5 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Ngưỡng khấu trừ vãng lai</span>
                        <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-1">
                          {taxPolicy ? formatVnd(taxPolicy.taxFlatThreshold) : '5.000.000 ₫'}
                          <span className="text-xs font-normal text-slate-400 ml-1">/lần chi trả</span>
                        </div>
                        <span className="text-[11px] text-slate-400 mt-1 block">Khấu trừ cố định 10% nếu từ 5M trở lên</span>
                      </div>
                    </div>

                    {/* Chính sách khấu trừ đoàn phí công đoàn */}
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-lg border border-sky-100 dark:border-sky-900/60 bg-white dark:bg-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                            Khấu trừ Đoàn phí công đoàn trước thuế
                          </span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded font-medium">
                            Quy chế nội bộ VNC
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Đoàn phí 100.000 ₫/tháng của công đoàn viên được trừ vào thu nhập trước khi tính thuế TNCN
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={taxPolicy?.deductUnionFeeBeforeTax ?? true}
                          onClick={() => handleToggleTaxPolicyFlag('union', !(taxPolicy?.deductUnionFeeBeforeTax ?? true))}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            (taxPolicy?.deductUnionFeeBeforeTax ?? true) ? 'bg-sky-600' : 'bg-slate-300 dark:bg-slate-600'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              (taxPolicy?.deductUnionFeeBeforeTax ?? true) ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <span
                          onClick={() => handleToggleTaxPolicyFlag('union', !(taxPolicy?.deductUnionFeeBeforeTax ?? true))}
                          className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          {(taxPolicy?.deductUnionFeeBeforeTax ?? true) ? 'Đang áp dụng' : 'Không trừ'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================= TAB 4: HOA HỒNG THỦ THUẬT ================= */}
            {activeTab === 'commission' && (
              <div className="p-4 space-y-4">
                {commSubTab === 'matrix' && (
                  <CommissionMatrixView
                    matrix={commissionMatrix}
                    loading={loading}
                    onEditCell={cell => {
                      const rule = commissionRules.find(r => r.id === cell.ruleId);
                      if (rule) {
                        setEditingItem(rule);
                        setSaveError('');
                        setModalType('commission');
                      }
                    }}
                    onAddRuleForService={(serviceId, category, roleKey) => {
                      setEditingItem({
                        serviceId,
                        serviceCategory: category,
                        role: roleKey,
                      });
                      setSaveError('');
                      setModalType('commission');
                    }}
                  />
                )}

                {commSubTab === 'list' && (
                  filteredCommissionRules.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="text-3xl text-slate-400 mb-2">📋</div>
                      <p className="text-slate-600 dark:text-slate-400 font-medium mb-3">{cardConfig.emptyText}</p>
                      <button className="h-10 px-4 rounded bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium" onClick={cardConfig.onAdd}>
                        + {cardConfig.addLabel}
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="px-4 py-3">Dịch vụ / Nhóm dịch vụ</th>
                            <th className="px-4 py-3">Vai trò</th>
                            <th className="px-4 py-3">Chức danh & Điều kiện</th>
                            <th className="px-4 py-3 text-right">Mức hoa hồng</th>
                            <th className="px-4 py-3">Hiệu lực</th>
                            <th className="px-4 py-3">Trạng thái</th>
                            <th className="px-4 py-3 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {filteredCommissionRules.map(c => {
                            const roleMap: Record<string, string> = {
                              indicating: 'BS Chỉ định',
                              performing: 'BS Thực hiện',
                              assisting: 'Phụ tá / KTV',
                              lab: 'Phòng Lab',
                              typist: 'Đánh máy',
                            };

                            let valStr = '';
                            if (c.valueType === 'fixed') valStr = formatVnd(c.commissionValue);
                            else if (c.valueType === 'per_hour') valStr = `${formatVnd(c.commissionValue)}/h`;
                            else valStr = formatPercent(c.commissionValue);

                            return (
                              <tr key={c.id} className="h-14 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="px-4 py-3">
                                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {c.serviceName || `[Nhóm] ${c.serviceCategory}`}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-slate-700 dark:text-slate-300 font-medium">
                                  {roleMap[c.role] || c.role}
                                </td>
                                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs">
                                  {c.positionName ? c.positionName : 'Mọi chức danh'}
                                  {c.timeCondition !== 'all' && (
                                    <span className="ml-1 text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-1 py-0.2 rounded font-medium">
                                      {c.timeCondition === 'after_hours' ? 'Ngoài giờ' : 'Hành chính'}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-[tabular-nums] text-slate-900 dark:text-slate-100">
                                  {valStr}
                                </td>
                                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs font-[tabular-nums]">
                                  {formatDateRange(c.effectiveFrom, c.effectiveTo)}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    c.status === 'active'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                      : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                  }`}>
                                    {c.status === 'active' ? 'Đang áp dụng' : 'Ngừng'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="inline-flex items-center justify-end gap-3">
                                    <button
                                      type="button"
                                      className="text-button text-xs font-medium text-sky-700 hover:underline"
                                      onClick={() => {
                                        setEditingItem(c);
                                        setSaveError('');
                                        setModalType('commission');
                                      }}
                                    >
                                      Sửa
                                    </button>
                                    {c.status === 'active' && (
                                      <button
                                        type="button"
                                        className="text-button text-xs font-medium text-rose-600 hover:underline"
                                        onClick={() => {
                                          setDeactivatingItem({
                                            type: 'commission',
                                            id: c.id,
                                            name: `${c.serviceName || c.serviceCategory} (${roleMap[c.role] || c.role})`,
                                            effectiveFrom: c.effectiveFrom,
                                          });
                                          setDeactivateError('');
                                        }}
                                      >
                                        Ngừng
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )
                )}

                {commSubTab === 'overrides' && (
                  filteredOverrides.length === 0 ? (
                    <div className="py-12 text-center">
                      <div className="text-3xl text-slate-400 mb-2">📋</div>
                      <p className="text-slate-600 dark:text-slate-400 font-medium mb-3">Chưa có đơn giá hoa hồng riêng nào cho nhân viên.</p>
                      <button
                        className="h-10 px-4 rounded bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium"
                        onClick={() => {
                          setEditingItem(null);
                          setSaveError('');
                          setModalType('override');
                        }}
                      >
                        + Thiết lập mức riêng
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="px-4 py-3">Nhân viên</th>
                            <th className="px-4 py-3">Dịch vụ / Nhóm</th>
                            <th className="px-4 py-3">Vai trò</th>
                            <th className="px-4 py-3 text-right">Mức hoa hồng riêng</th>
                            <th className="px-4 py-3">Hiệu lực</th>
                            <th className="px-4 py-3">Trạng thái</th>
                            <th className="px-4 py-3 text-right">Thao tác</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {filteredOverrides.map(o => (
                            <tr key={o.id} className="h-14 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="px-4 py-3">
                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {o.staffName}
                                </span>
                                <div className="text-xs text-slate-500">{o.staffCode}</div>
                              </td>
                              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                {o.serviceName || `[Nhóm] ${o.serviceCategory}`}
                              </td>
                              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                {o.role}
                              </td>
                              <td className="px-4 py-3 text-right font-[tabular-nums] text-slate-900 dark:text-slate-100">
                                {o.valueType === 'fixed' || o.valueType === 'per_hour'
                                  ? formatVnd(o.commissionValue)
                                  : `${o.commissionValue}%`}
                              </td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs font-[tabular-nums]">
                                {formatDateRange(o.effectiveFrom, o.effectiveTo)}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  o.status === 'active'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                }`}>
                                  {o.status === 'active' ? 'Đang áp dụng' : 'Ngừng'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex items-center justify-end gap-3">
                                  <button
                                    type="button"
                                    className="text-button text-xs font-medium text-sky-700 hover:underline"
                                    onClick={() => {
                                      setEditingItem(o);
                                      setSaveError('');
                                      setModalType('override');
                                    }}
                                  >
                                    Sửa
                                  </button>
                                  {o.status === 'active' && (
                                    <button
                                      type="button"
                                      className="text-button text-xs font-medium text-rose-600 hover:underline"
                                      onClick={() => {
                                        setDeactivatingItem({
                                          type: 'override',
                                          id: o.id,
                                          name: `Hoa hồng riêng: ${o.staffName}`,
                                          effectiveFrom: o.effectiveFrom,
                                        });
                                        setDeactivateError('');
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
                  )
                )}
              </div>
            )}

            {/* ================= TAB 5: ĐƠN GIÁ TRỰC & KHÁC ================= */}
            {activeTab === 'rates' && (
              rateGroups.dutyItems.length === 0 && rateGroups.otherItems.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="text-3xl text-slate-400 mb-2">📋</div>
                  <p className="text-slate-600 dark:text-slate-400 font-medium mb-3">{cardConfig.emptyText}</p>
                  <button className="h-10 px-4 rounded bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium" onClick={cardConfig.onAdd}>
                    + {cardConfig.addLabel}
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Tham số</th>
                        <th className="px-4 py-3">Áp dụng cho</th>
                        <th className="px-4 py-3 text-right">Giá trị</th>
                        <th className="px-4 py-3">Hiệu lực</th>
                        <th className="px-4 py-3">Trạng thái</th>
                        <th className="px-4 py-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {/* Sub-group 1: Trực (Trực tối, Trực trưa, Trực ngoài giờ) */}
                      {rateGroups.dutyItems.length > 0 && (
                        <>
                          <tr className="bg-slate-50 dark:bg-slate-800/70 border-y border-slate-200 dark:border-slate-700">
                            <td colSpan={6} className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                              Trực
                            </td>
                          </tr>
                          {rateGroups.dutyItems.map(r => (
                            <tr key={r.id} className="h-14 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="px-4 py-3">
                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {renderRateParamName(r)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                {renderAppliesTo(r)}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100">
                                {renderRateValue(r)}
                              </td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs font-[tabular-nums]">
                                {formatDateRange(r.effectiveFrom, r.effectiveTo)}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  r.status === 'active'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                }`}>
                                  {r.status === 'active' ? 'Đang áp dụng' : 'Ngừng'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex items-center justify-end gap-3">
                                  <button
                                    type="button"
                                    className="text-button text-xs font-medium text-sky-700 hover:underline"
                                    onClick={() => {
                                      setEditingItem(r);
                                      setSaveError('');
                                      setModalType('rate');
                                    }}
                                  >
                                    Sửa
                                  </button>
                                  {r.status === 'active' && (
                                    <button
                                      type="button"
                                      className="text-button text-xs font-medium text-rose-600 hover:underline"
                                      onClick={() => {
                                        setDeactivatingItem({
                                          type: 'rate',
                                          id: r.id,
                                          name: `${renderRateParamName(r)} (${renderAppliesTo(r)})`,
                                          effectiveFrom: r.effectiveFrom,
                                        });
                                        setDeactivateError('');
                                      }}
                                    >
                                      Ngừng
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </>
                      )}

                      {/* Sub-group 2: Khác (Đoàn phí công đoàn, Ngày công chuẩn) */}
                      {rateGroups.otherItems.length > 0 && (
                        <>
                          <tr className="bg-slate-50 dark:bg-slate-800/70 border-y border-slate-200 dark:border-slate-700">
                            <td colSpan={6} className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                              Khác
                            </td>
                          </tr>
                          {rateGroups.otherItems.map(r => (
                            <tr key={r.id} className="h-14 hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="px-4 py-3">
                                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                  {renderRateParamName(r)}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                {renderAppliesTo(r)}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-900 dark:text-slate-100">
                                {renderRateValue(r)}
                              </td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-400 text-xs font-[tabular-nums]">
                                {formatDateRange(r.effectiveFrom, r.effectiveTo)}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                  r.status === 'active'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                }`}>
                                  {r.status === 'active' ? 'Đang áp dụng' : 'Ngừng'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex items-center justify-end gap-3">
                                  <button
                                    type="button"
                                    className="text-button text-xs font-medium text-sky-700 hover:underline"
                                    onClick={() => {
                                      setEditingItem(r);
                                      setSaveError('');
                                      setModalType('rate');
                                    }}
                                  >
                                    Sửa
                                  </button>
                                  {r.status === 'active' && (
                                    <button
                                      type="button"
                                      className="text-button text-xs font-medium text-rose-600 hover:underline"
                                      onClick={() => {
                                        setDeactivatingItem({
                                          type: 'rate',
                                          id: r.id,
                                          name: `${renderRateParamName(r)} (${renderAppliesTo(r)})`,
                                          effectiveFrom: r.effectiveFrom,
                                        });
                                        setDeactivateError('');
                                      }}
                                    >
                                      Ngừng
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* 7. Modal forms: Rộng 560px, chuẩn UX */}
      {modalType === 'rate' && (
        <Modal
          title={editingItem ? 'Cập nhật đơn giá trực / tham số' : 'Thêm mới đơn giá trực / tham số'}
          maxWidth="600px"
          onClose={() => setModalType(null)}
          hasUnsavedChanges={isModalDirty}
        >
          <PayrollRateConfigForm
            initial={editingItem}
            positions={positions}
            staffList={staffList}
            onSave={handleSaveRate}
            onClose={() => setModalType(null)}
            busy={saving}
            error={saveError}
            onDirtyChange={setIsModalDirty}
          />
        </Modal>
      )}

      {modalType === 'commission' && (
        <Modal
          title={editingItem?.id ? 'Cập nhật quy tắc hoa hồng thủ thuật' : 'Thêm quy tắc hoa hồng thủ thuật'}
          maxWidth="600px"
          onClose={() => setModalType(null)}
          hasUnsavedChanges={isModalDirty}
        >
          <CommissionRuleForm
            initial={editingItem}
            services={services}
            positions={positions}
            onSave={handleSaveCommission}
            onClose={() => setModalType(null)}
            busy={saving}
            error={saveError}
            onDirtyChange={setIsModalDirty}
          />
        </Modal>
      )}

      {modalType === 'override' && (
        <Modal
          title={editingItem?.id ? 'Cập nhật hoa hồng riêng nhân viên' : 'Thiết lập hoa hồng riêng cho nhân viên'}
          maxWidth="600px"
          onClose={() => setModalType(null)}
          hasUnsavedChanges={isModalDirty}
        >
          <StaffCommissionOverrideForm
            initial={editingItem}
            services={services}
            onSave={handleSaveOverride}
            onClose={() => setModalType(null)}
            busy={saving}
            error={saveError}
            onDirtyChange={setIsModalDirty}
          />
        </Modal>
      )}

      {modalType === 'allowance' && (
        <Modal
          title={editingItem ? 'Cập nhật loại phụ cấp' : 'Thêm loại phụ cấp mới'}
          maxWidth="600px"
          onClose={() => setModalType(null)}
          hasUnsavedChanges={isModalDirty}
        >
          <AllowanceTypeForm
            initial={editingItem}
            onSave={handleSaveAllowance}
            onClose={() => setModalType(null)}
            busy={saving}
            error={saveError}
            onDirtyChange={setIsModalDirty}
          />
        </Modal>
      )}

      {modalType === 'insurance' && (
        <Modal
          title={editingItem ? 'Cập nhật mức đóng bảo hiểm' : 'Thêm mức đóng bảo hiểm mới'}
          maxWidth="600px"
          onClose={() => setModalType(null)}
          hasUnsavedChanges={isModalDirty}
        >
          <InsuranceConfigForm
            initial={editingItem}
            onSave={handleSaveInsurance}
            onClose={() => setModalType(null)}
            busy={saving}
            error={saveError}
            onDirtyChange={setIsModalDirty}
          />
        </Modal>
      )}

      {modalType === 'tax' && (
        <Modal
          title={editingItem ? 'Cập nhật bậc thuế TNCN' : 'Thêm bậc thuế TNCN mới'}
          maxWidth="600px"
          onClose={() => setModalType(null)}
          hasUnsavedChanges={isModalDirty}
        >
          <TaxBracketForm
            initial={editingItem}
            onSave={handleSaveTaxBracket}
            onClose={() => setModalType(null)}
            busy={saving}
            error={saveError}
            onDirtyChange={setIsModalDirty}
          />
        </Modal>
      )}

      {deactivatingItem && (
        <DeactivateModal
          open={Boolean(deactivatingItem)}
          title="Xác nhận ngừng áp dụng tham số"
          itemName={deactivatingItem.name}
          effectiveFrom={deactivatingItem.effectiveFrom}
          onConfirm={handleConfirmDeactivate}
          onClose={() => setDeactivatingItem(null)}
          busy={deactivating}
          error={deactivateError}
        />
      )}
    </div>
  );
}
