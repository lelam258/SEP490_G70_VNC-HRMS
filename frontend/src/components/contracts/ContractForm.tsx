import { useState, type ChangeEvent, type FormEvent } from 'react';
import Icon from '../ui/Icon';
import Alert from '../ui/Alert';
import MoneyInput from '../ui/MoneyInput';
import { fileApi } from '../../services/fileApi';
import type { Employee } from '../../types/accounts';
import {
  CONTRACT_TYPES, isIndefiniteContract, salaryTypeLabels,
  type ContractDetail, type CreateContractInput, type UpdateContractInput,
} from '../../types/contract';
import { formatVnd } from '../../utils/format';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_FILES = '.pdf,.png,.jpg,.jpeg';

type Props =
  | { mode: 'create'; employees: Employee[]; contract?: undefined; onSave: (value: CreateContractInput) => Promise<string | null>; onBack: () => void }
  | { mode: 'edit'; contract: ContractDetail; employees?: undefined; onSave: (value: UpdateContractInput) => Promise<string | null>; onBack: () => void };

/** Create (task 21) and edit (task 23) form. Salary is only set at creation; later changes go through compensation settings. */
export default function ContractForm(props: Props) {
  const { mode, contract, onBack } = props;
  const isCreate = mode === 'create';
  const initialType = contract?.contractType || CONTRACT_TYPES[0];

  const [staffId, setStaffId] = useState('');
  const [contractCode, setContractCode] = useState(contract?.contractCode || '');
  const [contractType, setContractType] = useState(initialType);
  const [salaryType, setSalaryType] = useState('monthly');
  const [baseSalary, setBaseSalary] = useState<number | null>(null);
  const [standardWorkingDays, setStandardWorkingDays] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(contract?.effectiveFrom || '');
  const [effectiveTo, setEffectiveTo] = useState(contract?.effectiveTo || '');
  const [status, setStatus] = useState(contract?.status || 'active');
  const [fileUrl, setFileUrl] = useState(contract?.fileUrl || '');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const indefinite = isIndefiniteContract(contractType);
  const typeOptions = CONTRACT_TYPES.includes(initialType as typeof CONTRACT_TYPES[number]) ? [...CONTRACT_TYPES] : [initialType, ...CONTRACT_TYPES];
  const activeEmployees = props.employees?.filter(e => e.status === 'active') || [];
  const isDirty = isCreate
    ? !!(staffId || contractCode || baseSalary || effectiveFrom || effectiveTo || fileUrl)
    : contractCode !== (contract.contractCode || '') || contractType !== contract.contractType || effectiveFrom !== contract.effectiveFrom
      || effectiveTo !== (contract.effectiveTo || '') || status !== contract.status || fileUrl !== (contract.fileUrl || '');

  function handleBack() {
    if (!isDirty || window.confirm('Bạn có thay đổi chưa lưu. Bạn có chắc muốn quay lại?')) onBack();
  }

  function changeType(value: string) {
    setContractType(value);
    if (isIndefiniteContract(value)) setEffectiveTo('');
  }

  async function uploadFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/\.(pdf|png|jpe?g)$/i.test(file.name) || file.size > MAX_FILE_BYTES) {
      setError('Tệp hợp đồng phải là PDF, PNG hoặc JPG và không quá 10 MB.');
      return;
    }
    setUploading(true); setError('');
    try { setFileUrl((await fileApi.upload(file)).url); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được tệp hợp đồng.'); }
    finally { setUploading(false); }
  }

  function validate() {
    if (isCreate && !staffId) return 'Vui lòng chọn nhân viên.';
    if (!contractCode.trim()) return 'Số hợp đồng là bắt buộc.';
    if (!effectiveFrom) return 'Ngày bắt đầu hiệu lực là bắt buộc.';
    if (!indefinite && !effectiveTo) return 'Hợp đồng có thời hạn phải có ngày kết thúc.';
    if (effectiveTo && effectiveTo < effectiveFrom) return 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.';
    if (isCreate && (!baseSalary || baseSalary <= 0)) return 'Mức lương cơ bản phải lớn hơn 0.';
    const days = Number(standardWorkingDays);
    if (isCreate && standardWorkingDays && (!(days > 0) || days > 31)) return 'Số ngày công chuẩn phải từ 1 đến 31.';
    return '';
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving || uploading) return;
    const invalid = validate();
    if (invalid) { setError(invalid); return; }
    setSaving(true); setError('');
    try {
      const common = { contractCode: contractCode.trim(), contractType, effectiveFrom, effectiveTo: indefinite ? null : effectiveTo || null, fileUrl: fileUrl || null };
      const err = props.mode === 'create'
        ? await props.onSave({ ...common, staffId, salaryType, baseSalary: baseSalary!, standardWorkingDays: standardWorkingDays ? Number(standardWorkingDays) : null })
        : await props.onSave({ ...common, status });
      if (err) setError(err);
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || uploading;
  return (
    <section className="account-form-page">
      <button className="text-button back-button" type="button" onClick={handleBack}>
        <Icon name="arrow" size={18} /> {isCreate ? 'Danh sách hợp đồng' : 'Chi tiết hợp đồng'}
      </button>
      <div className="page-heading">
        <div>
          <span className="eyebrow">HỢP ĐỒNG LAO ĐỘNG</span>
          <h1>{isCreate ? 'Tạo hợp đồng' : 'Chỉnh sửa hợp đồng'}</h1>
          <p className="muted">{isCreate ? 'Nhập thông tin theo hợp đồng lao động đã ký.' : `${contract.staffName} · ${contract.staffCode}`}</p>
        </div>
      </div>

      <div className="form-layout">
        <form onSubmit={handleSubmit} className="panel account-form" aria-label={isCreate ? 'Tạo hợp đồng' : 'Chỉnh sửa hợp đồng'} noValidate>
          <div className="panel-heading divided">
            <span className="section-number">01</span>
            <div><h2>Thông tin hợp đồng</h2><p>Người lao động, số hợp đồng, loại và thời hạn.</p></div>
          </div>
          <div className="form-section">
            <div className="form-grid" style={{ marginTop: 0 }}>
              <div>
                <label htmlFor="contract-staff">Nhân viên {isCreate && <span className="required">*</span>}</label>
                {isCreate ? (
                  <select id="contract-staff" value={staffId} required onChange={e => setStaffId(e.target.value)}>
                    <option value="">Chọn nhân viên</option>
                    {activeEmployees.map(e => <option key={e.id} value={e.id}>{e.code} — {e.name}</option>)}
                  </select>
                ) : (
                  <input id="contract-staff" readOnly value={`${contract.staffCode} — ${contract.staffName}`} />
                )}
              </div>
              <div>
                <label htmlFor="contract-code">Số hợp đồng <span className="required">*</span></label>
                <input id="contract-code" value={contractCode} required maxLength={30} placeholder="Ví dụ: 0925/HĐLĐ-VN" onChange={e => setContractCode(e.target.value)} />
              </div>
            </div>
            <div className="form-grid">
              <div>
                <label htmlFor="contract-type">Loại hợp đồng <span className="required">*</span></label>
                <select id="contract-type" value={contractType} onChange={e => changeType(e.target.value)}>
                  {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {!isCreate && (
                <div>
                  <label htmlFor="contract-status">Trạng thái <span className="required">*</span></label>
                  <select id="contract-status" value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="active">Đang áp dụng</option>
                    <option value="inactive">Ngừng hiệu lực</option>
                  </select>
                </div>
              )}
            </div>
            <div className="form-grid">
              <div>
                <label htmlFor="contract-from">Hiệu lực từ <span className="required">*</span></label>
                <input id="contract-from" type="date" value={effectiveFrom} required onChange={e => setEffectiveFrom(e.target.value)} />
              </div>
              <div>
                <label htmlFor="contract-to">Hiệu lực đến {!indefinite && <span className="required">*</span>}</label>
                <input id="contract-to" type="date" value={indefinite ? '' : effectiveTo} min={effectiveFrom || undefined} disabled={indefinite} onChange={e => setEffectiveTo(e.target.value)} />
                {indefinite && <p className="field-hint">Hợp đồng không xác định thời hạn không có ngày kết thúc.</p>}
              </div>
            </div>
          </div>

          <div className="panel-heading divided">
            <span className="section-number">02</span>
            <div><h2>Mức lương thỏa thuận</h2><p>{isCreate ? 'Mức lương cơ bản ghi trên hợp đồng.' : 'Điều chỉnh lương do Kế toán thực hiện ở màn Đãi ngộ hợp đồng.'}</p></div>
          </div>
          <div className="form-section">
            {isCreate ? (
              <div className="form-grid" style={{ marginTop: 0 }}>
                <div>
                  <label htmlFor="contract-salary-type">Kiểu lương <span className="required">*</span></label>
                  <select id="contract-salary-type" value={salaryType} onChange={e => setSalaryType(e.target.value)}>
                    <option value="monthly">{salaryTypeLabels.monthly}</option>
                    <option value="daily">{salaryTypeLabels.daily}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="contract-base-salary">{salaryType === 'daily' ? 'Lương ngày' : 'Lương cơ bản / tháng'} <span className="required">*</span></label>
                  <MoneyInput id="contract-base-salary" value={baseSalary} onChange={setBaseSalary} placeholder="Ví dụ: 4.718.700" />
                </div>
                <div>
                  <label htmlFor="contract-standard-days">Ngày công chuẩn</label>
                  <input id="contract-standard-days" type="number" min={1} max={31} step="0.5" value={standardWorkingDays} placeholder="Theo cấu hình (mặc định 26)" onChange={e => setStandardWorkingDays(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="form-grid" style={{ marginTop: 0 }}>
                <div>
                  <label htmlFor="contract-salary-readonly">Kiểu lương</label>
                  <input id="contract-salary-readonly" readOnly value={salaryTypeLabels[contract.salaryType] || contract.salaryType} />
                </div>
                <div>
                  <label htmlFor="contract-amount-readonly">Mức lương hiện tại</label>
                  <input id="contract-amount-readonly" readOnly value={contract.salaryType === 'daily' ? `${formatVnd(contract.dailyRate)} / ngày` : `${formatVnd(contract.monthlySalary)} / tháng`} />
                </div>
              </div>
            )}
          </div>

          <div className="panel-heading divided">
            <span className="section-number">03</span>
            <div><h2>Bản scan hợp đồng</h2><p>Bản hợp đồng đã ký, định dạng PDF, PNG hoặc JPG, tối đa 10 MB.</p></div>
          </div>
          <div className="form-section">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <label className="button" htmlFor="contract-file" style={{ margin: 0 }}>
                <Icon name="file" size={16} />{uploading ? 'Đang tải lên…' : fileUrl ? 'Thay tệp' : 'Chọn tệp'}
              </label>
              <input id="contract-file" type="file" accept={ACCEPTED_FILES} disabled={busy} onChange={uploadFile} style={{ display: 'none' }} />
              {fileUrl
                ? <><a href={fileUrl} target="_blank" rel="noreferrer">Xem tệp đã tải</a><button type="button" className="text-button" disabled={busy} onClick={() => setFileUrl('')}>Gỡ tệp</button></>
                : <span className="field-hint">Chưa có tệp</span>}
            </div>
            {error && <div style={{ marginTop: 20 }}><Alert variant="error">{error}</Alert></div>}
          </div>

          <div className="form-actions">
            <button type="button" className="button" disabled={busy} onClick={handleBack}>Hủy</button>
            <button type="submit" className="button primary" disabled={busy}>
              <Icon name="check" size={18} />{saving ? 'Đang lưu…' : isCreate ? 'Tạo hợp đồng' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>

        <aside className="form-guide">
          <span className="guide-icon"><Icon name="fileText" size={26} /></span>
          <h3>Quy tắc hợp đồng</h3>
          <ul>
            <li><strong>Số hợp đồng</strong> là duy nhất trong hệ thống.</li>
            <li>Mỗi nhân viên chỉ có <strong>một hợp đồng đang áp dụng</strong> tại một thời điểm; thời hạn không được chồng lấn.</li>
            <li>Hợp đồng <strong>không xác định thời hạn</strong> không có ngày kết thúc; các loại khác bắt buộc có.</li>
            <li>Hợp đồng đã dùng để tính kỳ lương đã khóa không được đổi ngày bắt đầu hoặc rút ngắn qua tháng đó.</li>
          </ul>
          <div className="guide-note">Bảo hiểm, thuế, phụ cấp và điều chỉnh lương được Kế toán cấu hình ở màn Đãi ngộ hợp đồng.</div>
        </aside>
      </div>
    </section>
  );
}
