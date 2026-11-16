import { useState, type FormEvent } from 'react';
import type {
  ComplianceCardFilter,
  ComplianceDepartmentOption,
  CompliancePositionOption,
  OperationalComplianceFilterParams,
  ReportPeriodPreset,
  ReportTypeValue,
} from '../../types/compliance';
import Icon from '../ui/Icon';

export interface ReportFilterBarProps {
  draftFilters: OperationalComplianceFilterParams;
  appliedFilters: OperationalComplianceFilterParams;
  activeCard: ComplianceCardFilter;
  departments: ComplianceDepartmentOption[];
  positions: CompliancePositionOption[];
  lockedDepartmentId: string | null;
  isDepartmentManager: boolean;
  loading: boolean;
  certThresholdDays: number;
  cmeThresholdDays: number;
  onChangeDraft: (patch: Partial<OperationalComplianceFilterParams>) => void;
  onApply: () => void;
  onReset: () => void;
  onRemoveAppliedFilter: (
    key: keyof OperationalComplianceFilterParams | 'activeCard'
  ) => void;
}

function formatPositionLabelVi(position: string): string {
  if (!position) return '—';
  const lower = position.trim().toLowerCase();
  if (lower === 'doctor' || lower === 'bs') return 'Bác sĩ';
  if (lower === 'nurse') return 'Điều dưỡng';
  if (lower === 'technician' || lower === 'ktv') return 'Kỹ thuật viên';
  return position;
}

export function formatReportTypeLabelVi(reportType?: string): string {
  switch (reportType) {
    case 'certificate':
      return 'Báo cáo Chứng chỉ hành nghề (Certificate)';
    case 'cme_cycle':
      return 'Báo cáo Chu kỳ Đào tạo liên tục (CME)';
    case 'all':
    default:
      return 'Tổng hợp Chứng chỉ & CME';
  }
}

export function formatPeriodPresetLabelVi(
  preset?: string,
  fromDate?: string,
  toDate?: string
): string {
  switch (preset) {
    case 'this_month':
      return `Trong tháng này (${fromDate || ''} → ${toDate || ''})`;
    case 'this_quarter':
      return `Trong quý này (${fromDate || ''} → ${toDate || ''})`;
    case 'this_year':
      return `Trong năm nay (${fromDate?.slice(0, 4) || new Date().getFullYear()})`;
    case 'custom':
      if (fromDate && toDate) return `${fromDate} → ${toDate}`;
      if (fromDate) return `Từ ${fromDate}`;
      if (toDate) return `Đến ${toDate}`;
      return 'Khoảng ngày tùy chọn';
    case 'all':
    default:
      return 'Tất cả thời hạn';
  }
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

function computeDateRangeForPreset(preset: ReportPeriodPreset): {
  fromDate: string;
  toDate: string;
} {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, '0');

  if (preset === 'this_month') {
    const ym = `${year}-${pad(month)}`;
    const lastDay = new Date(year, month, 0).getDate();
    return {
      fromDate: `${ym}-01`,
      toDate: `${ym}-${pad(lastDay)}`,
    };
  }

  if (preset === 'this_quarter') {
    const qStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
    const qEndMonth = qStartMonth + 2;
    const lastDay = new Date(year, qEndMonth, 0).getDate();
    return {
      fromDate: `${year}-${pad(qStartMonth)}-01`,
      toDate: `${year}-${pad(qEndMonth)}-${pad(lastDay)}`,
    };
  }

  if (preset === 'this_year') {
    return {
      fromDate: `${year}-01-01`,
      toDate: `${year}-12-31`,
    };
  }

  return {
    fromDate: '',
    toDate: '',
  };
}

