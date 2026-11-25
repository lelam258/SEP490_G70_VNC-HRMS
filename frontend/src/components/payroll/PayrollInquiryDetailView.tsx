import { Link } from 'react-router-dom';
import Alert from '../ui/Alert';
import Icon from '../ui/Icon';
import type { PayrollInquiryDetail } from '../../types/payrollInquiry';
import { formatVnd } from '../../utils/format';
import { formatVietnamDateTime } from '../../utils/leaveRules';
import {
  extractOriginalFileName,
  formatPayMonthLabel,
  getInquiryStatusBadgeClass,
  getInquiryStatusLabel,
  getInquiryTypeLabel,
} from '../../utils/payrollInquiry';

interface Props {
  detail: PayrollInquiryDetail;
  isAccountantView?: boolean;
  hideResponseSection?: boolean;
}

export default function PayrollInquiryDetailView({
  detail,
  isAccountantView = false,
  hideResponseSection = false,
}: Props) {
  const { sourceContext } = detail;

  return (
    <div className="space-y-3">
      {/* Kết quả xử lý & Phản hồi từ Kế toán (đưa lên đầu ở màn Nhân viên để thấy ngay) */}
      {!hideResponseSection &&
        (detail.response || detail.status === 'resolved' || detail.status === 'rejected') && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 m-0">
                  Phản hồi của Kế toán
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${getInquiryStatusBadgeClass(detail.status)}`}
                >
                  {getInquiryStatusLabel(detail.status)}
                </span>
              </div>
              <span className="text-xs text-slate-500 tabular-nums">
                {detail.repliedByName ? `Người xử lý: ${detail.repliedByName}` : ''}
                {detail.resolvedAt ? ` · ${formatVietnamDateTime(detail.resolvedAt)}` : ''}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
              {detail.response}
            </div>
          </div>
        )}

      {/* Đầu hồ sơ: Mã, Tiêu đề, Trạng thái */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-mono font-semibold text-teal-700 bg-teal-50 border border-teal-200/80 px-2 py-0.5 rounded">
                {detail.inquiryCode}
              </span>
              <span>•</span>
              <span>{getInquiryTypeLabel(detail.inquiryType)}</span>
              <span>•</span>
              <span>Kỳ lương: <strong className="text-slate-700">{formatPayMonthLabel(detail.payMonth)}</strong></span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 m-0">{detail.subject}</h2>
          </div>

          <div className="flex items-center gap-2">
            {detail.isReadOnly && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                <Icon name="lock" size={12} />
                Chỉ đọc
              </span>
            )}
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getInquiryStatusBadgeClass(detail.status)}`}>
              {getInquiryStatusLabel(detail.status)}
            </span>
          </div>
        </div>

        {/* Thông tin chung */}
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="bg-slate-50/70 border border-slate-100 rounded-lg px-3 py-2">
            <dt className="text-slate-500 mb-0.5">Nhân viên gửi</dt>
            <dd className="font-semibold text-slate-800 m-0">
              {detail.staffName} <span className="text-slate-500 font-normal">({detail.staffCode})</span>
            </dd>
          </div>
          <div className="bg-slate-50/70 border border-slate-100 rounded-lg px-3 py-2">
            <dt className="text-slate-500 mb-0.5">Khoa / Phòng ban</dt>
            <dd className="font-semibold text-slate-800 m-0">{detail.departmentName || 'Chưa phân khoa'}</dd>
          </div>
          <div className="bg-slate-50/70 border border-slate-100 rounded-lg px-3 py-2">
            <dt className="text-slate-500 mb-0.5">Thời gian gửi</dt>
            <dd className="font-semibold text-slate-800 m-0 tabular-nums">{formatVietnamDateTime(detail.submittedAt)}</dd>
          </div>
          <div className="bg-slate-50/70 border border-slate-100 rounded-lg px-3 py-2">
            <dt className="text-slate-500 mb-0.5">Cập nhật / Đóng hồ sơ</dt>
            <dd className="font-semibold text-slate-800 m-0 tabular-nums">
              {detail.resolvedAt
                ? formatVietnamDateTime(detail.resolvedAt)
                : formatVietnamDateTime(detail.repliedAt)}
            </dd>
          </div>
        </dl>

        {/* Nội dung mô tả */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Nội dung thắc mắc chi tiết
          </div>
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3.5 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
            {detail.description}
          </div>
        </div>

        {/* Tệp minh chứng đính kèm */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
            Minh chứng đính kèm ({detail.attachments.length})
          </div>
          {detail.attachments.length === 0 ? (
            <p className="text-xs text-slate-500 italic m-0">
              Không có tệp minh chứng được đính kèm.
            </p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 m-0 p-0 list-none">
              {detail.attachments.map((att) => {
                const displayName = extractOriginalFileName(att.fileUrl, att.fileName);
                return (
                  <li key={att.attachmentId}>
                    <a
                      href={att.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-teal-50/50 hover:border-teal-300 transition-colors text-xs text-slate-700 no-underline"
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-teal-700 shrink-0 inline-flex">
                          <Icon name="fileText" size={15} />
                        </span>
                        <span className="truncate font-medium">{displayName}</span>
                      </span>
                      <span className="text-[11px] text-teal-700 font-semibold shrink-0">Xem / Tải</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Dữ liệu đối chiếu liên quan (Bảng công, Thủ thuật, Phiếu lương kỳ tương ứng) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900 m-0">
            Thông tin đối chiếu kỳ {formatPayMonthLabel(sourceContext.payMonth)}
          </h3>
          {isAccountantView && sourceContext.payMonth && (
            <div className="flex items-center gap-2 text-xs">
              <Link
                to={`/payroll/periods/${sourceContext.payMonth}`}
                className="text-teal-700 hover:text-teal-800 font-semibold no-underline hover:underline"
              >
                Mở kỳ lương {sourceContext.payMonth} →
              </Link>
            </div>
          )}
        </div>

        {/* Cảnh báo theo SRS MSG05, MSG09, MSG10 */}
        {!sourceContext.attendanceConfirmed && (
          <Alert variant="warning">
            Dữ liệu chấm công của kỳ chưa được chốt xác nhận.
          </Alert>
        )}
        {sourceContext.unverifiedProcedureCount > 0 && (
          <Alert variant="warning">
            Hiện có {sourceContext.unverifiedProcedureCount} phiếu thủ thuật chưa được xác nhận và chưa tính vào hoa hồng kỳ này.
          </Alert>
        )}
        {sourceContext.salaryMaskedReason && (
          <Alert variant="warning">{sourceContext.salaryMaskedReason}</Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
            <div className="text-slate-500 mb-1">Chấm công tháng</div>
            <div className="font-semibold text-slate-800">
              {sourceContext.attendanceConfirmed ? 'Đã chốt xác nhận' : 'Chưa chốt / Đang mở'}
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
            <div className="text-slate-500 mb-1">Phiếu thủ thuật trong kỳ</div>
            <div className="font-semibold text-slate-800 tabular-nums">
              {sourceContext.verifiedProcedureCount} đã xác nhận
              {sourceContext.unverifiedProcedureCount > 0 && (
                <span className="text-amber-700 font-normal"> · {sourceContext.unverifiedProcedureCount} chờ duyệt</span>
              )}
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50">
            <div className="text-slate-500 mb-1">Trạng thái kỳ lương</div>
            <div className="font-semibold text-slate-800">
              {sourceContext.isPeriodFinalized ? 'Đã chốt chính thức' : 'Chưa chốt chính thức'}
            </div>
            {sourceContext.finalizedNetPay != null && (
              <div className="mt-1 text-[11px] text-slate-600 tabular-nums">
                {sourceContext.finalizedWorkDays ?? 0} công · Thực lĩnh:{' '}
                <strong className="text-teal-700">{formatVnd(sourceContext.finalizedNetPay)}</strong>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
