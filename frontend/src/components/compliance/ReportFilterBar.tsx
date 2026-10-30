import { useState, type FormEvent } from 'react';
import type {
  ComplianceCardFilter,
  ComplianceDepartmentOption,
  CompliancePositionOption,
  ComplianceSelectOption,
  OperationalComplianceFilterParams,
} from '../../types/compliance';
import Icon from '../ui/Icon';

export interface ReportFilterBarProps {
  draftFilters: OperationalComplianceFilterParams;
  appliedFilters: OperationalComplianceFilterParams;
  activeCard: ComplianceCardFilter;
  departments: ComplianceDepartmentOption[];
  positions: CompliancePositionOption[];
  contractTypes: ComplianceSelectOption[];
  staffStatuses: ComplianceSelectOption[];
  availablePayMonths: string[];
  lockedDepartmentId: string | null;
  isDepartmentManager: boolean;
  loading: boolean;
  certThresholdDays: number;
  cmeThresholdDays: number;
  onChangeDraft: (patch: Partial<OperationalComplianceFilterParams>) => void;
  onApply: () => void;
  onReset: () => void;
  onRemoveAppliedFilter: (key: keyof OperationalComplianceFilterParams | 'activeCard') => void;
}

function formatPositionLabelVi(position: string): string {
  if (!position) return '—';
  const lower = position.trim().toLowerCase();
  if (lower === 'doctor' || lower === 'bs') return 'Bác sĩ';
  if (lower === 'nurse') return 'Điều dưỡng';
  if (lower === 'technician' || lower === 'ktv') return 'Kỹ thuật viên';
  return position;
}

function formatCardFilterLabelVi(
  card: ComplianceCardFilter,
  certThresholdDays: number,
  cmeThresholdDays: number
): string {
  switch (card) {
    case 'total':
      return 'Tất cả trạng thái';
    case 'valid':
      return 'Còn hiệu lực';
    case 'expiring':
      return `Sắp hết hạn (<= ${certThresholdDays} ngày)`;
    case 'expired':
      return 'Đã hết hạn';
    case 'legacy':
      return 'CCHN cũ (Không thời hạn)';
    case 'cme_at_risk':
      return `CME có nguy cơ (<= ${cmeThresholdDays} ngày)`;
    case 'attention':
    default:
      return 'Cần chú ý';
  }
}

