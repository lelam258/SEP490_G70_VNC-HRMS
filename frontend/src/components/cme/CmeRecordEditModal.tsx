import { useState, type FormEvent } from 'react';
import Modal from '../ui/Modal';
import Alert from '../ui/Alert';
import type { Certificate } from '../../types/certificates';
import type { CmeRecord, UpdateCmeRecordInput } from '../../types/cme';

interface Props {
  record: CmeRecord;
  certificates: Certificate[];
  onClose: () => void;
  onSave: (id: string, input: UpdateCmeRecordInput) => Promise<void>;
  busy?: boolean;
}

export default function CmeRecordEditModal({
  record,
  certificates,
  onClose,
  onSave,
  busy = false,
}: Props) {
  const onlyCerts = certificates.filter(c => c.category === 'certificate');
  const [certificateId, setCertificateId] = useState(record.certificateId);
  const [courseName, setCourseName] = useState(record.courseName || '');
  const [provider, setProvider] = useState(record.provider || '');
  const [completedDate, setCompletedDate] = useState(record.completedDate || '');
  const [credits, setCredits] = useState(String(record.credits ?? ''));
  const [fileUrl, setFileUrl] = useState(record.fileUrl || '');
  const [verified, setVerified] = useState<boolean>(record.verified);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!certificateId) {
      setError('Vui lòng chọn chứng chỉ liên kết.');
      return;
    }

    if (!courseName.trim()) {
      setError('Vui lòng nhập tên khóa đào tạo / hội thảo CME.');
      return;
    }

    if (!completedDate) {
      setError('Vui lòng chọn ngày hoàn thành.');
      return;
    }

    const creditVal = parseFloat(credits);
    if (isNaN(creditVal) || creditVal <= 0 || creditVal > 999.99) {
      setError('Số tín chỉ CME phải lớn hơn 0 và nhỏ hơn 1000.');
      return;
    }

    try {
      await onSave(record.cmeId, {
        certificateId,
        courseName: courseName.trim(),
        provider: provider.trim() || null,
        completedDate,
        credits: creditVal,
        fileUrl: fileUrl.trim() || null,
        verified,
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không lưu được bản ghi CME.');
    }
  }

  return (
    <Modal
      title={`Chỉnh sửa CME - ${record.staffName}`}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={handleSubmit} className="p-6">
        {error && <Alert variant="error">{error}</Alert>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="edit-cme-certificate">
              Chứng chỉ áp dụng <span className="text-red-500">*</span>
            </label>
            <select
              id="edit-cme-certificate"
              value={certificateId}
              onChange={e => setCertificateId(e.target.value)}
              disabled={busy}
              required
            >
              {onlyCerts.map(c => (
                <option key={c.certificateId} value={c.certificateId}>
                  {c.certificateType}
                  {c.cmeRequiredCredits ? ` (Yêu cầu: ${c.cmeRequiredCredits} tín chỉ)` : ''}
                </option>
              ))}
              {!onlyCerts.some(c => c.certificateId === record.certificateId) && (
                <option value={record.certificateId}>{record.certificateType}</option>
              )}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="edit-cme-course-name">
              Tên khóa đào tạo / Hội thảo CME <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-cme-course-name"
              required
              placeholder="VD: Cập nhật chẩn đoán và điều trị..."
              value={courseName}
              onChange={e => setCourseName(e.target.value)}
              disabled={busy}
            />
          </div>

          <div>
            <label htmlFor="edit-cme-provider">Đơn vị đào tạo / Cấp chứng nhận</label>
            <input
              id="edit-cme-provider"
              placeholder="VD: Bệnh viện Bạch Mai, Đại học Y Hà Nội..."
              value={provider}
              onChange={e => setProvider(e.target.value)}
              disabled={busy}
            />
          </div>

          <div>
            <label htmlFor="edit-cme-completed-date">
              Ngày hoàn thành / Ngày cấp <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-cme-completed-date"
              type="date"
              required
              value={completedDate}
              onChange={e => setCompletedDate(e.target.value)}
              disabled={busy}
            />
          </div>

          <div>
            <label htmlFor="edit-cme-credits">
              Số tiết / Tín chỉ CME <span className="text-red-500">*</span>
            </label>
            <input
              id="edit-cme-credits"
              type="number"
              step="0.5"
              min="0.5"
              max="999.99"
              required
              value={credits}
              onChange={e => setCredits(e.target.value)}
              disabled={busy}
            />
          </div>

          <div>
            <label htmlFor="edit-cme-verified">Trạng thái xác minh</label>
            <select
              id="edit-cme-verified"
              value={verified ? 'verified' : 'unverified'}
              onChange={e => setVerified(e.target.value === 'verified')}
              disabled={busy}
            >
              <option value="verified">Đã xác minh</option>
              <option value="unverified">Chờ xác minh</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="edit-cme-file-url">Link tài liệu / Ảnh giấy chứng nhận CME (URL)</label>
            <input
              id="edit-cme-file-url"
              placeholder="https://..."
              value={fileUrl}
              onChange={e => setFileUrl(e.target.value)}
              disabled={busy}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-200">
          <button type="button" className="button" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? 'Đang lưu…' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
