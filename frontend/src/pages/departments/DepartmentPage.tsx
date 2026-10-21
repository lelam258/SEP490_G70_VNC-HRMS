import { useCallback, useEffect, useState } from 'react';
import { departmentApi, type Department } from '../../services/departmentApi';
import Alert from '../../components/ui/Alert';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import DepartmentForm from '../../components/departments/DepartmentForm';

export default function DepartmentPage() {
  const [departments, setDepartments] = useState<Department[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [notice, setNotice] = useState(''); const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false); const [saveError, setSaveError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setDepartments(await departmentApi.list()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được khoa/phòng.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function save(value: { code: string; name: string }) {
    setSaving(true); setSaveError('');
    try { await departmentApi.create(value); setOpen(false); setNotice('Đã thêm khoa/phòng.'); await load(); }
    catch (cause) { setSaveError(cause instanceof Error ? cause.message : 'Không lưu được khoa/phòng.'); }
    finally { setSaving(false); }
  }
  return <section><div className="page-heading"><div><span className="eyebrow">TỔ CHỨC VNC CLINIC</span><h1>Khoa/phòng</h1><p className="muted">Quản lý các đơn vị trong phòng khám.</p></div>
    <button className="button primary" disabled={loading || !!error} onClick={() => { setSaveError(''); setOpen(true); }}>Thêm khoa/phòng</button></div>
    {error && <Alert>{error}</Alert>}{notice && <Alert variant="success">{notice}</Alert>}
    <section className="panel"><div className="list-heading"><h2>Danh sách khoa/phòng <span className="count-badge">{departments.length}</span></h2><button className="text-button" disabled={loading} onClick={() => void load()}>Làm mới</button></div>
      {loading ? <p className="loading-state" role="status">Đang tải dữ liệu…</p> : <DataTable rows={departments} rowKey={d => d.id} emptyMessage="Chưa có khoa/phòng."
        columns={[{ key: 'code', label: 'Mã', render: d => d.code }, { key: 'name', label: 'Tên khoa/phòng', render: d => d.name }, { key: 'status', label: 'Trạng thái', render: d => d.status === 'active' ? 'Hoạt động' : 'Ngừng hoạt động' }]} />}</section>
    {open && <Modal title="Thêm khoa/phòng" busy={saving} onClose={() => setOpen(false)}><DepartmentForm onSave={save} onClose={() => setOpen(false)} busy={saving} error={saveError} /></Modal>}
  </section>;
}
