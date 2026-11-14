import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '../../components/ui/Alert';
import DataTable, { type Column } from '../../components/ui/DataTable';
import ProcedureReviewModal from '../../components/payroll/ProcedureReviewModal';
import ProcedureCompleteModal from '../../components/payroll/ProcedureCompleteModal';
import { procedureSlipApi } from '../../services/procedureSlipApi';
import { useAuthStore } from '../../store/useAuthStore';
import type {
  ProcedureAssignmentItem,
  ProcedureSlipDetail,
} from '../../types/procedureSlip';
import { formatDateOnly, formatVnd } from '../../utils/format';
import { formatVietnamDateTime } from '../../utils/leaveRules';
import {
  formatRuleFormula,
  formatTimeRangeVn,
  getProcedureStatusBadgeClass,
  PROCEDURE_ROLE_LABELS,
  PROCEDURE_STATUS_LABELS,
  RULE_SOURCE_LABELS,
} from '../../utils/procedureHelpers';

export default function ProcedureDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.session?.user);
  const role = user?.role || 'employee';
  const isReviewerRole = role === 'hr_staff' || role === 'accountant';

  const [detail, setDetail] = useState<ProcedureSlipDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [notice, setNotice] = useState<string>('');

  const [reviewOpen, setReviewOpen] = useState<boolean>(false);
  const [reviewMode, setReviewMode] = useState<'hr_check' | 'accountant_verify'>('accountant_verify');
  const [reviewDecision, setReviewDecision] = useState<'approve' | 'reject'>('approve');
  const [completeOpen, setCompleteOpen] = useState<boolean>(false);

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const data = await procedureSlipApi.getSlipDetail(id);
      setDetail(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tải được chi tiết phiếu thủ thuật.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const assignmentColumns: Column<ProcedureAssignmentItem>[] = [
    {
      key: 'staff',
      label: 'Nhân sự tham gia',
      render: (r) => (
        <div>
          <div className="font-semibold text-slate-900 text-sm">{r.staffName}</div>
          <div className="text-xs text-slate-500">
            <span className="font-mono font-medium text-slate-700">{r.staffCode}</span>
            {r.positionName && ` • ${r.positionName}`}
            {r.departmentName && ` • ${r.departmentName}`}
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Vai trò trong kíp',
      render: (r) => (
        <span className="inline-block px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 text-xs font-medium border border-slate-200">
          {PROCEDURE_ROLE_LABELS[r.role] || r.role}
        </span>
      ),
    },
    {
      key: 'ruleSource',
      label: 'Quy tắc áp dụng',
      render: (r) => (
        <div>
          <div className="text-xs font-medium text-slate-700">
            {RULE_SOURCE_LABELS[r.ruleSource] || r.ruleSource}
          </div>
          <div className="text-xs text-slate-500 font-mono">
            Định mức: {formatRuleFormula(r.valueType, r.ruleValue)}
          </div>
        </div>
      ),
    },
    {
      key: 'commissionAmount',
      label: 'Số tiền hoa hồng',
      render: (r) => (
        <span className="text-sm font-bold text-emerald-700 font-[tabular-nums]">
          {formatVnd(r.commissionAmount)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái & Payslip',
      render: (r) => (
        <div>
          <span
            className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-medium ${getProcedureStatusBadgeClass(
              r.status
            )}`}
          >
            {PROCEDURE_STATUS_LABELS[r.status] || r.status}
          </span>
          {r.payslipId && (
            <div className="text-[11px] text-emerald-700 font-medium mt-0.5">
              ✓ Đã kết chuyển Payslip
            </div>
          )}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        Đang tải thông tin chi tiết phiếu thủ thuật...
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="space-y-4">
        <Alert variant="error">{error || 'Không tìm thấy phiếu thủ thuật.'}</Alert>
        <button
          type="button"
          className="button"
          onClick={() => navigate(role === 'accountant' ? '/payroll/procedures' : '/procedures')}
        >
          ← Quay lại danh sách
        </button>
      </div>
    );
  }

  const creatorLabel =
    detail.indicatingStaffName || detail.recordedByName || 'Nhân viên y tế';
  const performingAssignment =
    detail.assignments.find((a) => a.role === 'performing') || detail.assignments[0];
  const performingLabel =
    detail.performingStaffName ||
    performingAssignment?.staffName ||
    'Chưa xác định';
  const performingCode =
    detail.performingStaffCode || performingAssignment?.staffCode || null;

  const isAccountant = role === 'accountant';
  const canShowEditButton =
    (detail.canEdit && !isReviewerRole) ||
    (isAccountant && detail.status === 'pending' && !detail.isPeriodLocked);

  return (
    <div className="space-y-6">
      {/* Header & Action Bar */}
      <div className="page-heading flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() => navigate(role === 'accountant' ? '/payroll/procedures' : '/procedures')}
              className="text-xs font-medium text-sky-700 hover:underline cursor-pointer"
            >
              ← Danh sách phiếu thủ thuật
            </button>
            <span className="text-xs text-slate-400">/</span>
            <span className="text-xs font-mono text-slate-500">{detail.slipNumber}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="m-0">Phiếu thủ thuật: {detail.slipNumber}</h1>
            <span
              className={`text-xs px-3 py-1 rounded-full font-semibold ${getProcedureStatusBadgeClass(
                detail.status
              )}`}
            >
              {PROCEDURE_STATUS_LABELS[detail.status] || detail.status}
            </span>
            {detail.isAfterHours && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 font-medium border border-purple-200">
                Ca ngoài giờ / Trực
              </span>
            )}
            {detail.isPeriodLocked && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-medium border border-rose-200">
                🔒 Kỳ lương đã khóa
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {canShowEditButton && (
            <button
              type="button"
              onClick={() => navigate(`/procedures/${detail.slipId}/edit`)}
              className="button text-sky-700 border-sky-300 bg-sky-50 hover:bg-sky-100"
            >
              ✎ {isAccountant ? 'Điều chỉnh nhân sự & thời gian ca' : detail.status === 'rejected' ? 'Chỉnh sửa & Gửi duyệt lại' : 'Chỉnh sửa phiếu'}
            </button>
          )}

          {detail.canComplete && (
            <button
              type="button"
              onClick={() => setCompleteOpen(true)}
              className="button primary bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              ✓ Xác nhận hoàn thành thủ thuật
            </button>
          )}

          {detail.canAccountantVerify && role === 'accountant' && (
            <>
              <button
                type="button"
                onClick={() => {
                  setReviewMode('accountant_verify');
                  setReviewDecision('approve');
                  setReviewOpen(true);
                }}
                className="button primary bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                ✓ Duyệt viện phí (Chuyển Bác sĩ)
              </button>
              <button
                type="button"
                onClick={() => {
                  setReviewMode('accountant_verify');
                  setReviewDecision('reject');
                  setReviewOpen(true);
                }}
                className="button bg-rose-50 text-rose-700 border-rose-300 hover:bg-rose-100"
              >
                ✕ Từ chối phiếu
              </button>
            </>
          )}
        </div>
      </div>

      {notice && <Alert variant="success">{notice}</Alert>}

      {/* Banner Cảnh báo khi Phiếu bị Từ chối */}
      {detail.status === 'rejected' && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-900 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="font-bold text-sm text-rose-800">
              ⚠ Phiếu thủ thuật đã bị từ chối
            </div>
            <div className="text-sm mt-1">
              <strong>Lý do từ chối:</strong>{' '}
              {detail.rejectedReason || 'Không đạt yêu cầu đối soát.'}
            </div>
          </div>
          {canShowEditButton && (
            <button
              type="button"
              onClick={() => navigate(`/procedures/${detail.slipId}/edit`)}
              className="button bg-rose-600 hover:bg-rose-700 text-white border-rose-600 shrink-0"
            >
              Cập nhật & Gửi duyệt lại ngay →
            </button>
          )}
        </div>
      )}

      {/* Sơ đồ Quy trình ghi nhận & Luân chuyển 3 bước (Người lập → Kế toán duyệt → Bác sĩ thực hiện) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Quy trình ghi nhận & Luân chuyển phiếu (Medical Staff → Accountant → Performing Doctor)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Theo dõi chi tiết phiếu được lập từ ai, Kế toán xác minh viện phí và Bác sĩ xác nhận hoàn thành ca.
            </p>
          </div>
          <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700">
            Luồng chuyển:{' '}
            <strong className="text-slate-900">{creatorLabel}</strong>
            {' → '}
            <strong className="text-sky-700">
              {detail.verifiedByName || 'Phòng Kế toán'}
            </strong>
            {' → '}
            <strong className="text-emerald-700">
              {performingLabel}
            </strong>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Bước 1: Medical Staff (Người lập / Bác sĩ chỉ định) */}
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800">
                1. Người lập / Bác sĩ chỉ định
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-semibold">
                Đã khởi tạo
              </span>
            </div>
            <div className="text-sm font-semibold text-slate-900 mt-2">
              {creatorLabel}
            </div>
            <div className="text-xs text-slate-600 mt-1">
              Chuyển sang: <strong>Kế toán xác minh viện phí</strong>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Thời gian lập: {formatVietnamDateTime(detail.createdAt)}
            </div>
          </div>

          {/* Bước 2: Accountant Verify (Kế toán xác minh viện phí) */}
          <div
            className={`p-4 rounded-xl border ${
              detail.status === 'verified' || detail.status === 'completed'
                ? 'border-emerald-200 bg-emerald-50/40'
                : detail.status === 'rejected'
                ? 'border-rose-200 bg-rose-50/50'
                : 'border-amber-200 bg-amber-50/40'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                2. Kế toán xác minh viện phí (Accountant)
              </span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                  detail.status === 'verified' || detail.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : detail.status === 'rejected'
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {detail.status === 'verified' || detail.status === 'completed'
                  ? 'Đã duyệt viện phí'
                  : detail.status === 'rejected'
                  ? 'Từ chối'
                  : 'Chờ xác minh'}
              </span>
            </div>

            {detail.status === 'verified' || detail.status === 'completed' ? (
              <>
                <div className="text-sm font-semibold text-emerald-800 mt-2">
                  ✓ Người duyệt: {detail.verifiedByName || 'Kế toán'}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  Nhận từ: <strong>{creatorLabel}</strong> → Chuyển sang:{' '}
                  <strong>{performingLabel}</strong>
                </div>
                {detail.verifiedAt && (
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Lúc: {formatVietnamDateTime(detail.verifiedAt)}
                  </div>
                )}
                {detail.verifyNote && (
                  <div className="text-xs text-slate-600 mt-1 italic">
                    Ghi chú: &ldquo;{detail.verifyNote}&rdquo;
                  </div>
                )}
              </>
            ) : detail.status === 'rejected' ? (
              <>
                <div className="text-sm font-semibold text-rose-800 mt-2">
                  ✕ Người từ chối: {detail.verifiedByName || 'Kế toán'}
                </div>
                <div className="text-xs text-rose-700 font-medium mt-1">
                  {detail.rejectedReason}
                </div>
              </>
            ) : (
              <div className="text-xs text-amber-800 mt-2">
                Phiếu từ <strong>{creatorLabel}</strong> đang chờ Kế toán đối soát viện phí & xác minh hợp lệ.
              </div>
            )}
          </div>

          {/* Bước 3: Performing Doctor (Bác sĩ thực hiện thủ thuật) */}
          <div
            className={`p-4 rounded-xl border ${
              detail.status === 'completed'
                ? 'border-emerald-200 bg-emerald-50/40'
                : detail.status === 'verified'
                ? 'border-sky-300 bg-sky-50/50'
                : 'border-slate-200 bg-slate-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800">
                3. Bác sĩ thực hiện (Performing Doctor)
              </span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                  detail.status === 'completed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : detail.status === 'verified'
                    ? 'bg-sky-100 text-sky-800'
                    : 'bg-slate-200 text-slate-600'
                }`}
              >
                {detail.status === 'completed'
                  ? 'Đã hoàn thành'
                  : detail.status === 'verified'
                  ? 'Sẵn sàng thực hiện'
                  : 'Chưa đến bước'}
              </span>
            </div>

            {detail.status === 'completed' ? (
              <>
                <div className="text-sm font-semibold text-emerald-800 mt-2">
                  ✓ Người hoàn thành: {detail.completedByName || performingLabel}
                </div>
                {detail.completedAt && (
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Lúc: {formatVietnamDateTime(detail.completedAt)}
                  </div>
                )}
                {detail.completeNote && (
                  <div className="text-xs text-emerald-700 mt-1 italic">
                    Ghi chú: &ldquo;{detail.completeNote}&rdquo;
                  </div>
                )}
              </>
            ) : detail.status === 'verified' ? (
              <>
                <div className="text-sm font-semibold text-sky-900 mt-2">
                  Bác sĩ chính: {performingLabel}
                </div>
                <div className="text-xs text-sky-700 mt-1">
                  Kế toán đã duyệt viện phí. Ca thủ thuật đang được giao cho Bác sĩ tiến hành và xác nhận hoàn thành.
                </div>
              </>
            ) : (
              <div className="text-xs text-slate-400 mt-2">
                Chờ hoàn tất bước Kế toán xác minh viện phí trước.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Khối Thông tin hành chính & Chi phí dịch vụ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2.5">
            Thông tin ca thủ thuật & Nhân sự chính
          </h2>
          <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Số phiếu thủ thuật</dt>
              <dd className="font-mono font-semibold text-slate-900 mt-0.5">{detail.slipNumber}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Ngày thực hiện</dt>
              <dd className="font-semibold text-slate-900 mt-0.5">
                {formatDateOnly(detail.procedureDate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Mã bệnh nhân</dt>
              <dd className="font-mono font-semibold text-slate-900 mt-0.5">
                {detail.patientCode || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Khoa / Phòng & Cơ sở thực hiện</dt>
              <dd className="font-medium text-slate-900 mt-0.5">
                {detail.facilityName ? `${detail.facilityName} • ` : ''}
                {detail.departmentName || 'Chưa phân khoa'}
                {detail.departmentCode ? ` (${detail.departmentCode})` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Bác sĩ chỉ định (Người lập)</dt>
              <dd className="font-semibold text-slate-900 mt-0.5">
                {creatorLabel}
                {detail.indicatingStaffCode ? ` (${detail.indicatingStaffCode})` : ''}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Người thực hiện chính</dt>
              <dd className="font-semibold text-sky-800 mt-0.5">
                {performingLabel}
                {performingCode ? ` (${performingCode})` : ''}
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-slate-500">Thời gian thực hiện & Khung giờ</dt>
              <dd className="font-medium text-slate-900 mt-0.5">
                {detail.startTime && detail.endTime
                  ? `${formatTimeRangeVn(detail.startTime, detail.endTime)}${
                      detail.durationHours ? ` (${detail.durationHours} giờ)` : ''
                    }`
                  : detail.durationHours
                  ? `${detail.durationHours} giờ`
                  : 'Theo ca chuẩn'}{' '}
                • {detail.isAfterHours ? 'Ca ngoài giờ / Trực' : 'Giờ hành chính'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2.5">
            Dịch vụ kỹ thuật & Chi phí tài chính
          </h2>
          <dl className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
            <div className="col-span-2">
              <dt className="text-xs text-slate-500">Dịch vụ kỹ thuật</dt>
              <dd className="font-semibold text-slate-900 mt-0.5">
                {detail.serviceName}{' '}
                <span className="font-mono text-xs text-slate-500">({detail.serviceCode})</span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Nhóm dịch vụ</dt>
              <dd className="font-medium text-slate-800 mt-0.5">{detail.serviceCategory || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Đơn giá niêm yết</dt>
              <dd className="font-medium text-slate-800 mt-0.5 font-[tabular-nums]">
                {detail.serviceBasePrice ? formatVnd(detail.serviceBasePrice) : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Số tiền thu viện phí (Charged)</dt>
              <dd className="text-base font-bold text-slate-900 mt-0.5 font-[tabular-nums]">
                {formatVnd(detail.chargedAmount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Chi phí vật tư trực tiếp (Direct Cost)</dt>
              <dd className="text-base font-semibold text-slate-700 mt-0.5 font-[tabular-nums]">
                {formatVnd(detail.directCost)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Doanh thu thuần</dt>
              <dd className="text-base font-bold text-sky-700 mt-0.5 font-[tabular-nums]">
                {formatVnd(detail.netRevenue)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Tổng hoa hồng kíp thực hiện</dt>
              <dd className="text-base font-bold text-emerald-700 mt-0.5 font-[tabular-nums]">
                {formatVnd(detail.totalCommissionAmount)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Bảng Kíp thực hiện & Phân bổ hoa hồng */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4 procedure-table-wrap">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Danh sách nhân sự tham gia & Phân bổ hoa hồng ({detail.assignments.length} người)
            </h2>
            <p className="text-xs text-slate-500">
              Thù lao được tính theo thứ tự ưu tiên: Đơn giá riêng của nhân viên → Quy tắc theo dịch vụ → Quy tắc nhóm dịch vụ.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-500 block">Tổng cộng hoa hồng ca:</span>
            <strong className="text-lg text-emerald-700 font-[tabular-nums]">
              {formatVnd(detail.totalCommissionAmount)}
            </strong>
          </div>
        </div>

        <DataTable<ProcedureAssignmentItem>
          columns={assignmentColumns}
          rows={detail.assignments}
          rowKey={(r) => r.assignmentId}
          emptyMessage="Chưa có nhân sự nào trong kíp thực hiện."
        />
      </div>

      {/* Modal HR Check / Accountant Verify */}
      <ProcedureReviewModal
        open={reviewOpen}
        mode={reviewMode}
        slip={detail}
        defaultDecision={reviewDecision}
        onClose={() => setReviewOpen(false)}
        onSuccess={(updated, message) => {
          setReviewOpen(false);
          setDetail(updated);
          setNotice(message);
        }}
      />

      {/* Modal Xác nhận hoàn thành ca thủ thuật */}
      <ProcedureCompleteModal
        open={completeOpen}
        slip={detail}
        onClose={() => setCompleteOpen(false)}
        onSuccess={(updated, message) => {
          setCompleteOpen(false);
          setDetail(updated);
          setNotice(message);
        }}
      />
    </div>
  );
}
