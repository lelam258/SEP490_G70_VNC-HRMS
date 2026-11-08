import { useState } from 'react';
import Modal from '../ui/Modal';
import Icon from '../ui/Icon';
import Alert from '../ui/Alert';
import type { Certificate } from '../../types/certificates';
import { formatDate } from '../../utils/format';

interface Props {
  certificate: Certificate;
  onClose: () => void;
  onEdit?: (cert: Certificate) => void;
  onReview?: (cert: Certificate, action: 'approve' | 'reject', reason?: string) => Promise<void>;
  busyReview?: boolean;
}

function formatDateTime(val: string | null | undefined): string {
  if (!val) return 'Chưa có';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function cleanText(val?: string | null): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      return (parsed.ProfessionalDegree || parsed.Scope || parsed.Major || '').trim();
    } catch {
      const m = trimmed.match(/"(?:ProfessionalDegree|Scope)":\s*"([^"]+)"/);
      if (m && m[1]) return m[1].trim();
      return '';
    }
  }
  return trimmed;
}

export default function CertificateDetailModal({
  certificate,
  onClose,
  onEdit,
  onReview,
  busyReview = false,
}: Props) {
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  const isDegree = certificate.category === 'degree';
  const isExpired = certificate.expiryDate ? new Date(certificate.expiryDate) < new Date() : false;

  const isPendingReview =
    certificate.status === 'unverified' ||
    certificate.status === 'pending' ||
    certificate.verificationStatus === 'unverified';

  const isRejected =
    certificate.status === 'rejected' ||
    certificate.verificationStatus === 'rejected';

  // Verification status label for Degree
  const verStatus = certificate.verificationStatus || certificate.status;
  const verLabel =
    verStatus === 'verified'
      ? 'Đã xác minh'
      : verStatus === 'rejected'
      ? 'Không hợp lệ / Từ chối'
      : 'Chờ xác minh';

  const verClass =
    verStatus === 'verified'
      ? 'active'
      : verStatus === 'rejected'
      ? 'inactive'
      : 'pending';

  // Status for Certificate
  const certStatusLabel =
    certificate.status === 'active'
      ? isExpired
        ? 'Hết hạn'
        : 'Đang hiệu lực'
      : certificate.status === 'pending' || certificate.status === 'unverified'
      ? 'Chờ HR duyệt'
      : certificate.status === 'rejected'
      ? 'Bị từ chối'
      : certificate.status === 'expired'
      ? 'Hết hạn'
      : certificate.status === 'suspended'
      ? 'Tạm đình chỉ'
      : certificate.status === 'revoked'
      ? 'Bị thu hồi'
      : certificate.status || 'Chưa xác định';

  const certStatusClass =
    certificate.status === 'active' && !isExpired
      ? 'active'
      : certificate.status === 'expired' || isExpired || certificate.status === 'rejected'
      ? 'inactive'
      : 'pending';

  const categoryBadgeClass = isDegree
    ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
    : 'bg-amber-50 text-amber-800 border-amber-200';

  return (
    <>
      <Modal title={isDegree ? 'Chi tiết bằng cấp' : 'Chi tiết chứng chỉ'} onClose={onClose} busy={busyReview}>
        <div className="p-6">
          {/* Review Alert Banner */}
          {isPendingReview && (
            <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs text-amber-900">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span>
                  <strong>Hồ sơ do nhân viên gửi lên - Chờ thẩm định:</strong> Đối chiếu kỹ văn bằng chuyên môn và tệp scan minh chứng bên dưới trước khi phê duyệt.
                </span>
              </div>
            </div>
          )}

          {isRejected && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-900">
              <strong className="block mb-1">Hồ sơ này đã bị từ chối thẩm định:</strong>
              <span>Lý do: {certificate.rejectionReason || 'Không đáp ứng tiêu chuẩn hoặc tài liệu scan không hợp lệ.'}</span>
            </div>
          )}

          <div className="flex items-start justify-between border-b border-slate-100 pb-4 mb-5">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${categoryBadgeClass}`}>
                  {isDegree ? 'Bằng cấp' : 'Chứng chỉ'}
                </span>
                <h3 className="text-lg font-semibold text-slate-800">
                  {certificate.certificateType}
                </h3>
              </div>
              {isDegree && certificate.major && (
                <p className="text-xs text-slate-500 mt-1">
                  Ngành/Chuyên ngành: <strong className="text-slate-700">{certificate.major}</strong>
                </p>
              )}
            </div>
            <span className={`status-badge ${isDegree ? verClass : certStatusClass}`}>
              <i />
              {isDegree ? verLabel : certStatusLabel}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-400 block font-medium">Nhân viên</span>
              <span className="font-semibold text-slate-800">{certificate.staffName}</span>
              <span className="text-xs text-slate-500 block">Mã NV: {certificate.staffCode}</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
              <span className="text-xs text-slate-400 block font-medium">Khoa / Phòng</span>
              <span className="font-semibold text-slate-800">
                {certificate.departmentName || 'Chưa phân khoa'}
              </span>
            </div>

            {/* CÁC TRƯỜNG DÀNH RIÊNG CHO BẰNG CẤP */}
            {isDegree ? (
              <>
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Trình độ đào tạo</span>
                  <span className="text-slate-800 font-medium">
                    {certificate.degreeType || 'Chưa cập nhật'}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block font-medium">Ngành hoặc chuyên ngành</span>
                  <span className="text-slate-800 font-medium">
                    {certificate.major || cleanText(certificate.scopeOfPractice) || 'Chưa cập nhật'}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block font-medium">Cơ sở đào tạo</span>
                  <span className="text-slate-700">
                    {certificate.issuingAuthority || 'Chưa cập nhật'}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block font-medium">Ngày cấp</span>
                  <span className="text-slate-700">{formatDate(certificate.issueDate)}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block font-medium">Trạng thái xác minh</span>
                  <span className="text-slate-800 font-semibold">{verLabel}</span>
                </div>

                {certificate.notes && (
                  <div className="md:col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <span className="text-xs text-slate-400 block font-medium">Ghi chú</span>
                    <span className="text-slate-700 whitespace-pre-wrap">{certificate.notes}</span>
                  </div>
                )}
              </>
            ) : (
              /* CÁC TRƯỜNG DÀNH RIÊNG CHO CHỨNG CHỈ */
              <>
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Số hiệu chứng chỉ</span>
                  <span className="text-slate-800 font-mono font-medium">
                    {certificate.certificateNumber || '—'}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block font-medium">Nơi cấp</span>
                  <span className="text-slate-700">
                    {certificate.issuingAuthority || 'Chưa cập nhật'}
                  </span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block font-medium">Văn bằng chuyên môn</span>
                  <span className="text-slate-700">
                    {cleanText(certificate.professionalDegree || certificate.scopeOfPractice) || 'Chưa cập nhật'}
                  </span>
                </div>

                {cleanText(certificate.issuanceMethod) ? (
                  <div>
                    <span className="text-xs text-slate-400 block font-medium">Hình thức cấp</span>
                    <span className="text-slate-700">{cleanText(certificate.issuanceMethod)}</span>
                  </div>
                ) : null}

                <div>
                  <span className="text-xs text-slate-400 block font-medium">Ngày cấp</span>
                  <span className="text-slate-700">{formatDate(certificate.issueDate)}</span>
                </div>

                <div>
                  <span className="text-xs text-slate-400 block font-medium">Ngày hết hạn</span>
                  <span className={`font-medium ${isExpired ? 'text-red-600' : 'text-slate-700'}`}>
                    {formatDate(certificate.expiryDate) || 'Vô thời hạn'}
                    {isExpired && ' (Đã hết hạn)'}
                  </span>
                </div>

                {certificate.cmeCycleMonths ? (
                  <div>
                    <span className="text-xs text-slate-400 block font-medium">Chu kỳ CME</span>
                    <span className="text-slate-700">{certificate.cmeCycleMonths} tháng</span>
                  </div>
                ) : null}

                {certificate.cmeRequiredCredits ? (
                  <div>
                    <span className="text-xs text-slate-400 block font-medium">Tín chỉ CME yêu cầu</span>
                    <span className="text-slate-700">{certificate.cmeRequiredCredits} tín chỉ</span>
                  </div>
                ) : null}
              </>
            )}

            <div className="border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-400 block font-medium">Ngày nhập vào</span>
              <span className="text-slate-600 text-xs">{formatDateTime(certificate.createdAt)}</span>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-400 block font-medium">Ngày thay đổi</span>
              <span className="text-slate-600 text-xs">{formatDateTime(certificate.updatedAt)}</span>
            </div>
          </div>

          {certificate.fileUrl && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <span className="text-xs text-slate-400 block font-medium mb-1.5">Tài liệu / File scan đính kèm</span>
              <a
                href={certificate.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-xs text-teal-700 hover:text-teal-900 bg-teal-50/70 border border-teal-200 px-3 py-1.5 rounded-lg font-semibold transition-colors"
              >
                <Icon name="fileText" size={15} />
                <span>Mở xem tài liệu scan đối chiếu</span>
              </a>
            </div>
          )}

          {/* Action Footer */}
          <div className="mt-6 flex justify-between items-center gap-3 pt-4 border-t border-slate-200 flex-wrap">
            {onReview && isPendingReview ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="button text-xs py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-1.5 shadow-sm"
                  onClick={() => onReview(certificate, 'approve')}
                  disabled={busyReview}
                >
                  <Icon name="check" size={14} />
                  <span>{busyReview ? 'Đang duyệt...' : 'Phê duyệt hồ sơ'}</span>
                </button>
                <button
                  type="button"
                  className="button text-xs py-1.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold flex items-center gap-1.5"
                  onClick={() => {
                    setRejectionReason('');
                    setReasonError('');
                    setRejectModalOpen(true);
                  }}
                  disabled={busyReview}
                >
                  <Icon name="close" size={14} />
                  <span>Từ chối</span>
                </button>
              </div>
            ) : (
              <div />
            )}

            <div className="flex gap-2">
              <button type="button" className="button text-xs" onClick={onClose} disabled={busyReview}>
                Đóng
              </button>
              {onEdit && (
                <button
                  type="button"
                  className="button primary text-xs"
                  onClick={() => {
                    onClose();
                    onEdit(certificate);
                  }}
                  disabled={busyReview}
                >
                  <Icon name="edit" size={14} />
                  Chỉnh sửa
                </button>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal nhập lý do từ chối */}
      {rejectModalOpen && (
        <Modal
          title="Từ chối phê duyệt hồ sơ"
          onClose={() => !busyReview && setRejectModalOpen(false)}
          busy={busyReview}
        >
          <div className="p-5 space-y-4 text-xs">
            <p className="text-slate-600">
              Vui lòng nhập lý do từ chối hồ sơ{' '}
              <strong className="text-slate-800">{certificate.certificateType}</strong> của nhân viên{' '}
              <strong className="text-slate-800">{certificate.staffName}</strong>:
            </p>

            {reasonError && <Alert variant="error">{reasonError}</Alert>}

            <div>
              <label htmlFor="rejection-reason-input" className="font-medium text-slate-700 mb-1 block">
                Lý do từ chối <span className="text-red-500">*</span>
              </label>
              <textarea
                id="rejection-reason-input"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20"
                rows={3}
                placeholder="Ví dụ: Tệp scan bị mờ, không rõ chữ ký hoặc dấu mộc / Không đúng chuyên môn đào tạo..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                disabled={busyReview}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                className="button secondary text-xs"
                onClick={() => setRejectModalOpen(false)}
                disabled={busyReview}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="button danger text-xs"
                onClick={async () => {
                  if (!rejectionReason.trim()) {
                    setReasonError('Vui lòng nhập lý do từ chối hồ sơ.');
                    return;
                  }
                  if (onReview) {
                    await onReview(certificate, 'reject', rejectionReason.trim());
                    setRejectModalOpen(false);
                  }
                }}
                disabled={busyReview}
              >
                {busyReview ? 'Đang gửi...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
