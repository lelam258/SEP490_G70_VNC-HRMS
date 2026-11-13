import { type ReactNode } from 'react';
import type { CommissionMatrix, CommissionMatrixCell } from '../../types/payroll';
import { formatVnd } from '../../utils/format';

interface CommissionMatrixViewProps {
  matrix: CommissionMatrix | null;
  loading: boolean;
  onEditCell?: (cell: CommissionMatrixCell) => void;
  onRemoveCell?: (cell: CommissionMatrixCell, serviceName: string, roleLabel: string) => void;
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
  onRemoveCell,
  onAddRuleForService,
}: CommissionMatrixViewProps) {
  if (loading) {
    return (
      <div className="p-8 text-center text-sm text-slate-500">
        Đang tải ma trận hoa hồng thủ thuật…
      </div>
    );
  }

  if (!matrix || matrix.groups.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-slate-500 border border-slate-200 rounded-lg bg-slate-50/60">
        Chưa có dịch vụ hoặc quy tắc hoa hồng nào được thiết lập.
      </div>
    );
  }

  function renderCellValue(
    cell: CommissionMatrixCell | null,
    serviceId: string | null,
    serviceName: string,
    category: string,
    roleKey: string,
    roleLabel: string
  ): ReactNode {
    if (!cell) {
      return (
        <button
          type="button"
          onClick={() => onAddRuleForService?.(serviceId, category, roleKey)}
          className="text-xs font-medium text-slate-400 hover:text-sky-700 py-1.5 px-2.5 rounded-md border border-transparent hover:border-sky-200 hover:bg-sky-50/70 w-full text-center transition-colors"
        >
          + Thêm
        </button>
      );
    }

    const isFixed = cell.valueType === 'fixed';
    const isPerHour = cell.valueType === 'per_hour';
    const formatted =
      isFixed || isPerHour
        ? `${formatVnd(cell.commissionValue)}${isPerHour ? '/h' : ''}`
        : `${cell.commissionValue}%`;

    return (
      <div className="relative group inline-flex items-center justify-center w-full">
        <button
          type="button"
          onClick={() => onEditCell?.(cell)}
          title="Bấm để chỉnh sửa hoặc hủy mức hoa hồng này"
          className="cursor-pointer py-1.5 px-2.5 rounded-md border border-transparent group-hover:border-slate-200 group-hover:bg-slate-50 w-full transition-colors text-center"
        >
          <span className="font-semibold text-[13px] text-slate-800 group-hover:text-sky-700 block font-[tabular-nums] transition-colors">
            {formatted}
          </span>
          {(cell.positionName || cell.timeCondition !== 'all') && (
            <div className="flex items-center justify-center gap-1 mt-0.5 flex-wrap">
              {cell.positionName && (
                <span className="text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.2 rounded">
                  {cell.positionName}
                </span>
              )}
              {cell.timeCondition !== 'all' && (
                <span className="text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded">
                  {cell.timeCondition === 'after_hours' ? 'Ngoài giờ' : 'Hành chính'}
                </span>
              )}
            </div>
          )}
        </button>

        {onRemoveCell && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveCell(cell, serviceName, roleLabel);
            }}
            title="Hủy mức hoa hồng này (trở về + Thêm)"
            aria-label={`Hủy mức hoa hồng ${roleLabel} của ${serviceName}`}
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-rose-600 hover:border-rose-300 hover:bg-rose-50 flex items-center justify-center text-[10px] leading-none shadow-2xs transition-all cursor-pointer"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 px-0.5">
        <span>
          Bảng phân bổ thù lao theo 5 vai trò thực hiện (BS chỉ định, BS thực hiện, Phụ tá/KTV, KTV Lab, Nhập kết quả).
        </span>
        <span className="text-slate-500">
          Độ ưu tiên: <strong className="font-medium text-slate-700">Nhân viên riêng → Dịch vụ cụ thể → Nhóm dịch vụ</strong>
        </span>
      </div>

      {matrix.groups.map((group) => (
        <div
          key={group.category}
          className="border border-slate-200 rounded-lg overflow-hidden bg-white"
        >
          <div className="bg-slate-50/90 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Nhóm dịch vụ: <span className="text-slate-900">{group.category}</span>
            </span>
            <span className="text-xs text-slate-500 font-medium">
              {group.rows.length} dịch vụ
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-white text-slate-500 text-[11px] font-semibold border-b border-slate-200 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2.5 min-w-[240px] text-slate-600">Dịch vụ kỹ thuật</th>
                  <th className="px-3 py-2.5 w-36 text-right text-slate-600">Đơn giá chuẩn</th>
                  {ROLES.map((r) => (
                    <th
                      key={r.key}
                      className="px-3 py-2.5 text-center min-w-[120px] border-l border-slate-100 text-slate-600"
                    >
                      {r.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 bg-white">
                {group.rows.map((row, idx) => {
                  const isCategoryFallback = row.serviceId === null;
                  return (
                    <tr
                      key={row.serviceId || `cat-${idx}`}
                      className={`h-13 ${
                        isCategoryFallback
                          ? 'bg-slate-50/70'
                          : 'hover:bg-slate-50/50'
                      } transition-colors`}
                    >
                      <td className="px-4 py-2.5 align-middle">
                        <div className="font-medium text-slate-800 text-[13px]">
                          {row.serviceName}
                        </div>
                        {row.serviceCode && (
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {row.serviceCode}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right align-middle font-[tabular-nums] text-[13px] font-medium text-slate-700">
                        {row.basePrice ? formatVnd(row.basePrice) : '—'}
                      </td>
                      {ROLES.map((r) => (
                        <td
                          key={r.key}
                          className="px-2 py-1.5 text-center align-middle border-l border-slate-100"
                        >
                          {renderCellValue(
                            row.cells[r.key] || null,
                            row.serviceId || null,
                            row.serviceName,
                            group.category,
                            r.key,
                            r.label
                          )}
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
