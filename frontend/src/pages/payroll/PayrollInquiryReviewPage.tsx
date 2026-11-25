import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PayrollInquiryDetailView from '../../components/payroll/PayrollInquiryDetailView';
import Alert from '../../components/ui/Alert';
import Icon from '../../components/ui/Icon';
import { payrollInquiryApi } from '../../services/payrollInquiryApi';
import type { PayrollInquiryDetail } from '../../types/payrollInquiry';
import { formatVietnamDateTime } from '../../utils/leaveRules';
import { getInquiryStatusBadgeClass, getInquiryStatusLabel } from '../../utils/payrollInquiry';

export default function PayrollInquiryReviewPage() {
  const { id } = useParams<{ id: string }>();

  const [detail, setDetail] = useState<PayrollInquiryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [decision, setDecision] = useState<'resolved' | 'rejected'>('resolved');
  const [responseText, setResponseText] = useState('');
  const [responseError, setResponseError] = useState('');
  const [startingReview, setStartingReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await payrollInquiryApi.getAccountantDetail(id);
      setDetail(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tải được hồ sơ thắc mắc lương.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleStartReview = async () => {
    if (!id || !detail || startingReview) return;
    setStartingReview(true);
    setError('');
    setNotice('');
    try {
      const updated = await payrollInquiryApi.startReview(id);
      setDetail(updated);
      setNotice('Đã tiếp nhận hồ sơ sang trạng thái Đang xem xét.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể chuyển trạng thái xem xét.');
    } finally {
      setStartingReview(false);
    }
  };

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !detail || submitting) return;

    if (!responseText.trim()) {
      setResponseError('Trường này là bắt buộc.');
      return;
    }

    setSubmitting(true);
    setResponseError('');
    setError('');
    setNotice('');
    try {
      const updated = await payrollInquiryApi.resolve(id, {
        decision,
        response: responseText.trim(),
        expectedStatus: detail.status,
        expectedRepliedAt: detail.repliedAt || null,
      });
      setDetail(updated);
      setResponseText('');
      setNotice('Dữ liệu đã được lưu thành công. Đã đóng thắc mắc và gửi thông báo cho nhân viên.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể lưu kết quả xử lý thắc mắc.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="workspace-content-page max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight m-0">
          Xử lý thắc mắc bảng lương
        </h1>
        <Link
          to="/payroll/inquiries"
          className="h-9 px-3.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center no-underline"
        >
          ← Quay lại hàng đợi
        </Link>
      </div>

      {notice && <Alert variant="success">{notice}</Alert>}
      {error && (
        <Alert variant="error">
          <div className="flex items-center justify-between gap-3 w-full">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void loadDetail()}
              className="text-xs font-semibold underline bg-transparent border-0 cursor-pointer text-current"
            >
              Tải lại dữ liệu
            </button>
          </div>
        </Alert>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3 animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3" />
          <div className="h-32 bg-slate-100 rounded" />
        </div>
      ) : (
        detail && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
            <div className="lg:col-span-2">
              <PayrollInquiryDetailView
                detail={detail}
                isAccountantView={true}
                hideResponseSection={true}
              />
            </div>

            {/* Cột phải: Bảng điều khiển xử lý của Kế toán */}
            <aside className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <h2 className="text-sm font-bold text-slate-900 m-0">Kết luận xử lý</h2>
                {detail.status === 'submitted' && (
                  <button
                    type="button"
                    disabled={startingReview}
                    onClick={() => void handleStartReview()}
                    className="h-8 px-3 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {startingReview ? 'Đang nhận...' : 'Tiếp nhận xem xét'}
                  </button>
                )}
              </div>

              {detail.sourceContext.isPeriodFinalized && (
                <Alert variant="warning">
                  Bảng lương đã được chốt chính thức và không thể chỉnh sửa trực tiếp. Nếu phát hiện sai lệch nguồn, hãy hướng dẫn điều chỉnh vào kỳ lương kế tiếp.
                </Alert>
              )}

              {detail.isReadOnly ? (
                <div className="space-y-3">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 flex items-start gap-2">
                    <span className="text-slate-500 shrink-0 mt-0.5 inline-flex"><Icon name="lock" size={14} /></span>
                    <span>
                      Hồ sơ đã đóng ở trạng thái chỉ đọc và không cho phép chỉnh sửa lại kết quả phản hồi.
                    </span>
                  </div>

                  {detail.response && (
                    <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/60 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800">Phản hồi đã gửi</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getInquiryStatusBadgeClass(detail.status)}`}
                        >
                          {getInquiryStatusLabel(detail.status)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-white border border-slate-200/80 rounded p-2.5">
                        {detail.response}
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {detail.repliedByName ? `Người xử lý: ${detail.repliedByName}` : ''}
                        {detail.resolvedAt ? ` · ${formatVietnamDateTime(detail.resolvedAt)}` : ''}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <form onSubmit={(e) => void handleResolve(e)} noValidate className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Quyết định xử lý <span className="text-rose-600">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setDecision('resolved')}
                        className={`px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                          decision === 'resolved'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        Đã giải quyết
                      </button>
                      <button
                        type="button"
                        onClick={() => setDecision('rejected')}
                        className={`px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${
                          decision === 'rejected'
                            ? 'bg-rose-50 border-rose-500 text-rose-800'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        Từ chối
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Nội dung giải trình / Hướng xử lý <span className="text-rose-600">*</span>
                    </label>
                    <textarea
                      rows={5}
                      maxLength={4000}
                      value={responseText}
                      onChange={(e) => {
                        setResponseText(e.target.value);
                        setResponseError('');
                      }}
                      placeholder={
                        decision === 'resolved'
                          ? 'Ghi rõ kết quả đối chiếu bảng công/thủ thuật và phương án điều chỉnh (nếu có vào kỳ lương sau)...'
                          : 'Nêu rõ căn cứ từ chối thắc mắc để nhân viên nắm thông tin...'
                      }
                      className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-800 leading-relaxed"
                    />
                    {responseError && (
                      <p className="text-[11px] text-rose-600 mt-1 mb-0">{responseError}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-9 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                  >
                    {submitting
                      ? 'Đang lưu...'
                      : decision === 'resolved'
                      ? 'Xác nhận Đã giải quyết'
                      : 'Xác nhận Từ chối'}
                  </button>
                </form>
              )}
            </aside>
          </div>
        )
      )}
    </div>
  );
}
