import { useState, type FormEvent } from 'react';
import Alert from '../ui/Alert';
import type { InsuranceConfig, SaveInsuranceConfigInput } from '../../types/payroll';

export default function InsuranceConfigForm({
  initial,
  onSave,
  onClose,
  busy,
  error,
}: {
  initial?: InsuranceConfig;
  onSave: (value: SaveInsuranceConfigInput) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  error: string;
}) {
  const [insuranceType, setInsuranceType] = useState<'social' | 'health' | 'unemployment' | 'accident'>(
    initial?.insuranceType || 'social'
  );
  const [payer, setPayer] = useState<'employee' | 'employer'>(initial?.payer || 'employee');
  const [ratePercent, setRatePercent] = useState<string>(
    initial?.ratePercent !== undefined ? String(initial.ratePercent) : '8'
  );
  const [appliesTo, setAppliesTo] = useState(initial?.appliesTo || 'all');
  const [effectiveFrom, setEffectiveFrom] = useState(initial?.effectiveFrom || '');
  const [effectiveTo, setEffectiveTo] = useState(initial?.effectiveTo || '');
  const [status, setStatus] = useState<'active' | 'inactive'>(initial?.status || 'active');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    void onSave({
      insuranceType,
      payer,
      ratePercent: Number(ratePercent),
      appliesTo: appliesTo.trim() || 'all',
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
            <label htmlFor="ins-type">Loại bảo hiểm *</label>
            <select
              id="ins-type"
              value={insuranceType}
              onChange={e => setInsuranceType(e.target.value as any)}
            >
              <option value="social">BHXH (Bảo hiểm xã hội)</option>
              <option value="health">BHYT (Bảo hiểm y tế)</option>
              <option value="unemployment">BHTN (Bảo hiểm thất nghiệp)</option>
              <option value="accident">BHTNLĐ-BNN (Tai nạn lao động - bệnh nghề nghiệp)</option>
            </select>
          </div>
          <div>
            <label htmlFor="ins-payer">Đối tượng đóng *</label>
            <select
              id="ins-payer"
              value={payer}
              onChange={e => setPayer(e.target.value as any)}
            >
              <option value="employee">Người lao động (Khấu trừ lương)</option>
              <option value="employer">Đơn vị sử dụng lao động</option>
            </select>
          </div>
        </div>

        <div className="form-grid mt-4">
          <div>
            <label htmlFor="ins-rate">Tỷ lệ đóng (%) *</label>
            <input
              id="ins-rate"
              type="number"
              step="0.01"
              min="0"
              max="100"
              required
              value={ratePercent}
              onChange={e => setRatePercent(e.target.value)}
              placeholder="VD: 8 cho BHXH người lao động"
            />
          </div>
          <div>
            <label htmlFor="ins-appliesto">Đối tượng áp dụng</label>
            <input
              id="ins-appliesto"
              maxLength={50}
              value={appliesTo}
              onChange={e => setAppliesTo(e.target.value)}
              placeholder="Mặc định: all"
            />
          </div>
        </div>

        <div className="form-grid mt-4">
          <div>
            <label htmlFor="ins-from">Hiệu lực từ ngày *</label>
            <input
              id="ins-from"
              type="date"
              required
              value={effectiveFrom}
              onChange={e => setEffectiveFrom(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="ins-to">Hiệu lực đến ngày</label>
            <input
              id="ins-to"
              type="date"
              value={effectiveTo}
              onChange={e => setEffectiveTo(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4">
          <label htmlFor="ins-status">Trạng thái</label>
          <select
            id="ins-status"
            value={status}
            onChange={e => setStatus(e.target.value as any)}
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
          {busy ? 'Đang lưu…' : initial ? 'Cập nhật cấu hình' : 'Thêm cấu hình'}
        </button>
      </div>
    </form>
  );
}
