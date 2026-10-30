import { useState, type FormEvent } from 'react';
import Modal from '../ui/Modal';
import Alert from '../ui/Alert';
import {
  type CertificateCategory,
  type SaveCertificateInput,
  type StaffCertificateSummary,
  EDUCATION_LEVELS,
  DEGREE_MAJORS,
  VERIFICATION_STATUSES,
} from '../../types/certificates';

interface Props {
  staff: StaffCertificateSummary;
  onClose: () => void;
  onSave: (input: SaveCertificateInput) => Promise<void>;
  busy?: boolean;
}

export default function CertificateCreateModal({ staff, onClose, onSave, busy = false }: Props) {
  const [category, setCategory] = useState<CertificateCategory>('degree');
  const [certificateType, setCertificateType] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [error, setError] = useState('');

  // Fields for Degree
  const [degreeType, setDegreeType] = useState<string>(EDUCATION_LEVELS[2]); // Đại học / Cử nhân
  const [major, setMajor] = useState<string>(DEGREE_MAJORS[0]); // Y khoa
  const [verificationStatus, setVerificationStatus] = useState<string>(VERIFICATION_STATUSES[0].value); // unverified
  const [notes, setNotes] = useState('');

  // Fields for Certificate
  const [professionalDegree, setProfessionalDegree] = useState('');
  const [issuanceMethod, setIssuanceMethod] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cmeCycleMonths, setCmeCycleMonths] = useState('');
  const [cmeRequiredCredits, setCmeRequiredCredits] = useState('');
  const [status, setStatus] = useState('active');

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
      const payload: SaveCertificateInput = {
        staffId: staff.staffId,
        category,
        certificateType: certificateType.trim(),
        certificateNumber: null, // Bỏ số hiệu chứng chỉ theo yêu cầu
        issuingAuthority: issuingAuthority.trim() || null,
        issueDate: issueDate || null,
        fileUrl: fileUrl.trim() || null,
        departmentId: staff.departmentId,
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

      await onSave(payload);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tạo được hồ sơ.');
    }
  }

  return (
    <Modal title={`Thêm hồ sơ chuyên môn - ${staff.fullName} (${staff.staffCode})`} onClose={onClose} busy={busy}>
      <form onSubmit={handleSubmit} className="p-6">
        {error && <Alert variant="error">{error}</Alert>}

        {/* Category Selection: Chỉ còn Bằng cấp và Chứng chỉ (Đã bỏ Giấy hành nghề) */}
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
              <label htmlFor="degree-name">
                Tên bằng cấp <span className="text-red-500">*</span>
              </label>
              <input
                id="degree-name"
                required
                placeholder="VD: Bằng Bác sĩ Y khoa, Bằng Cử nhân Điều dưỡng..."
                value={certificateType}
                onChange={e => setCertificateType(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="degree-level">
                Trình độ đào tạo <span className="text-red-500">*</span>
              </label>
              <select
                id="degree-level"
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
              <label htmlFor="degree-major">
                Ngành hoặc chuyên ngành <span className="text-red-500">*</span>
              </label>
              <select
                id="degree-major"
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
              <label htmlFor="degree-institution">Cơ sở đào tạo</label>
              <input
                id="degree-institution"
                placeholder="VD: Đại học Y Hà Nội, Đại học Y Dược TP.HCM..."
                value={issuingAuthority}
                onChange={e => setIssuingAuthority(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="degree-issue-date">Ngày cấp</label>
              <input
                id="degree-issue-date"
                type="date"
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="degree-file">File bằng cấp (URL)</label>
              <input
                id="degree-file"
                placeholder="https://..."
                value={fileUrl}
                onChange={e => setFileUrl(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="degree-verification">Trạng thái xác minh</label>
              <select
                id="degree-verification"
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
              <label htmlFor="degree-notes">Ghi chú</label>
              <textarea
                id="degree-notes"
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
              <label htmlFor="cert-name">
                Tên chứng chỉ <span className="text-red-500">*</span>
              </label>
              <input
                id="cert-name"
                required
                placeholder="VD: Chứng chỉ Siêu âm tổng quát, Kỹ thuật viên xét nghiệm..."
                value={certificateType}
                onChange={e => setCertificateType(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="cert-authority">Nơi cấp</label>
              <input
                id="cert-authority"
                placeholder="VD: Sở Y Tế TP. Hà Nội, Bệnh viện Bạch Mai..."
                value={issuingAuthority}
                onChange={e => setIssuingAuthority(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="cert-professional-degree">Văn bằng chuyên môn</label>
              <input
                id="cert-professional-degree"
                placeholder="VD: Bác sĩ Đa khoa, Cử nhân Điều dưỡng..."
                value={professionalDegree}
                onChange={e => setProfessionalDegree(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="cert-issuance-method">Hình thức cấp (nếu có)</label>
              <input
                id="cert-issuance-method"
                placeholder="VD: Cấp lần đầu, Cấp lại, Cấp điều chỉnh..."
                value={issuanceMethod}
                onChange={e => setIssuanceMethod(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="cert-issue-date">Ngày cấp</label>
              <input
                id="cert-issue-date"
                type="date"
                value={issueDate}
                onChange={e => setIssueDate(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="cert-expiry-date">Ngày hết hạn</label>
              <input
                id="cert-expiry-date"
                type="date"
                value={expiryDate}
                onChange={e => setExpiryDate(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="cert-status">Trạng thái</label>
              <select
                id="cert-status"
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
              <label htmlFor="cert-file">File chứng chỉ (URL)</label>
              <input
                id="cert-file"
                placeholder="https://..."
                value={fileUrl}
                onChange={e => setFileUrl(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="cert-cme-months">Chu kỳ CME (tháng)</label>
              <input
                id="cert-cme-months"
                type="number"
                min="0"
                placeholder="VD: 24"
                value={cmeCycleMonths}
                onChange={e => setCmeCycleMonths(e.target.value)}
                disabled={busy}
              />
            </div>

            <div>
              <label htmlFor="cert-cme-credits">Tín chỉ CME yêu cầu</label>
              <input
                id="cert-cme-credits"
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
            {busy ? 'Đang thêm…' : 'Thêm hồ sơ'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
