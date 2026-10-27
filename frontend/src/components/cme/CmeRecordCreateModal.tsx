import { useState, type FormEvent } from 'react';
import Modal from '../ui/Modal';
import Alert from '../ui/Alert';
import type { Certificate } from '../../types/certificates';
import type { SaveCmeRecordInput, StaffCmeSummary } from '../../types/cme';

interface Props {
  staff: StaffCmeSummary;
  certificates: Certificate[];
  defaultCertificateId?: string;
  onClose: () => void;
  onSave: (input: SaveCmeRecordInput) => Promise<void>;
  busy?: boolean;
}

export default function CmeRecordCreateModal({
  staff,
  certificates,
  defaultCertificateId,
  onClose,
  onSave,
  busy = false,
}: Props) {
  const onlyCerts = certificates.filter(c => c.category === 'certificate');
  const [certificateId, setCertificateId] = useState(
    defaultCertificateId || onlyCerts[0]?.certificateId || ''
  );
  const [courseName, setCourseName] = useState('');
  const [provider, setProvider] = useState('');
  const [completedDate, setCompletedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [credits, setCredits] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [verified, setVerified] = useState(true);
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
      await onSave({
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
      setError(cause instanceof Error ? cause.message : 'Không thêm được bản ghi CME.');
    }
  }

  return (
    <Modal
      title={`Thêm bản ghi CME - ${staff.fullName} (${staff.staffCode})`}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={handleSubmit} className="p-6">
        {error && <Alert variant="error">{error}</Alert>}

        {onlyCerts.length === 0 ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm mb-4">
            Nhân viên này chưa có <strong>Chứng chỉ chuyên môn</strong> nào trong hệ thống. Vui lòng thêm chứng chỉ trước khi ghi nhận CME.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="cme-certificate">
                Chứng chỉ áp dụng <span className="text-red-500">*</span>
              </label>
              <select
                id="cme-certificate"
                value={certificateId}
                onChange={e => setCertificateId(e.target.value)}
                disabled={busy}
                required
              >
                {onlyCerts.map(c => (
                  <option key={c.certificateId} value={c.certificateId}>
                    {c.certificateType}
                    {c.cmeRequiredCredits
                      ? ` (Yêu cầu: ${c.cmeRequiredCredits} tín chỉ${
                          c.cmeCycleMonths ? ` / ${c.cmeCycleMonths} tháng` : ''
                        })`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="cme-course-name">
                Tên khóa đào tạo / Hội thảo CME <span className="text-red-500">*</span>
              </label>
              <input
                id="cme-course-name"
                required
                placeholder="VD: Cập nhật chẩn đoán và điều trị bệnh lý tim mạch..."
                value={courseName}
                onChange={e => setCourseName(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="cme-provider">Đơn vị đào tạo / Cấp chứng nhận</label>
              <input
                id="cme-provider"
                placeholder="VD: Bệnh viện Bạch Mai, Đại học Y Hà Nội..."
                value={provider}
                onChange={e => setProvider(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="cme-completed-date">
                Ngày hoàn thành / Ngày cấp <span className="text-red-500">*</span>
              </label>
              <input
                id="cme-completed-date"
                type="date"
                required
                value={completedDate}
                onChange={e => setCompletedDate(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="cme-credits">
                Số tiết / Tín chỉ CME <span className="text-red-500">*</span>
              </label>
              <input
                id="cme-credits"
                type="number"
                step="0.5"
                min="0.5"
                max="999.99"
                required
                placeholder="VD: 4, 8, 16, 24..."
                value={credits}
                onChange={e => setCredits(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="cme-verified">Trạng thái xác minh</label>
              <select
                id="cme-verified"
                value={verified ? 'verified' : 'unverified'}
                onChange={e => setVerified(e.target.value === 'verified')}
                disabled={busy}
              >
                <option value="verified">Đã xác minh (Tính vào tín chỉ hợp lệ)</option>
                <option value="unverified">Chờ xác minh</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="cme-file-url">Link tài liệu / Ảnh giấy chứng nhận CME (URL)</label>
              <input
                id="cme-file-url"
                placeholder="https://..."
                value={fileUrl}
                onChange={e => setFileUrl(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-200">
          <button type="button" className="button" onClick={onClose} disabled={busy}>
            Hủy
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={busy || onlyCerts.length === 0}
          >
            {busy ? 'Đang lưu…' : 'Thêm bản ghi CME'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
