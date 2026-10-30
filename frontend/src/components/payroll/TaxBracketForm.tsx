import { useState, type FormEvent } from 'react';
import Alert from '../ui/Alert';
import type { TaxBracket, SaveTaxBracketInput } from '../../types/payroll';

export default function TaxBracketForm({
  initial,
  onSave,
  onClose,
  busy,
  error,
}: {
  initial?: TaxBracket;
  onSave: (value: SaveTaxBracketInput) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  error: string;
}) {
  const [incomeFrom, setIncomeFrom] = useState<string>(
    initial?.incomeFrom !== undefined ? String(initial.incomeFrom) : '0'
  );
  const [incomeTo, setIncomeTo] = useState<string>(
    initial?.incomeTo !== null && initial?.incomeTo !== undefined ? String(initial.incomeTo) : ''
  );
  const [taxRatePercent, setTaxRatePercent] = useState<string>(
    initial?.taxRatePercent !== undefined ? String(initial.taxRatePercent) : '5'
  );
  const [effectiveFrom, setEffectiveFrom] = useState(initial?.effectiveFrom || '');
  const [effectiveTo, setEffectiveTo] = useState(initial?.effectiveTo || '');
  const [status, setStatus] = useState<'active' | 'inactive'>(initial?.status || 'active');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const parsedTo = incomeTo.trim() === '' ? null : Number(incomeTo);
    void onSave({
      incomeFrom: Number(incomeFrom),
      incomeTo: parsedTo,
      taxRatePercent: Number(taxRatePercent),
      effectiveFrom,
      effectiveTo: effectiveTo ? effectiveTo : null,
      status,
    });
  }

  return (
    <form onSubmit={submit}>
      <div className="form-section">
        <div className="form-grid">
          <div>
            <label htmlFor="tax-from">Thu nhập từ (VND/tháng) *</label>
            <input
              id="tax-from"
              type="number"
              step="100000"
              min="0"
              required
              value={incomeFrom}
              onChange={e => setIncomeFrom(e.target.value)}
              placeholder="VD: 0"
            />
          </div>
          <div>
            <label htmlFor="tax-to">Thu nhập đến (VND/tháng)</label>
            <input
              id="tax-to"
              type="number"
              step="100000"
              min="0"
              value={incomeTo}
              onChange={e => setIncomeTo(e.target.value)}
              placeholder="Để trống nếu không giới hạn"
            />
          </div>
        </div>

        <div className="form-grid mt-4">
          <div>
            <label htmlFor="tax-rate">Thuế suất (%) *</label>
            <input
              id="tax-rate"
              type="number"
              step="0.1"
              min="0"
              max="100"
              required
              value={taxRatePercent}
              onChange={e => setTaxRatePercent(e.target.value)}
              placeholder="VD: 5"
            />
          </div>
          <div>
            <label htmlFor="tax-status">Trạng thái</label>
            <select
              id="tax-status"
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
            <label htmlFor="tax-eff-from">Hiệu lực từ ngày *</label>
            <input
              id="tax-eff-from"
              type="date"
              required
              value={effectiveFrom}
              onChange={e => setEffectiveFrom(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="tax-eff-to">Hiệu lực đến ngày</label>
            <input
              id="tax-eff-to"
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
          {busy ? 'Đang lưu…' : initial ? 'Cập nhật bậc thuế' : 'Thêm bậc thuế'}
        </button>
      </div>
    </form>
  );
}
