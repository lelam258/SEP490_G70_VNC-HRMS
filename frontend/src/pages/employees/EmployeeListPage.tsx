import { useCallback, useEffect, useState } from 'react';
import { employeeApi, type EmployeeInput } from '../../services/employeeApi';
import { departmentApi, type Department } from '../../services/departmentApi';
import type { Employee } from '../../types/accounts';
import Alert from '../../components/ui/Alert';
import Modal from '../../components/ui/Modal';
import DataTable from '../../components/ui/DataTable';
import EmployeeForm from '../../components/employees/EmployeeForm';

export default function EmployeeListPage() {
  const [employees, setEmployees] = useState<Employee[]>([]); const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false); const [saveError, setSaveError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const [staff, teams] = await Promise.all([employeeApi.list(), departmentApi.list()]); setEmployees(staff); setDepartments(teams); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function save(value: EmployeeInput) {
    setSaving(true); setSaveError('');
    try { await employeeApi.create(value); setOpen(false); setNotice('Đã thêm hồ sơ nhân viên.'); await load(); }
    catch (cause) { setSaveError(cause instanceof Error ? cause.message : 'Không lưu được hồ sơ.'); }
    finally { setSaving(false); }
  }
  return <section><div className="page-heading"><div><span className="eyebrow">ĐỘI NGŨ VNC CLINIC</span><h1>Nhân viên</h1><p className="muted">Tạo hồ sơ nhân viên trước khi cấp tài khoản.</p></div>
    <button className="button primary" disabled={loading || !!error} onClick={() => { setSaveError(''); setOpen(true); }}>Thêm nhân viên</button></div>
    {error && <Alert>{error}</Alert>}{notice && <Alert variant="success">{notice}</Alert>}
    <section className="panel"><div className="list-heading"><h2>Danh sách nhân viên <span className="count-badge">{employees.length}</span></h2><button className="text-button" disabled={loading} onClick={() => void load()}>Làm mới</button></div>
      {loading ? <p className="loading-state" role="status">Đang tải dữ liệu…</p> : <DataTable rows={employees} rowKey={e => e.id} emptyMessage="Chưa có hồ sơ nhân viên."
        columns={[{ key: 'code', label: 'Mã nhân viên', render: e => e.code }, { key: 'name', label: 'Họ tên', render: e => e.name }, { key: 'email', label: 'Email', render: e => e.email || 'Chưa có' }, { key: 'department', label: 'Khoa/phòng', render: e => e.department }]} />}</section>
    {open && <Modal title="Thêm nhân viên" busy={saving} onClose={() => setOpen(false)}><EmployeeForm departments={departments} onSave={save} onClose={() => setOpen(false)} busy={saving} error={saveError} /></Modal>}
  </section>;
}
