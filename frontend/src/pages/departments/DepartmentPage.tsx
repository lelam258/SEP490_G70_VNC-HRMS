import { useCallback, useEffect, useState } from 'react';
import { departmentApi, type Department } from '../../services/departmentApi';
import Alert from '../../components/ui/Alert';
import DataTable from '../../components/ui/DataTable';
import Modal from '../../components/ui/Modal';
import DepartmentForm from '../../components/departments/DepartmentForm';

export default function DepartmentPage() {
  const [departments, setDepartments] = useState<Department[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [notice, setNotice] = useState(''); const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false); const [saveError, setSaveError] = useState('');
  const [editing, setEditing] = useState<Department | undefined>();
  const [statusTarget, setStatusTarget] = useState<Department | null>(null);
  const [statusError, setStatusError] = useState('');
  const [changingStatus, setChangingStatus] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setDepartments(await departmentApi.list()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được khoa/phòng.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function save(value: { code: string; name: string; status: string }) {
    setSaving(true); setSaveError('');
    try { if (editing) await departmentApi.update(editing.id, value); else await departmentApi.create(value); setOpen(false); setNotice('Đã lưu khoa/phòng.'); await load(); }
    catch (cause) { setSaveError(cause instanceof Error ? cause.message : 'Không lưu được khoa/phòng.'); }
    finally { setSaving(false); }
  }
  async function changeStatus() {
    if (!statusTarget || changingStatus) return;
    setChangingStatus(true); setStatusError(''); setNotice('');
    try {
      await departmentApi.setStatus(statusTarget.id, statusTarget.status === 'active' ? 'inactive' : 'active');
      setStatusTarget(null); setNotice(statusTarget.status === 'active' ? 'Đã ngừng hoạt động khoa/phòng.' : 'Đã kích hoạt khoa/phòng.'); await load();
    } catch (cause) { setStatusError(cause instanceof Error ? cause.message : 'Không cập nhật được trạng thái khoa/phòng.'); }
    finally { setChangingStatus(false); }
  }
  return <section><div className="page-heading"><div><span className="eyebrow">TỔ CHỨC VNC CLINIC</span><h1>Khoa/phòng</h1><p className="muted">Quản lý các đơn vị trong phòng khám.</p></div>
    <button className="button primary" disabled={loading || !!error} onClick={() => { setEditing(undefined); setSaveError(''); setOpen(true); }}>Thêm khoa/phòng</button></div>
    {error && <Alert>{error}</Alert>}{notice && <Alert variant="success">{notice}</Alert>}
    <section className="panel"><div className="list-heading"><h2>Danh sách khoa/phòng <span className="count-badge">{departments.length}</span></h2><button className="text-button" disabled={loading} onClick={() => void load()}>Làm mới</button></div>
      {loading ? <p className="loading-state" role="status">Đang tải dữ liệu…</p> : <DataTable rows={departments} rowKey={d => d.id} emptyMessage="Chưa có khoa/phòng."
        columns={[{ key: 'code', label: 'Mã', render: d => d.code }, { key: 'name', label: 'Tên khoa/phòng', render: d => d.name }, { key: 'status', label: 'Trạng thái', render: d => d.status === 'active' ? 'Hoạt động' : 'Ngừng hoạt động' }, { key: 'actions', label: 'Thao tác', render: d => <div className="flex items-center gap-4"><button className="text-button" onClick={() => { setEditing(d); setSaveError(''); setOpen(true); }}>Chỉnh sửa</button><button className="text-button" onClick={() => { setStatusTarget(d); setStatusError(''); setNotice(''); }}>{d.status === 'active' ? 'Ngừng hoạt động' : 'Kích hoạt'}</button></div> }]} />}</section>
    {open && <Modal title={editing ? 'Cập nhật khoa/phòng' : 'Thêm khoa/phòng'} busy={saving} onClose={() => setOpen(false)}><DepartmentForm initial={editing} onSave={save} onClose={() => setOpen(false)} busy={saving} error={saveError} /></Modal>}
    {statusTarget && <Modal title={statusTarget.status === 'active' ? 'Ngừng hoạt động khoa/phòng' : 'Kích hoạt khoa/phòng'} busy={changingStatus} onClose={() => setStatusTarget(null)}>
      <div className="form-section"><p>Bạn có chắc muốn {statusTarget.status === 'active' ? 'ngừng hoạt động' : 'kích hoạt'} khoa/phòng <strong>{statusTarget.name} ({statusTarget.code})</strong>?</p>
        <p className="muted">Nhân viên và dữ liệu lịch sử được giữ nguyên. Khoa/phòng ngừng hoạt động không được chọn khi tạo mới nhân viên.</p>
        {statusError && <Alert>{statusError}</Alert>}</div>
      <div className="form-actions"><button type="button" className="button" disabled={changingStatus} onClick={() => setStatusTarget(null)}>Hủy</button><button type="button" className="button primary" disabled={changingStatus} onClick={() => void changeStatus()}>{changingStatus ? 'Đang cập nhật…' : statusTarget.status === 'active' ? 'Ngừng hoạt động' : 'Kích hoạt'}</button></div>
    </Modal>}
  </section>;
}
