import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Alert from '../../components/ui/Alert';
import DataTable from '../../components/ui/DataTable';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import Pagination from '../../components/ui/Pagination';
import ProcedureServiceForm from '../../components/payroll/ProcedureServiceForm';
import usePagination from '../../hooks/usePagination';
import { procedureServiceApi } from '../../services/procedureServiceApi';
import type {
  ProcedureServiceItem,
  SaveProcedureServiceInput,
} from '../../types/procedureService';
import { formatVnd, normalize } from '../../utils/format';

export default function ProcedureServiceListPage() {
  const navigate = useNavigate();

  const [services, setServices] = useState<ProcedureServiceItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [notice, setNotice] = useState<string>('');

  // Modal Create / Edit state
  const [formOpen, setFormOpen] = useState<boolean>(false);
  const [editing, setEditing] = useState<ProcedureServiceItem | undefined>();
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string>('');

  // Status toggle confirmation modal
  const [statusTarget, setStatusTarget] = useState<ProcedureServiceItem | null>(null);
  const [changingStatus, setChangingStatus] = useState<boolean>(false);
  const [statusError, setStatusError] = useState<string>('');

  // Client filters
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [listData, catData] = await Promise.all([
        procedureServiceApi.list(),
        procedureServiceApi.listCategories().catch(() => [] as string[]),
      ]);
      setServices(listData);
      setCategories(catData);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không tải được danh mục dịch vụ thủ thuật.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>(categories);
    services.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [categories, services]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return services.filter((item) => {
      if (statusFilter && item.status !== statusFilter) return false;
      if (categoryFilter === '__uncategorized__') {
        if (item.category) return false;
      } else if (categoryFilter && item.category !== categoryFilter) {
        return false;
      }
      if (q) {
        const haystack = normalize(
          `${item.serviceCode} ${item.serviceName} ${item.category || ''}`
        );
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [services, search, categoryFilter, statusFilter]);

  const pagination = usePagination(filtered, 5);
  const hasFilters = !!(search || categoryFilter || statusFilter);

  function resetFilters() {
    setSearch('');
    setCategoryFilter('');
    setStatusFilter('');
    pagination.resetPage();
  }

  function openForm(item?: ProcedureServiceItem) {
    setEditing(item);
    setSaveError('');
    setFormOpen(true);
  }

  async function handleSave(input: SaveProcedureServiceInput) {
    setSaving(true);
    setSaveError('');
    try {
      if (editing) {
        await procedureServiceApi.update(editing.serviceId, input);
        setNotice(`Đã cập nhật thủ thuật "${input.name}" (${input.code}).`);
      } else {
        await procedureServiceApi.create(input);
        setNotice(`Đã tạo mới thủ thuật "${input.name}" (${input.code}).`);
      }
      setFormOpen(false);
      await load();
    } catch (cause) {
      setSaveError(
        cause instanceof Error ? cause.message : 'Không lưu được thông tin thủ thuật.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmStatusChange() {
    if (!statusTarget || changingStatus) return;
    setChangingStatus(true);
    setStatusError('');
    setNotice('');
    const nextStatus = statusTarget.status === 'active' ? 'inactive' : 'active';
    try {
      await procedureServiceApi.setStatus(statusTarget.serviceId, nextStatus);
      setStatusTarget(null);
      setNotice(
        nextStatus === 'inactive'
          ? `Đã vô hiệu hóa thủ thuật "${statusTarget.serviceName}" (${statusTarget.serviceCode}).`
          : `Đã kích hoạt lại thủ thuật "${statusTarget.serviceName}" (${statusTarget.serviceCode}).`
      );
      await load();
    } catch (cause) {
      setStatusError(
        cause instanceof Error ? cause.message : 'Không cập nhật được trạng thái thủ thuật.'
      );
    } finally {
      setChangingStatus(false);
    }
  }

  const activeCount = useMemo(
    () => services.filter((s) => s.status === 'active').length,
    [services]
  );
  const inactiveCount = services.length - activeCount;

  return (
    <section
      className="directory-page directory-procedure-services"
      aria-labelledby="procedure-services-page-title"
    >
      <header className="directory-heading">
        <div>
          <span className="eyebrow">QUẢN LÝ LƯƠNG & HOA HỒNG</span>
          <h1 id="procedure-services-page-title">Danh mục thủ thuật</h1>
          <p>
            Quản lý danh mục dịch vụ thủ thuật y tế, đơn giá niêm yết và trạng thái áp dụng khi lập
            phiếu thủ thuật.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/payroll/parameters" className="button">
            <Icon name="sliders" size={16} />
            Quy tắc hoa hồng
          </Link>
          <button
            type="button"
            className="button primary"
            disabled={loading || saving || changingStatus}
            onClick={() => openForm()}
          >
            <Icon name="plus" size={17} />
            Thêm thủ thuật
          </button>
        </div>
      </header>

      {error && <Alert>{error}</Alert>}
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

      <section
        className="directory-panel"
        aria-label="Danh sách dịch vụ thủ thuật"
        aria-busy={loading}
      >
        <div className="directory-panel-heading">
          <div>
            <h2>
              Danh mục thủ thuật <span>{loading ? '—' : services.length}</span>
            </h2>
            <p>
              {loading
                ? 'Đang tải dữ liệu...'
                : `${activeCount} đang hoạt động · ${inactiveCount} ngừng sử dụng · ${availableCategories.length} nhóm chuyên khoa`}
            </p>
          </div>
          <button
            type="button"
            className="directory-refresh"
            disabled={loading || saving || changingStatus}
            onClick={() => void load()}
          >
            <Icon name="refresh" size={15} />
            Làm mới
          </button>
        </div>

        <div className="directory-filters">
          <label className="directory-search" htmlFor="procedure-service-search">
            Tìm kiếm thủ thuật
            <span>
              <Icon name="search" size={17} />
              <input
                id="procedure-service-search"
                type="search"
                placeholder="Tìm theo mã, tên thủ thuật hoặc nhóm..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  pagination.resetPage();
                }}
              />
            </span>
          </label>

          <label htmlFor="procedure-service-filter-category">
            Nhóm dịch vụ
            <select
              id="procedure-service-filter-category"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                pagination.resetPage();
              }}
            >
              <option value="">Tất cả nhóm dịch vụ</option>
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              <option value="__uncategorized__">Chưa phân nhóm</option>
            </select>
          </label>

          <label htmlFor="procedure-service-filter-status">
            Trạng thái
            <select
              id="procedure-service-filter-status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                pagination.resetPage();
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Đang hoạt động</option>
              <option value="inactive">Ngừng sử dụng</option>
            </select>
          </label>
        </div>

        {hasFilters && (
          <div className="directory-filter-summary">
            <span>
              <strong>{filtered.length}</strong> thủ thuật phù hợp
            </span>
            <button type="button" onClick={resetFilters}>
              Xóa bộ lọc
              <Icon name="close" size={13} />
            </button>
          </div>
        )}

        <div className="directory-table">
          {loading ? (
            <p className="directory-loading" role="status">
              Đang tải danh mục thủ thuật…
            </p>
          ) : (
            <DataTable
              rows={pagination.visible}
              rowKey={(item) => item.serviceId}
              caption="Danh sách dịch vụ thủ thuật"
              emptyMessage="Không có thủ thuật phù hợp."
              emptyState={
                <div className="directory-empty">
                  <span>
                    <Icon name="fileText" size={28} />
                  </span>
                  <h3>
                    {hasFilters ? 'Không tìm thấy thủ thuật phù hợp' : 'Chưa có danh mục thủ thuật'}
                  </h3>
                  <p>
                    {hasFilters
                      ? 'Thử từ khóa khác hoặc xóa bộ lọc để xem toàn bộ danh mục.'
                      : 'Thêm mới dịch vụ thủ thuật để nhân viên y tế lập phiếu và tính hoa hồng.'}
                  </p>
                  {hasFilters && (
                    <button type="button" className="button" onClick={resetFilters}>
                      Xóa bộ lọc
                    </button>
                  )}
                </div>
              }
              columns={[
                {
                  key: 'service',
                  label: 'Thủ thuật',
                  className: 'directory-col-person',
                  render: (item) => (
                    <div className="directory-person">
                      <span className="directory-avatar department">
                        <Icon name="fileText" size={20} />
                      </span>
                      <div>
                        <strong>
                          <Link
                            to={`/payroll/procedure-services/${item.serviceId}`}
                            className="hover:text-sky-700 hover:underline"
                          >
                            {item.serviceName}
                          </Link>
                        </strong>
                        <small className="font-mono">{item.serviceCode}</small>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'category',
                  label: 'Nhóm chuyên khoa',
                  render: (item) =>
                    item.category ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {item.category}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Chưa phân nhóm</span>
                    ),
                },
                {
                  key: 'basePrice',
                  label: 'Đơn giá niêm yết',
                  render: (item) =>
                    item.basePrice !== null && item.basePrice !== undefined ? (
                      <span className="font-semibold text-slate-800 font-[tabular-nums]">
                        {formatVnd(item.basePrice)}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Chưa đặt giá</span>
                    ),
                },
                {
                  key: 'usage',
                  label: 'Sử dụng & Quy tắc',
                  render: (item) => (
                    <div className="text-xs leading-tight space-y-0.5">
                      <div>
                        <span className="font-semibold text-slate-800">{item.slipCount}</span>{' '}
                        <span className="text-slate-500">phiếu</span>
                        <span className="mx-1.5 text-slate-300">·</span>
                        <span
                          className={
                            item.activeRuleCount > 0
                              ? 'text-emerald-700 font-medium'
                              : 'text-slate-400'
                          }
                        >
                          {item.activeRuleCount} quy tắc riêng
                        </span>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'status',
                  label: 'Trạng thái',
                  className: 'directory-col-status',
                  render: (item) => (
                    <span
                      className={`directory-status ${
                        item.status === 'active' ? 'active' : 'inactive'
                      }`}
                    >
                      <i />
                      {item.status === 'active' ? 'Đang hoạt động' : 'Ngừng sử dụng'}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  label: 'Thao tác',
                  className: 'directory-col-actions',
                  render: (item) => (
                    <div className="directory-actions">
                      <button
                        type="button"
                        className="directory-action"
                        aria-label={`Xem chi tiết ${item.serviceName}`}
                        onClick={() => navigate(`/payroll/procedure-services/${item.serviceId}`)}
                      >
                        <Icon name="eye" size={15} />
                        Chi tiết
                      </button>
                      <button
                        type="button"
                        className="directory-action"
                        aria-label={`Sửa ${item.serviceName}`}
                        disabled={saving || changingStatus}
                        onClick={() => openForm(item)}
                      >
                        <Icon name="edit" size={15} />
                        Sửa
                      </button>
                      <button
                        type="button"
                        className={`directory-action ${
                          item.status === 'active' ? 'danger' : 'activate'
                        }`}
                        aria-label={`${
                          item.status === 'active' ? 'Vô hiệu hóa' : 'Kích hoạt'
                        } ${item.serviceName}`}
                        disabled={saving || changingStatus}
                        onClick={() => {
                          setStatusTarget(item);
                          setStatusError('');
                          setNotice('');
                        }}
                      >
                        <Icon name="power" size={15} />
                        {item.status === 'active' ? 'Vô hiệu hóa' : 'Kích hoạt'}
                      </button>
                    </div>
                  ),
                },
              ]}
            />
          )}
        </div>

        <Pagination
          total={filtered.length}
          page={pagination.page}
          pageSize={pagination.pageSize}
          label="thủ thuật"
          disabled={loading || saving || changingStatus}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </section>

      {formOpen && (
        <Modal
          className="directory-dialog"
          title={editing ? 'Cập nhật danh mục thủ thuật' : 'Thêm mới danh mục thủ thuật'}
          busy={saving}
          onClose={() => setFormOpen(false)}
        >
          <ProcedureServiceForm
            initial={editing}
            categories={availableCategories}
            onSave={handleSave}
            onClose={() => setFormOpen(false)}
            busy={saving}
            error={saveError}
          />
        </Modal>
      )}

      {statusTarget && (
        <Modal
          className="directory-dialog"
          title={
            statusTarget.status === 'active'
              ? 'Vô hiệu hóa danh mục thủ thuật'
              : 'Kích hoạt lại danh mục thủ thuật'
          }
          busy={changingStatus}
          onClose={() => setStatusTarget(null)}
        >
          <div className="form-section space-y-3">
            <p>
              Bạn có chắc chắn muốn{' '}
              {statusTarget.status === 'active' ? 'vô hiệu hóa (ngừng sử dụng)' : 'kích hoạt lại'}{' '}
              thủ thuật{' '}
              <strong>
                {statusTarget.serviceName} ({statusTarget.serviceCode})
              </strong>
              ?
            </p>
            {statusTarget.status === 'active' ? (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
                <p className="font-semibold">Lưu ý khi vô hiệu hóa:</p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    Thủ thuật sẽ ẩn khỏi danh sách lựa chọn khi lập phiếu thủ thuật mới.
                  </li>
                  <li>
                    Toàn bộ <strong>{statusTarget.slipCount}</strong> phiếu thủ thuật lịch sử và kết
                    quả hoa hồng trước đây vẫn được giữ nguyên.
                  </li>
                  {statusTarget.activeRuleCount > 0 && (
                    <li className="text-amber-900 font-medium">
                      Đang có <strong>{statusTarget.activeRuleCount}</strong> quy tắc hoa hồng riêng
                      gắn với thủ thuật này.
                    </li>
                  )}
                </ul>
              </div>
            ) : (
              <p className="muted text-sm">
                Sau khi kích hoạt lại, nhân viên y tế có thể chọn thủ thuật này khi lập phiếu mới.
              </p>
            )}
            {statusError && <Alert>{statusError}</Alert>}
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="button"
              disabled={changingStatus}
              onClick={() => setStatusTarget(null)}
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
                : statusTarget.status === 'active'
                ? 'Xác nhận vô hiệu hóa'
                : 'Kích hoạt lại'}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
