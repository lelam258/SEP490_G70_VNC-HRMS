import { useState, type FormEvent } from 'react';
import Alert from '../ui/Alert';
import type { ContractSummary, UpdateContractCompensationInput } from '../../types/payroll';

export default function ContractCompensationForm({
  contract,
  onSave,
  onClose,
  busy,
  error,
}: {
  contract: ContractSummary;
  onSave: (value: UpdateContractCompensationInput) => Promise<void>;
  onClose: () => void;
  busy: boolean;
  error: string;
}) {
  const [dailyRate, setDailyRate] = useState<string>(String(contract.dailyRate || 0));
  const [isInsuranceEligible, setIsInsuranceEligible] = useState<boolean>(contract.isInsuranceEligible);
  const [insuranceSalaryBasis, setInsuranceSalaryBasis] = useState<string>(
    contract.insuranceSalaryBasis !== null && contract.insuranceSalaryBasis !== undefined
      ? String(contract.insuranceSalaryBasis)
      : ''
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const basisNum = isInsuranceEligible && insuranceSalaryBasis.trim() !== ''
      ? Number(insuranceSalaryBasis)
      : null;

    void onSave({
      dailyRate: Number(dailyRate),
      isInsuranceEligible,
      insuranceSalaryBasis: basisNum,
    });
  }

  return (
    <form onSubmit={submit}>
      <div className="form-section">
        <div className="mb-4 rounded bg-slate-50 p-3 text-sm">
          <p><strong>Nhân viên:</strong> {contract.staffCode} - {contract.staffName}</p>
          <p><strong>Hợp đồng:</strong> {contract.contractCode || 'Chưa có mã'} ({contract.contractType})</p>
        </div>

        <div>
          <label htmlFor="comp-dailyrate">Mức lương ngày (VND) *</label>
          <input
            id="comp-dailyrate"
            type="number"
            step="1000"
            min="0"
            required
            value={dailyRate}
            onChange={e => setDailyRate(e.target.value)}
            placeholder="VD: 300000"
          />
        </div>

        <div className="mt-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isInsuranceEligible}
              onChange={e => setIsInsuranceEligible(e.target.checked)}
            />
            <span className="font-medium">Tham gia đóng bảo hiểm bắt buộc</span>
          </label>
        </div>

        {isInsuranceEligible && (
          <div className="mt-4">
            <label htmlFor="comp-insbasis">Mức lương làm căn cứ đóng bảo hiểm (VND) *</label>
            <input
              id="comp-insbasis"
              type="number"
              step="1000"
              min="1"
              required={isInsuranceEligible}
              value={insuranceSalaryBasis}
              onChange={e => setInsuranceSalaryBasis(e.target.value)}
              placeholder="VD: 5000000"
            />
            <small className="text-slate-500">
              Lương đóng BHXH, BHYT, BHTN theo thỏa thuận hợp đồng
            </small>
          </div>
        )}

        {error && <div className="mt-4"><Alert>{error}</Alert></div>}
      </div>

      <div className="form-actions">
        <button className="button" type="button" disabled={busy} onClick={onClose}>
          Hủy
        </button>
        <button className="button primary" disabled={busy}>
          {busy ? 'Đang lưu…' : 'Lưu đãi ngộ'}
        </button>
      </div>
    </form>
  );
}
