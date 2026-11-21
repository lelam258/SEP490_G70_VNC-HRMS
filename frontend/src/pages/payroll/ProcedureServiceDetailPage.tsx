import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Alert from '../../components/ui/Alert';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import ProcedureServiceForm from '../../components/payroll/ProcedureServiceForm';
import { procedureServiceApi } from '../../services/procedureServiceApi';
import type {
  ProcedureServiceDetail,
  ProcedureServiceOverrideSummary,
  ProcedureServiceRuleSummary,
  ProcedureServiceSlipSummary,
  SaveProcedureServiceInput,
} from '../../types/procedureService';
import { formatDateOnly, formatVnd } from '../../utils/format';
import { formatVietnamDateTime } from '../../utils/leaveRules';
import {
  formatRuleFormula,
  getProcedureStatusBadgeClass,
  PROCEDURE_ROLE_LABELS,
  PROCEDURE_STATUS_LABELS,
} from '../../utils/procedureHelpers';

const TIME_CONDITION_LABELS: Record<string, string> = {
  all: 'Mọi khung giờ',
  in_hours: 'Trong giờ HC',
  after_hours: 'Ngoài giờ',
};

const SERVICE_AUDIT_LABELS: Record<string, string> = {
  create: 'Tạo mới thủ thuật',
  update: 'Cập nhật thông tin',
  deactivate: 'Vô hiệu hóa thủ thuật',
  activate: 'Kích hoạt lại thủ thuật',
};

