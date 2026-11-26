import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '../../components/ui/Alert';
import Icon from '../../components/ui/Icon';
import { dependentApi } from '../../services/dependentApi';
import { employeeApi } from '../../services/employeeApi';
import { fileApi } from '../../services/fileApi';
import { useAppStore } from '../../store/useAppStore';
import type { EmployeeDetail } from '../../types/accounts';
import {
  DEPENDENT_DOCUMENT_TYPE_OPTIONS,
  DEPENDENT_GENDER_OPTIONS,
  DEPENDENT_RELATIONSHIP_OPTIONS,
} from '../../types/dependents';
import {
  validateDependentDob,
  validateDependentDocumentUrl,
  validateDependentFullName,
  validateDependentIdCard,
  validateDependentTaxCode,
} from '../../utils/dependentRules';

type DocSourceMode = 'upload' | 'url' | 'none';

export default function EmployeeDependentFormPage() {
  const { id, dependentId } = useParams<{ id: string; dependentId?: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(dependentId);

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('male');
  const [idCardNumber, setIdCardNumber] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [relationship, setRelationship] = useState('child');
  const [isActive, setIsActive] = useState(true);

  const [attachDoc, setAttachDoc] = useState(false);
  const [initDocType, setInitDocType] = useState('birth_certificate');
  const [initDocName, setInitDocName] = useState('');
  const [initDocSourceMode, setInitDocSourceMode] = useState<DocSourceMode>('upload');
  const [initDocUrl, setInitDocUrl] = useState('');
  const [uploadedFileLabel, setUploadedFileLabel] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const fullNameError = fullName ? validateDependentFullName(fullName) : '';
  const dobError = dateOfBirth ? validateDependentDob(dateOfBirth) : '';
  const idCardError = validateDependentIdCard(idCardNumber);
  const taxCodeError = validateDependentTaxCode(taxCode);
  const docUrlError = attachDoc && initDocSourceMode === 'url' ? validateDependentDocumentUrl(initDocUrl) : '';

  useEffect(() => {
    let active = true;
    async function load() {
      if (!id) return;
      setLoading(true);
      setPageError('');
      try {
        const emp = await employeeApi.get(id);
        if (!active) return;
        setEmployee(emp);

        if (dependentId) {
          const list = await dependentApi.list(id);
          if (!active) return;
          const found = list.find(item => item.staffDependentId === dependentId);
          if (!found) {
            setPageError('Không tìm thấy thông tin người phụ thuộc.');
          } else {
            setFullName(found.fullName);
            setDateOfBirth(found.dateOfBirth);
            setGender(found.gender);
            setIdCardNumber(found.idCardNumber ?? '');
            setTaxCode(found.taxCode ?? '');
            setRelationship(found.relationship);
            setIsActive(found.isActive);
          }
        }
      } catch (cause) {
        if (active) {
          setPageError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [id, dependentId]);

  function handleChangeInitDocSourceMode(mode: DocSourceMode) {
    setInitDocSourceMode(mode);
    setInitDocUrl('');
    setUploadedFileLabel('');
    setFormError('');
  }

  async function handleFileUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    setFormError('');
    try {
      const uploaded = await fileApi.upload(file);
      if (!initDocName.trim()) setInitDocName(file.name);
      setUploadedFileLabel(file.name);
      setInitDocUrl(uploaded.url);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Không thể tải tệp lên.');
    } finally {
      setUploadingDoc(false);
      e.target.value = '';
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id || saving) return;

    setFormError('');
    const errName = validateDependentFullName(fullName);
    if (errName) {
      setFormError(errName);
      return;
    }
    const errDob = validateDependentDob(dateOfBirth);
    if (errDob) {
      setFormError(errDob);
      return;
    }
    if (idCardError) {
      setFormError(idCardError);
      return;
    }
    if (taxCodeError) {
      setFormError(taxCodeError);
      return;
    }

    if (!isEdit && attachDoc) {
      if (!initDocName.trim()) {
        setFormError('Vui lòng nhập tên tài liệu minh chứng.');
        return;
      }
      if (initDocSourceMode === 'upload' && !initDocUrl) {
        setFormError('Vui lòng chọn tệp để tải lên hoặc chuyển sang mục "Bản cứng (để trống)".');
        return;
      }
      if (initDocSourceMode === 'url') {
        if (!initDocUrl.trim()) {
          setFormError('Vui lòng nhập đường dẫn tệp hoặc chuyển sang mục "Bản cứng (để trống)".');
          return;
        }
        if (docUrlError) {
          setFormError(docUrlError);
          return;
        }
      }
    }

    setSaving(true);
    try {
      if (isEdit && dependentId) {
        await dependentApi.update(id, dependentId, {
          fullName: fullName.trim(),
          dateOfBirth,
          gender,
          idCardNumber: idCardNumber || null,
          taxCode: taxCode || null,
          relationship,
          isActive,
        });
        useAppStore.getState().setNotice('Đã cập nhật thông tin người phụ thuộc.');
      } else {
        await dependentApi.create(id, {
          fullName: fullName.trim(),
          dateOfBirth,
          gender,
          idCardNumber: idCardNumber || null,
          taxCode: taxCode || null,
          relationship,
          isActive,
            documents: attachDoc
              ? [
                  {
                    documentType: initDocType,
                    fileName: initDocName.trim(),
                    fileUrl: initDocSourceMode === 'none' ? null : (initDocUrl || null),
                  },
                ]
              : undefined,
        });
        useAppStore.getState().setNotice('Đã thêm người phụ thuộc thành công.');
      }
      navigate(`/employees/${id}/dependents`);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Không thể lưu thông tin người phụ thuộc.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="loading-state" role="status">Đang tải biểu mẫu…</p>;
  }

  if (pageError) {
    return (
      <div className="account-form-page">
        <Alert variant="error">
          {pageError}
          <div style={{ marginTop: 12 }}>
            <button className="button" onClick={() => navigate(`/employees/${id}/dependents`)}>
              Quay lại danh sách người phụ thuộc
            </button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <section className="account-form-page workspace-content-page">
      <button className="text-button back-button" type="button" onClick={() => navigate(`/employees/${id}/dependents`)}>
        <Icon name="arrow" size={18} /> Quay lại danh sách người phụ thuộc
      </button>

      <div className="page-heading">
        <div>
          <span className="eyebrow">GIẢM TRỪ GIA CẢNH · {employee ? `${employee.name} (${employee.code})` : 'NHÂN VIÊN'}</span>
          <h1>{isEdit ? 'Chỉnh sửa người phụ thuộc' : 'Thêm người phụ thuộc mới'}</h1>
          <p className="muted">
            {isEdit
              ? 'Cập nhật thông tin định danh và mối quan hệ của người phụ thuộc.'
              : 'Nhập thông tin định danh, mối quan hệ gia đình và hồ sơ minh chứng đi kèm (nếu có).'}
          </p>
        </div>
      </div>

      <div className="workspace-section-body">
        <form onSubmit={handleSubmit} className="panel account-form workspace-form-panel" style={{ maxWidth: 900 }}>
          <div className="workspace-form-fields">
            <div className="panel-heading divided">
              <span className="section-number">01</span>
              <div>
                <h2>Thông tin người phụ thuộc</h2>
                <p>Họ tên, ngày sinh, giới tính và giấy tờ định danh.</p>
              </div>
            </div>

            <div className="form-section">
              <div className="form-grid" style={{ marginTop: 0 }}>
                <div>
                  <label htmlFor="dep-fullname">
                    Họ và tên <span className="required">*</span>
                  </label>
                  <input
                    id="dep-fullname"
                    value={fullName}
                    required
                    maxLength={100}
                    placeholder="Ví dụ: Nguyễn Văn An"
                    onChange={e => setFullName(e.target.value)}
                    aria-invalid={!!fullNameError}
                  />
                  {fullNameError && <p className="field-error" role="alert">{fullNameError}</p>}
                </div>

                <div>
                  <label htmlFor="dep-dob">
                    Ngày sinh <span className="required">*</span>
                  </label>
                  <input
                    id="dep-dob"
                    type="date"
                    min="1900-01-01"
                    max={new Date().toISOString().slice(0, 10)}
                    value={dateOfBirth}
                    required
                    onChange={e => setDateOfBirth(e.target.value)}
                    aria-invalid={!!dobError}
                  />
                  {dobError && <p className="field-error" role="alert">{dobError}</p>}
                </div>
              </div>

              <div className="form-grid">
                <div>
                  <label htmlFor="dep-gender">
                    Giới tính <span className="required">*</span>
                  </label>
                  <select id="dep-gender" value={gender} onChange={e => setGender(e.target.value)}>
                    {DEPENDENT_GENDER_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="dep-relationship">
                    Mối quan hệ với nhân viên <span className="required">*</span>
                  </label>
                  <select id="dep-relationship" value={relationship} onChange={e => setRelationship(e.target.value)}>
                    {DEPENDENT_RELATIONSHIP_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid">
                <div>
                  <label htmlFor="dep-idcard">Số CCCD / Giấy tờ tùy thân (không bắt buộc)</label>
                  <input
                    id="dep-idcard"
                    type="text"
                    inputMode="numeric"
                    value={idCardNumber}
                    maxLength={20}
                    placeholder="12 chữ số (không khoảng trắng)"
                    onChange={e => setIdCardNumber(e.target.value)}
                    aria-invalid={!!idCardError}
                  />
                  {idCardError ? (
                    <p className="field-error" role="alert">{idCardError}</p>
                  ) : (
                    <p className="field-hint">Để trống nếu chưa có CCCD. Chỉ nhập 12 chữ số, không dấu cách.</p>
                  )}
                </div>

                <div>
                  <label htmlFor="dep-taxcode">Mã số thuế cá nhân (không bắt buộc)</label>
                  <input
                    id="dep-taxcode"
                    type="text"
                    inputMode="numeric"
                    value={taxCode}
                    maxLength={20}
                    placeholder="10 hoặc 13 chữ số (không khoảng trắng)"
                    onChange={e => setTaxCode(e.target.value)}
                    aria-invalid={!!taxCodeError}
                  />
                  {taxCodeError ? (
                    <p className="field-error" role="alert">{taxCodeError}</p>
                  ) : (
                    <p className="field-hint">Chỉ nhập 10 hoặc 13 chữ số, không dấu cách hay dấu âm.</p>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 18 }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    style={{ width: 'auto' }}
                  />
                  <span>Quan hệ còn được quản lý (tính vào số người phụ thuộc giảm trừ gia cảnh)</span>
                </label>
              </div>
            </div>

            {!isEdit && (
              <>
                <div className="panel-heading divided">
                  <span className="section-number">02</span>
                  <div>
                    <h2>Hồ sơ minh chứng (tùy chọn)</h2>
                    <p>Có thể đính kèm ngay hoặc bổ sung sau tại trang Quản lý người phụ thuộc.</p>
                  </div>
                </div>

                <div className="form-section">
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={attachDoc}
                      onChange={e => setAttachDoc(e.target.checked)}
                      style={{ width: 'auto' }}
                    />
                    <span>Đính kèm hồ sơ minh chứng ngay</span>
                  </label>

                  {attachDoc && (
                    <div style={{ marginTop: 14 }}>
                      <div className="form-grid" style={{ marginTop: 0 }}>
                        <div>
                          <label htmlFor="init-doc-type">Loại giấy tờ</label>
                          <select id="init-doc-type" value={initDocType} onChange={e => setInitDocType(e.target.value)}>
                            {DEPENDENT_DOCUMENT_TYPE_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label htmlFor="init-doc-name">
                            Tên tài liệu <span className="required">*</span>
                          </label>
                          <input
                            id="init-doc-name"
                            value={initDocName}
                            maxLength={255}
                            placeholder="Ví dụ: Giay_khai_sinh.pdf"
                            onChange={e => setInitDocName(e.target.value)}
                          />
                        </div>
                      </div>
                      <div style={{ marginTop: 16 }}>
                        <label style={{ display: 'block', marginBottom: 8 }}>Hình thức đính kèm tệp</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                          {(
                            [
                              { value: 'upload', label: 'Tải tệp lên' },
                              { value: 'url', label: 'Nhập đường dẫn' },
                              { value: 'none', label: 'Bản cứng (để trống)' },
                            ] as const
                          ).map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleChangeInitDocSourceMode(opt.value)}
                              style={{
                                padding: '6px 14px',
                                borderRadius: 8,
                                border: initDocSourceMode === opt.value ? '1px solid #0f766e' : '1px solid #cbd5e1',
                                background: initDocSourceMode === opt.value ? '#0f766e' : '#ffffff',
                                color: initDocSourceMode === opt.value ? '#ffffff' : '#334155',
                                fontSize: 13,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {initDocSourceMode === 'upload' && (
                          <div>
                            <input
                              id="init-doc-file"
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              disabled={uploadingDoc}
                              onChange={e => void handleFileUpload(e)}
                            />
                            {uploadingDoc && <p className="field-hint">Đang tải tệp lên…</p>}
                            {!uploadingDoc && uploadedFileLabel && (
                              <p className="field-hint" style={{ color: '#0f766e', fontWeight: 500 }}>
                                Đã tải lên: {uploadedFileLabel}
                              </p>
                            )}
                          </div>
                        )}

                        {initDocSourceMode === 'url' && (
                          <div>
                            <input
                              id="init-doc-url"
                              value={initDocUrl}
                              maxLength={500}
                              placeholder="Nhập đường dẫn tệp (ví dụ: https://...)"
                              onChange={e => setInitDocUrl(e.target.value)}
                              aria-invalid={!!docUrlError}
                            />
                            {docUrlError && <p className="field-error" role="alert">{docUrlError}</p>}
                          </div>
                        )}

                        {initDocSourceMode === 'none' && (
                          <p className="field-hint" style={{ margin: 0 }}>
                            Ghi nhận hồ sơ nộp bản cứng, không lưu đường dẫn tệp đính kèm.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {formError && (
              <div className="form-section" style={{ paddingTop: 0 }}>
                <Alert variant="error">{formError}</Alert>
              </div>
            )}
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="button"
              disabled={saving}
              onClick={() => navigate(`/employees/${id}/dependents`)}
            >
              Hủy
            </button>
            <button type="submit" className="button primary" disabled={saving || uploadingDoc}>
              <Icon name="check" size={18} />
              {saving ? 'Đang lưu…' : isEdit ? 'Lưu cập nhật' : 'Tạo người phụ thuộc'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