export default function ReportFilterBar({
  draftFilters,
  appliedFilters,
  activeCard,
  departments,
  positions,
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

  function handleReportTypeChange(nextReportType: ReportTypeValue) {
    let nextItemType: 'all' | 'certificate' | 'cme_cycle' = 'all';
    if (nextReportType === 'certificate') nextItemType = 'certificate';
    if (nextReportType === 'cme_cycle') nextItemType = 'cme_cycle';

    onChangeDraft({
      reportType: nextReportType,
      itemType: nextItemType,
    });
  }

  function handlePeriodPresetChange(nextPreset: ReportPeriodPreset) {
    if (nextPreset === 'custom') {
      onChangeDraft({
        periodPreset: 'custom',
      });
      return;
    }

    const range = computeDateRangeForPreset(nextPreset);
    onChangeDraft({
      periodPreset: nextPreset,
      fromDate: range.fromDate,
      toDate: range.toDate,
    });
  }

  const effectiveDeptId = lockedDepartmentId || appliedFilters.departmentId || 'all';
  const lockedDeptName = lockedDepartmentId
    ? departments.find(d => d.id === lockedDepartmentId)?.name || 'Khoa/Phòng phụ trách'
    : null;

  // Build active filter chips based on appliedFilters + activeCard
  const chips: Array<{
    key: keyof OperationalComplianceFilterParams | 'activeCard';
    label: string;
    removable: boolean;
  }> = [];

  if (appliedFilters.reportType && appliedFilters.reportType !== 'all') {
    chips.push({
      key: 'reportType',
      label: `Loại báo cáo: ${formatReportTypeLabelVi(appliedFilters.reportType)}`,
      removable: true,
    });
  }

  if (effectiveDeptId && effectiveDeptId !== 'all') {
    const deptName =
      departments.find(d => d.id === effectiveDeptId)?.name || 'Khoa/Phòng đã chọn';
    chips.push({
      key: 'departmentId',
      label:
        lockedDepartmentId || isDepartmentManager
          ? `Phạm vi ủy quyền: ${deptName} (Cố định)`
          : `Phạm vi: ${deptName}`,
      removable: !lockedDepartmentId && !isDepartmentManager,
    });
  }

  if (
    (appliedFilters.periodPreset && appliedFilters.periodPreset !== 'all') ||
    appliedFilters.fromDate ||
    appliedFilters.toDate
  ) {
    chips.push({
      key: 'periodPreset',
      label: `Kỳ hạn: ${formatPeriodPresetLabelVi(
        appliedFilters.periodPreset,
        appliedFilters.fromDate,
        appliedFilters.toDate
      )}`,
      removable: true,
    });
  }

  if (appliedFilters.position && appliedFilters.position !== 'all') {
    chips.push({
      key: 'position',
      label: `Chức danh: ${formatPositionLabelVi(appliedFilters.position)}`,
      removable: true,
    });
  }

  if (appliedFilters.keyword && appliedFilters.keyword.trim() !== '') {
    chips.push({
      key: 'keyword',
      label: `Từ khóa: "${appliedFilters.keyword.trim()}"`,
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

  if (appliedFilters.maxDaysLeft !== undefined && appliedFilters.maxDaysLeft !== '') {
    chips.push({
      key: 'maxDaysLeft',
      label: `Ngưỡng cảnh báo: <= ${appliedFilters.maxDaysLeft} ngày`,
      removable: true,
    });
  }

  const currentPeriodPreset = (draftFilters.periodPreset || 'all') as ReportPeriodPreset;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-3.5"
    >
      {/* HÀNG 1: 3 Trụ cột chính (1. Report Type - 2. Period - 3. Authorized Scope) + Thao tác */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
        {/* 1. Loại báo cáo (Report Type) */}
        <div className="lg:col-span-3">
          <label
            htmlFor="report-type-select"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            1. Loại báo cáo (Report Type)
          </label>
          <select
            id="report-type-select"
            value={draftFilters.reportType || 'all'}
            onChange={e => handleReportTypeChange(e.target.value as ReportTypeValue)}
            disabled={loading}
            className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm bg-white text-slate-800 font-medium"
          >
            <option value="all">Tổng hợp Chứng chỉ &amp; CME</option>
            <option value="certificate">Báo cáo Chứng chỉ hành nghề (Certificate)</option>
            <option value="cme_cycle">Báo cáo Chu kỳ Đào tạo liên tục (CME)</option>
          </select>
        </div>

        {/* 2. Kỳ báo cáo / Thời hạn (Period) */}
        <div className="lg:col-span-3">
          <label
            htmlFor="report-period-preset"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            2. Kỳ hạn xét (Period)
          </label>
          <select
            id="report-period-preset"
            value={currentPeriodPreset}
            onChange={e =>
              handlePeriodPresetChange(e.target.value as ReportPeriodPreset)
            }
            disabled={loading}
            className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm bg-white text-slate-800"
          >
            <option value="all">Tất cả thời hạn</option>
            <option value="this_month">Hết hạn trong tháng này</option>
            <option value="this_quarter">Hết hạn trong quý này</option>
            <option value="this_year">Hết hạn trong năm nay</option>
            <option value="custom">Tùy chọn khoảng ngày…</option>
          </select>
        </div>

        {/* 3. Phạm vi thẩm quyền (Authorized Scope) */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-1">
            <label
              htmlFor="compliance-dept-filter"
              className="block text-xs font-semibold text-slate-700"
            >
              3. Phạm vi thẩm quyền (Scope)
            </label>
            {(lockedDepartmentId || isDepartmentManager) && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                <Icon name="lock" size={11} />
                Khóa theo khoa
              </span>
            )}
          </div>
          <select
            id="compliance-dept-filter"
            value={lockedDepartmentId || draftFilters.departmentId || 'all'}
            onChange={e => onChangeDraft({ departmentId: e.target.value })}
            disabled={Boolean(lockedDepartmentId) || isDepartmentManager || loading}
            title={
              lockedDepartmentId || isDepartmentManager
                ? `Trưởng khoa chỉ được ủy quyền xem dữ liệu của ${lockedDeptName || 'khoa mình'}.`
                : 'Chọn phạm vi Toàn viện hoặc từng Khoa/Phòng cụ thể'
            }
            className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm bg-white text-slate-800 disabled:bg-slate-100 disabled:text-slate-600 disabled:font-medium"
          >
            {!lockedDepartmentId && (
              <option value="all">Toàn viện (Tất cả Khoa/Phòng)</option>
            )}
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>
                {dept.name}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Cụm nút thao tác (Lọc chi tiết, Đặt lại, Áp dụng) */}
        <div className="lg:col-span-3 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(prev => !prev)}
            className={`px-2.5 py-1.5 rounded border text-xs font-medium transition cursor-pointer ${
              showAdvanced
                ? 'border-teal-600 bg-teal-50 text-teal-800'
                : 'border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700'
            }`}
          >
            {showAdvanced ? 'Ẩn lọc phụ' : 'Lọc chi tiết'}
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

      {/* Nếu chọn Kỳ hạn = "Tùy chọn khoảng ngày" thì hiển thị ngay Từ ngày - Đến ngày */}
      {currentPeriodPreset === 'custom' && (
        <div className="pt-2.5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label
              htmlFor="report-from-date-main"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Thời hạn từ ngày
            </label>
            <input
              id="report-from-date-main"
              type="date"
              value={draftFilters.fromDate || ''}
              onChange={e => onChangeDraft({ fromDate: e.target.value })}
              disabled={loading}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm bg-white text-slate-800"
            />
          </div>
          <div>
            <label
              htmlFor="report-to-date-main"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Thời hạn đến ngày
            </label>
            <input
              id="report-to-date-main"
              type="date"
              value={draftFilters.toDate || ''}
              onChange={e => onChangeDraft({ toDate: e.target.value })}
              disabled={loading}
              className="w-full border border-slate-300 rounded px-2.5 py-1.5 text-sm bg-white text-slate-800"
            />
          </div>
        </div>
      )}

      {/* HÀNG 2: Lọc chi tiết cho Chứng chỉ & CME (Tìm kiếm, Chức danh, Ngưỡng cảnh báo) */}
      {showAdvanced && (
        <div className="pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
          {/* Tìm kiếm từ khóa */}
          <div>
            <label
              htmlFor="report-keyword-filter"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Tìm kiếm (Mã NV, Họ tên, Số/Tên chứng chỉ)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-2.5 text-slate-400 pointer-events-none">
                <Icon name="search" size={14} />
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

          {/* Chức danh */}
          <div>
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

          {/* Ngưỡng cảnh báo số ngày còn lại */}
          <div>
            <label
              htmlFor="report-max-days-filter"
              className="block text-xs font-medium text-slate-600 mb-1"
            >
              Ngưỡng ngày còn lại (CCHN &amp; CME)
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

      {/* HÀNG 3: Hiển thị các thẻ bộ lọc đang kích hoạt (Active Filter Chips) */}
      {chips.length > 0 && (
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">Đang áp dụng:</span>
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
