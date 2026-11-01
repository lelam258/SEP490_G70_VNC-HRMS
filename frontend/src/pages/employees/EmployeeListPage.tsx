import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { employeeApi, type EmployeeInput } from '../../services/employeeApi';
import { departmentApi, type Department } from '../../services/departmentApi';
import { useAppStore } from '../../store/useAppStore';
import type { Employee } from '../../types/accounts';
import { initials } from '../../utils/format';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import DataTable from '../../components/ui/DataTable';
import Icon from '../../components/ui/Icon';
import EmployeeForm from '../../components/employees/EmployeeForm';

export default function EmployeeListPage() {
  const navigate = useNavigate();
  const noticeFromStore = useAppStore(state => state.notice);
  const setNoticeInStore = useAppStore(state => state.setNotice);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [localNotice, setLocalNotice] = useState('');
  const [createdEmployee, setCreatedEmployee] = useState<Employee | null>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [status, setStatus] = useState('');

  const displayNotice = noticeFromStore || localNotice;

  const filtered = useMemo(() => {
    const normalize = (value: string) =>
      value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[đĐ]/g, 'd')
        .toLowerCase();
    const term = normalize(search.trim());
    return employees.filter(
      employee =>
        (!term ||
          normalize(`${employee.code} ${employee.name} ${employee.email || ''}`).includes(term)) &&
        (!departmentId || employee.departmentId === departmentId) &&
        (!status || employee.status === status)
    );
  }, [employees, search, departmentId, status]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [empList, deptList] = await Promise.all([employeeApi.list(), departmentApi.list()]);
      setEmployees(empList);
      setDepartments(deptList);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được danh sách nhân viên.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(value: EmployeeInput) {
    setSaving(true);
    setSaveError('');
    try {
      const created = await employeeApi.create(value);
      setOpen(false);
      setCreatedEmployee(created);
      setLocalNotice(`Đã thêm hồ sơ nhân viên ${created.name} (${created.code}) thành công.`);
      await load();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : 'Không lưu được hồ sơ.');
    } finally {
      setSaving(false);
    }
  }

  function clearNotice() {
    setLocalNotice('');
    setNoticeInStore('');
    setCreatedEmployee(null);
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ĐỘI NGŨ VNC CLINIC</span>
          <h1>Nhân viên</h1>
          <p className="muted">Quản lý hồ sơ nhân sự, thông tin chuyên môn và cấp quyền hệ thống.</p>
        </div>
        <button
          className="button primary"
          disabled={loading || !!error}
          onClick={() => {
            setSaveError('');
            setOpen(true);
          }}
        >
          <Icon name="plus" size={18} /> Thêm nhân viên
        </button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {displayNotice && (
        <Alert variant="success">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: 10 }}>
            <span>{displayNotice}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {createdEmployee && (
                <button
                  className="button small primary"
                  style={{ padding: '4px 12px', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => navigate(`/certificates?staffId=${createdEmployee.id}`)}
                >
                  <Icon name="award" size={14} /> Cập nhật chứng chỉ / bằng cấp ngay
                </button>
              )}
              <button className="icon-button" onClick={clearNotice} aria-label="Đóng thông báo">
                <Icon name="close" size={16} />
              </button>
            </div>
          </div>
        </Alert>
      )}

      <section className="panel">
        <div className="list-heading">
          <h2>
            Danh sách nhân viên <span className="count-badge">{employees.length}</span>
          </h2>
          <button className="text-button" disabled={loading} onClick={() => void load()}>
            Làm mới
          </button>
        </div>

        <div className="filter-bar">
          <input
            aria-label="Tìm hồ sơ nhân viên"
            placeholder="Mã nhân viên, họ tên hoặc email"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select
            aria-label="Lọc khoa/phòng"
            value={departmentId}
            onChange={e => setDepartmentId(e.target.value)}
          >
            <option value="">Tất cả khoa/phòng</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Lọc trạng thái"
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Ngừng hoạt động</option>
          </select>
        </div>

        {employees.length === 0 && !loading ? (
          <div className="empty-state">
            <Icon name="users" size={38} />
            <h3>Chưa có hồ sơ nhân viên</h3>
            <p>Bắt đầu thêm hồ sơ nhân viên đầu tiên vào hệ thống.</p>
            <button className="button primary" onClick={() => setOpen(true)}>
              <Icon name="plus" size={16} /> Thêm nhân viên
            </button>
          </div>
        ) : filtered.length === 0 && !loading ? (
          <div className="empty-state">
            <Icon name="search" size={38} />
            <h3>Không tìm thấy nhân viên</h3>
            <p>Thử từ khóa khác hoặc xóa bộ lọc.</p>
          </div>
        ) : loading ? (
          <p className="loading-state" role="status">
            Đang tải dữ liệu…
          </p>
        ) : (
          <DataTable<Employee>
            rows={filtered}
            rowKey={e => e.id}
            emptyMessage="Không có hồ sơ phù hợp."
            columns={[
              {
                key: 'code',
                label: 'Mã nhân viên',
                render: e => (
                  <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{e.code}</span>
                ),
              },
              {
                key: 'name',
                label: 'Họ tên',
                render: e => (
                  <div className="person-cell">
                    <span className="avatar small">{initials(e.name)}</span>
                    <div>
                      <button
                        className="person-name"
                        onClick={() => navigate(`/employees/${e.id}`)}
                      >
                        {e.name}
                      </button>
                      <small>{e.department}</small>
                    </div>
                  </div>
                ),
              },
              {
                key: 'email',
                label: 'Email',
                render: e => e.email || 'Chưa có',
              },
              {
                key: 'department',
                label: 'Khoa/phòng',
                render: e => e.department,
              },
              {
                key: 'status',
                label: 'Trạng thái',
                render: e => (
                  <span className={`status-badge ${e.status}`}>
                    <i />
                    {e.status === 'active' ? 'Hoạt động' : 'Ngừng hoạt động'}
                  </span>
                ),
              },
              {
                key: 'actions',
                label: 'Thao tác',
                render: e => (
                  <div className="table-actions">
                    <button
                      className="icon-button"
                      title="Xem chi tiết"
                      aria-label={`Xem hồ sơ ${e.name}`}
                      onClick={() => navigate(`/employees/${e.id}`)}
                    >
                      <Icon name="eye" size={18} />
                    </button>
                    <button
                      className="icon-button"
                      title="Chỉnh sửa"
                      aria-label={`Chỉnh sửa hồ sơ ${e.name}`}
                      onClick={() => navigate(`/employees/${e.id}/edit`)}
                    >
                      <Icon name="edit" size={18} />
                    </button>
                    <button
                      className="icon-button"
                      title="Chứng chỉ & Bằng cấp"
                      aria-label={`Quản lý chứng chỉ của ${e.name}`}
                      onClick={() => navigate(`/certificates?staffId=${e.id}`)}
                    >
                      <Icon name="award" size={18} />
                    </button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </section>

      {open && (
        <Modal title="Thêm nhân viên" busy={saving} onClose={() => setOpen(false)}>
          <EmployeeForm
            departments={departments}
            onSave={save}
            onClose={() => setOpen(false)}
            busy={saving}
            error={saveError}
          />
        </Modal>
      )}
    </section>
  );
}
