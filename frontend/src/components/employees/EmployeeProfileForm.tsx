import { useState, type FormEvent } from 'react';
import Icon from '../ui/Icon';
import Alert from '../ui/Alert';
import type { Department } from '../../services/departmentApi';
import type { EmployeeDetail, UpdateEmployeeInput } from '../../types/accounts';
import { formatDate, initials } from '../../utils/format';

interface EmployeeProfileFormProps {
  employee: EmployeeDetail;
  departments: Department[];
  mode: 'detail' | 'edit';
  onBack: () => void;
  onEdit?: () => void;
  onSave?: (value: UpdateEmployeeInput) => Promise<string | null>;
  busy?: boolean;
}

export default function EmployeeProfileForm({
  employee,
  departments,
  mode,
  onBack,
  onEdit,
  onSave,
  busy = false,
}: EmployeeProfileFormProps) {
  const readonly = mode === 'detail';

  const [code, setCode] = useState(employee.code || '');
  const [name, setName] = useState(employee.name || '');
  const [email, setEmail] = useState(employee.email || '');
  const [phone, setPhone] = useState(employee.phone || '');
  const [dateOfBirth, setDateOfBirth] = useState(employee.dateOfBirth || '');
  const [gender, setGender] = useState(employee.gender || '');
  const [idCardNumber, setIdCardNumber] = useState(employee.idCardNumber || '');
  const [avatarUrl, setAvatarUrl] = useState(employee.avatarUrl || '');
  const [departmentId, setDepartmentId] = useState(employee.departmentId || '');
  const [scopeOfPractice, setScopeOfPractice] = useState(employee.scopeOfPractice || '');
  const [dateJoined, setDateJoined] = useState(employee.dateJoined || '');
  const [dateLeft, setDateLeft] = useState(employee.dateLeft || '');
  const [dependentCount, setDependentCount] = useState<number>(employee.dependentCount ?? 0);
  const [status, setStatus] = useState(employee.status || 'active');

  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isDirty =
    code !== (employee.code || '') ||
    name !== (employee.name || '') ||
    email !== (employee.email || '') ||
    phone !== (employee.phone || '') ||
    dateOfBirth !== (employee.dateOfBirth || '') ||
    gender !== (employee.gender || '') ||
    idCardNumber !== (employee.idCardNumber || '') ||
    avatarUrl !== (employee.avatarUrl || '') ||
    departmentId !== (employee.departmentId || '') ||
    scopeOfPractice !== (employee.scopeOfPractice || '') ||
    dateJoined !== (employee.dateJoined || '') ||
    dateLeft !== (employee.dateLeft || '') ||
    dependentCount !== (employee.dependentCount ?? 0) ||
    status !== (employee.status || 'active');

  function handleBack() {
    if (readonly || !isDirty || window.confirm('Bạn có thay đổi chưa lưu. Bạn có chắc muốn quay lại?')) {
      onBack();
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (readonly || !onSave || busy || saving) return;

    setError('');
    const trimmedCode = code.trim();
    const trimmedName = name.trim();

    if (!trimmedCode) {
      setError('Mã nhân viên không được để trống.');
      return;
    }
    if (!trimmedName) {
      setError('Họ và tên nhân viên không được để trống.');
      return;
    }

    setSaving(true);
    try {
      const err = await onSave({
        code: trimmedCode,
        name: trimmedName,
        email: email.trim() || null,
        phone: phone.trim() || null,
        dateOfBirth: dateOfBirth || null,
        gender: gender || null,
        idCardNumber: idCardNumber.trim() || null,
        avatarUrl: avatarUrl.trim() || null,
        departmentId: departmentId || null,
        scopeOfPractice: scopeOfPractice.trim() || null,
        dateJoined: dateJoined || null,
        dateLeft: dateLeft || null,
        dependentCount: Number(dependentCount) >= 0 ? Number(dependentCount) : 0,
        status,
      });
      if (err) setError(err);
    } finally {
      setSaving(false);
    }
  }

  const currentDept = departments.find(d => d.id === departmentId);
  const departmentDisplay = currentDept?.name || employee.department || 'Chưa phân khoa';

  return (
    <section className="account-form-page">
      <button className="text-button back-button" type="button" onClick={handleBack}>
        <Icon name="arrow" size={18} /> Danh sách nhân viên
      </button>

      <div className="page-heading">
        <div>
          <span className="eyebrow">HỒ SƠ NHÂN VIÊN VNC CLINIC</span>
          <h1>{readonly ? 'Chi tiết hồ sơ nhân viên' : 'Chỉnh sửa hồ sơ nhân viên'}</h1>
          <p className="muted">
            {readonly
              ? 'Xem thông tin định danh, chuyên môn y tế và hợp đồng công tác.'
              : 'Cập nhật thông tin lý lịch cá nhân và phân khoa/phòng ban.'}
          </p>
        </div>
        {readonly && onEdit && (
          <button className="button primary" type="button" onClick={onEdit}>
            <Icon name="edit" size={18} /> Chỉnh sửa
          </button>
        )}
      </div>

      <div className="form-layout">
        <form onSubmit={handleSubmit} className="panel account-form" aria-label="Hồ sơ nhân viên">
          {/* Header Preview Banner */}
          <div className="employee-preview" style={{ margin: '20px 27px 0', border: '1px solid #dce8e5' }}>
            <span className="avatar" style={{ width: 50, height: 50, fontSize: 16 }}>
              {initials(name || employee.name)}
            </span>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <strong style={{ fontSize: 16 }}>{name || employee.name}</strong>
                <span className={`status-badge ${status}`}>
                  <i />
                  {status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                </span>
              </div>
              <span>
                Mã: <strong>{code || employee.code}</strong> · Khoa/phòng: <strong>{departmentDisplay}</strong>
              </span>
              <small>
                {scopeOfPractice ? `Chuyên môn: ${scopeOfPractice} · ` : ''}
                {email || 'Chưa có email'}
              </small>
            </div>
          </div>

          {/* Section 01: Thông tin cá nhân */}
          <div className="panel-heading divided">
            <span className="section-number">01</span>
            <div>
              <h2>Thông tin cá nhân & định danh</h2>
              <p>Mã nhân viên, họ tên và giấy tờ tùy thân của nhân sự y tế.</p>
            </div>
          </div>

          <div className="form-section">
            <div className="form-grid" style={{ marginTop: 0 }}>
              <div>
                <label htmlFor="staff-code">
                  Mã nhân viên <span className="required">*</span>
                </label>
                <input
                  id="staff-code"
                  value={code}
                  readOnly={readonly}
                  required
                  maxLength={20}
                  placeholder="Ví dụ: NV001, BS002"
                  onChange={e => setCode(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="staff-name">
                  Họ và tên <span className="required">*</span>
                </label>
                <input
                  id="staff-name"
                  value={name}
                  readOnly={readonly}
                  required
                  maxLength={100}
                  placeholder="Họ và tên đầy đủ"
                  onChange={e => setName(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid">
              <div>
                <label htmlFor="staff-gender">Giới tính</label>
                {readonly ? (
                  <input
                    id="staff-gender"
                    readOnly
                    value={gender === 'male' ? 'Nam' : gender === 'female' ? 'Nữ' : gender || 'Chưa cập nhật'}
                  />
                ) : (
                  <select id="staff-gender" value={gender} onChange={e => setGender(e.target.value)}>
                    <option value="">Chọn giới tính</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                )}
              </div>

              <div>
                <label htmlFor="staff-dob">Ngày sinh</label>
                <input
                  id="staff-dob"
                  type={readonly ? 'text' : 'date'}
                  value={readonly ? (dateOfBirth ? formatDate(dateOfBirth) : 'Chưa cập nhật') : dateOfBirth}
                  readOnly={readonly}
                  onChange={e => setDateOfBirth(e.target.value)}
                />
              </div>
            </div>

            <div className="form-grid">
              <div>
                <label htmlFor="staff-idcard">Số CCCD / CMND</label>
                <input
                  id="staff-idcard"
                  value={idCardNumber}
                  readOnly={readonly}
                  maxLength={20}
                  placeholder="Số căn cước công dân"
                  onChange={e => setIdCardNumber(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="staff-phone">Số điện thoại liên hệ</label>
                <input
                  id="staff-phone"
                  type="tel"
                  value={phone}
                  readOnly={readonly}
                  maxLength={20}
                  placeholder="0912 xxx xxx"
                  onChange={e => setPhone(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <label htmlFor="staff-email">Email công việc / liên hệ</label>
              <input
                id="staff-email"
                type="email"
                value={email}
                readOnly={readonly}
                maxLength={100}
                placeholder="email@vncclinic.vn"
                onChange={e => setEmail(e.target.value)}
              />
              <p className="field-hint">Email dùng để nhận thông báo công việc, gửi phiếu lương và khôi phục tài khoản.</p>
            </div>
          </div>

          {/* Section 02: Công tác & Chuyên môn */}
          <div className="panel-heading divided">
            <span className="section-number">02</span>
            <div>
              <h2>Công tác & Chuyên môn y tế</h2>
              <p>Khoa/phòng làm việc, phạm vi chuyên môn và thời gian công tác.</p>
            </div>
          </div>

          <div className="form-section">
            <div className="form-grid" style={{ marginTop: 0 }}>
              <div>
                <label htmlFor="staff-dept">Khoa / Phòng ban</label>
                {readonly ? (
                  <input id="staff-dept" readOnly value={departmentDisplay} />
                ) : (
                  <select id="staff-dept" value={departmentId} onChange={e => setDepartmentId(e.target.value)}>
                    <option value="">Chưa phân khoa</option>
                    {departments
                      .filter(d => d.status === 'active' || d.id === departmentId)
                      .map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} {d.status === 'inactive' ? '(Ngừng hoạt động)' : ''}
                        </option>
                      ))}
                  </select>
                )}
              </div>

              <div>
                <label htmlFor="staff-status">
                  Trạng thái công tác <span className="required">*</span>
                </label>
                {readonly ? (
                  <input
                    id="staff-status"
                    readOnly
                    value={status === 'active' ? 'Đang hoạt động' : 'Ngừng hoạt động'}
                  />
                ) : (
                  <select id="staff-status" value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="active">Đang hoạt động</option>
                    <option value="inactive">Ngừng hoạt động</option>
                  </select>
                )}
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <label htmlFor="staff-scope">Phạm vi hoạt động chuyên môn</label>
              <input
                id="staff-scope"
                value={scopeOfPractice}
                readOnly={readonly}
                maxLength={200}
                placeholder="Ví dụ: Bác sĩ Nội khoa, Điều dưỡng trưởng, Kỹ thuật viên xét nghiệm"
                onChange={e => setScopeOfPractice(e.target.value)}
              />
              <p className="field-hint">Theo chứng chỉ hành nghề hoặc quyết định phân công chuyên môn kỹ thuật.</p>
            </div>

            <div className="form-grid">
              <div>
                <label htmlFor="staff-joined">Ngày vào làm (bắt đầu công tác)</label>
                <input
                  id="staff-joined"
                  type={readonly ? 'text' : 'date'}
                  value={readonly ? (dateJoined ? formatDate(dateJoined) : 'Chưa có') : dateJoined}
                  readOnly={readonly}
                  onChange={e => setDateJoined(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="staff-left">Ngày nghỉ việc (nếu có)</label>
                <input
                  id="staff-left"
                  type={readonly ? 'text' : 'date'}
                  value={readonly ? (dateLeft ? formatDate(dateLeft) : 'Đang làm việc') : dateLeft}
                  readOnly={readonly}
                  onChange={e => setDateLeft(e.target.value)}
                />
              </div>
            </div>

            <div style={{ marginTop: 20, maxWidth: 300 }}>
              <label htmlFor="staff-dependents">Số người phụ thuộc giảm trừ gia cảnh</label>
              <input
                id="staff-dependents"
                type="number"
                min={0}
                max={20}
                value={dependentCount}
                readOnly={readonly}
                onChange={e => setDependentCount(Number(e.target.value))}
              />
              <p className="field-hint">Dùng để tính mức giảm trừ thuế TNCN trên bảng lương.</p>
            </div>
          </div>

          {/* Section 03: Siêu dữ liệu */}
          <div className="panel-heading divided">
            <span className="section-number">03</span>
            <div>
              <h2>Thông tin hệ thống</h2>
              <p>Dấu vết thời gian tạo và cập nhật hồ sơ.</p>
            </div>
          </div>

          <div className="form-section">
            <dl className="metadata" style={{ marginTop: 0, borderTop: 'none', paddingTop: 0 }}>
              <div>
                <dt>Ngày tạo hồ sơ</dt>
                <dd>{formatDate(employee.createdAt || employee.dateJoined)}</dd>
              </div>
              <div>
                <dt>Cập nhật lần cuối</dt>
                <dd>{formatDate(employee.updatedAt || employee.createdAt || employee.dateJoined)}</dd>
              </div>
            </dl>

            {error && (
              <div style={{ marginTop: 20 }}>
                <Alert variant="error">{error}</Alert>
              </div>
            )}
          </div>

          {/* Actions */}
          {!readonly && (
            <div className="form-actions">
              <button type="button" className="button" disabled={saving || busy} onClick={handleBack}>
                Hủy
              </button>
              <button type="submit" className="button primary" disabled={saving || busy}>
                <Icon name="check" size={18} />
                {saving || busy ? 'Đang lưu…' : 'Lưu thay đổi'}
              </button>
            </div>
          )}
        </form>

        <aside className="form-guide">
          <span className="guide-icon">
            <Icon name="shield" size={26} />
          </span>
          <h3>Quản lý hồ sơ nhân sự</h3>
          <p>Hồ sơ nhân viên là dữ liệu gốc của toàn bộ hệ thống quản lý nhân sự VNC Clinic.</p>
          <ul>
            <li>
              <strong>Mã nhân viên</strong> là duy nhất trong toàn hệ thống, dùng để cấp tài khoản và đồng bộ máy chấm công.
            </li>
            <li>
              <strong>Khoa/phòng</strong> xác định luồng duyệt chấm công, phân ca trực và cấu trúc sơ đồ tổ chức.
            </li>
            <li>
              <strong>Phạm vi chuyên môn</strong> giúp phòng khám kiểm soát tuân thủ chứng chỉ hành nghề và CME.
            </li>
            <li>
              <strong>Trạng thái</strong>: Chuyển sang "Ngừng hoạt động" khi nhân viên kết thúc hợp đồng để khóa các quyền nghiệp vụ liên quan.
            </li>
          </ul>
          <div className="guide-note">
            Để cấp tài khoản đăng nhập cho nhân viên mới, Quản trị viên (Administrator) sẽ liên kết hồ sơ này trong mục Quản lý tài khoản.
          </div>
        </aside>
      </div>
    </section>
  );
}
