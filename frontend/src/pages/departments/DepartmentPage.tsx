import { useCallback, useEffect, useMemo, useState } from 'react';
import { departmentApi, type Department, type FacilityOption } from '../../services/departmentApi';
import Alert from '../../components/ui/Alert';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import DepartmentForm from '../../components/departments/DepartmentForm';
import Icon from '../../components/ui/Icon';
import Pagination from '../../components/ui/Pagination';
import usePagination from '../../hooks/usePagination';
import { normalize } from '../../utils/format';

export default function DepartmentPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [facilities, setFacilities] = useState<FacilityOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [editing, setEditing] = useState<Department | undefined>();

  // Modal phân cơ sở nhanh
  const [facilityTarget, setFacilityTarget] = useState<Department | null>(null);
  const [facilityChoice, setFacilityChoice] = useState<string>('BOTH');
  const [facilityError, setFacilityError] = useState('');
  const [savingFacility, setSavingFacility] = useState(false);

  const [statusTarget, setStatusTarget] = useState<Department | null>(null);
  const [statusError, setStatusError] = useState('');
  const [changingStatus, setChangingStatus] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const filtered = useMemo(
    () =>
      departments.filter(
        (d) =>
          (!status || d.status === status) &&
          normalize(`${d.code} ${d.name} ${d.facilityLabel || ''}`).includes(normalize(search))
      ),
    [departments, search, status]
  );
  const pagination = usePagination(filtered);
  const hasFilters = !!(search || status);

  function resetFilters() {
    setSearch('');
    setStatus('');
    pagination.resetPage();
  }

  function edit(department?: Department) {
    setEditing(department);
    setSaveError('');
    setOpen(true);
  }

  function openAssignFacility(dept: Department) {
    setFacilityTarget(dept);
    setFacilityError('');
    setNotice('');
    const allIds = facilities.map((f) => f.id);
    if (
      dept.facilityIds &&
      dept.facilityIds.length > 0 &&
      dept.facilityIds.length < allIds.length
    ) {
      setFacilityChoice(dept.facilityIds[0]);
    } else {
      setFacilityChoice('BOTH');
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [deptRes, facRes] = await Promise.all([
        departmentApi.list(),
        departmentApi.listFacilities().catch(() => [] as FacilityOption[]),
      ]);
      setDepartments(deptRes);
      setFacilities(facRes);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được khoa/phòng.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(value: {
    code: string;
    name: string;
    status: string;
    facilityIds?: string[];
  }) {
    setSaving(true);
    setSaveError('');
    try {
      if (editing) await departmentApi.update(editing.id, value);
      else await departmentApi.create(value);
      setOpen(false);
      setNotice('Đã lưu khoa/phòng.');
      await load();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Không lưu được khoa/phòng.');
    } finally {
      setSaving(false);
    }
  }

  async function saveAssignedFacility() {
    if (!facilityTarget || savingFacility) return;
    setSavingFacility(true);
    setFacilityError('');
    setNotice('');
    try {
      const allIds = facilities.map((f) => f.id);
      const selectedIds = facilityChoice === 'BOTH' ? allIds : [facilityChoice];
      await departmentApi.assignFacilities(facilityTarget.id, selectedIds);
      setFacilityTarget(null);
      setNotice(`Đã cập nhật cơ sở trực thuộc cho khoa/phòng ${facilityTarget.name}.`);
      await load();
    } catch (cause) {
      setFacilityError(
        cause instanceof Error ? cause.message : 'Không phân được cơ sở cho khoa/phòng.'
      );
    } finally {
      setSavingFacility(false);
    }
  }

  async function changeStatus() {
    if (!statusTarget || changingStatus) return;
    setChangingStatus(true);
    setStatusError('');
    setNotice('');
    try {
      await departmentApi.setStatus(
        statusTarget.id,
        statusTarget.status === 'active' ? 'inactive' : 'active'
      );
      setStatusTarget(null);
      setNotice(
        statusTarget.status === 'active'
          ? 'Đã ngừng hoạt động khoa/phòng.'
          : 'Đã kích hoạt khoa/phòng.'
      );
      await load();
    } catch (cause) {
      setStatusError(
        cause instanceof Error ? cause.message : 'Không cập nhật được trạng thái khoa/phòng.'
      );
    } finally {
      setChangingStatus(false);
    }
  }

  return (
    <section
      className="directory-page directory-departments"
      aria-labelledby="department-page-title"
    >
      <header className="directory-heading">
        <div>
          <span className="eyebrow">CƠ CẤU TỔ CHỨC</span>
          <h1 id="department-page-title">Khoa/phòng</h1>
          <p>Quản lý các đơn vị chuyên môn, bộ phận và phân bổ cơ sở của phòng khám.</p>
        </div>
        <button
          className="button primary"
          disabled={loading || saving || changingStatus || savingFacility || !!error}
          onClick={() => edit()}
        >
          <Icon name="plus" size={17} />
          Thêm khoa/phòng
        </button>
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
        aria-label="Danh sách khoa/phòng"
        aria-busy={loading}
      >
        <div className="directory-panel-heading">
          <div>
            <h2>
              Danh sách khoa/phòng <span>{loading ? '—' : departments.length}</span>
            </h2>
            <p>
              {loading
                ? 'Đang tải dữ liệu'
                : `${departments.filter((d) => d.status === 'active').length} hoạt động · ${
                    departments.filter((d) => d.status !== 'active').length
                  } ngừng hoạt động`}
            </p>
          </div>
          <button
            className="directory-refresh"
            disabled={loading || saving || changingStatus || savingFacility}
            onClick={() => void load()}
          >
            <Icon name="refresh" size={15} />
            Làm mới
          </button>
        </div>
        <div className="directory-filters">
          <label className="directory-search" htmlFor="department-search">
            Tìm khoa/phòng
            <span>
              <Icon name="search" size={17} />
              <input
                id="department-search"
                type="search"
                placeholder="Tên, mã hoặc cơ sở…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  pagination.resetPage();
                }}
              />
            </span>
          </label>
          <label htmlFor="department-filter-status">
            Trạng thái
            <select
              id="department-filter-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                pagination.resetPage();
              }}
            >
              <option value="">Tất cả trạng thái</option>
              <option value="active">Hoạt động</option>
              <option value="inactive">Ngừng hoạt động</option>
            </select>
          </label>
        </div>
        {hasFilters && (
          <div className="directory-filter-summary">
            <span>
              <strong>{filtered.length}</strong> khoa/phòng phù hợp
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
              Đang tải danh sách khoa/phòng…
            </p>
          ) : (
            <DataTable
              rows={pagination.visible}
              rowKey={(d) => d.id}
              caption="Danh sách khoa và phòng ban"
              emptyMessage="Không có khoa/phòng phù hợp."
              emptyState={
                <div className="directory-empty">
                  <span>
                    <Icon name="building" size={28} />
                  </span>
                  <h3>{hasFilters ? 'Không tìm thấy khoa/phòng' : 'Chưa có khoa/phòng'}</h3>
                  <p>
                    {hasFilters
                      ? 'Thử tên, mã khác hoặc thay đổi trạng thái.'
                      : 'Thêm đơn vị để tổ chức đội ngũ phòng khám.'}
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
                  key: 'name',
                  label: 'Khoa/phòng',
                  className: 'directory-col-person',
                  render: (d) => (
                    <div className="directory-person">
                      <span className="directory-avatar department">
                        <Icon name="building" size={20} />
                      </span>
                      <div>
                        <strong>{d.name}</strong>
                        <small>{d.code}</small>
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'facility',
                  label: 'Thuộc cơ sở',
                  render: (d) => (
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-800 border border-sky-200">
                      {d.facilityLabel || 'Cả hai cơ sở'}
                    </span>
                  ),
                },
                {
                  key: 'status',
                  label: 'Trạng thái',
                  className: 'directory-col-status',
                  render: (d) => (
                    <span
                      className={`directory-status ${
                        d.status === 'active' ? 'active' : 'inactive'
                      }`}
                    >
                      <i />
                      {d.status === 'active' ? 'Hoạt động' : 'Ngừng hoạt động'}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  label: 'Thao tác',
                  className: 'directory-col-actions',
                  render: (d) => (
                    <div className="directory-actions">
                      <button
                        className="directory-action"
                        aria-label={`Phân cơ sở cho ${d.name}`}
                        disabled={saving || changingStatus || savingFacility || !!error}
                        onClick={() => openAssignFacility(d)}
                      >
                        <Icon name="building" size={15} />
                        Phân cơ sở
                      </button>
                      <button
                        className="directory-action"
                        aria-label={`Sửa khoa/phòng ${d.name}`}
                        disabled={saving || changingStatus || savingFacility || !!error}
                        onClick={() => edit(d)}
                      >
                        <Icon name="edit" size={15} />
                        Chỉnh sửa
                      </button>
                      <button
                        className={`directory-action ${
                          d.status === 'active' ? 'danger' : 'activate'
                        }`}
                        aria-label={`${
                          d.status === 'active' ? 'Ngừng hoạt động' : 'Kích hoạt'
                        } ${d.name}`}
                        disabled={saving || changingStatus || savingFacility || !!error}
                        onClick={() => {
                          setStatusTarget(d);
                          setStatusError('');
                          setNotice('');
                        }}
                      >
                        <Icon name="power" size={15} />
                        {d.status === 'active' ? 'Ngừng' : 'Kích hoạt'}
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
          label="khoa/phòng"
          disabled={loading || saving || changingStatus || savingFacility}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </section>

      {open && (
        <Modal
          className="directory-dialog"
          title={editing ? 'Cập nhật khoa/phòng' : 'Thêm khoa/phòng'}
          busy={saving}
          onClose={() => setOpen(false)}
        >
          <DepartmentForm
            initial={editing}
            facilities={facilities}
            onSave={save}
            onClose={() => setOpen(false)}
            busy={saving}
            error={saveError}
          />
        </Modal>
      )}

      {facilityTarget && (
        <Modal
          className="directory-dialog"
          title={`Phân cơ sở trực thuộc: ${facilityTarget.name} (${facilityTarget.code})`}
          busy={savingFacility}
          onClose={() => setFacilityTarget(null)}
        >
          <div className="form-section space-y-3">
            <p className="text-sm text-slate-600">
              Chọn cơ sở mà khoa/phòng <strong>{facilityTarget.name}</strong> trực thuộc hoạt động:
            </p>
            <div className="space-y-2">
              {facilities.map((fac) => (
                <label
                  key={fac.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    facilityChoice === fac.id
                      ? 'border-sky-500 bg-sky-50/70 font-semibold text-sky-900'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="facilityChoice"
                    value={fac.id}
                    checked={facilityChoice === fac.id}
                    onChange={() => setFacilityChoice(fac.id)}
                    className="h-4 w-4 text-sky-600"
                  />
                  <span>Chỉ thuộc {fac.name}</span>
                </label>
              ))}
              {facilities.length >= 2 && (
                <label
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    facilityChoice === 'BOTH'
                      ? 'border-sky-500 bg-sky-50/70 font-semibold text-sky-900'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="facilityChoice"
                    value="BOTH"
                    checked={facilityChoice === 'BOTH'}
                    onChange={() => setFacilityChoice('BOTH')}
                    className="h-4 w-4 text-sky-600"
                  />
                  <span>
                    Cả hai cơ sở ({facilities.map((f) => f.name).join(' & ')})
                  </span>
                </label>
              )}
            </div>
            {facilityError && <Alert>{facilityError}</Alert>}
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="button"
              disabled={savingFacility}
              onClick={() => setFacilityTarget(null)}
            >
              Hủy
            </button>
            <button
              type="button"
              className="button primary"
              disabled={savingFacility}
              onClick={() => void saveAssignedFacility()}
            >
              {savingFacility ? 'Đang lưu…' : 'Lưu phân cơ sở'}
            </button>
          </div>
        </Modal>
      )}

      {statusTarget && (
        <Modal
          className="directory-dialog"
          title={
            statusTarget.status === 'active'
              ? 'Ngừng hoạt động khoa/phòng'
              : 'Kích hoạt khoa/phòng'
          }
          busy={changingStatus}
          onClose={() => setStatusTarget(null)}
        >
          <div className="form-section">
            <p>
              Bạn có chắc muốn{' '}
              {statusTarget.status === 'active' ? 'ngừng hoạt động' : 'kích hoạt'} khoa/phòng{' '}
              <strong>
                {statusTarget.name} ({statusTarget.code})
              </strong>
              ?
            </p>
            <p className="muted">
              Nhân viên và dữ liệu lịch sử được giữ nguyên. Khoa/phòng ngừng hoạt động không được
              chọn khi tạo mới nhân viên.
            </p>
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
              onClick={() => void changeStatus()}
            >
              {changingStatus
                ? 'Đang cập nhật…'
                : statusTarget.status === 'active'
                ? 'Ngừng hoạt động'
                : 'Kích hoạt'}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
