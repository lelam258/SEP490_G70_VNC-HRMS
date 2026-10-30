import Modal from '../ui/Modal';
import Icon from '../ui/Icon';
import type { CmeRecord } from '../../types/cme';
import { formatDate } from '../../utils/format';

interface Props {
  record: CmeRecord;
  onClose: () => void;
  onEdit: (record: CmeRecord) => void;
  onToggleVerify: (record: CmeRecord) => void;
  busy?: boolean;
}

function formatDateTime(val: string | null | undefined): string {
  if (!val) return 'Chưa có';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CmeRecordDetailModal({
  record,
  onClose,
  onEdit,
  onToggleVerify,
  busy = false,
}: Props) {
  return (
    <Modal title="Chi tiết bản ghi đào tạo liên tục (CME)" onClose={onClose} busy={busy}>
      <div className="p-6">
        <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-5 gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                +{record.credits} tín chỉ CME
              </span>
              {record.cycleNumber && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
                  Chu kỳ #{record.cycleNumber}
                </span>
              )}
            </div>
            <h3 className="text-lg font-semibold text-slate-800">{record.courseName}</h3>
            <p className="text-xs text-slate-500 mt-1">
              Chứng chỉ liên kết: <strong className="text-slate-700">{record.certificateType}</strong>
            </p>
          </div>

          <span className={`status-badge ${record.verified ? 'active' : 'pending'}`}>
            <i />
            {record.verified ? 'Đã xác minh' : 'Chờ xác minh'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="text-xs text-slate-400 block font-medium">Nhân viên</span>
            <span className="font-semibold text-slate-800">{record.staffName}</span>
            <span className="text-xs text-slate-500 block">Mã NV: {record.staffCode}</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
            <span className="text-xs text-slate-400 block font-medium">Khoa / Phòng</span>
            <span className="font-semibold text-slate-800">
              {record.departmentName || 'Chưa phân khoa'}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block font-medium">Đơn vị đào tạo / Cấp CME</span>
            <span className="text-slate-800 font-medium">
              {record.provider || 'Chưa cập nhật'}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block font-medium">Ngày hoàn thành</span>
            <span className="text-slate-800 font-medium">{formatDate(record.completedDate)}</span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block font-medium">Số tín chỉ tích lũy</span>
            <span className="text-teal-700 font-bold">{record.credits} tín chỉ</span>
          </div>

          <div>
            <span className="text-xs text-slate-400 block font-medium">Định mức CME của chứng chỉ</span>
            <span className="text-slate-700">
              {record.cmeRequiredCredits
                ? `${record.cmeRequiredCredits} tín chỉ${
                    record.cmeCycleMonths ? ` / ${record.cmeCycleMonths} tháng` : ''
                  }`
                : 'Không giới hạn'}
            </span>
          </div>

          <div className="border-t border-slate-100 pt-3">
            <span className="text-xs text-slate-400 block font-medium">Thông tin xác minh</span>
            {record.verified ? (
              <span className="text-slate-700 text-xs block">
                Bởi: <strong>{record.verifiedByName || 'HR Manager'}</strong> lúc{' '}
                {formatDateTime(record.verifiedAt)}
              </span>
            ) : (
              <span className="text-amber-600 text-xs font-medium">Chưa được xác minh</span>
            )}
          </div>

          <div className="border-t border-slate-100 pt-3">
            <span className="text-xs text-slate-400 block font-medium">Ngày nhập vào hệ thống</span>
            <span className="text-slate-600 text-xs">{formatDateTime(record.createdAt)}</span>
          </div>
        </div>

        {record.fileUrl && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <span className="text-xs text-slate-400 block font-medium mb-1">
              Tài liệu / Giấy chứng nhận CME
            </span>
            <a
              href={record.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-teal-700 hover:text-teal-800 underline font-medium"
            >
              <Icon name="fileText" size={14} />
              Xem bản sao chứng nhận CME
            </a>
          </div>
        )}

        <div className="mt-6 flex justify-between items-center gap-3 pt-4 border-t border-slate-200 flex-wrap">
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => onToggleVerify(record)}
          >
            <Icon name="check" size={16} />
            {record.verified ? 'Hủy xác minh' : 'Xác minh ngay'}
          </button>

          <div className="flex gap-2">
            <button type="button" className="button" onClick={onClose} disabled={busy}>
              Đóng
            </button>
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() => {
                onClose();
                onEdit(record);
              }}
            >
              <Icon name="edit" size={16} />
              Chỉnh sửa
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