export default function ReportFilterBar({
  draftFilters,
  appliedFilters,
  activeCard,
  departments,
  positions,
  contractTypes,
  staffStatuses,
  availablePayMonths,
  lockedDepartmentId,
  isDepartmentManager,
  loading,
  certThresholdDays,
  cmeThresholdDays,
  onChangeDraft,
  onApply,
  onReset,
  onRemoveAppliedFilter,
}: ReportFilterBarProps) {
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onApply();
  }

  // Build active filter chips based on appliedFilters + activeCard
  const chips: Array<{
    key: keyof OperationalComplianceFilterParams | 'activeCard';
    label: string;
    removable: boolean;
  }> = [];

  if (appliedFilters.keyword && appliedFilters.keyword.trim() !== '') {
    chips.push({
      key: 'keyword',
      label: `Từ khóa: "${appliedFilters.keyword.trim()}"`,
      removable: true,
    });
  }

  const effectiveDeptId = lockedDepartmentId || appliedFilters.departmentId;
  if (effectiveDeptId && effectiveDeptId !== 'all') {
    const deptName =
      departments.find(d => d.id === effectiveDeptId)?.name || 'Khoa/Phòng đã chọn';
    chips.push({
      key: 'departmentId',
      label: `Khoa/Phòng: ${deptName}`,
      removable: !lockedDepartmentId && !isDepartmentManager,
    });
  }

  if (appliedFilters.position && appliedFilters.position !== 'all') {
    chips.push({
      key: 'position',
      label: `Chức danh: ${formatPositionLabelVi(appliedFilters.position)}`,
      removable: true,
    });
  }

  if (activeCard !== 'attention') {
    chips.push({
      key: 'activeCard',
      label: `Trạng thái: ${formatCardFilterLabelVi(
        activeCard,
        certThresholdDays,
        cmeThresholdDays
      )}`,
      removable: true,
    });
  }

  if (appliedFilters.itemType && appliedFilters.itemType !== 'all') {
    const itemLabel =
      appliedFilters.itemType === 'certificate' ? 'Chỉ Chứng chỉ' : 'Chỉ Chu kỳ CME';
    chips.push({
      key: 'itemType',
      label: `Phân mục: ${itemLabel}`,
      removable: true,
    });
  }

  if (appliedFilters.staffStatus && appliedFilters.staffStatus !== 'active') {
    const statusLabel =
      appliedFilters.staffStatus === 'all'
        ? 'Tất cả trạng thái nhân sự'
        : staffStatuses.find(s => s.value === appliedFilters.staffStatus)?.label ||
          appliedFilters.staffStatus;
    chips.push({
      key: 'staffStatus',
      label: `Nhân sự: ${statusLabel}`,
      removable: true,
    });
  }

  if (appliedFilters.contractType && appliedFilters.contractType !== 'all') {
    const contractLabel =
      contractTypes.find(c => c.value === appliedFilters.contractType)?.label ||
      appliedFilters.contractType;
    chips.push({
      key: 'contractType',
      label: `Hợp đồng: ${contractLabel}`,
      removable: true,
    });
  }

  if (appliedFilters.payMonth && appliedFilters.payMonth !== 'all') {
    chips.push({
      key: 'payMonth',
      label: `Kỳ vận hành: ${appliedFilters.payMonth}`,
      removable: true,
    });
  }

  if (appliedFilters.fromDate) {
    chips.push({
      key: 'fromDate',
      label: `Hạn từ: ${appliedFilters.fromDate}`,
      removable: true,
    });
  }

  if (appliedFilters.toDate) {
    chips.push({
      key: 'toDate',
      label: `Hạn đến: ${appliedFilters.toDate}`,
      removable: true,
    });
  }

  if (appliedFilters.maxDaysLeft !== undefined && appliedFilters.maxDaysLeft !== '') {
    chips.push({
      key: 'maxDaysLeft',
      label: `Ngưỡng còn lại: <= ${appliedFilters.maxDaysLeft} ngày`,
      removable: true,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3.5"
    >
      {/* Hàng 1: Bộ lọc chính (Operational & Compliance Core Filters) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
        {/* 1. Từ khóa tìm kiếm */}
        <div className="lg:col-span-3">
          <label
            htmlFor="report-keyword-filter"
            className="block text-xs font-medium text-slate-600 mb-1"
          >
            Tìm kiếm (Mã NV, Họ tên, Số CCHN)
          </label>
          <div className="relative flex items-center">
            <span className="absolute left-2.5 text-slate-400 pointer-events-none">
              <Icon name="search" size={15} />
            </span>
            <input
              id="report-keyword-filter"
              type="text"
              value={draftFilters.keyword || ''}
              onChange={e => onChangeDraft({ keyword: e.target.value })}
              placeholder="Nhập tên, mã NV, chứng chỉ…"
              disabled={loading}
              className="w-full border border-slate-300 rounded pl-8 pr-2.5 py-1.5 text-sm bg-white text-slate-800 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* 2. Phòng ban / Khoa */}
        <div className="lg:col-span-2">
          <label
            htmlFor="compliance-dept-filter"
            className="block text-xs font-medium text-slate-600 mb-1"
          >
            Phòng ban / Khoa
          </label>
          <select
            id="compliance-dept-filter"
            value={lockedDepartmentId || draftFilters.departmentId || 'all'}
            onChange={e => onChangeDraft({ departmentId: e.target.value })}
            disabled={Boolean(lockedDepartmentId) || isDepartmentManager || loading}
            title={
              lockedDepartmentId || isDepartmentManager
                ? 'Trưởng khoa / phòng chỉ xem được dữ liệu trong phạm vi khoa / phòng của mình.'
                : 'Lọc theo Phòng ban / Khoa'
            }
            className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm bg-white text-slate-800 disabled:bg-slate-100 disabled:text-slate-500"
          >
            {!lockedDepartmentId && <option value="all">Tất cả khoa/phòng</option>}
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        {/* 3. Chức danh */}
        <div className="lg:col-span-2">
          <label
            htmlFor="compliance-pos-filter"
            className="block text-xs font-medium text-slate-600 mb-1"
          >
            Chức danh chuyên môn
          </label>
          <select
            id="compliance-pos-filter"
            value={draftFilters.position || 'all'}
            onChange={e => onChangeDraft({ position: e.target.value })}
            disabled={loading}
            className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm bg-white text-slate-800"
          >
            <option value="all">Tất cả chức danh</option>
            {positions.map(pos => (
              <option key={pos.value} value={pos.value}>
                {formatPositionLabelVi(pos.label)}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Phân mục báo cáo */}
        <div className="lg:col-span-2">
          <label
            htmlFor="report-item-type-filter"
            className="block text-xs font-medium text-slate-600 mb-1"
          >
            Phân mục hiển thị
          </label>
          <select
            id="report-item-type-filter"
            value={draftFilters.itemType || 'all'}
            onChange={e => onChangeDraft({ itemType: e.target.value })}
            disabled={loading}
            className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm bg-white text-slate-800"
          >
            <option value="all">Chứng chỉ &amp; Chu kỳ CME</option>
            <option value="certificate">Chỉ Chứng chỉ hành nghề</option>
            <option value="cme_cycle">Chỉ Chu kỳ CME</option>
          </select>
        </div>

        {/* 5. Cụm nút thao tác (Lọc nâng cao, Áp dụng, Đặt lại) */}
        <div className="lg:col-span-3 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(prev => !prev)}
            className={`px-3 py-1.5 rounded border text-xs font-medium transition cursor-pointer ${
              showAdvanced
                ? 'border-teal-600 bg-teal-50 text-teal-800'
                : 'border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700'
            }`}
          >
            {showAdvanced ? 'Ẩn lọc nâng cao' : 'Bộ lọc nâng cao'}
          </button>

          <button
            type="button"
            onClick={onReset}
            disabled={loading}
            className="px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition cursor-pointer disabled:opacity-50"
          >
            Đặt lại
          </button>

          <button
            type="submit"
            disabled={loading}
            className="px-4 py-1.5 rounded border border-slate-800 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            Áp dụng
          </button>
        </div>
      </div>

      {/* Hàng 2: Bộ lọc nâng cao (Operational HR, Hợp đồng, Thời hạn, Ngưỡng ngày & Sắp xếp) */}
      {showAdvanced && (
        <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          {/* Trạng thái nhân sự */}
          <div>
            <label
              htmlFor="report-staff-status-filter"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Trạng thái nhân sự
            </label>
            <select
              id="report-staff-status-filter"
              value={draftFilters.staffStatus || 'active'}
              onChange={e => onChangeDraft({ staffStatus: e.target.value })}
              disabled={loading}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm bg-white text-slate-800"
            >
              <option value="all">Tất cả trạng thái</option>
              {staffStatuses.map(st => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          {/* Loại hợp đồng */}
          <div>
            <label
              htmlFor="report-contract-type-filter"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Loại hợp đồng
            </label>
            <select
              id="report-contract-type-filter"
              value={draftFilters.contractType || 'all'}
              onChange={e => onChangeDraft({ contractType: e.target.value })}
              disabled={loading}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm bg-white text-slate-800"
            >
              <option value="all">Tất cả hợp đồng</option>
              {contractTypes.map(ct => (
                <option key={ct.value} value={ct.value}>
                  {ct.label}
                </option>
              ))}
            </select>
          </div>

          {/* Kỳ vận hành / chấm công / lương */}
          <div>
            <label
              htmlFor="report-pay-month-filter"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Kỳ vận hành (Tháng)
            </label>
            <select
              id="report-pay-month-filter"
              value={draftFilters.payMonth || 'all'}
              onChange={e => onChangeDraft({ payMonth: e.target.value })}
              disabled={loading}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm bg-white text-slate-800"
            >
              <option value="all">Tất cả các kỳ</option>
              {availablePayMonths.map(pm => (
                <option key={pm} value={pm}>
                  Tháng {pm}
                </option>
              ))}
            </select>
          </div>

          {/* Hạn từ ngày */}
          <div>
            <label
              htmlFor="report-from-date-filter"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Thời hạn từ ngày
            </label>
            <input
              id="report-from-date-filter"
              type="date"
              value={draftFilters.fromDate || ''}
              onChange={e => onChangeDraft({ fromDate: e.target.value })}
              disabled={loading}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm bg-white text-slate-800"
            />
          </div>

          {/* Hạn đến ngày */}
          <div>
            <label
              htmlFor="report-to-date-filter"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Thời hạn đến ngày
            </label>
            <input
              id="report-to-date-filter"
              type="date"
              value={draftFilters.toDate || ''}
              onChange={e => onChangeDraft({ toDate: e.target.value })}
              disabled={loading}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm bg-white text-slate-800"
            />
          </div>

          {/* Ngưỡng cảnh báo số ngày còn lại */}
          <div>
            <label
              htmlFor="report-max-days-filter"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Ngưỡng ngày còn lại
            </label>
            <select
              id="report-max-days-filter"
              value={draftFilters.maxDaysLeft ?? ''}
              onChange={e =>
                onChangeDraft({
                  maxDaysLeft: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
              disabled={loading}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm bg-white text-slate-800"
            >
              <option value="">Mặc định hệ thống</option>
              <option value="30">Trong vòng 30 ngày</option>
              <option value="60">Trong vòng 60 ngày</option>
              <option value="90">Trong vòng 90 ngày</option>
              <option value="180">Trong vòng 180 ngày</option>
              <option value="365">Trong vòng 365 ngày</option>
            </select>
          </div>
        </div>
      )}

      {/* Hàng 3: Hiển thị các thẻ bộ lọc đang kích hoạt (Active Filter Chips) */}
      {chips.length > 0 && (
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Đang lọc theo:</span>
          {chips.map(chip => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200"
            >
              {chip.label}
              {chip.removable && (
                <button
                  type="button"
                  onClick={() => onRemoveAppliedFilter(chip.key)}
                  className="text-slate-500 hover:text-slate-900 font-bold ml-0.5 cursor-pointer bg-transparent border-0 p-0 leading-none"
                  title="Gỡ tiêu chí lọc này"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </form>
  );
}
