import { type ReactNode } from 'react';
import type { CommissionMatrix, CommissionMatrixCell } from '../../types/payroll';
import { formatVnd } from '../../utils/format';

interface CommissionMatrixViewProps {
  matrix: CommissionMatrix | null;
  loading: boolean;
  onEditCell?: (cell: CommissionMatrixCell) => void;
  onAddRuleForService?: (serviceId: string | null, category: string, role: string) => void;
}

const ROLES = [
  { key: 'indicating', label: 'BS Chỉ định', shortLabel: 'Chỉ định' },
  { key: 'performing', label: 'BS Thực hiện', shortLabel: 'Thực hiện' },
  { key: 'assisting', label: 'Phụ tá / KTV', shortLabel: 'Phụ tá' },
  { key: 'lab', label: 'KTV Lab / Xét nghiệm', shortLabel: 'KTV Lab' },
  { key: 'typist', label: 'Nhập kết quả', shortLabel: 'Nhập KQ' },
];

export default function CommissionMatrixView({
  matrix,
  loading,
  onEditCell,
  onAddRuleForService,
}: CommissionMatrixViewProps) {
  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        Đang tải ma trận hoa hồng thủ thuật…
      </div>
    );
  }

  if (!matrix || matrix.groups.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 border rounded-lg bg-slate-50 dark:bg-slate-800">
        Chưa có dịch vụ hoặc quy tắc hoa hồng nào được thiết lập.
      </div>
    );
  }

  function renderCellValue(cell: CommissionMatrixCell | null, serviceId: string | null, category: string, roleKey: string): ReactNode {
    if (!cell) {
      return (
        <button
          type="button"
          onClick={() => onAddRuleForService?.(serviceId, category, roleKey)}
          className="text-xs text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 py-1.5 px-2 rounded hover:bg-sky-50 dark:hover:bg-sky-900/30 w-full text-center transition-colors"
        >
          + Thêm
        </button>
      );
    }

    const isFixed = cell.valueType === 'fixed';
    const isPerHour = cell.valueType === 'per_hour';
    const formatted = isFixed || isPerHour
      ? `${formatVnd(cell.commissionValue)}${isPerHour ? '/h' : ''}`
      : `${cell.commissionValue}%`;

    return (
      <div
        onClick={() => onEditCell?.(cell)}
        className="cursor-pointer group p-1.5 rounded hover:bg-sky-50 dark:hover:bg-sky-950/40 transition-colors text-center"
      >
        <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 block font-[tabular-nums]">
          {formatted}
        </span>
        <div className="flex items-center justify-center gap-1 mt-0.5 flex-wrap">
          {cell.positionName && (
            <span className="text-[10px] bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 px-1 rounded">
              {cell.positionName}
            </span>
          )}
          {cell.timeCondition !== 'all' && (
            <span className="text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 px-1 rounded">
              {cell.timeCondition === 'after_hours' ? 'Ngoài giờ' : 'Hành chính'}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Bảng phân bổ thù lao theo 5 vai trò thực hiện (BS chỉ định, BS thực hiện, Phụ tá/KTV, KTV Lab, Nhập kết quả).</span>
        <span className="font-medium text-slate-600 dark:text-slate-400">Độ ưu tiên: Nhân viên riêng → Dịch vụ cụ thể → Nhóm dịch vụ</span>
      </div>

      {matrix.groups.map(group => (
        <div key={group.category} className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm">
          <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
            <span>Nhóm dịch vụ: {group.category}</span>
            <span className="text-xs font-normal text-slate-500">{group.rows.length} dịch vụ</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-xs border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 min-w-[240px]">Dịch vụ kỹ thuật</th>
                  <th className="px-3 py-3 w-32 text-right">Đơn giá chuẩn</th>
                  {ROLES.map(r => (
                    <th key={r.key} className="px-3 py-3 text-center min-w-[120px]">
                      {r.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                {group.rows.map((row, idx) => {
                  const isCategoryFallback = row.serviceId === null;
                  return (
                    <tr
                      key={row.serviceId || `cat-${idx}`}
                      className={`h-14 ${isCategoryFallback ? 'bg-amber-50/50 dark:bg-amber-950/20' : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'} transition-colors`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                          {row.serviceName}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-[tabular-nums] text-xs text-slate-600 dark:text-slate-400">
                        {row.basePrice ? formatVnd(row.basePrice) : '-'}
                      </td>
                      {ROLES.map(r => (
                        <td key={r.key} className="px-2 py-2 text-center align-middle border-l border-slate-100 dark:border-slate-800">
                          {renderCellValue(row.cells[r.key] || null, row.serviceId || null, group.category, r.key)}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
