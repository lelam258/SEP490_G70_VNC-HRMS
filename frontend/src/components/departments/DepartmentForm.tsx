import { useState, type FormEvent } from 'react';
import type { FacilityOption } from '../../services/departmentApi';
import Alert from '../ui/Alert';

export default function DepartmentForm({
  initial,
  facilities = [],
  onSave,
  onClose,
  busy,
  error,
}: {
  initial?: { code: string; name: string; status: string; facilityIds?: string[] };
  facilities?: FacilityOption[];
  onSave: (value: { code: string; name: string; status: string; facilityIds?: string[] }) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  error: string;
}) {
  const [code, setCode] = useState(initial?.code || '');
  const [name, setName] = useState(initial?.name || '');
  const [status, setStatus] = useState(initial?.status || 'active');

  const allFacIds = facilities.map((f) => f.id);
  const initialSelection =
    initial?.facilityIds && initial.facilityIds.length > 0
      ? initial.facilityIds.length >= allFacIds.length && allFacIds.length >= 2
        ? 'BOTH'
        : initial.facilityIds[0]
      : 'BOTH';

  const [facilityChoice, setFacilityChoice] = useState<string>(initialSelection);
  const [validationError, setValidationError] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!code.trim() || !name.trim()) {
      setValidationError('Mã và tên khoa/phòng không được để trống.');
      return;
    }
    setValidationError('');
    const resolvedFacilityIds =
      facilities.length === 0
        ? undefined
        : facilityChoice === 'BOTH'
        ? allFacIds
        : [facilityChoice];
    if (!busy) void onSave({ code: code.trim(), name: name.trim(), status, facilityIds: resolvedFacilityIds });
  }

  return (
    <form onSubmit={submit}>
      <div className="form-section">
        <div className="form-grid">
          <div>
            <label htmlFor="department-code">Mã khoa/phòng</label>
            <input
              id="department-code"
              required
              maxLength={20}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="department-name">Tên khoa/phòng</label>
            <input
              id="department-name"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        {facilities.length > 0 && (
          <div className="mt-4">
            <label htmlFor="department-facility">Thuộc cơ sở</label>
            <select
              id="department-facility"
              value={facilityChoice}
              onChange={(e) => setFacilityChoice(e.target.value)}
            >
              {facilities.length >= 2 && (
                <option value="BOTH">
                  Cả hai ({facilities.map((f) => f.name).join(' & ')})
                </option>
              )}
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  Chỉ thuộc {f.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {initial && (
          <div className="mt-4">
            <label htmlFor="department-status">Trạng thái</label>
            <select
              id="department-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="active">Hoạt động</option>
              <option value="inactive">Ngừng hoạt động</option>
            </select>
          </div>
        )}
        {(validationError || error) && <Alert>{validationError || error}</Alert>}
      </div>
      <div className="form-actions">
        <button className="button" type="button" disabled={busy} onClick={onClose}>
          Hủy
        </button>
        <button className="button primary" disabled={busy}>
          {busy ? 'Đang lưu…' : 'Lưu khoa/phòng'}
        </button>
      </div>
    </form>
  );
}
