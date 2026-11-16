import { useState, type ChangeEvent, type FormEvent } from 'react';
import Modal from '../ui/Modal';
import Icon from '../ui/Icon';
import Alert from '../ui/Alert';
import { fileApi } from '../../services/fileApi';
import {
  type CertificateCategory,
  type SaveCertificateInput,
  EDUCATION_LEVELS,
  DEGREE_MAJORS,
  ISSUANCE_METHODS,
} from '../../types/certificates';

interface Props {
  onClose: () => void;
  onSave: (input: SaveCertificateInput) => Promise<void>;
  busy?: boolean;
}

export default function MyCertificateCreateModal({ onClose, onSave, busy = false }: Props) {
  const [category, setCategory] = useState<CertificateCategory>('degree');
  const [certificateType, setCertificateType] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  // Degree-specific fields
  const [degreeType, setDegreeType] = useState<string>(EDUCATION_LEVELS[2]); // Đại học / Cử nhân
  const [major, setMajor] = useState<string>(DEGREE_MAJORS[0]); // Y khoa
  const [notes, setNotes] = useState('');

  // Certificate-specific fields
  const [certificateNumber, setCertificateNumber] = useState('');
  const [professionalDegree, setProfessionalDegree] = useState('');
  const [issuanceMethod, setIssuanceMethod] = useState<string>(ISSUANCE_METHODS[0]);
  const [hasExpiry, setHasExpiry] = useState(false);
  const [expiryDate, setExpiryDate] = useState('');
  const [cmeCycleMonths, setCmeCycleMonths] = useState('60');
  const [cmeRequiredCredits, setCmeRequiredCredits] = useState('120');

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

    const trimmedType = certificateType.trim();
    if (!trimmedType) {
      setError(category === 'degree' ? 'Vui lòng nhập tên văn bằng tốt nghiệp.' : 'Vui lòng nhập tên chứng chỉ hành nghề.');
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (issueDate && issueDate > todayStr) {
      setError('Ngày cấp không được lớn hơn ngày hiện tại.');
      return;
    }

    if (category === 'certificate' && hasExpiry && expiryDate) {
      if (issueDate && expiryDate < issueDate) {
        setError('Ngày hết hạn phải lớn hơn hoặc bằng ngày cấp.');
        return;
      }
    }

    try {
      const payload: SaveCertificateInput = {
        category,
        certificateType: trimmedType,
        certificateNumber: certificateNumber.trim() || null,
        issuingAuthority: issuingAuthority.trim() || null,
        issueDate: issueDate || null,
        fileUrl: fileUrl.trim() || null,
        status: 'unverified',
        verificationStatus: 'unverified',
      };

      if (category === 'degree') {
        payload.degreeType = degreeType;
        payload.major = major;
        payload.notes = notes.trim() || null;
        payload.expiryDate = null;
        payload.cmeCycleMonths = null;
        payload.cmeRequiredCredits = null;
      } else {
        const trimmedDegree = professionalDegree.trim() || null;
        payload.professionalDegree = trimmedDegree;
        payload.issuanceMethod = issuanceMethod.trim() || null;
        payload.scopeOfPractice = trimmedDegree;
        payload.expiryDate = hasExpiry && expiryDate ? expiryDate : null;
        payload.cmeCycleMonths = cmeCycleMonths ? parseInt(cmeCycleMonths, 10) : 60;
        payload.cmeRequiredCredits = cmeRequiredCredits ? parseFloat(cmeRequiredCredits) : 120;
      }

      await onSave(payload);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Khai báo hồ sơ thất bại.');
    }
  };

  return (
    <Modal
      title="Khai báo văn bằng / Chứng chỉ hành nghề mới"
      onClose={onClose}
      busy={busy || uploading}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
        {error && <Alert variant="error">{error}</Alert>}

        {/* Notice */}
        <div className="bg-sky-50 p-3 rounded-lg border border-sky-100 text-xs text-sky-800 flex items-start gap-2">
          <Icon name="shield" size={16} />
          <div>
            Hồ sơ do bạn tự khai báo sẽ ở trạng thái <strong>Chờ thẩm định</strong> cho đến khi
            được Phòng Nhân sự (HR) kiểm tra bản scan minh chứng và phê duyệt vào hệ thống.
          </div>
        </div>

        {/* Category Toggle */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
            Phân loại hồ sơ chuyên môn <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all ${
                category === 'degree'
                  ? 'border-teal-500 bg-teal-50/50 shadow-2xs'
                  : 'border-slate-200 bg-white hover:bg-slate-100'
              }`}
              onClick={() => setCategory('degree')}
            >
              <div
                className={`p-1.5 rounded-md mt-0.5 ${
                  category === 'degree' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <Icon name="award" size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">Bằng cấp chuyên môn</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Văn bằng Đại học, Thạc sĩ, Bác sĩ, Cử nhân...
                </div>
              </div>
            </button>

            <button
              type="button"
              className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all ${
                category === 'certificate'
                  ? 'border-teal-500 bg-teal-50/50 shadow-2xs'
                  : 'border-slate-200 bg-white hover:bg-slate-100'
              }`}
              onClick={() => setCategory('certificate')}
            >
              <div
                className={`p-1.5 rounded-md mt-0.5 ${
                  category === 'certificate' ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <Icon name="fileText" size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800">Chứng chỉ hành nghề (CCHN)</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Chứng chỉ hành nghề y tế, giấy phép hoạt động...
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Common Field: Certificate / Degree Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {category === 'degree' ? 'Tên văn bằng tốt nghiệp' : 'Tên chứng chỉ hành nghề'}{' '}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            placeholder={
              category === 'degree'
                ? 'Ví dụ: Bằng Bác sĩ Y khoa, Cử nhân Điều dưỡng...'
                : 'Ví dụ: Chứng chỉ hành nghề Khám bệnh, chữa bệnh chuyên khoa Nội...'
            }
            value={certificateType}
            onChange={(e) => setCertificateType(e.target.value)}
            required
          />
        </div>

        {/* Degree Specific Fields */}
        {category === 'degree' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/60 p-3.5 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Trình độ đào tạo
              </label>
              <select
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
                value={degreeType}
                onChange={(e) => setDegreeType(e.target.value)}
              >
                {EDUCATION_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Chuyên ngành đào tạo
              </label>
              <select
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
                value={major}
                onChange={(e) => setMajor(e.target.value)}
              >
                {DEGREE_MAJORS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ghi chú thêm về văn bằng
              </label>
              <input
                type="text"
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
                placeholder="Xếp loại tốt nghiệp, hệ đào tạo chính quy..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* Certificate Specific Fields */}
        {category === 'certificate' && (
          <div className="space-y-3 bg-slate-50/60 p-3.5 rounded-xl border border-slate-200">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Số hiệu CCHN / Giấy phép
                </label>
                <input
                  type="text"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
                  placeholder="Ví dụ: 012345/BYT-CCHN"
                  value={certificateNumber}
                  onChange={(e) => setCertificateNumber(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hình thức cấp
                </label>
                <select
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
                  value={issuanceMethod}
                  onChange={(e) => setIssuanceMethod(e.target.value)}
                >
                  {ISSUANCE_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Văn bằng chuyên môn
                </label>
                <input
                  type="text"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
                  placeholder="Ví dụ: Bác sĩ, Cử nhân Điều dưỡng, Dược sĩ chuyên khoa..."
                  value={professionalDegree}
                  onChange={(e) => setProfessionalDegree(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Chu kỳ CME (tháng)
                </label>
                <input
                  type="number"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
                  value={cmeCycleMonths}
                  onChange={(e) => setCmeCycleMonths(e.target.value)}
                  placeholder="60"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Định mức tín chỉ CME yêu cầu
                </label>
                <input
                  type="number"
                  step="0.5"
                  className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
                  value={cmeRequiredCredits}
                  onChange={(e) => setCmeRequiredCredits(e.target.value)}
                  placeholder="120"
                  min="0"
                />
              </div>
            </div>
          </div>
        )}

        {/* Issuing Authority & Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cơ quan cấp / Cơ sở đào tạo
            </label>
            <input
              type="text"
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              placeholder={
                category === 'degree'
                  ? 'Ví dụ: Đại học Y Hà Nội, Đại học Y Dược TP.HCM...'
                  : 'Ví dụ: Bộ Y tế, Sở Y tế Hà Nội...'
              }
              value={issuingAuthority}
              onChange={(e) => setIssuingAuthority(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ngày cấp
            </label>
            <input
              type="date"
              className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>

          {category === 'certificate' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Ngày hết hạn</label>
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-500">
                  <input
                    type="checkbox"
                    checked={!hasExpiry}
                    onChange={(e) => setHasExpiry(!e.target.checked)}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Vô thời hạn</span>
                </label>
              </div>
              <input
                type="date"
                disabled={!hasExpiry}
                className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 disabled:bg-slate-100 disabled:text-slate-400"
                value={hasExpiry ? expiryDate : ''}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
          )}
        </div>

        {/* Scan Proof File Upload */}
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Tài liệu scan đính kèm (Ảnh / PDF)
          </label>
          <div className="flex items-center gap-3">
            <label className="button secondary text-xs py-1.5 px-3 cursor-pointer shrink-0">
              <Icon name="camera" size={13} />
              <span>{uploading ? 'Đang tải lên...' : 'Chọn tệp scan'}</span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                className="sr-only"
                onChange={(e) => void handleFileUpload(e)}
                disabled={uploading}
              />
            </label>
            <div className="text-xs text-slate-500 truncate flex-1">
              {uploadedFileName ? (
                <span className="text-teal-700 font-medium truncate inline-flex items-center gap-1">
                  <Icon name="check" size={13} />
                  {uploadedFileName}
                </span>
              ) : fileUrl ? (
                <span className="text-teal-700 font-medium">Đã có tệp đính kèm</span>
              ) : (
                <span className="text-slate-400 italic">Chưa chọn tệp (Tối đa 11 MB)</span>
              )}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
          <button type="button" className="button" onClick={onClose} disabled={busy || uploading}>
            Hủy
          </button>
          <button
            type="submit"
            className="button primary"
            disabled={busy || uploading || !certificateType.trim()}
          >
            {busy ? 'Đang lưu...' : 'Khai báo hồ sơ'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
