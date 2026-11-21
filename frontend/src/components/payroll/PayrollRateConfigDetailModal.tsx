import type { PayrollRateConfig } from '../../types/payroll';
import Modal from '../ui/Modal';
import Icon from '../ui/Icon';
import { formatDate, formatDateOnly, formatVnd, formatPercent } from '../../utils/format';

interface PayrollRateConfigDetailModalProps {
  item: PayrollRateConfig | null;
  onClose: () => void;
  onEdit?: (item: PayrollRateConfig) => void;
}

export default function PayrollRateConfigDetailModal({
  item,
  onClose,
  onEdit,
}: PayrollRateConfigDetailModalProps) {
  if (!item) return null;

  // Tên hiển thị chuẩn xác, không bị trùng lặp
  const displayName = (() => {
    switch (item.code) {
      case 'duty_night':
        return 'Trực ca đêm';
      case 'duty_noon':
        return 'Trực ca trưa';
      case 'duty_extra_hour_multiplier':
        return 'Trực ngoài giờ';
      case 'union_fee':
        return 'Đoàn phí công đoàn';
      case 'standard_working_days':
        return 'Ngày công chuẩn tháng';
      default:
        return item.description || item.code;
    }
  })();

  const categoryLabel = (() => {
    if (item.code.startsWith('duty_')) return 'Đơn giá ca trực';
    if (item.code === 'union_fee' || item.code === 'standard_working_days') return 'Quy định chung';
    return 'Tham số mở rộng';
  })();

  // Hiển thị số tiền/giá trị to, rõ và đơn vị tự nhiên
  const formattedValue = (() => {
    if (item.unit === 'percent') return formatPercent(item.value);
    if (item.unit === 'days') return `${item.value} ngày`;
    if ((item.unit as string) === 'multiplier') return `${item.value}x`;
    return formatVnd(item.value);
  })();

  const unitSuffix = (() => {
    if (item.code.startsWith('duty_') && item.unit === 'vnd') return '/ ca trực';
    if (item.code === 'duty_extra_hour_multiplier') return 'lương giờ';
    if (item.code === 'union_fee') return '/ tháng';
    if (item.unit === 'percent') return 'tổng thu nhập';
    if (item.unit === 'days') return '/ tháng';
    return '';
  })();

  const scopeDisplay = (() => {
    if (item.staffName) {
      return {
        title: item.staffName,
        subtitle: item.staffCode ? `Mã NV: ${item.staffCode}` : 'Nhân viên cụ thể',
      };
    }
    if (item.positionName) {
      return {
        title: item.positionName,
        subtitle: 'Áp dụng theo chức danh',
      };
    }
    return {
      title: 'Toàn phòng khám',
      subtitle: 'Áp dụng cho mọi nhân sự',
    };
  })();

  return (
    <Modal
      title="Chi tiết tham số lương"
      maxWidth="500px"
      onClose={onClose}
    >
      <div className="space-y-4 pt-1 pb-1 text-slate-800 dark:text-slate-100">
        {/* Hero Section: Thiết kế sạch, sang trọng, tập trung vào giá trị chính */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-b from-sky-50/50 to-white dark:from-slate-800/60 dark:to-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sky-100/70 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300">
                  {categoryLabel}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${
                    item.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      item.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
                    }`}
                  />
                  {item.status === 'active' ? 'Đang áp dụng' : 'Ngừng áp dụng'}
                </span>
              </div>

              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                {displayName}
              </h3>
            </div>

            {/* Khối tiền nổi bật */}
            <div className="text-right shrink-0">
              <div className="flex items-baseline justify-end gap-1">
                <span className="text-2xl font-bold tracking-tight text-sky-600 dark:text-sky-400 font-[tabular-nums]">
                  {formattedValue}
                </span>
                {unitSuffix && (
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {unitSuffix}
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400 dark:text-slate-500 block mt-0.5">
                Mức áp dụng hiện hành
              </span>
            </div>
          </div>
        </div>

        {/* Danh sách thuộc tính: Thiết kế phẳng, thanh lịch, chia hàng sạch sẽ */}
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-sm">
          {/* Hàng 1: Phạm vi áp dụng */}
          <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">
              Phạm vi áp dụng
            </span>
            <div className="text-right">
              <span className="font-semibold text-slate-900 dark:text-slate-100 block">
                {scopeDisplay.title}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500 block">
                {scopeDisplay.subtitle}
              </span>
            </div>
          </div>

          {/* Hàng 2: Thời hạn hiệu lực */}
          <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">
              Thời hạn hiệu lực
            </span>
            <div className="text-right font-[tabular-nums]">
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {formatDateOnly(item.effectiveFrom)}
              </span>
              <span className="text-slate-400 mx-1.5">→</span>
              <span className={item.effectiveTo ? 'font-semibold text-slate-900 dark:text-slate-100' : 'text-emerald-600 dark:text-emerald-400 font-medium'}>
                {item.effectiveTo ? formatDateOnly(item.effectiveTo) : 'Hiện tại'}
              </span>
            </div>
          </div>

          {/* Hàng 3: Mã tham số hệ thống */}
          <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">
              Mã tham số
            </span>
            <code className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200/60 dark:border-slate-700">
              {item.code}
            </code>
          </div>

          {/* Hàng 4: Thời gian khởi tạo */}
          {item.createdAt && (
            <div className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
              <span className="text-slate-500 dark:text-slate-400 text-xs font-medium">
                Khởi tạo lúc
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-300 font-[tabular-nums]">
                {formatDate(item.createdAt)}
              </span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            className="h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-sm font-medium transition-colors"
            onClick={onClose}
          >
            Đóng
          </button>
          {onEdit && (
            <button
              type="button"
              className="h-9 px-4 rounded-lg bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white text-sm font-medium transition-colors flex items-center gap-1.5 shadow-xs"
              onClick={() => {
                onClose();
                onEdit(item);
              }}
            >
              <Icon name="edit" size={15} />
              <span>Chỉnh sửa</span>
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
