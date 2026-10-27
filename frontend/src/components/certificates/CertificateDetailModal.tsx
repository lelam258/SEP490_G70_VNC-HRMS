import Modal from '../ui/Modal';
import Icon from '../ui/Icon';
import type { Certificate } from '../../types/certificates';
import { formatDate } from '../../utils/format';

interface Props {
  certificate: Certificate;
  onClose: () => void;
  onEdit: (cert: Certificate) => void;
}

function formatDateTime(val: string | null | undefined): string {
  if (!val) return 'Chưa có';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CertificateDetailModal({ certificate, onClose, onEdit }: Props) {
  const isDegree = certificate.category === 'degree';
  const isExpired = certificate.expiryDate ? new Date(certificate.expiryDate) < new Date() : false;

  // Verification status label for Degree
  const verStatus = certificate.verificationStatus || certificate.status;
  const verLabel =
    verStatus === 'verified'
      ? 'Đã xác minh'
      : verStatus === 'rejected'
      ? 'Không hợp lệ / Từ chối'
      : 'Chưa xác minh';

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
      : certificate.status === 'expired' || isExpired
      ? 'inactive'
      : 'pending';

  const categoryBadgeClass = isDegree
    ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
    : 'bg-amber-50 text-amber-800 border-amber-200';

  return (
    <Modal title={isDegree ? 'Chi tiết bằng cấp' : 'Chi tiết chứng chỉ'} onClose={onClose}>
      <div className="p-6">
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
                  {certificate.major || certificate.scopeOfPractice || 'Chưa cập nhật'}
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
                <span className="text-xs text-slate-400 block font-medium">Nơi cấp</span>
                <span className="text-slate-700">
                  {certificate.issuingAuthority || 'Chưa cập nhật'}
                </span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block font-medium">Văn bằng chuyên môn</span>
                <span className="text-slate-700">
                  {certificate.professionalDegree || certificate.scopeOfPractice || 'Chưa cập nhật'}
                </span>
              </div>

              {certificate.issuanceMethod && (
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Hình thức cấp</span>
                  <span className="text-slate-700">{certificate.issuanceMethod}</span>
                </div>
              )}

              <div>
                <span className="text-xs text-slate-400 block font-medium">Ngày cấp</span>
                <span className="text-slate-700">{formatDate(certificate.issueDate)}</span>
              </div>

              <div>
                <span className="text-xs text-slate-400 block font-medium">Ngày hết hạn</span>
                <span className={`font-medium ${isExpired ? 'text-red-600' : 'text-slate-700'}`}>
                  {formatDate(certificate.expiryDate)}
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
            <span className="text-xs text-slate-400 block font-medium mb-1">Tài liệu đính kèm</span>
            <a
              href={certificate.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-teal-700 hover:text-teal-800 underline font-medium"
            >
              <Icon name="fileText" size={14} />
              Xem bản sao tài liệu
            </a>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-200">
          <button type="button" className="button" onClick={onClose}>
            Đóng
          </button>
          <button
            type="button"
            className="button primary"
            onClick={() => {
              onClose();
              onEdit(certificate);
            }}
          >
            <Icon name="edit" size={16} />
            Chỉnh sửa
          </button>
        </div>
      </div>
    </Modal>
  );
}
