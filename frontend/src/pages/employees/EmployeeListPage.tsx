import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { employeeApi, type EmployeeInput } from '../../services/employeeApi';
import { departmentApi, type Department } from '../../services/departmentApi';
import type { Employee, EmployeeDetail } from '../../types/accounts';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import DataTable from '../../components/ui/DataTable';
import EmployeeForm from '../../components/employees/EmployeeForm';
import Icon from '../../components/ui/Icon';
import Pagination from '../../components/ui/Pagination';
import usePagination from '../../hooks/usePagination';
import { initials, normalize } from '../../utils/format';

export default function EmployeeListPage() {
  const navigate = useNavigate();
  const storeNotice = useAppStore(state => state.notice);
  const clearStoreNotice = useAppStore(state => state.setNotice);
  const [createdEmployee, setCreatedEmployee] = useState<Employee>();
  const [loadingEmployee, setLoadingEmployee] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]); const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false); const [saveError, setSaveError] = useState('');
  const [editing, setEditing] = useState<EmployeeDetail>();
  const [search, setSearch] = useState(''); const [departmentId, setDepartmentId] = useState(''); const [status, setStatus] = useState('');
  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    return employees.filter(employee => (!term || normalize(`${employee.code} ${employee.name} ${employee.email || ''}`).includes(term))
      && (!departmentId || employee.departmentId === departmentId) && (!status || employee.status === status));
  }, [employees, search, departmentId, status]);
  const pagination = usePagination(filtered);
  const hasFilters = !!(search || departmentId || status);
  function resetFilters() { setSearch(''); setDepartmentId(''); setStatus(''); pagination.resetPage(); }
  async function edit(employee?: Employee) {
    setSaveError('');
    if (!employee) { setEditing(undefined); setOpen(true); return; }
    setLoadingEmployee(true);
    try { setEditing(await employeeApi.get(employee.id)); setOpen(true); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được hồ sơ nhân viên.'); }
    finally { setLoadingEmployee(false); }
  }
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const [staff, teams] = await Promise.all([employeeApi.list(), departmentApi.list()]); setEmployees(staff); setDepartments(teams); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function save(value: EmployeeInput) {
    setSaving(true); setSaveError('');
    try { if (editing) await employeeApi.update(editing.id, { ...editing, ...value, status: editing.status }); else setCreatedEmployee(await employeeApi.create(value)); setOpen(false); setNotice(editing ? 'Đã cập nhật hồ sơ và khoa/phòng nhân viên.' : 'Đã thêm hồ sơ nhân viên.'); await load(); }
    catch (cause) { setSaveError(cause instanceof Error ? cause.message : 'Không lưu được hồ sơ.'); }
    finally { setSaving(false); }
  }
  return <section className="directory-page" aria-labelledby="employee-page-title"><header className="directory-heading"><div><span className="eyebrow">QUẢN LÝ NHÂN SỰ</span><h1 id="employee-page-title">Nhân viên</h1><p>Quản lý hồ sơ và khoa/phòng của đội ngũ phòng khám.</p></div>
    <button className="button primary" disabled={loading || saving || loadingEmployee || !!error} onClick={() => edit()}><Icon name="plus" size={17} />Thêm nhân viên</button></header>
    {error && <Alert>{error}</Alert>}{(notice || storeNotice) && <Alert variant="success"><span>{notice || storeNotice}</span>{createdEmployee && <button className="directory-action" onClick={() => navigate(`/certificates?staffId=${createdEmployee.id}`)}><Icon name="award" size={15} />Cập nhật chứng chỉ</button>}<button className="icon-button" aria-label="Đóng thông báo" onClick={() => { setNotice(''); clearStoreNotice(''); setCreatedEmployee(undefined); }}><Icon name="close" size={15} /></button></Alert>}
    <section className="directory-panel" aria-label="Danh sách nhân viên" aria-busy={loading}><div className="directory-panel-heading"><div><h2>Danh sách nhân viên <span>{loading ? '—' : employees.length}</span></h2><p>{loading ? 'Đang tải hồ sơ' : `${employees.filter(e => e.status === 'active').length} đang làm việc · ${employees.filter(e => !e.departmentId).length} chưa phân khoa`}</p></div><button className="directory-refresh" disabled={loading || saving} onClick={() => void load()}><Icon name="refresh" size={15} />Làm mới</button></div>
      <div className="directory-filters"><label className="directory-search" htmlFor="employee-search">Tìm nhân viên<span><Icon name="search" size={17} /><input id="employee-search" type="search" placeholder="Họ tên, mã nhân viên hoặc email…" value={search} onChange={e => { setSearch(e.target.value); pagination.resetPage(); }} /></span></label>
        <label htmlFor="employee-filter-department">Khoa/phòng<select id="employee-filter-department" value={departmentId} onChange={e => { setDepartmentId(e.target.value); pagination.resetPage(); }}><option value="">Tất cả khoa/phòng</option>{departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}</select></label>
        <label htmlFor="employee-filter-status">Trạng thái<select id="employee-filter-status" value={status} onChange={e => { setStatus(e.target.value); pagination.resetPage(); }}><option value="">Tất cả trạng thái</option><option value="active">Đang làm việc</option><option value="inactive">Ngừng hoạt động</option></select></label></div>
      {hasFilters && <div className="directory-filter-summary"><span><strong>{filtered.length}</strong> hồ sơ phù hợp</span><button type="button" onClick={resetFilters}>Xóa bộ lọc<Icon name="close" size={13} /></button></div>}
      <div className="directory-table">{loading ? <p className="directory-loading" role="status">Đang tải danh sách nhân viên…</p> : <DataTable rows={pagination.visible} rowKey={e => e.id} caption="Danh sách hồ sơ nhân viên" emptyMessage="Không có hồ sơ phù hợp."
        emptyState={<div className="directory-empty"><span><Icon name="users" size={28} /></span><h3>{hasFilters ? 'Không tìm thấy nhân viên' : 'Chưa có hồ sơ nhân viên'}</h3><p>{hasFilters ? 'Thử từ khóa khác hoặc thay đổi khoa/phòng, trạng thái.' : 'Thêm hồ sơ đầu tiên để bắt đầu quản lý đội ngũ.'}</p>{hasFilters && <button type="button" className="button" onClick={resetFilters}>Xóa bộ lọc</button>}</div>}
        columns={[{ key: 'person', label: 'Nhân viên', className: 'directory-col-person', render: e => <div className="directory-person"><span className={`directory-avatar tone-${employees.indexOf(e) % 4}`}>{initials(e.name)}</span><div><button type="button" className="directory-person-link" onClick={() => navigate(`/employees/${e.id}`)} aria-label={`Xem hồ sơ ${e.name}`}>{e.name}</button><small>{e.code}</small></div></div> },
          { key: 'department', label: 'Khoa/phòng', className: 'directory-col-department', render: e => <span className={e.departmentId ? 'directory-department' : 'directory-secondary'}>{e.department || 'Chưa phân khoa'}</span> },
          { key: 'email', label: 'Email', className: 'directory-col-email', render: e => e.email ? <span>{e.email}</span> : <span className="directory-secondary">Chưa cập nhật</span> },
          { key: 'status', label: 'Trạng thái', className: 'directory-col-status', render: e => <span className={`directory-status ${e.status === 'active' ? 'active' : 'inactive'}`}><i />{e.status === 'active' ? 'Đang làm việc' : e.status === 'inactive' ? 'Ngừng hoạt động' : e.status}</span> },
          { key: 'actions', label: 'Thao tác', className: 'directory-col-actions', render: e => <button className="directory-action" aria-label={`Sửa hồ sơ ${e.name}`} disabled={saving || loadingEmployee || !!error} onClick={() => edit(e)}><Icon name="edit" size={15} />Chỉnh sửa</button> }]} />}</div>
      <Pagination total={filtered.length} page={pagination.page} pageSize={pagination.pageSize} label="nhân viên" disabled={loading || saving} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize} />
    </section>
    {open && <Modal className="directory-dialog" title={editing ? 'Chỉnh sửa nhân viên' : 'Thêm nhân viên'} busy={saving} onClose={() => setOpen(false)}><EmployeeForm employee={editing} departments={departments} onSave={save} onClose={() => setOpen(false)} busy={saving} error={saveError} /></Modal>}
  </section>;
}
