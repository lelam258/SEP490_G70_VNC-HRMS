import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import PayrollInquiryDetailView from '../../components/payroll/PayrollInquiryDetailView';
import Alert from '../../components/ui/Alert';
import { payrollInquiryApi } from '../../services/payrollInquiryApi';
import type { PayrollInquiryDetail } from '../../types/payrollInquiry';

export default function PayrollInquiryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();

  const [detail, setDetail] = useState<PayrollInquiryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<string>(
    (location.state as { notice?: string } | null)?.notice || ''
  );

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await payrollInquiryApi.getMyDetail(id);
      setDetail(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tải được chi tiết thắc mắc lương.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  return (
    <div className="workspace-content-page max-w-4xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight m-0">
          Chi tiết thắc mắc bảng lương
        </h1>
        <Link
          to="/me/payroll-inquiries"
          className="h-9 px-3.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center no-underline"
        >
          ← Danh sách thắc mắc của tôi
        </Link>
      </div>

      {notice && (
        <Alert variant="success">
          <div className="flex items-center justify-between gap-3 w-full">
            <span>{notice}</span>
            <button
              type="button"
              className="text-xs underline bg-transparent border-0 cursor-pointer text-current"
              onClick={() => setNotice('')}
            >
              Đóng
            </button>
          </div>
        </Alert>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3 animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3" />
          <div className="h-24 bg-slate-100 rounded" />
        </div>
      ) : (
        detail && <PayrollInquiryDetailView detail={detail} isAccountantView={false} />
      )}
    </div>
  );
}
