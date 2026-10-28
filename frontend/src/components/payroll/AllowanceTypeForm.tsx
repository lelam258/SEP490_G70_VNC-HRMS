import { useState, type FormEvent } from 'react';
import Alert from '../ui/Alert';
import type { AllowanceType, SaveAllowanceTypeInput } from '../../types/payroll';

export default function AllowanceTypeForm({
  initial,
  onSave,
  onClose,
  busy,
  error,
}: {
  initial?: AllowanceType;
  onSave: (value: SaveAllowanceTypeInput) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  error: string;
}) {
  const [code, setCode] = useState(initial?.code || '');
  const [name, setName] = useState(initial?.name || '');
  const [valueType, setValueType] = useState<'fixed' | 'percentage'>(initial?.valueType || 'fixed');
  const [defaultValue, setDefaultValue] = useState<string>(
    initial?.defaultValue !== null && initial?.defaultValue !== undefined ? String(initial.defaultValue) : ''
  );
  const [appliesTo, setAppliesTo] = useState(initial?.appliesTo || 'all');
  const [isTaxable, setIsTaxable] = useState(initial?.isTaxable ?? false);
  const [isInsuranceBasis, setIsInsuranceBasis] = useState(initial?.isInsuranceBasis ?? false);
  const [status, setStatus] = useState<'active' | 'inactive'>(initial?.status || 'active');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const parsedDefault = defaultValue.trim() === '' ? null : Number(defaultValue);
    void onSave({
      code: code.trim(),
      name: name.trim(),
      valueType,
      defaultValue: parsedDefault,
      appliesTo: appliesTo.trim() || 'all',
      isTaxable,
      isInsuranceBasis,
      status,
    });
  }

  return (
    <form onSubmit={submit}>
      <div className="form-section">
        <div className="form-grid">
          <div>
            <label htmlFor="allowance-code">Mã phụ cấp *</label>
            <input
              id="allowance-code"
              required
              maxLength={30}
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="VD: AN_TRUA, TRUC_DEM"
            />
          </div>
          <div>
            <label htmlFor="allowance-name">Tên loại phụ cấp *</label>
            <input
              id="allowance-name"
              required
              maxLength={100}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="VD: Phụ cấp ăn trưa"
            />
          </div>
        </div>

        <div className="form-grid mt-4">
          <div>
            <label htmlFor="allowance-valuetype">Loại giá trị *</label>
            <select
              id="allowance-valuetype"
              value={valueType}
              onChange={e => setValueType(e.target.value as 'fixed' | 'percentage')}
            >
              <option value="fixed">Số tiền cố định (VND)</option>
              <option value="percentage">Phần trăm (%)</option>
            </select>
          </div>
          <div>
            <label htmlFor="allowance-defaultvalue">
              {valueType === 'fixed' ? 'Giá trị mặc định (VND)' : 'Tỷ lệ mặc định (%)'}
            </label>
            <input
              id="allowance-defaultvalue"
              type="number"
              step={valueType === 'fixed' ? '1000' : '0.1'}
              min="0"
              max={valueType === 'percentage' ? '100' : undefined}
              value={defaultValue}
              onChange={e => setDefaultValue(e.target.value)}
              placeholder={valueType === 'fixed' ? 'VD: 500000' : 'VD: 10'}
            />
          </div>
        </div>

        <div className="form-grid mt-4">
          <div>
            <label htmlFor="allowance-appliesto">Đối tượng áp dụng</label>
            <input
              id="allowance-appliesto"
              maxLength={50}
              value={appliesTo}
              onChange={e => setAppliesTo(e.target.value)}
              placeholder="Mặc định: all"
            />
          </div>
          <div>
            <label htmlFor="allowance-status">Trạng thái</label>
            <select
              id="allowance-status"
              value={status}
              onChange={e => setStatus(e.target.value as 'active' | 'inactive')}
            >
              <option value="active">Hoạt động</option>
              <option value="inactive">Ngừng hoạt động</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex gap-6">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isTaxable}
              onChange={e => setIsTaxable(e.target.checked)}
            />
            <span>Tính thuế TNCN</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isInsuranceBasis}
              onChange={e => setIsInsuranceBasis(e.target.checked)}
            />
            <span>Tính vào căn cứ đóng BHXH</span>
          </label>
        </div>

        {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      </div>

      <div className="form-actions">
        <button className="button" type="button" disabled={busy} onClick={onClose}>
          Hủy
        </button>
        <button className="button primary" disabled={busy}>
          {busy ? 'Đang lưu…' : initial ? 'Cập nhật phụ cấp' : 'Thêm phụ cấp'}
        </button>
      </div>
    </form>
  );
}
