import { useState, type FormEvent } from 'react';
import Alert from '../ui/Alert';
import type { CommissionRule, SaveCommissionRuleInput, ProcedureServiceOption } from '../../types/payroll';

export default function CommissionRuleForm({
  initial,
  services,
  onSave,
  onClose,
  busy,
  error,
}: {
  initial?: CommissionRule;
  services: ProcedureServiceOption[];
  onSave: (value: SaveCommissionRuleInput) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  error: string;
}) {
  const [serviceId, setServiceId] = useState(initial?.serviceId || (services[0]?.id || ''));
  const [role, setRole] = useState<'indicating' | 'performing' | 'assisting'>(
    initial?.role || 'performing'
  );
  const [valueType, setValueType] = useState<'fixed' | 'percent_service' | 'percent_profit'>(
    initial?.valueType || 'fixed'
  );
  const [commissionValue, setCommissionValue] = useState<string>(
    initial?.commissionValue !== undefined ? String(initial.commissionValue) : '50000'
  );
  const [effectiveFrom, setEffectiveFrom] = useState(initial?.effectiveFrom || '');
  const [effectiveTo, setEffectiveTo] = useState(initial?.effectiveTo || '');
  const [status, setStatus] = useState<'active' | 'inactive'>(initial?.status || 'active');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    void onSave({
      serviceId,
      role,
      valueType,
      commissionValue: Number(commissionValue),
      effectiveFrom,
      effectiveTo: effectiveTo ? effectiveTo : null,
      status,
    });
  }

  return (
    <form onSubmit={submit}>
      <div className="form-section">
        <div>
          <label htmlFor="comm-service">Dịch vụ thủ thuật *</label>
          <select
            id="comm-service"
            required
            value={serviceId}
            onChange={e => setServiceId(e.target.value)}
          >
            {services.map(s => (
              <option key={s.id} value={s.id}>
                {s.code} - {s.name} {s.category ? `(${s.category})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="form-grid mt-4">
          <div>
            <label htmlFor="comm-role">Vai trò tham gia *</label>
            <select
              id="comm-role"
              value={role}
              onChange={e => setRole(e.target.value as any)}
            >
              <option value="indicating">Bác sĩ chỉ định</option>
              <option value="performing">Bác sĩ thực hiện</option>
              <option value="assisting">Nhân sự phụ tá / Điều dưỡng</option>
            </select>
          </div>
          <div>
            <label htmlFor="comm-valuetype">Phương thức tính *</label>
            <select
              id="comm-valuetype"
              value={valueType}
              onChange={e => setValueType(e.target.value as any)}
            >
              <option value="fixed">Số tiền cố định (VND)</option>
              <option value="percent_service">% Doanh thu dịch vụ</option>
              <option value="percent_profit">% Lợi nhuận (sau trừ vật tư)</option>
            </select>
          </div>
        </div>

        <div className="form-grid mt-4">
          <div>
            <label htmlFor="comm-val">
              {valueType === 'fixed' ? 'Mức hoa hồng (VND) *' : 'Tỷ lệ hoa hồng (%) *'}
            </label>
            <input
              id="comm-val"
              type="number"
              step={valueType === 'fixed' ? '1000' : '0.1'}
              min="0"
              max={valueType === 'fixed' ? undefined : '100'}
              required
              value={commissionValue}
              onChange={e => setCommissionValue(e.target.value)}
              placeholder={valueType === 'fixed' ? 'VD: 50000' : 'VD: 15'}
            />
          </div>
          <div>
            <label htmlFor="comm-status">Trạng thái</label>
            <select
              id="comm-status"
              value={status}
              onChange={e => setStatus(e.target.value as any)}
            >
              <option value="active">Hoạt động</option>
              <option value="inactive">Ngừng hoạt động</option>
            </select>
          </div>
        </div>

        <div className="form-grid mt-4">
          <div>
            <label htmlFor="comm-eff-from">Hiệu lực từ ngày *</label>
            <input
              id="comm-eff-from"
              type="date"
              required
              value={effectiveFrom}
              onChange={e => setEffectiveFrom(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="comm-eff-to">Hiệu lực đến ngày</label>
            <input
              id="comm-eff-to"
              type="date"
              value={effectiveTo}
              onChange={e => setEffectiveTo(e.target.value)}
            />
          </div>
        </div>

        {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      </div>

      <div className="form-actions">
        <button className="button" type="button" disabled={busy} onClick={onClose}>
          Hủy
        </button>
        <button className="button primary" disabled={busy}>
          {busy ? 'Đang lưu…' : initial ? 'Cập nhật quy tắc' : 'Thêm quy tắc'}
        </button>
      </div>
    </form>
  );
}
