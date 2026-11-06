import { useEffect, useState, type FormEvent } from 'react';
import { employeeApi, type EmployeeInput, type UnlinkedAccount } from '../../services/employeeApi';
import type { Department } from '../../services/departmentApi';
import { roleLabels, type Role, type Employee } from '../../types/accounts';
import Alert from '../ui/Alert';

export default function EmployeeForm({
  employee,
  departments,
  onSave,
  onClose,
  busy,
  error,
}: {
  employee?: Employee;
  departments: Department[];
  onSave: (value: EmployeeInput) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  error: string;
}) {
  const [code, setCode] = useState(employee?.code || '');
  const [name, setName] = useState(employee?.name || '');
  const [email, setEmail] = useState(employee?.email || '');
  const [departmentId, setDepartmentId] = useState(employee?.departmentId || '');
  const [userId, setUserId] = useState('');
  const [unlinkedAccounts, setUnlinkedAccounts] = useState<UnlinkedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  useEffect(() => {
    if (employee) return;
    let active = true;
    async function fetchUnlinked() {
      setLoadingAccounts(true);
      try {
        const data = await employeeApi.unlinkedAccounts();
        if (active) setUnlinkedAccounts(data);
      } catch {
        // Non-blocking: unlinked accounts dropdown is optional
      } finally {
        if (active) setLoadingAccounts(false);
      }
    }
    void fetchUnlinked();
    return () => {
      active = false;
    };
  }, [employee]);

  const selectedAccount = unlinkedAccounts.find(a => a.userId === userId);

  function handleAccountSelect(selectedId: string) {
    setUserId(selectedId);
    const found = unlinkedAccounts.find(a => a.userId === selectedId);
    if (found) {
      if (found.fullName) setName(found.fullName);
      if (found.email) setEmail(found.email);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!busy) {
      void onSave({
        code: code.trim(),
        name: name.trim(),
        email: email.trim() || null,
        departmentId: departmentId || null,
        userId: userId || null,
      });
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="form-section">
        {/* Dropdown to link pre-created Admin accounts */}
        {!employee && <div style={{ marginBottom: 16, padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
          <label htmlFor="unlinked-account-select" style={{ fontWeight: 600, display: 'block', marginBottom: 6, fontSize: 13, color: '#334155' }}>
            Liên kết tài khoản do Quản trị viên (Admin) tạo trước:
          </label>
          <select
            id="unlinked-account-select"
            value={userId}
            disabled={loadingAccounts || busy}
            onChange={e => handleAccountSelect(e.target.value)}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
          >
            <option value="">-- Tạo nhân sự mới độc lập (chưa có tài khoản) --</option>
            {unlinkedAccounts.map(acc => (
              <option key={acc.userId} value={acc.userId}>
                {acc.username} {acc.fullName ? `— ${acc.fullName}` : ''} ({roleLabels[acc.role as Role] || acc.role})
              </option>
            ))}
          </select>
          {selectedAccount ? (
            <div style={{ marginTop: 8, fontSize: 13, color: '#0f766e', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>✓</span>
              <span>
                Đã chọn tài khoản <strong>{selectedAccount.username}</strong> ({roleLabels[selectedAccount.role as Role] || selectedAccount.role}). Thông tin họ tên và email đã được tự động điền.
              </span>
            </div>
          ) : unlinkedAccounts.length > 0 ? (
            <p className="field-hint" style={{ marginTop: 6, marginBottom: 0, fontSize: 12, color: '#64748b' }}>
              Có <strong>{unlinkedAccounts.length}</strong> tài khoản do Admin cấp trước đang chờ lập hồ sơ nhân sự.
            </p>
          ) : null}
        </div>}

        <div className="form-grid">
          <div>
            <label htmlFor="employee-code">
              Mã nhân viên <span className="required">*</span>
            </label>
            <input
              id="employee-code"
              required
              maxLength={20}
              placeholder="Ví dụ: BS002, NV010"
              value={code}
              onChange={e => setCode(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="employee-name">
              Họ tên <span className="required">*</span>
            </label>
            <input
              id="employee-name"
              required
              maxLength={100}
              placeholder="Nguyễn Văn A"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
        </div>

        <div className="form-grid">
          <div>
            <label htmlFor="employee-email">Email</label>
            <input
              id="employee-email"
              type="email"
              maxLength={100}
              placeholder="nguyenvana@vnc.local"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="employee-department">Khoa/phòng</label>
            <select
              id="employee-department"
              value={departmentId}
              onChange={e => setDepartmentId(e.target.value)}
            >
              <option value="">Chưa phân khoa</option>
              {departments
                .filter(d => d.status === 'active' || d.id === employee?.departmentId)
                .map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {error && <Alert>{error}</Alert>}
      </div>

      <div className="form-actions">
        <button className="button" type="button" disabled={busy} onClick={onClose}>
          Hủy
        </button>
        <button className="button primary" disabled={busy}>
          {busy ? 'Đang lưu…' : 'Lưu hồ sơ'}
        </button>
      </div>
    </form>
  );
}
