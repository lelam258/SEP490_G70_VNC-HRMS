import { useState, type ChangeEvent, type FormEvent } from 'react';
import Modal from '../ui/Modal';
import Icon from '../ui/Icon';
import Alert from '../ui/Alert';
import { fileApi } from '../../services/fileApi';
import type { Certificate } from '../../types/certificates';
import type { SaveCmeRecordInput } from '../../types/cme';

interface Props {
  certificates: Certificate[];
  initialCertificateId?: string;
  initialCmeCycleId?: string;
  onClose: () => void;
  onSave: (input: SaveCmeRecordInput) => Promise<void>;
  busy?: boolean;
}

export default function MyCmeCreateModal({
  certificates,
  initialCertificateId,
  initialCmeCycleId,
  onClose,
  onSave,
  busy = false,
}: Props) {
  // Only certificates eligible for CME (category == 'certificate')
  const cmeEligibleCerts = certificates.filter(
    (c) => c.category === 'certificate' || !c.category
  );

  const [certificateId, setCertificateId] = useState<string>(
    initialCertificateId || cmeEligibleCerts[0]?.certificateId || ''
  );
  const [courseName, setCourseName] = useState('');
  const [provider, setProvider] = useState('');
  const [completedDate, setCompletedDate] = useState('');
  const [credits, setCredits] = useState('2.0');
  const [fileUrl, setFileUrl] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const selectedCert = cmeEligibleCerts.find((c) => c.certificateId === certificateId);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 11 * 1024 * 1024) {
      setError('Tệp đính kèm không được vượt quá 11 MB.');
      return;
    }

    setUploading(true);
    setError('');
    try {
      const res = await fileApi.upload(file);
      setFileUrl(res.url);
      setUploadedFileName(file.name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Tải lên tài liệu thất bại.');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!certificateId) {
      setError('Vui lòng chọn chứng chỉ hành nghề liên kết.');
      return;
    }

    const trimmedCourse = courseName.trim();
    if (!trimmedCourse) {
      setError('Tên khóa học / hội thảo là bắt buộc.');
      return;
    }

    if (trimmedCourse.length > 150) {
      setError('Tên khóa học tối đa 150 ký tự.');
      return;
    }

    if (provider.trim().length > 100) {
      setError('Đơn vị tổ chức tối đa 100 ký tự.');
      return;
    }

    if (!completedDate) {
      setError('Ngày hoàn thành khóa học là bắt buộc.');
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (completedDate > todayStr) {
      setError('Ngày hoàn thành không được lớn hơn ngày hiện tại.');
      return;
    }

    const numCredits = parseFloat(credits);
    if (isNaN(numCredits) || numCredits <= 0) {
      setError('Số tín chỉ phải lớn hơn 0.');
      return;
    }

    if (numCredits * 2 !== Math.floor(numCredits * 2)) {
      setError('Số tín chỉ phải có bước nhảy 0.5 (ví dụ: 1.0, 1.5, 2.0).');
      return;
    }

    try {
      await onSave({
        certificateId,
        courseName: trimmedCourse,
        provider: provider.trim() || null,
        completedDate,
        credits: numCredits,
        fileUrl: fileUrl || null,
        verified: false,
        cmeCycleId: certificateId === initialCertificateId ? (initialCmeCycleId || null) : null,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không lưu được bản ghi CME.');
    }
  };

  return (
    <Modal title="Khai báo khóa đào tạo CME mới" onClose={onClose} busy={busy || uploading}>
      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {error && <Alert variant="error">{error}</Alert>}

        <div className="bg-sky-50 p-3 rounded-lg border border-sky-100 text-xs text-sky-800 flex items-start gap-2">
          <Icon name="shield" size={16} />
          <div>
            Khóa học bạn tự khai báo sẽ ở trạng thái <strong>Chờ xác minh</strong> cho đến khi
            được Phòng Nhân sự (HR) kiểm tra minh chứng và duyệt vào chu kỳ tích lũy.
          </div>
        </div>

        {/* Certificate selection */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Chứng chỉ hành nghề liên kết <span className="text-red-500">*</span>
          </label>
          {cmeEligibleCerts.length === 0 ? (
            <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-200">
              Bạn chưa có chứng chỉ chuyên môn nào trong hệ thống để gắn hồ sơ CME.
            </div>
          ) : (
            <select
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
              value={certificateId}
              onChange={(e) => setCertificateId(e.target.value)}
              disabled={busy}
              required
            >
              {cmeEligibleCerts.map((cert) => (
                <option key={cert.certificateId} value={cert.certificateId}>
                  {cert.certificateType}{' '}
                  {cert.certificateNumber ? `(Số: ${cert.certificateNumber})` : ''}
                </option>
              ))}
            </select>
          )}
          {selectedCert?.cmeCycleMonths ? (
            <span className="text-[11px] text-slate-500 block mt-1">
              Định mức: {selectedCert.cmeRequiredCredits || 0} tín chỉ / {selectedCert.cmeCycleMonths} tháng
            </span>
          ) : null}
        </div>

        {/* Course name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Tên khóa học / Hội thảo / Chuyên đề <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            placeholder="Ví dụ: Kỹ thuật Hồi sức tim phổi nâng cao (ACLS)..."
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            maxLength={150}
            disabled={busy}
            required
          />
        </div>

        {/* Provider / Organizer */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Cơ sở đào tạo / Đơn vị tổ chức
          </label>
          <input
            type="text"
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
            placeholder="Ví dụ: Bệnh viện Đại học Y Dược TP.HCM, Viện Tim..."
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            maxLength={100}
            disabled={busy}
          />
        </div>

        {/* Completed date & Credits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ngày hoàn thành <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
              value={completedDate}
              onChange={(e) => setCompletedDate(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              disabled={busy}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Số tín chỉ tích lũy <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="999.5"
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              disabled={busy}
              required
            />
            <span className="text-[10px] text-slate-400 block mt-0.5">
              Bước nhảy 0.5 (ví dụ: 1.0, 2.5, 4.0...)
            </span>
          </div>
        </div>

        {/* File upload proof */}
        <div className="border-t border-slate-100 pt-3">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Bản scan chứng nhận / Giấy xác nhận CME (PDF, Ảnh)
          </label>
          <div className="flex items-center gap-3">
            <label className="button secondary text-xs py-1.5 px-3 cursor-pointer shrink-0">
              <Icon name="fileText" size={14} />
              <span>{uploading ? 'Đang tải lên...' : 'Chọn tệp scan'}</span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => void handleFileUpload(e)}
                disabled={busy || uploading}
              />
            </label>
            <span className="text-xs text-slate-500 truncate flex-1">
              {uploadedFileName || (fileUrl ? 'Đã có tệp đính kèm' : 'Chưa chọn tệp')}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-1">
            Hỗ trợ định dạng PDF, JPG, PNG dung lượng tối đa 11 MB.
          </span>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-200">
          <button type="button" className="button" onClick={onClose} disabled={busy || uploading}>
            Hủy
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={busy || uploading || cmeEligibleCerts.length === 0}
          >
            <Icon name="check" size={16} />
            <span>{busy ? 'Đang gửi...' : 'Gửi hồ sơ thẩm định'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
