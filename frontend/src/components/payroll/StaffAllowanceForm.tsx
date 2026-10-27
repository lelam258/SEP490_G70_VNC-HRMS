import { useState, type FormEvent } from 'react';
import Alert from '../ui/Alert';
import type { StaffAllowance, SaveStaffAllowanceInput, AllowanceType } from '../../types/payroll';

export default function StaffAllowanceForm({
  initial,
  allowanceTypes,
  onSave,
  onClose,
  busy,
  error,
}: {
  initial?: StaffAllowance;
  allowanceTypes: AllowanceType[];
  onSave: (value: SaveStaffAllowanceInput) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  error: string;
}) {
  const [allowanceId, setAllowanceId] = useState<string>(
    initial?.allowanceId || (allowanceTypes[0]?.id || '')
  );
  const [valueType, setValueType] = useState<string>(initial?.valueType || 'fixed');
  const [amountValue, setAmountValue] = useState<string>(
    initial?.amountValue !== undefined ? String(initial.amountValue) : '500000'
  );
  const [effectiveFrom, setEffectiveFrom] = useState(initial?.effectiveFrom || '');
  const [effectiveTo, setEffectiveTo] = useState(initial?.effectiveTo || '');
  const [status, setStatus] = useState<string>(initial?.status || 'active');

  function onSelectAllowance(id: string) {
    setAllowanceId(id);
    const chosen = allowanceTypes.find(a => a.id === id);
    if (chosen) {
      setValueType(chosen.valueType);
      if (chosen.defaultValue) setAmountValue(String(chosen.defaultValue));
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    void onSave({
      allowanceId,
      valueType,
      amountValue: Number(amountValue),
      effectiveFrom,
      effectiveTo: effectiveTo ? effectiveTo : null,
      status,
    });
  }

  return (
    <form onSubmit={submit}>
      <div className="form-section">
        <div>
          <label htmlFor="sa-type">Loại phụ cấp *</label>
          <select
            id="sa-type"
            required
            value={allowanceId}
            onChange={e => onSelectAllowance(e.target.value)}
          >
            {allowanceTypes.map(a => (
              <option key={a.id} value={a.id}>
                {a.code} - {a.name} ({a.valueType === 'fixed' ? 'Cố định' : '%'})
              </option>
            ))}
          </select>
        </div>

        <div className="form-grid mt-4">
          <div>
            <label htmlFor="sa-valuetype">Phương thức tính *</label>
            <select
              id="sa-valuetype"
              value={valueType}
              onChange={e => setValueType(e.target.value)}
            >
              <option value="fixed">Số tiền cố định (VND)</option>
              <option value="percentage">Phần trăm (%)</option>
            </select>
          </div>
          <div>
            <label htmlFor="sa-amount">
              {valueType === 'fixed' ? 'Giá trị phụ cấp (VND) *' : 'Tỷ lệ phụ cấp (%) *'}
            </label>
            <input
              id="sa-amount"
              type="number"
              step={valueType === 'fixed' ? '1000' : '0.1'}
              min="0"
              max={valueType === 'fixed' ? undefined : '100'}
              required
              value={amountValue}
              onChange={e => setAmountValue(e.target.value)}
              placeholder={valueType === 'fixed' ? 'VD: 500000' : 'VD: 10'}
            />
          </div>
        </div>

        <div className="form-grid mt-4">
          <div>
            <label htmlFor="sa-eff-from">Hiệu lực từ ngày *</label>
            <input
              id="sa-eff-from"
              type="date"
              required
              value={effectiveFrom}
              onChange={e => setEffectiveFrom(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="sa-eff-to">Hiệu lực đến ngày</label>
            <input
              id="sa-eff-to"
              type="date"
              value={effectiveTo}
              onChange={e => setEffectiveTo(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="sa-status">Trạng thái</label>
          <select
            id="sa-status"
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="active">Hoạt động</option>
            <option value="inactive">Ngừng hoạt động</option>
          </select>
        </div>

        {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      </div>

      <div className="form-actions">
        <button className="button" type="button" disabled={busy} onClick={onClose}>
          Hủy
        </button>
        <button className="button primary" disabled={busy}>
          {busy ? 'Đang lưu…' : initial ? 'Cập nhật phụ cấp' : 'Gán phụ cấp'}
        </button>
      </div>
    </form>
  );
}
