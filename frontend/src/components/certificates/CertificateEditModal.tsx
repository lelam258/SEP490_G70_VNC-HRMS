import { useState, type FormEvent } from 'react';
import Modal from '../ui/Modal';
import Alert from '../ui/Alert';
import {
  type Certificate,
  type CertificateCategory,
  type UpdateCertificateInput,
  EDUCATION_LEVELS,
  DEGREE_MAJORS,
  VERIFICATION_STATUSES,
} from '../../types/certificates';

interface Props {
  certificate: Certificate;
  onClose: () => void;
  onSave: (id: string, input: UpdateCertificateInput) => Promise<void>;
  busy?: boolean;
}

export default function CertificateEditModal({ certificate, onClose, onSave, busy = false }: Props) {
  // If old record was practice_license, migrate to certificate
  const initialCategory: CertificateCategory =
    certificate.category === 'degree' ? 'degree' : 'certificate';

  const [category, setCategory] = useState<CertificateCategory>(initialCategory);
  const [certificateType, setCertificateType] = useState(certificate.certificateType || '');
  const [issuingAuthority, setIssuingAuthority] = useState(certificate.issuingAuthority || '');
  const [issueDate, setIssueDate] = useState(certificate.issueDate || '');
  const [fileUrl, setFileUrl] = useState(certificate.fileUrl || '');
  const [error, setError] = useState('');

  // Degree fields
  const [degreeType, setDegreeType] = useState<string>(
    certificate.degreeType || EDUCATION_LEVELS[2]
  );
  const [major, setMajor] = useState<string>(
    certificate.major || DEGREE_MAJORS[0]
  );
  const [verificationStatus, setVerificationStatus] = useState<string>(
    certificate.verificationStatus || certificate.status || VERIFICATION_STATUSES[0].value
  );
  const [notes, setNotes] = useState(certificate.notes || '');

  // Certificate fields
  const [professionalDegree, setProfessionalDegree] = useState(
    certificate.professionalDegree || certificate.scopeOfPractice || ''
  );
  const [issuanceMethod, setIssuanceMethod] = useState(
    certificate.issuanceMethod || ''
  );
  const [expiryDate, setExpiryDate] = useState(certificate.expiryDate || '');
  const [cmeCycleMonths, setCmeCycleMonths] = useState<string>(
    certificate.cmeCycleMonths != null ? String(certificate.cmeCycleMonths) : ''
  );
  const [cmeRequiredCredits, setCmeRequiredCredits] = useState<string>(
    certificate.cmeRequiredCredits != null ? String(certificate.cmeRequiredCredits) : ''
  );
  const [status, setStatus] = useState(certificate.status || 'active');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!certificateType.trim()) {
      setError(category === 'degree' ? 'Vui lòng nhập tên bằng cấp.' : 'Vui lòng nhập tên chứng chỉ.');
      return;
    }

    if (category === 'certificate' && issueDate && expiryDate && expiryDate < issueDate) {
      setError('Ngày hết hạn phải lớn hơn hoặc bằng ngày cấp.');
      return;
    }

    try {
      const payload: UpdateCertificateInput = {
        category,
        certificateType: certificateType.trim(),
        certificateNumber: null, // Bỏ số hiệu chứng chỉ theo yêu cầu
        issuingAuthority: issuingAuthority.trim() || null,
        issueDate: issueDate || null,
        fileUrl: fileUrl.trim() || null,
        departmentId: certificate.departmentId,
        status: category === 'degree' ? verificationStatus : status || 'active',
      };

      if (category === 'degree') {
        payload.degreeType = degreeType;
        payload.major = major;
        payload.verificationStatus = verificationStatus;
        payload.notes = notes.trim() || null;
        payload.expiryDate = null;
        payload.cmeCycleMonths = null;
        payload.cmeRequiredCredits = null;
      } else {
        payload.professionalDegree = professionalDegree.trim() || null;
        payload.issuanceMethod = issuanceMethod.trim() || null;
        payload.expiryDate = expiryDate || null;
        payload.cmeCycleMonths = cmeCycleMonths ? parseInt(cmeCycleMonths, 10) : null;
        payload.cmeRequiredCredits = cmeRequiredCredits ? parseFloat(cmeRequiredCredits) : null;
      }

      await onSave(certificate.certificateId, payload);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không lưu được hồ sơ.');
    }
  }

  return (
    <Modal title={`Chỉnh sửa hồ sơ - ${certificate.staffName}`} onClose={onClose} busy={busy}>
      <form onSubmit={handleSubmit} className="p-6">
        {error && <Alert variant="error">{error}</Alert>}

        {/* Category Selection: Bỏ Giấy hành nghề, chỉ còn Bằng cấp và Chứng chỉ */}
        <div className="mb-5 bg-slate-50 p-4 rounded-xl border border-slate-200">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Phân loại hồ sơ <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className={`flex items-center justify-center p-3 rounded-lg border text-sm font-semibold transition-all ${
                category === 'degree'
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-800 shadow-sm ring-2 ring-indigo-500/20'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
              onClick={() => setCategory('degree')}
              disabled={busy}
            >
              <span>Bằng cấp</span>
            </button>

            <button
              type="button"
              className={`flex items-center justify-center p-3 rounded-lg border text-sm font-semibold transition-all ${
                category === 'certificate'
                  ? 'border-amber-600 bg-amber-50 text-amber-800 shadow-sm ring-2 ring-amber-500/20'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
              onClick={() => setCategory('certificate')}
              disabled={busy}
            >
              <span>Chứng chỉ</span>
            </button>
          </div>
        </div>

        {/* FORM BẰNG CẤP */}
        {category === 'degree' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="edit-degree-name">
                Tên bằng cấp <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-degree-name"
                required
                placeholder="VD: Bằng Bác sĩ Y khoa, Bằng Cử nhân Điều dưỡng..."
                value={certificateType}
                onChange={e => setCertificateType(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="edit-degree-level">
                Trình độ đào tạo <span className="text-red-500">*</span>
              </label>
              <select
                id="edit-degree-level"
                value={degreeType}
                onChange={e => setDegreeType(e.target.value)}
                disabled={busy}
              >
                {EDUCATION_LEVELS.map(lvl => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="edit-degree-major">
                Ngành hoặc chuyên ngành <span className="text-red-500">*</span>
              </label>
              <select
                id="edit-degree-major"
                value={major}
                onChange={e => setMajor(e.target.value)}
                disabled={busy}
              >
                {DEGREE_MAJORS.map(m => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="edit-degree-institution">Cơ sở đào tạo</label>
              <input
                id="edit-degree-institution"
                placeholder="VD: Đại học Y Hà Nội, Đại học Y Dược TP.HCM..."
                value={issuingAuthority}
                onChange={e => setIssuingAuthority(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="edit-degree-issue-date">Ngày cấp</label>
              <input
                id="edit-degree-issue-date"
                type="date"
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="edit-degree-file">File bằng cấp (URL)</label>
              <input
                id="edit-degree-file"
                placeholder="https://..."
                value={fileUrl}
                onChange={e => setFileUrl(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="edit-degree-verification">Trạng thái xác minh</label>
              <select
                id="edit-degree-verification"
                value={verificationStatus}
                onChange={e => setVerificationStatus(e.target.value)}
                disabled={busy}
              >
                {VERIFICATION_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="edit-degree-notes">Ghi chú</label>
              <textarea
                id="edit-degree-notes"
                rows={2}
                placeholder="Ghi chú thêm về văn bằng..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>
        ) : (
          /* FORM CHỨNG CHỈ */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label htmlFor="edit-cert-name">
                Tên chứng chỉ <span className="text-red-500">*</span>
              </label>
              <input
                id="edit-cert-name"
                required
                placeholder="VD: Chứng chỉ Siêu âm tổng quát, Kỹ thuật viên xét nghiệm..."
                value={certificateType}
                onChange={e => setCertificateType(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="edit-cert-authority">Nơi cấp</label>
              <input
                id="edit-cert-authority"
                placeholder="VD: Sở Y Tế TP. Hà Nội, Bệnh viện Bạch Mai..."
                value={issuingAuthority}
                onChange={e => setIssuingAuthority(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="edit-cert-professional-degree">Văn bằng chuyên môn</label>
              <input
                id="edit-cert-professional-degree"
                placeholder="VD: Bác sĩ Đa khoa, Cử nhân Điều dưỡng..."
                value={professionalDegree}
                onChange={e => setProfessionalDegree(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="edit-cert-issuance-method">Hình thức cấp (nếu có)</label>
              <input
                id="edit-cert-issuance-method"
                placeholder="VD: Cấp lần đầu, Cấp lại, Cấp điều chỉnh..."
                value={issuanceMethod}
                onChange={e => setIssuanceMethod(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="edit-cert-issue-date">Ngày cấp</label>
              <input
                id="edit-cert-issue-date"
                type="date"
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="edit-cert-expiry-date">Ngày hết hạn</label>
              <input
                id="edit-cert-expiry-date"
                type="date"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="edit-cert-status">Trạng thái</label>
              <select
                id="edit-cert-status"
                value={status}
                onChange={e => setStatus(e.target.value)}
                disabled={busy}
              >
                <option value="active">Đang hiệu lực (Active)</option>
                <option value="expired">Đã hết hạn (Expired)</option>
                <option value="suspended">Tạm đình chỉ (Suspended)</option>
                <option value="revoked">Bị thu hồi (Revoked)</option>
              </select>
            </div>

            <div>
              <label htmlFor="edit-cert-file">File chứng chỉ (URL)</label>
              <input
                id="edit-cert-file"
                placeholder="https://..."
                value={fileUrl}
                onChange={e => setFileUrl(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="edit-cert-cme-months">Chu kỳ CME (tháng)</label>
              <input
                id="edit-cert-cme-months"
                type="number"
                min="0"
                placeholder="VD: 24"
                value={cmeCycleMonths}
                onChange={e => setCmeCycleMonths(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="edit-cert-cme-credits">Tín chỉ CME yêu cầu</label>
              <input
                id="edit-cert-cme-credits"
                type="number"
                step="0.5"
                min="0"
                placeholder="VD: 48"
                value={cmeRequiredCredits}
                onChange={e => setCmeRequiredCredits(e.target.value)}
                disabled={busy}
              />
            </div>
          </div>
        )}

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
