import { useEffect, useMemo, useRef, useState } from 'react';
import Alert from '../../components/ui/Alert';
import Icon from '../../components/ui/Icon';
import { ApiError } from '../../services/axiosClient';
import { profileApi } from '../../services/profileApi';
import { useAuthStore } from '../../store/useAuthStore';
import type { UserProfile } from '../../types/profile';
import { formatDateOnly, initials } from '../../utils/format';
import { getMaxAdultDateOfBirth } from '../../utils/leaveRules';

const PHONE_REGEX = /^0\d{9}$/;
const FULL_NAME_REGEX = /^[\p{L}\s'-]+$/u;
const ID_CARD_REGEX = /^\d{12}$/;
const MSG03 = 'Cập nhật thông tin thành công.';

export default function ProfilePage() {
  const setUserName = useAuthStore((state) => state.setUserName);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Edit Mode state
  const [isEditing, setIsEditing] = useState(false);
  const [fullNameInput, setFullNameInput] = useState('');
  const [dateOfBirthInput, setDateOfBirthInput] = useState('');
  const [genderInput, setGenderInput] = useState('');
  const [idCardInput, setIdCardInput] = useState('');
  const [isClearingIdCard, setIsClearingIdCard] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');

  // Field inline errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Avatar upload state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxAdultDob = useMemo(() => getMaxAdultDateOfBirth(), []);

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await profileApi.getProfile();
      setProfile(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tải được hồ sơ cá nhân.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProfile();
  }, []);

  const handleStartEdit = () => {
    if (!profile) return;
    setFullNameInput(profile.fullName || '');
    setDateOfBirthInput(profile.dateOfBirth || '');
    setGenderInput(profile.gender || '');
    setIdCardInput('');
    setIsClearingIdCard(false);
    setPhoneInput(profile.phone || '');
    setFieldErrors({});
    setError('');
    setNotice('');
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setFieldErrors({});
  };

  const isDirty = useMemo(() => {
    if (!profile) return false;
    if (fullNameInput.trim() !== (profile.fullName || '').trim()) return true;
    if ((dateOfBirthInput || '') !== (profile.dateOfBirth || '')) return true;
    if ((genderInput || '') !== (profile.gender || '')) return true;
    if (phoneInput.trim() !== (profile.phone || '').trim()) return true;
    if (isClearingIdCard) return true;
    if (idCardInput.trim().length > 0) return true;
    return false;
  }, [profile, fullNameInput, dateOfBirthInput, genderInput, phoneInput, isClearingIdCard, idCardInput]);

  const validateFrontend = (): boolean => {
    const errors: Record<string, string> = {};

    // 1. FullName validation
    const trimmedName = fullNameInput.trim().replace(/\s+/g, ' ');
    if (!trimmedName) {
      errors.fullName = 'Họ và tên là bắt buộc.';
    } else if (trimmedName.length < 2 || trimmedName.length > 100) {
      errors.fullName = 'Họ và tên phải từ 2 đến 100 ký tự.';
    } else if (!FULL_NAME_REGEX.test(trimmedName)) {
      errors.fullName = 'Họ và tên chỉ được chứa chữ cái, khoảng trắng, dấu gạch nối và nháy đơn.';
    }

    // 2. DateOfBirth validation
    if (dateOfBirthInput) {
      const year = Number(dateOfBirthInput.split('-')[0]);
      if (year < 1940) {
        errors.dateOfBirth = 'Năm sinh phải từ năm 1940 trở lại đây.';
      } else if (dateOfBirthInput > maxAdultDob) {
        errors.dateOfBirth = 'Nhân viên phải từ đủ 18 tuổi trở lên.';
      }
    }

    // 3. Gender validation
    if (genderInput && !['male', 'female', 'other'].includes(genderInput)) {
      errors.gender = 'Giới tính không hợp lệ. Vui lòng chọn Nam, Nữ hoặc Khác.';
    }

    // 4. CCCD validation
    if (!isClearingIdCard && idCardInput.trim().length > 0) {
      if (!ID_CARD_REGEX.test(idCardInput.trim())) {
        errors.idCardNumber = 'Số CCCD phải gồm đúng 12 chữ số.';
      }
    }

    // 5. Phone validation
    const trimmedPhone = phoneInput.trim();
    if (!trimmedPhone) {
      errors.phone = 'Số điện thoại là bắt buộc. Vui lòng nhập 10 chữ số bắt đầu bằng 0.';
    } else if (!PHONE_REGEX.test(trimmedPhone)) {
      errors.phone = 'Số điện thoại không hợp lệ. Vui lòng nhập 10 chữ số bắt đầu bằng 0.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!validateFrontend()) return;

    setSaving(true);
    setFieldErrors({});
    setError('');
    setNotice('');

    // Determine IdCardNumber payload:
    // - "CLEAR" if user chose to clear
    // - entered 12 digits if provided
    // - null if left blank (meaning keep unchanged)
    let payloadIdCard: string | null = null;
    if (isClearingIdCard) {
      payloadIdCard = 'CLEAR';
    } else if (idCardInput.trim().length > 0) {
      payloadIdCard = idCardInput.trim();
    }

    try {
      const updated = await profileApi.updateProfile({
        fullName: fullNameInput.trim().replace(/\s+/g, ' '),
        dateOfBirth: dateOfBirthInput ? dateOfBirthInput : null,
        gender: genderInput ? genderInput : null,
        idCardNumber: payloadIdCard,
        phone: phoneInput.trim(),
      });

      setProfile(updated);
      setUserName(updated.fullName);
      setIsEditing(false);
      setNotice(MSG03);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.field) {
          setFieldErrors({ [err.field]: err.message });
        } else {
          setError(err.message);
        }
      } else {
        setError(err instanceof Error ? err.message : 'Không cập nhật được hồ sơ cá nhân.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Ảnh đại diện tối đa 2 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploadingAvatar(true);
    setError('');
    setNotice('');

    try {
      const updated = await profileApi.uploadAvatar(file);
      setProfile(updated);
      setNotice(MSG03);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tải lên được ảnh đại diện.');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const renderGenderText = (gender: string | null) => {
    if (!gender) return <span className="profile-empty-val">Chưa cập nhật</span>;
    if (gender === 'male') return 'Nam';
    if (gender === 'female') return 'Nữ';
    if (gender === 'other') return 'Khác';
    return gender;
  };

  if (loading) {
    return (
      <div className="panel p-8 text-center" style={{ padding: '48px 24px', textAlign: 'center' }}>
        <p style={{ color: 'var(--muted, #748793)' }}>Đang tải hồ sơ…</p>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="vnc panel empty-state">
        <Alert variant="error">{error}</Alert>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="profile-page-container">
      {notice && <Alert variant="success">{notice}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {/* Header Banner Card */}
      <div className="panel profile-banner-card">
        <div className="profile-avatar-box">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={profile.fullName}
              className="profile-avatar-circle"
            />
          ) : (
            <div className="profile-avatar-fallback">
              {initials(profile.fullName).toUpperCase()}
            </div>
          )}

          <button
            type="button"
            className="profile-camera-btn"
            disabled={uploadingAvatar}
            onClick={() => fileInputRef.current?.click()}
            title="Đổi ảnh đại diện"
            aria-label="Đổi ảnh đại diện"
          >
            {uploadingAvatar ? (
              <span style={{ fontSize: '10px' }}>…</span>
            ) : (
              <Icon name="camera" size={15} />
            )}
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarChange}
            accept="image/png,image/jpeg"
            style={{ display: 'none' }}
          />
        </div>

        <div className="profile-banner-info">
          <div className="profile-banner-name-row">
            <h1 className="profile-banner-name">{profile.fullName}</h1>
            <span
              className={`badge ${profile.status === 'active' ? 'badge-success' : 'badge-warning'}`}
              style={{
                padding: '3px 9px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: profile.status === 'active' ? '#def7ec' : '#fef08a',
                color: profile.status === 'active' ? '#03543f' : '#713f12',
              }}
            >
              {profile.status === 'active' ? 'Đang làm việc' : profile.status}
            </span>
          </div>

          <div className="profile-banner-meta">
            <span>Mã NV: <strong>{profile.staffCode}</strong></span>
            <span className="profile-banner-meta-sep">•</span>
            <span>
              Chức vụ: <strong>{profile.positionName || <span className="profile-empty-val">Chưa cập nhật</span>}</strong>
            </span>
            <span className="profile-banner-meta-sep">•</span>
            <span>
              Khoa/Phòng: <strong>{profile.departmentName || <span className="profile-empty-val">Chưa phân bổ</span>}</strong>
            </span>
          </div>
          {uploadingAvatar && <small style={{ color: '#2563eb', display: 'block', marginTop: '4px' }}>Đang tải ảnh đại diện lên…</small>}
        </div>
      </div>

      {/* Grid: 2 Cards */}
      <div className="profile-grid">
        {/* Card 1: Thông tin cá nhân */}
        <div className="panel">
          <div className="profile-card-header">
            <h2 className="profile-card-title">
              <Icon name="users" /> Thông tin cá nhân
            </h2>
            {!isEditing && (
              <button
                type="button"
                className="button small secondary"
                onClick={handleStartEdit}
                title="Chỉnh sửa thông tin cá nhân"
              >
                <Icon name="edit" size={14} /> Chỉnh sửa
              </button>
            )}
          </div>

          <div className="profile-card-body">
            {!isEditing ? (
              <dl className="profile-dl">
                <div className="profile-row">
                  <dt className="profile-dt">Họ và tên</dt>
                  <dd className="profile-dd">{profile.fullName}</dd>
                </div>

                <div className="profile-row">
                  <dt className="profile-dt">Giới tính</dt>
                  <dd className="profile-dd">{renderGenderText(profile.gender)}</dd>
                </div>

                <div className="profile-row">
                  <dt className="profile-dt">Ngày sinh</dt>
                  <dd className="profile-dd">
                    {profile.dateOfBirth ? formatDateOnly(profile.dateOfBirth) : <span className="profile-empty-val">Chưa cập nhật</span>}
                  </dd>
                </div>

                <div className="profile-row">
                  <dt className="profile-dt">Số CCCD</dt>
                  <dd className="profile-dd" style={{ fontFamily: 'monospace' }}>
                    {profile.idCardNumber ? profile.idCardNumber : <span className="profile-empty-val">Chưa cập nhật</span>}
                  </dd>
                </div>

                <div className="profile-row">
                  <dt className="profile-dt">Số điện thoại</dt>
                  <dd className="profile-dd">
                    {profile.phone ? profile.phone : <span className="profile-empty-val">Chưa cập nhật</span>}
                  </dd>
                </div>

                <div className="profile-row">
                  <dt className="profile-dt">Người phụ thuộc</dt>
                  <dd className="profile-dd">
                    {profile.dependentCount} người{' '}
                    <small style={{ color: '#8b9aa5', fontWeight: 400, marginLeft: '6px' }}>
                      (Liên hệ bộ phận nhân sự để thay đổi)
                    </small>
                  </dd>
                </div>
              </dl>
            ) : (
              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column' }}>
                {/* FullName */}
                <div className="profile-field-item">
                  <label htmlFor="input-fullName" className="profile-field-label">
                    Họ và tên <span style={{ color: '#cf7c66' }}>*</span>
                  </label>
                  <input
                    id="input-fullName"
                    type="text"
                    className="input"
                    value={fullNameInput}
                    onChange={(e) => setFullNameInput(e.target.value)}
                    placeholder="VD: Nguyễn Thị Kế Toán"
                    disabled={saving}
                    autoFocus
                  />
                  {fieldErrors.fullName && (
                    <span className="profile-inline-error">{fieldErrors.fullName}</span>
                  )}
                </div>

                {/* Gender */}
                <div className="profile-field-item">
                  <label htmlFor="select-gender" className="profile-field-label">
                    Giới tính
                  </label>
                  <select
                    id="select-gender"
                    className="input"
                    value={genderInput}
                    onChange={(e) => setGenderInput(e.target.value)}
                    disabled={saving}
                  >
                    <option value="">-- Chưa cập nhật --</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                  {fieldErrors.gender && (
                    <span className="profile-inline-error">{fieldErrors.gender}</span>
                  )}
                </div>

                {/* DateOfBirth */}
                <div className="profile-field-item">
                  <label htmlFor="input-dob" className="profile-field-label">
                    Ngày sinh (tối thiểu đủ 18 tuổi)
                  </label>
                  <input
                    id="input-dob"
                    type="date"
                    className="input"
                    min="1940-01-01"
                    max={maxAdultDob}
                    value={dateOfBirthInput}
                    onChange={(e) => setDateOfBirthInput(e.target.value)}
                    disabled={saving}
                  />
                  {fieldErrors.dateOfBirth && (
                    <span className="profile-inline-error">{fieldErrors.dateOfBirth}</span>
                  )}
                </div>

                {/* CCCD */}
                <div className="profile-field-item">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label htmlFor="input-idCard" className="profile-field-label">
                      Số CCCD (12 chữ số)
                    </label>
                    {profile.idCardNumber && !isClearingIdCard && (
                      <button
                        type="button"
                        className="text-button"
                        style={{ fontSize: '11px', color: '#cf7c66' }}
                        onClick={() => {
                          setIsClearingIdCard(true);
                          setIdCardInput('');
                        }}
                      >
                        Xóa CCCD
                      </button>
                    )}
                  </div>

                  {isClearingIdCard ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: '#fdf2f2', border: '1px dashed #fca5a5', borderRadius: '6px' }}>
                      <span style={{ fontSize: '12px', color: '#991b1b' }}>Sẽ xóa số CCCD hiện tại ({profile.idCardNumber}) khi lưu</span>
                      <button
                        type="button"
                        className="button small secondary"
                        style={{ padding: '2px 8px', fontSize: '11px', marginLeft: 'auto' }}
                        onClick={() => setIsClearingIdCard(false)}
                      >
                        Hoàn tác
                      </button>
                    </div>
                  ) : (
                    <input
                      id="input-idCard"
                      type="text"
                      inputMode="numeric"
                      maxLength={12}
                      className="input"
                      value={idCardInput}
                      onChange={(e) => setIdCardInput(e.target.value)}
                      placeholder={profile.idCardNumber ? `Để trống để giữ nguyên (${profile.idCardNumber})` : 'Nhập đúng 12 chữ số'}
                      disabled={saving}
                    />
                  )}
                  {fieldErrors.idCardNumber && (
                    <span className="profile-inline-error">{fieldErrors.idCardNumber}</span>
                  )}
                </div>

                {/* Phone */}
                <div className="profile-field-item">
                  <label htmlFor="input-phone" className="profile-field-label">
                    Số điện thoại <span style={{ color: '#cf7c66' }}>*</span>
                  </label>
                  <input
                    id="input-phone"
                    type="text"
                    inputMode="tel"
                    maxLength={10}
                    className="input"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="VD: 0912345678"
                    disabled={saving}
                  />
                  {fieldErrors.phone && (
                    <span className="profile-inline-error">{fieldErrors.phone}</span>
                  )}
                </div>

                {/* Form Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                  <button
                    type="button"
                    className="button secondary"
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    className="button primary"
                    disabled={saving || !isDirty}
                  >
                    {saving ? 'Đang lưu…' : 'Lưu thay đổi'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Card 2: Thông tin công việc (Read-only) */}
        <div className="panel">
          <div className="profile-card-header">
            <h2 className="profile-card-title">
              <Icon name="building" /> Thông tin công việc
            </h2>
          </div>

          <div className="profile-card-body">
            <dl className="profile-dl">
              <div className="profile-row">
                <dt className="profile-dt">Email công việc</dt>
                <dd className="profile-dd">
                  {profile.email ? profile.email : <span className="profile-empty-val">Chưa cập nhật</span>}
                </dd>
              </div>

              <div className="profile-row">
                <dt className="profile-dt">Ngày vào làm</dt>
                <dd className="profile-dd">
                  {profile.dateJoined ? formatDateOnly(profile.dateJoined) : <span className="profile-empty-val">Chưa cập nhật</span>}
                </dd>
              </div>

              <div className="profile-row">
                <dt className="profile-dt">Khoa/Phòng</dt>
                <dd className="profile-dd">
                  {profile.departmentName ? profile.departmentName : <span className="profile-empty-val">Chưa phân bổ</span>}
                </dd>
              </div>

              <div className="profile-row">
                <dt className="profile-dt">Chức vụ</dt>
                <dd className="profile-dd">
                  {profile.positionName ? profile.positionName : <span className="profile-empty-val">Chưa cập nhật</span>}
                </dd>
              </div>

              <div className="profile-row">
                <dt className="profile-dt">Phạm vi hành nghề</dt>
                <dd className="profile-dd">
                  {profile.scopeOfPractice ? profile.scopeOfPractice : <span className="profile-empty-val">Chưa cập nhật</span>}
                </dd>
              </div>

              <div className="profile-row">
                <dt className="profile-dt">Trạng thái làm việc</dt>
                <dd className="profile-dd">
                  {profile.status === 'active' ? 'Đang làm việc' : profile.status}
                </dd>
              </div>
            </dl>

            <div className="profile-note-small">
              Liên hệ bộ phận nhân sự để thay đổi thông tin công việc.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