export default function ProcedureServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<ProcedureServiceDetail | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [notice, setNotice] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'rules' | 'slips' | 'overrides' | 'audit'>('rules');

  // Edit modal
  const [editOpen, setEditOpen] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string>('');

  // Status modal
  const [statusModalOpen, setStatusModalOpen] = useState<boolean>(false);
  const [changingStatus, setChangingStatus] = useState<boolean>(false);
  const [statusError, setStatusError] = useState<string>('');

  const loadDetail = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [detailData, catData] = await Promise.all([
        procedureServiceApi.getDetail(id),
        procedureServiceApi.listCategories().catch(() => [] as string[]),
      ]);
      setDetail(detailData);
      setCategories(catData);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không tải được chi tiết danh mục thủ thuật.'
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  async function handleSave(input: SaveProcedureServiceInput) {
    if (!detail) return;
    setSaving(true);
    setSaveError('');
    try {
      await procedureServiceApi.update(detail.serviceId, input);
      setEditOpen(false);
      setNotice('Đã cập nhật thông tin danh mục thủ thuật.');
      await loadDetail();
    } catch (cause) {
      setSaveError(
        cause instanceof Error ? cause.message : 'Không cập nhật được danh mục thủ thuật.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmStatusChange() {
    if (!detail || changingStatus) return;
    setChangingStatus(true);
    setStatusError('');
    const nextStatus = detail.status === 'active' ? 'inactive' : 'active';
    try {
      await procedureServiceApi.setStatus(detail.serviceId, nextStatus);
      setStatusModalOpen(false);
      setNotice(
        nextStatus === 'inactive'
          ? 'Đã vô hiệu hóa danh mục thủ thuật.'
          : 'Đã kích hoạt lại danh mục thủ thuật.'
      );
      await loadDetail();
    } catch (cause) {
      setStatusError(
        cause instanceof Error ? cause.message : 'Không cập nhật được trạng thái thủ thuật.'
      );
    } finally {
      setChangingStatus(false);
    }
  }

  const ruleColumns: Column<ProcedureServiceRuleSummary>[] = [
    {
      key: 'scope',
      label: 'Phạm vi áp dụng',
      render: (r) =>
        r.isDirectRule ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200">
            Theo dịch vụ này
          </span>
        ) : (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
            Theo nhóm ({detail?.category})
          </span>
        ),
    },
    {
      key: 'role',
      label: 'Vai trò trong kíp',
      render: (r) => (
        <span className="font-medium text-slate-800 text-sm">
          {PROCEDURE_ROLE_LABELS[r.role] || r.role}
        </span>
      ),
    },
    {
      key: 'position',
      label: 'Chức danh',
      render: (r) =>
        r.positionName ? (
          <span className="text-sm text-slate-700">{r.positionName}</span>
        ) : (
          <span className="text-xs text-slate-400">Tất cả chức danh</span>
        ),
    },
    {
      key: 'timeCondition',
      label: 'Khung giờ',
      render: (r) => (
        <span className="text-xs text-slate-600">
          {TIME_CONDITION_LABELS[r.timeCondition] || r.timeCondition}
        </span>
      ),
    },
    {
      key: 'formula',
      label: 'Định mức hoa hồng',
      render: (r) => (
        <span className="font-semibold text-emerald-700 font-mono text-sm">
          {formatRuleFormula(r.valueType, r.commissionValue)}
        </span>
      ),
    },
    {
      key: 'effective',
      label: 'Hiệu lực',
      render: (r) => (
        <span className="text-xs text-slate-600 font-mono">
          {formatDateOnly(r.effectiveFrom)} → {r.effectiveTo ? formatDateOnly(r.effectiveTo) : 'Nay'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (r) => (
        <span
          className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
            r.status === 'active'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          {r.status === 'active' ? 'Đang áp dụng' : 'Ngừng áp dụng'}
        </span>
      ),
    },
  ];

  const slipColumns: Column<ProcedureServiceSlipSummary>[] = [
    {
      key: 'slipNumber',
      label: 'Số phiếu',
      render: (s) => (
        <Link
          to={`/procedures/${s.slipId}`}
          className="font-mono font-semibold text-sky-700 hover:underline text-sm"
        >
          {s.slipNumber}
        </Link>
      ),
    },
    {
      key: 'procedureDate',
      label: 'Ngày thực hiện',
      render: (s) => <span className="text-sm font-mono">{formatDateOnly(s.procedureDate)}</span>,
    },
    {
      key: 'patient',
      label: 'Bệnh nhân / Khoa',
      render: (s) => (
        <div className="text-xs">
          <div className="font-medium text-slate-800">{s.patientCode || '—'}</div>
          <div className="text-slate-500">{s.departmentName || 'Chưa gắn khoa'}</div>
        </div>
      ),
    },
    {
      key: 'chargedAmount',
      label: 'Thu dịch vụ',
      render: (s) => (
        <span className="text-sm font-semibold text-slate-800 font-[tabular-nums]">
          {formatVnd(s.chargedAmount)}
        </span>
      ),
    },
    {
      key: 'totalCommissionAmount',
      label: 'Tổng hoa hồng',
      render: (s) => (
        <span className="text-sm font-semibold text-emerald-700 font-[tabular-nums]">
          {formatVnd(s.totalCommissionAmount)}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (s) => (
        <span
          className={`inline-block text-[11px] px-2.5 py-0.5 rounded-full font-medium ${getProcedureStatusBadgeClass(
            s.status
          )}`}
        >
          {PROCEDURE_STATUS_LABELS[s.status] || s.status}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Chi tiết',
      render: (s) => (
        <Link
          to={`/procedures/${s.slipId}`}
          className="text-xs font-medium text-sky-600 hover:text-sky-800"
        >
          Xem phiếu →
        </Link>
      ),
    },
  ];

  const overrideColumns: Column<ProcedureServiceOverrideSummary>[] = [
    {
      key: 'staff',
      label: 'Nhân viên',
      render: (o) => (
        <div>
          <div className="font-medium text-slate-800 text-sm">{o.staffName}</div>
          <div className="text-xs text-slate-500 font-mono">{o.staffCode}</div>
        </div>
      ),
    },
    {
      key: 'scope',
      label: 'Loại cấu hình',
      render: (o) => (
        <span className="text-xs text-slate-600">
          {o.isDirectRule ? 'Theo dịch vụ này' : `Theo nhóm (${detail?.category})`}
        </span>
      ),
    },
    {
      key: 'role',
      label: 'Vai trò',
      render: (o) => (
        <span className="text-sm font-medium text-slate-700">
          {PROCEDURE_ROLE_LABELS[o.role] || o.role}
        </span>
      ),
    },
    {
      key: 'formula',
      label: 'Đơn giá riêng',
      render: (o) => (
        <span className="font-semibold text-emerald-700 font-mono text-sm">
          {formatRuleFormula(o.valueType, o.commissionValue)}
        </span>
      ),
    },
    {
      key: 'effective',
      label: 'Hiệu lực',
      render: (o) => (
        <span className="text-xs text-slate-600 font-mono">
          {formatDateOnly(o.effectiveFrom)} → {o.effectiveTo ? formatDateOnly(o.effectiveTo) : 'Nay'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Trạng thái',
      render: (o) => (
        <span
          className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
            o.status === 'active'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          {o.status === 'active' ? 'Đang áp dụng' : 'Ngừng áp dụng'}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <section className="directory-page">
        <p className="directory-loading" role="status">
          Đang tải chi tiết danh mục thủ thuật…
        </p>
      </section>
    );
  }

  if (error || !detail) {
    return (
      <section className="directory-page space-y-4">
        <Alert>{error || 'Không tìm thấy danh mục thủ thuật.'}</Alert>
        <div>
          <button
            type="button"
            className="button"
            onClick={() => navigate('/payroll/procedure-services')}
          >
            ← Quay lại danh mục thủ thuật
          </button>
        </div>
      </section>
    );
  }

  return (
    <section
      className="directory-page space-y-6"
      aria-labelledby="procedure-service-detail-heading"
    >
      {/* Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link to="/payroll/procedure-services" className="hover:text-sky-600 font-medium">
              Danh mục thủ thuật
            </Link>
            <span>/</span>
            <span className="font-mono text-slate-700">{detail.serviceCode}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1
              id="procedure-service-detail-heading"
              className="text-xl md:text-2xl font-bold text-slate-900 m-0"
            >
              {detail.serviceName}
            </h1>
            <span
              className={`directory-status ${detail.status === 'active' ? 'active' : 'inactive'}`}
            >
              <i />
              {detail.status === 'active' ? 'Đang hoạt động' : 'Ngừng sử dụng'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
            <span>
              Mã thủ thuật:{' '}
              <strong className="font-mono text-slate-900">{detail.serviceCode}</strong>
            </span>
            <span>•</span>
            <span>
              Nhóm chuyên khoa:{' '}
              <strong className="text-slate-900">{detail.category || 'Chưa phân nhóm'}</strong>
            </span>
            <span>•</span>
            <span>
              Đơn giá niêm yết:{' '}
              <strong className="text-emerald-700">
                {detail.basePrice !== null && detail.basePrice !== undefined
                  ? formatVnd(detail.basePrice)
                  : 'Chưa đặt giá'}
              </strong>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="button"
            onClick={() => navigate('/payroll/procedure-services')}
          >
            ← Danh sách
          </button>
          <button
            type="button"
            className="button"
            onClick={() => {
              setSaveError('');
              setEditOpen(true);
            }}
          >
            <Icon name="edit" size={16} />
            Chỉnh sửa
          </button>
          <button
            type="button"
            className={`button ${detail.status === 'active' ? '' : 'primary'}`}
            onClick={() => {
              setStatusError('');
              setStatusModalOpen(true);
            }}
          >
            <Icon name="power" size={16} />
            {detail.status === 'active' ? 'Vô hiệu hóa' : 'Kích hoạt lại'}
          </button>
        </div>
      </div>

      {notice && (
        <Alert variant="success">
          {notice}
          <button
            className="icon-button"
            aria-label="Đóng thông báo"
            onClick={() => setNotice('')}
          >
            <Icon name="close" size={15} />
          </button>
        </Alert>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Tổng phiếu phát sinh
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{detail.totalSlips}</div>
          <div className="text-xs text-slate-500 mt-1.5 flex flex-wrap gap-2">
            <span className="text-emerald-700 font-medium">{detail.verifiedSlips} đã duyệt</span>
            <span>·</span>
            <span className="text-amber-700">
              {detail.pendingSlips + detail.hrCheckedSlips} chờ duyệt
            </span>
            {detail.rejectedSlips > 0 && (
              <>
                <span>·</span>
                <span className="text-rose-600">{detail.rejectedSlips} từ chối</span>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Tổng doanh thu thủ thuật
          </div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-[tabular-nums]">
            {formatVnd(detail.totalChargedAmount)}
          </div>
          <div className="text-xs text-slate-500 mt-1.5">
            Đơn giá niêm yết:{' '}
            {detail.basePrice !== null && detail.basePrice !== undefined
              ? formatVnd(detail.basePrice)
              : 'Chưa cấu hình'}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Tổng hoa hồng phát sinh
          </div>
          <div className="text-2xl font-bold text-emerald-700 mt-1 font-[tabular-nums]">
            {formatVnd(detail.totalCommissionAmount)}
          </div>
          <div className="text-xs text-slate-500 mt-1.5">
            Tính trên tất cả kíp thực hiện của dịch vụ này
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
            Cấu hình hoa hồng
          </div>
          <div className="text-2xl font-bold text-sky-700 mt-1">
            {detail.activeDirectRuleCount} quy tắc riêng
          </div>
          <div className="text-xs text-slate-500 mt-1.5">
            {detail.categoryRuleCount} quy tắc nhóm · {detail.overrideCount} đơn giá riêng NV
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-200 px-6 pt-3 flex flex-wrap items-center justify-between gap-2 bg-slate-50/60">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'rules'
                  ? 'border-sky-600 text-sky-700 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Quy tắc hoa hồng ({detail.commissionRules.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('slips')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'slips'
                  ? 'border-sky-600 text-sky-700 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Phiếu thủ thuật gần đây ({detail.recentSlips.length}/{detail.totalSlips})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('overrides')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'overrides'
                  ? 'border-sky-600 text-sky-700 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Đơn giá riêng nhân viên ({detail.staffOverrides.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'audit'
                  ? 'border-sky-600 text-sky-700 bg-white rounded-t-lg'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Lịch sử thay đổi ({detail.auditHistory.length})
            </button>
          </div>

          {activeTab === 'rules' && (
            <Link
              to="/payroll/parameters"
              className="text-xs font-medium text-sky-600 hover:text-sky-800 pb-2"
            >
              Quản lý ma trận quy tắc hoa hồng →
            </Link>
          )}
          {activeTab === 'slips' && (
            <Link
              to="/payroll/procedures"
              className="text-xs font-medium text-sky-600 hover:text-sky-800 pb-2"
            >
              Xem toàn bộ phiếu thủ thuật →
            </Link>
          )}
        </div>

        <div className="p-6">
          {activeTab === 'rules' && (
            <DataTable
              rows={detail.commissionRules}
              rowKey={(r) => r.ruleId}
              columns={ruleColumns}
              caption="Danh sách quy tắc hoa hồng áp dụng cho thủ thuật"
              emptyMessage="Chưa có quy tắc hoa hồng nào cho dịch vụ hoặc nhóm dịch vụ này."
            />
          )}

          {activeTab === 'slips' && (
            <DataTable
              rows={detail.recentSlips}
              rowKey={(s) => s.slipId}
              columns={slipColumns}
              caption="20 phiếu thủ thuật gần nhất"
              emptyMessage="Chưa có phiếu thủ thuật nào phát sinh cho dịch vụ này."
            />
          )}

          {activeTab === 'overrides' && (
            <DataTable
              rows={detail.staffOverrides}
              rowKey={(o) => o.overrideId}
              columns={overrideColumns}
              caption="Đơn giá hoa hồng riêng theo nhân viên"
              emptyMessage="Không có cấu hình đơn giá hoa hồng riêng nhân viên nào cho dịch vụ này."
            />
          )}

          {activeTab === 'audit' && (
            <div className="space-y-3">
              {detail.auditHistory.length === 0 ? (
                <p className="text-sm text-slate-500 italic">Chưa có lịch sử cập nhật.</p>
              ) : (
                detail.auditHistory.map((item) => (
                  <div
                    key={item.logId}
                    className="flex items-start justify-between gap-4 p-3 rounded-lg border border-slate-200 bg-slate-50/50 text-sm"
                  >
                    <div>
                      <div className="font-semibold text-slate-800">
                        {SERVICE_AUDIT_LABELS[item.action] || item.action}
                      </div>
                      {item.detail && <div className="text-slate-600 mt-0.5">{item.detail}</div>}
                      <div className="text-xs text-slate-500 mt-1">
                        Thực hiện bởi:{' '}
                        <span className="font-medium text-slate-700">
                          {item.actorFullName || item.username || 'Hệ thống'}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 font-mono whitespace-nowrap">
                      {item.createdAt ? formatVietnamDateTime(item.createdAt) : '—'}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {editOpen && (
        <Modal
          className="directory-dialog"
          title="Cập nhật danh mục thủ thuật"
          busy={saving}
          onClose={() => setEditOpen(false)}
        >
          <ProcedureServiceForm
            initial={{
              serviceCode: detail.serviceCode,
              serviceName: detail.serviceName,
              category: detail.category,
              basePrice: detail.basePrice,
              status: detail.status,
              slipCount: detail.totalSlips,
            }}
            categories={categories}
            onSave={handleSave}
            onClose={() => setEditOpen(false)}
            busy={saving}
            error={saveError}
          />
        </Modal>
      )}

      {statusModalOpen && (
        <Modal
          className="directory-dialog"
          title={
            detail.status === 'active'
              ? 'Vô hiệu hóa danh mục thủ thuật'
              : 'Kích hoạt lại danh mục thủ thuật'
          }
          busy={changingStatus}
          onClose={() => setStatusModalOpen(false)}
        >
          <div className="form-section space-y-3">
            <p>
              Bạn có chắc muốn{' '}
              {detail.status === 'active' ? 'vô hiệu hóa (ngừng sử dụng)' : 'kích hoạt lại'} thủ
              thuật{' '}
              <strong>
                {detail.serviceName} ({detail.serviceCode})
              </strong>
              ?
            </p>
            {detail.status === 'active' && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
                <p>
                  • Thủ thuật bị vô hiệu hóa sẽ không hiển thị khi tạo phiếu thủ thuật mới.
                </p>
                <p>
                  • Dữ liệu lịch sử ({detail.totalSlips} phiếu) vẫn được giữ nguyên.
                </p>
                {detail.activeDirectRuleCount > 0 && (
                  <p className="font-semibold">
                    • Hiện có {detail.activeDirectRuleCount} quy tắc hoa hồng riêng đang gắn với thủ
                    thuật này.
                  </p>
                )}
              </div>
            )}
            {statusError && <Alert>{statusError}</Alert>}
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="button"
              disabled={changingStatus}
              onClick={() => setStatusModalOpen(false)}
            >
              Hủy
            </button>
            <button
              type="button"
              className="button primary"
              disabled={changingStatus}
              onClick={() => void handleConfirmStatusChange()}
            >
              {changingStatus
                ? 'Đang cập nhật…'
                : detail.status === 'active'
                ? 'Xác nhận vô hiệu hóa'
                : 'Kích hoạt lại'}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
