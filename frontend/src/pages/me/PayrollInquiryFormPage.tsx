import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Alert from '../../components/ui/Alert';
import Icon from '../../components/ui/Icon';
import { fileApi } from '../../services/fileApi';
import { payrollInquiryApi } from '../../services/payrollInquiryApi';
import type { MyPayslipSummary } from '../../types/myPayslip';
import {
  INQUIRY_TYPE_LABELS,
  type InquiryAttachmentInput,
  type InquiryType,
} from '../../types/payrollInquiry';
import { formatVnd } from '../../utils/format';
import { formatPayMonthLabel, validateAttachmentFile } from '../../utils/payrollInquiry';

interface LocalAttachmentItem extends InquiryAttachmentInput {
  fileName: string;
}

export default function PayrollInquiryFormPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryPayslipId = searchParams.get('payslipId') || '';
  const queryMonth = searchParams.get('month') || '';

  const [finalizedPayslips, setFinalizedPayslips] = useState<MyPayslipSummary[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [inquiryType, setInquiryType] = useState<InquiryType>(
    queryPayslipId ? 'payslip_salary' : 'attendance'
  );
  const [payMonth, setPayMonth] = useState(queryMonth);
  const [payslipId, setPayslipId] = useState(queryPayslipId);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [attachments, setAttachments] = useState<LocalAttachmentItem[]>([]);

  const [uploadingFile, setUploadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    async function load() {
      setLoadingOptions(true);
      try {
        const opts = await payrollInquiryApi.getMyOptions();
        if (!active) return;
        setFinalizedPayslips(opts.finalizedPayslips || []);
        if (!queryMonth) {
          if (queryPayslipId) {
            const matched = opts.finalizedPayslips.find((p) => p.payslipId === queryPayslipId);
            setPayMonth(matched?.payMonth || opts.defaultPayMonth);
          } else {
            setPayMonth(opts.defaultPayMonth);
          }
        }
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Không tải được tùy chọn kỳ lương.');
        }
      } finally {
        if (active) setLoadingOptions(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [queryMonth, queryPayslipId]);

  const monthPayslip = useMemo(
    () => finalizedPayslips.find((p) => p.payMonth === payMonth) || null,
    [finalizedPayslips, payMonth]
  );

  // Tự động đồng bộ PayslipId khi đổi tháng (nếu tháng đó có phiếu lương đã chốt)
  const handleMonthChange = (nextMonth: string) => {
    setPayMonth(nextMonth);
    const found = finalizedPayslips.find((p) => p.payMonth === nextMonth);
    setPayslipId(found ? found.payslipId : '');
  };

  const handlePayslipSelect = (nextId: string) => {
    setPayslipId(nextId);
    if (nextId) {
      const found = finalizedPayslips.find((p) => p.payslipId === nextId);
      if (found) setPayMonth(found.payMonth);
    }
  };

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (attachments.length + files.length > 5) {
      setError('Chỉ được đính kèm tối đa 5 tệp minh chứng cho mỗi thắc mắc.');
      e.target.value = '';
      return;
    }

    for (const file of files) {
      const validationMsg = validateAttachmentFile(file);
      if (validationMsg) {
        setError(validationMsg);
        e.target.value = '';
        return;
      }
    }

    setError('');
    setUploadingFile(true);
    try {
      const uploaded: LocalAttachmentItem[] = [];
      for (const file of files) {
        const res = await fileApi.upload(file);
        uploaded.push({ fileUrl: res.url, fileName: file.name });
      }
      setAttachments((prev) => [...prev, ...uploaded]);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể tải tệp minh chứng lên hệ thống.'
      );
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAttachment = (idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!inquiryType) errs.inquiryType = 'Vui lòng chọn phân loại thắc mắc.';
    if (!payMonth) errs.payMonth = 'Vui lòng chọn kỳ lương liên quan.';
    if (!subject.trim()) errs.subject = 'Vui lòng nhập tiêu đề thắc mắc.';
    else if (subject.trim().length > 200) errs.subject = 'Tiêu đề tối đa 200 ký tự.';
    if (!description.trim()) errs.description = 'Vui lòng nhập nội dung chi tiết.';

    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSubmitting(true);
    setError('');
    try {
      const created = await payrollInquiryApi.submitMyInquiry({
        inquiryType,
        subject: subject.trim(),
        description: description.trim(),
        payMonth,
        payslipId: payslipId || null,
        attachments,
      });
      navigate(`/me/payroll-inquiries/${created.complaintId}`, {
        state: { notice: 'Dữ liệu đã được lưu thành công. Thắc mắc đã được gửi tới Bộ phận Kế toán.' },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể gửi thắc mắc bảng lương.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="workspace-content-page max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight m-0">
          Gửi thắc mắc bảng lương
        </h1>
        <Link
          to="/me/payroll-inquiries"
          className="h-9 px-3.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 no-underline"
        >
          Quay lại danh sách
        </Link>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <form
        onSubmit={(e) => void handleSubmit(e)}
        noValidate
        className="bg-white border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Phân loại thắc mắc <span className="text-rose-600">*</span>
            </label>
            <select
              value={inquiryType}
              onChange={(e) => setInquiryType(e.target.value as InquiryType)}
              className="w-full px-3 rounded-lg border border-slate-300 text-xs bg-white text-slate-800"
              style={{ height: '38px', minHeight: '38px', paddingTop: 0, paddingBottom: 0, lineHeight: '36px' }}
            >
              {Object.entries(INQUIRY_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            {fieldErrors.inquiryType && (
              <p className="text-[11px] text-rose-600 mt-1 mb-0">{fieldErrors.inquiryType}</p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Kỳ lương liên quan <span className="text-rose-600">*</span>
            </label>
            <input
              type="month"
              value={payMonth}
              onChange={(e) => handleMonthChange(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs text-slate-800"
            />
            {fieldErrors.payMonth && (
              <p className="text-[11px] text-rose-600 mt-1 mb-0">{fieldErrors.payMonth}</p>
            )}
          </div>
        </div>

        {/* Tham chiếu phiếu lương đã chốt (nếu có) */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Phiếu lương tham chiếu (chỉ hiển thị các kỳ đã chốt)
          </label>
          <select
            disabled={loadingOptions}
            value={payslipId}
            onChange={(e) => handlePayslipSelect(e.target.value)}
            className="w-full px-3 rounded-lg border border-slate-300 text-xs bg-white text-slate-800"
            style={{ height: '38px', minHeight: '38px', paddingTop: 0, paddingBottom: 0, lineHeight: '36px' }}
          >
            <option value="">-- Không gắn phiếu lương cụ thể (hỏi về chấm công / thủ thuật kỳ đang mở) --</option>
            {finalizedPayslips.map((ps) => (
              <option key={ps.payslipId} value={ps.payslipId}>
                {formatPayMonthLabel(ps.payMonth)} — {ps.workDays} công · Thực lĩnh {formatVnd(ps.netPay)}
              </option>
            ))}
          </select>
          {!monthPayslip && payMonth && (
            <p className="text-[11px] text-amber-700 mt-1 mb-0">
              Kỳ {formatPayMonthLabel(payMonth)} chưa có phiếu lương chính thức được chốt; bạn vẫn có thể gửi thắc mắc về chấm công hoặc thủ thuật phát sinh trong kỳ.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Tiêu đề thắc mắc <span className="text-rose-600">*</span>
          </label>
          <input
            type="text"
            maxLength={200}
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setFieldErrors((p) => ({ ...p, subject: '' }));
            }}
            placeholder="Ví dụ: Đối chiếu số ca trực tối ngày 15/11 chưa khớp bảng lương"
            className="w-full h-9 px-3 rounded-lg border border-slate-300 text-xs text-slate-800"
          />
          {fieldErrors.subject && (
            <p className="text-[11px] text-rose-600 mt-1 mb-0">{fieldErrors.subject}</p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Nội dung chi tiết <span className="text-rose-600">*</span>
          </label>
          <textarea
            rows={4}
            maxLength={4000}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setFieldErrors((p) => ({ ...p, description: '' }));
            }}
            placeholder="Mô tả rõ ngày phát sinh, khoản mục chênh lệch và số liệu thực tế cần Kế toán kiểm tra..."
            className="w-full p-3 rounded-lg border border-slate-300 text-xs text-slate-800 leading-relaxed"
          />
          {fieldErrors.description && (
            <p className="text-[11px] text-rose-600 mt-1 mb-0">{fieldErrors.description}</p>
          )}
        </div>

        {/* Minh chứng đính kèm */}
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Minh chứng đính kèm (PDF, JPG, PNG · tối đa 10 MB/tệp, tối đa 5 tệp)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              onChange={(e) => void handleUploadFiles(e)}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploadingFile || attachments.length >= 5}
              onClick={() => fileInputRef.current?.click()}
              className="h-8 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer disabled:opacity-50"
            >
              {uploadingFile ? 'Đang tải lên...' : 'Đính kèm tệp'}
            </button>
          </div>

          {attachments.length > 0 && (
            <ul className="space-y-1.5 m-0 p-0 list-none">
              {attachments.map((att, idx) => (
                <li
                  key={`${att.fileUrl}-${idx}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-xs"
                >
                  <span className="flex items-center gap-2 truncate text-slate-700">
                    <span className="text-teal-700 shrink-0 inline-flex"><Icon name="fileText" size={14} /></span>
                    <span className="truncate">{att.fileName}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(idx)}
                    className="text-rose-600 hover:text-rose-700 font-semibold bg-transparent border-0 cursor-pointer text-xs"
                  >
                    Gỡ bỏ
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => navigate('/me/payroll-inquiries')}
            className="h-9 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={submitting || uploadingFile}
            className="h-9 px-4 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
          >
            {submitting ? 'Đang gửi...' : 'Gửi thắc mắc'}
          </button>
        </div>
      </form>
    </div>
  );
}
