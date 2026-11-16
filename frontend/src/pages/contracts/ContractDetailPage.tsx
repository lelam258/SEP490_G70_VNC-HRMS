import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { contractApi } from '../../services/contractApi';
import { useAppStore } from '../../store/useAppStore';
import { contractStatusLabels, salaryTypeLabels, type ContractDetail } from '../../types/contract';
import Alert from '../../components/ui/Alert';
import Icon from '../../components/ui/Icon';
import { formatDate, formatDateOnly, formatVnd } from '../../utils/format';

const taxMethodLabels: Record<string, string> = { progressive: 'Lũy tiến từng phần', flat_10: 'Khấu trừ 10%' };

function Field({ id, label, value }: { id: string; label: string; value: string }) {
  return <div><label htmlFor={id}>{label}</label><input id={id} readOnly value={value} /></div>;
}

export default function ContractDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const notice = useAppStore(state => state.notice);
  const setNotice = useAppStore(state => state.setNotice);
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setContract(await contractApi.get(id)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Không tải được hợp đồng.'); }
    finally { setLoading(false); }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  if (loading) return <p className="loading-state" role="status">Đang tải hợp đồng…</p>;
  if (error || !contract) return (
    <div className="account-form-page">
      <Alert>{error || 'Không tìm thấy hợp đồng.'}
        <div style={{ marginTop: 12 }}>
          <button className="button" onClick={() => navigate('/contracts')}>Quay lại danh sách</button>
          <button className="button primary" style={{ marginLeft: 8 }} onClick={() => void load()}>Thử lại</button>
        </div>
      </Alert>
    </div>
  );

  const c = contract;
  return (
    <section className="account-form-page">
      <button className="text-button back-button" type="button" onClick={() => navigate('/contracts')}>
        <Icon name="arrow" size={18} /> Danh sách hợp đồng
      </button>
      <div className="page-heading">
        <div>
          <span className="eyebrow">HỢP ĐỒNG LAO ĐỘNG</span>
          <h1>Chi tiết hợp đồng</h1>
          <p className="muted">Thông tin hợp đồng, người lao động và điều khoản lương đang áp dụng.</p>
        </div>
        <button className="button primary" type="button" onClick={() => navigate(`/contracts/${c.contractId}/edit`)}>
          <Icon name="edit" size={18} /> Chỉnh sửa
        </button>
      </div>
      {notice && <Alert variant="success"><span>{notice}</span><button className="icon-button" aria-label="Đóng thông báo" onClick={() => setNotice('')}><Icon name="close" size={15} /></button></Alert>}

      <div className="panel account-form">
        <div className="employee-preview" style={{ margin: '20px 27px 0', border: '1px solid #dce8e5' }}>
          <span className="avatar" style={{ width: 50, height: 50 }}><Icon name="fileText" size={20} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 16 }}>{c.contractCode || 'Chưa có số hợp đồng'}</strong>
              <span className={`directory-status ${c.displayStatus}`}><i />{contractStatusLabels[c.displayStatus]}</span>
            </div>
            <span>{c.contractType} · {formatDateOnly(c.effectiveFrom)} – {c.effectiveTo ? formatDateOnly(c.effectiveTo) : 'Không thời hạn'}</span>
            <small>{c.staffName} · {c.staffCode}</small>
          </div>
        </div>

        <div className="panel-heading divided"><span className="section-number">01</span><div><h2>Thông tin hợp đồng</h2></div></div>
        <div className="form-section">
          <div className="form-grid" style={{ marginTop: 0 }}>
            <Field id="cd-code" label="Số hợp đồng" value={c.contractCode || '—'} />
            <Field id="cd-type" label="Loại hợp đồng" value={c.contractType} />
          </div>
          <div className="form-grid">
            <Field id="cd-from" label="Hiệu lực từ" value={formatDateOnly(c.effectiveFrom)} />
            <Field id="cd-to" label="Hiệu lực đến" value={c.effectiveTo ? formatDateOnly(c.effectiveTo) : 'Không thời hạn'} />
          </div>
        </div>

        <div className="panel-heading divided"><span className="section-number">02</span><div><h2>Người lao động</h2></div></div>
        <div className="form-section">
          <div className="form-grid" style={{ marginTop: 0 }}>
            <Field id="cd-staff" label="Nhân viên" value={`${c.staffCode} — ${c.staffName}`} />
            <Field id="cd-position" label="Chức danh" value={c.positionName || 'Chưa cập nhật'} />
          </div>
          <div className="form-grid">
            <Field id="cd-dept" label="Khoa/phòng" value={c.departmentName || 'Chưa phân khoa'} />
            <Field id="cd-site" label="Cơ sở làm việc" value={c.siteName || 'Chưa cập nhật'} />
          </div>
        </div>

        <div className="panel-heading divided"><span className="section-number">03</span><div><h2>Điều khoản lương đang áp dụng</h2><p>Điều chỉnh do Kế toán thực hiện ở màn Đãi ngộ hợp đồng.</p></div></div>
        <div className="form-section">
          <div className="form-grid" style={{ marginTop: 0 }}>
            <Field id="cd-salary-type" label="Kiểu lương" value={salaryTypeLabels[c.salaryType] || c.salaryType} />
            <Field id="cd-salary" label={c.salaryType === 'daily' ? 'Lương ngày' : 'Lương cơ bản / tháng'} value={c.salaryType === 'daily' ? formatVnd(c.dailyRate) : formatVnd(c.monthlySalary)} />
          </div>
          <div className="form-grid">
            <Field id="cd-days" label="Ngày công chuẩn" value={c.standardWorkingDays != null ? String(c.standardWorkingDays) : '—'} />
            <Field id="cd-tax" label="Cách tính thuế TNCN" value={taxMethodLabels[c.taxMethod] || c.taxMethod} />
          </div>
          <div className="form-grid">
            <Field id="cd-insurance" label="Tham gia bảo hiểm" value={c.isInsuranceEligible ? 'Có' : 'Không'} />
            <Field id="cd-insurance-basis" label="Mức lương đóng bảo hiểm" value={c.isInsuranceEligible ? formatVnd(c.insuranceSalaryBasis) : '—'} />
          </div>
        </div>

        <div className="panel-heading divided"><span className="section-number">04</span><div><h2>Bản scan & hệ thống</h2></div></div>
        <div className="form-section">
          <p>{c.fileUrl ? <a href={c.fileUrl} target="_blank" rel="noreferrer"><Icon name="file" size={15} /> Mở bản scan hợp đồng</a> : <span className="field-hint">Chưa có bản scan hợp đồng.</span>}</p>
          <dl className="metadata">
            <div><dt>Ngày tạo</dt><dd>{formatDate(c.createdAt)}</dd></div>
            <div><dt>Cập nhật lần cuối</dt><dd>{formatDate(c.updatedAt)}</dd></div>
          </dl>
        </div>
      </div>
    </section>
  );
}
