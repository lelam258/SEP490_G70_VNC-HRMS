import { useCallback, useEffect, useMemo, useState } from 'react';
import { myCertificateApi } from '../../services/myCertificateApi';
import type { Certificate, CertificateCategory } from '../../types/certificates';
import { formatDate } from '../../utils/format';
import Alert from '../../components/ui/Alert';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import CertificateDetailModal from '../../components/certificates/CertificateDetailModal';
import MyCertificateCreateModal from '../../components/certificates/MyCertificateCreateModal';
import type { SaveCertificateInput } from '../../types/certificates';

function normalizeCertificate(raw: Partial<Certificate>): Certificate {
  let cat: CertificateCategory = raw.category === 'degree' ? 'degree' : 'certificate';
  let catLabel = cat === 'degree' ? 'Bằng cấp' : 'Chứng chỉ';
  let cleanType = raw.certificateType || '';

  if (cleanType.startsWith('[Bằng cấp]')) {
    cat = 'degree';
    catLabel = 'Bằng cấp';
    cleanType = cleanType.slice(10).trim();
  } else if (cleanType.startsWith('[Giấy hành nghề]')) {
    cat = 'certificate';
    catLabel = 'Chứng chỉ';
    cleanType = cleanType.slice(16).trim();
  } else if (cleanType.startsWith('[Chứng chỉ]')) {
    cat = 'certificate';
    catLabel = 'Chứng chỉ';
    cleanType = cleanType.slice(11).trim();
  } else {
    const lower = cleanType.toLowerCase();
    if (
      lower.includes('bằng') ||
      lower.includes('cử nhân') ||
      lower.includes('thạc sĩ') ||
      lower.includes('tiến sĩ') ||
      lower.includes('bác sĩ')
    ) {
      cat = 'degree';
      catLabel = 'Bằng cấp';
    } else {
      cat = 'certificate';
      catLabel = 'Chứng chỉ';
    }
  }

  return {
    certificateId: raw.certificateId || '',
    staffId: raw.staffId || '',
    staffCode: raw.staffCode || '',
    staffName: raw.staffName || '',
    departmentId: raw.departmentId || null,
    departmentName: raw.departmentName || null,
    certificateNumber: raw.certificateNumber || null,
    category: cat,
    categoryLabel: catLabel,
    certificateType: cleanType || raw.certificateType || '',
    issuingAuthority: raw.issuingAuthority || null,
    issueDate: raw.issueDate || null,
    expiryDate: raw.expiryDate || null,
    scopeOfPractice: raw.scopeOfPractice || null,
    cmeCycleMonths: raw.cmeCycleMonths ?? null,
    cmeRequiredCredits: raw.cmeRequiredCredits ?? null,
    status: raw.status || 'active',
    fileUrl: raw.fileUrl || null,
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
    degreeType: raw.degreeType || null,
    major: raw.major || null,
    verificationStatus: raw.verificationStatus || null,
    notes: raw.notes || null,
    professionalDegree: raw.professionalDegree || null,
    issuanceMethod: raw.issuanceMethod || null,
    rejectionReason: raw.rejectionReason || null,
  };
}

interface ExpiryInfo {
  state: 'no_expiry' | 'valid' | 'expiring_soon' | 'expired';
  label: string;
  daysRemaining?: number;
  badgeClass: string;
}

function getExpiryInfo(expiryDateStr: string | null | undefined): ExpiryInfo {
  if (!expiryDateStr) {
    return {
      state: 'no_expiry',
      label: 'Vô thời hạn',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDateStr);
  expiry.setHours(0, 0, 0, 0);

  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      state: 'expired',
      label: `Đã hết hạn (${Math.abs(diffDays)} ngày trước)`,
      daysRemaining: diffDays,
      badgeClass: 'bg-red-50 text-red-700 border-red-200',
    };
  }

  if (diffDays <= 60) {
    return {
      state: 'expiring_soon',
      label: `Sắp hết hạn (còn ${diffDays} ngày)`,
      daysRemaining: diffDays,
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-300 font-semibold',
    };
  }

  return {
    state: 'valid',
    label: `Còn hiệu lực (còn ${diffDays} ngày)`,
    daysRemaining: diffDays,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  };
}

export default function MyCertificateListPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedCert, setSelectedCert] = useState<Certificate | null>(null);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  const [deletingCert, setDeletingCert] = useState<Certificate | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'degree' | 'certificate'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'expiring_soon' | 'expired'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await myCertificateApi.list();
      const normalized = (data || []).map(normalizeCertificate);
      setCertificates(normalized);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tải được danh sách chứng chỉ.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSaveCreate = async (input: SaveCertificateInput) => {
    setSavingCreate(true);
    try {
      await myCertificateApi.create(input);
      setNotice('Khai báo hồ sơ thành công. Hồ sơ đang chờ phòng Nhân sự thẩm định.');
      await loadData();
    } finally {
      setSavingCreate(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCert) return;
    setBusyDelete(true);
    try {
      await myCertificateApi.revoke(deletingCert.certificateId);
      setNotice('Đã thu hồi hồ sơ thành công.');
      setDeletingCert(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Thu hồi hồ sơ thất bại.');
    } finally {
      setBusyDelete(false);
    }
  };

  // Statistics
  const stats = useMemo(() => {
    let degrees = 0;
    let certs = 0;
    let expiringSoon = 0;
    let expired = 0;
    let valid = 0;

    for (const c of certificates) {
      if (c.category === 'degree') {
        degrees++;
      } else {
        certs++;
      }

      const info = getExpiryInfo(c.expiryDate);
      if (info.state === 'expired') expired++;
      else if (info.state === 'expiring_soon') expiringSoon++;
      else valid++;
    }

    return {
      total: certificates.length,
      degrees,
      certs,
      valid,
      expiringSoon,
      expired,
      alerts: expiringSoon + expired,
    };
  }, [certificates]);

  // Filtered list
  const filteredList = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return certificates.filter((c) => {
      // Category filter
      if (categoryFilter !== 'all' && c.category !== categoryFilter) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all') {
        const info = getExpiryInfo(c.expiryDate);
        if (statusFilter === 'valid' && info.state !== 'valid' && info.state !== 'no_expiry') return false;
        if (statusFilter === 'expiring_soon' && info.state !== 'expiring_soon') return false;
        if (statusFilter === 'expired' && info.state !== 'expired') return false;
      }

      // Search keyword
      if (q) {
        const matchName = c.certificateType.toLowerCase().includes(q);
        const matchCode = c.certificateNumber?.toLowerCase().includes(q);
        const matchAuth = c.issuingAuthority?.toLowerCase().includes(q);
        const matchMajor = c.major?.toLowerCase().includes(q);
        const matchProf = c.professionalDegree?.toLowerCase().includes(q);
        const matchScope = c.scopeOfPractice?.toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchAuth && !matchMajor && !matchProf && !matchScope) {
          return false;
        }
      }

      return true;
    });
  }, [certificates, searchTerm, categoryFilter, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-teal-50 text-teal-700 rounded-lg">
              <Icon name="award" size={24} />
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Chứng chỉ & Bằng cấp của tôi</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Hồ sơ năng lực y tế, văn bằng chuyên môn và chứng chỉ hành nghề của bạn tại VNC Clinic
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="button secondary text-xs flex items-center gap-1.5"
            onClick={() => void loadData()}
            disabled={loading}
          >
            <Icon name="sliders" size={14} />
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            className="button primary text-xs flex items-center gap-1.5"
            onClick={() => setCreateModalOpen(true)}
            disabled={loading}
          >
            <Icon name="plus" size={14} />
            <span>Khai báo bằng / CCHN mới</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="py-2.5 px-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Icon name="check" size={14} />
            {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="text-emerald-600 hover:text-emerald-800"
          >
            <Icon name="close" size={13} />
          </button>
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Tổng hồ sơ</span>
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
              <Icon name="fileText" size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-800">{stats.total}</span>
            <span className="text-xs text-slate-400">chứng chỉ & bằng</span>
          </div>
        </div>

        {/* Degrees */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Bằng cấp chuyên môn</span>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Icon name="award" size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-indigo-700">{stats.degrees}</span>
            <span className="text-xs text-slate-400">văn bằng</span>
          </div>
        </div>

        {/* Certificates */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Chứng chỉ hành nghề</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Icon name="shield" size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700">{stats.certs}</span>
            <span className="text-xs text-slate-400">chứng chỉ</span>
          </div>
        </div>

        {/* Alerts / Expiration */}
        <div
          className={`p-4 rounded-xl border shadow-2xs transition-colors ${
            stats.alerts > 0
              ? 'bg-amber-50/70 border-amber-200'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Cảnh báo hạn dùng</span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                stats.alerts > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-400'
              }`}
            >
              <Icon name="clock" size={16} />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${stats.alerts > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
              {stats.alerts}
            </span>
            <span className="text-xs text-slate-500">
              {stats.expired > 0 ? `${stats.expired} đã hết hạn` : 'sắp hết hạn'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          {/* Search box */}
          <div className="relative flex-1 min-w-[240px]">
            <input
              type="text"
              className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              placeholder="Tìm theo tên chứng chỉ, số hiệu, nơi cấp, chuyên ngành..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="absolute left-3 top-2.5 text-slate-400 pointer-events-none">
              <Icon name="search" size={14} />
            </span>
            {searchTerm && (
              <button
                type="button"
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                onClick={() => setSearchTerm('')}
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs shrink-0">
            <button
              type="button"
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-white text-slate-800 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setCategoryFilter('all')}
            >
              Tất cả ({certificates.length})
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                categoryFilter === 'degree'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setCategoryFilter('degree')}
            >
              Bằng cấp ({stats.degrees})
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
                categoryFilter === 'certificate'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setCategoryFilter('certificate')}
            >
              Chứng chỉ ({stats.certs})
            </button>
          </div>

          {/* Status filter dropdown */}
          <select
            className="text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="valid">Còn hiệu lực / Vô thời hạn</option>
            <option value="expiring_soon">Sắp hết hạn (≤ 60 ngày)</option>
            <option value="expired">Đã hết hạn</option>
          </select>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100 justify-end">
          <span className="text-xs text-slate-400 mr-1 hidden sm:inline">Chế độ xem:</span>
          <button
            type="button"
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 ${
              viewMode === 'grid'
                ? 'bg-teal-50 text-teal-700 border-teal-200 font-medium'
                : 'text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
            onClick={() => setViewMode('grid')}
            title="Dạng thẻ lưới"
          >
            <Icon name="sliders" size={14} />
            <span className="text-[11px]">Thẻ</span>
          </button>
          <button
            type="button"
            className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 ${
              viewMode === 'table'
                ? 'bg-teal-50 text-teal-700 border-teal-200 font-medium'
                : 'text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
            onClick={() => setViewMode('table')}
            title="Dạng danh sách bảng"
          >
            <Icon name="fileText" size={14} />
            <span className="text-[11px]">Bảng</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-xl border border-slate-200">
          <div className="animate-spin inline-block w-8 h-8 border-3 border-current border-t-transparent text-teal-600 rounded-full mb-3" />
          <p className="text-sm font-medium">Đang tải hồ sơ chứng chỉ & bằng cấp của bạn...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
            <Icon name="award" size={24} />
          </div>
          {certificates.length === 0 ? (
            <>
              <h3 className="text-base font-semibold text-slate-700">Chưa có chứng chỉ hoặc bằng cấp</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Hiện tại hồ sơ nhân sự của bạn chưa được cập nhật thông tin bằng cấp, chứng chỉ hành nghề.
                Vui lòng liên hệ Phòng Nhân sự (HR) để được hỗ trợ nhập liệu.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-base font-semibold text-slate-700">Không tìm thấy kết quả phù hợp</h3>
              <p className="text-xs text-slate-500 mt-1">
                Không có chứng chỉ nào khớp với từ khóa tìm kiếm hoặc bộ lọc hiện tại.
              </p>
              <button
                type="button"
                className="button secondary text-xs mt-3"
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('all');
                  setStatusFilter('all');
                }}
              >
                Đặt lại bộ lọc
              </button>
            </>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Card View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredList.map((cert) => {
            const isDegree = cert.category === 'degree';
            const expiryInfo = getExpiryInfo(cert.expiryDate);

            return (
              <div
                key={cert.certificateId}
                className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Card Top / Badges */}
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        isDegree
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      <Icon name={isDegree ? 'award' : 'shield'} size={12} />
                      {isDegree ? 'Bằng cấp' : 'Chứng chỉ'}
                    </span>

                    {cert.status === 'rejected' || cert.verificationStatus === 'rejected' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        Bị từ chối
                      </span>
                    ) : cert.verificationStatus === 'unverified' || cert.status === 'pending' || cert.status === 'unverified' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                        Chờ HR duyệt
                      </span>
                    ) : (
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] border ${expiryInfo.badgeClass}`}
                      >
                        {expiryInfo.label}
                      </span>
                    )}
                  </div>

                  {/* Title & Category Info */}
                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-teal-700 transition-colors line-clamp-2">
                    {cert.certificateType}
                  </h3>

                  {/* Degree specific or Certificate specific badge details */}
                  {isDegree && cert.degreeType && (
                    <div className="text-xs text-indigo-600 font-medium mt-1">
                      Trình độ: {cert.degreeType}
                    </div>
                  )}

                  {cert.major && (
                    <div className="text-xs text-slate-600 mt-1 line-clamp-1">
                      <span className="text-slate-400">Chuyên ngành: </span>
                      <strong className="font-semibold text-slate-700">{cert.major}</strong>
                    </div>
                  )}

                  {cert.certificateNumber && (
                    <div className="text-xs text-slate-600 mt-1 font-mono">
                      <span className="text-slate-400">Số hiệu: </span>
                      <span className="font-medium text-slate-800">{cert.certificateNumber}</span>
                    </div>
                  )}

                  <hr className="my-3 border-slate-100" />

                  {/* Metadata fields */}
                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-start gap-1.5">
                      <span className="text-slate-400 shrink-0 w-20">Nơi cấp:</span>
                      <span className="text-slate-700 font-medium truncate flex-1" title={cert.issuingAuthority || ''}>
                        {cert.issuingAuthority || 'Chưa cập nhật'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 shrink-0 w-20">Ngày cấp:</span>
                      <span className="text-slate-700 font-medium">
                        {formatDate(cert.issueDate) || 'Chưa có'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400 shrink-0 w-20">Hạn dùng:</span>
                      <span className="text-slate-700 font-medium">
                        {cert.expiryDate ? formatDate(cert.expiryDate) : 'Vô thời hạn'}
                      </span>
                    </div>

                    {cert.cmeCycleMonths ? (
                      <div className="flex items-center gap-1.5 pt-1">
                        <span className="text-slate-400 shrink-0 w-20">Chu kỳ CME:</span>
                        <span className="text-teal-700 font-semibold bg-teal-50 px-1.5 py-0.5 rounded text-[11px]">
                          {cert.cmeCycleMonths} tháng / {cert.cmeRequiredCredits || 0} tín chỉ
                        </span>
                      </div>
                    ) : null}
                    {cert.rejectionReason && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-800">
                        <strong className="block text-red-900 mb-0.5">Lý do từ chối:</strong>
                        {cert.rejectionReason}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div>
                    {cert.fileUrl ? (
                      <a
                        href={cert.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900 transition-colors"
                        title="Mở xem tài liệu scan"
                      >
                        <Icon name="fileText" size={14} />
                        <span>Xem tệp scan</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">Chưa có tệp</span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {(cert.verificationStatus === 'unverified' || cert.status === 'pending' || cert.status === 'unverified' || cert.status === 'rejected') && (
                      <button
                        type="button"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        onClick={() => setDeletingCert(cert)}
                        title="Thu hồi bản khai báo"
                      >
                        <Icon name="close" size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="button secondary text-xs py-1 px-3"
                      onClick={() => setSelectedCert(cert)}
                    >
                      <Icon name="eye" size={13} />
                      <span>Chi tiết</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="py-3 px-4">Phân loại</th>
                  <th className="py-3 px-4">Tên văn bằng / Chứng chỉ</th>
                  <th className="py-3 px-4">Số hiệu</th>
                  <th className="py-3 px-4">Nơi đào tạo / Cơ quan cấp</th>
                  <th className="py-3 px-4">Ngày cấp</th>
                  <th className="py-3 px-4">Hạn dùng</th>
                  <th className="py-3 px-4">Tài liệu</th>
                  <th className="py-3 px-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((cert) => {
                  const isDegree = cert.category === 'degree';
                  const expiryInfo = getExpiryInfo(cert.expiryDate);

                  return (
                    <tr key={cert.certificateId} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                            isDegree
                              ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          <Icon name={isDegree ? 'award' : 'shield'} size={11} />
                          {isDegree ? 'Bằng cấp' : 'Chứng chỉ'}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-medium text-slate-900 max-w-xs">
                        <div className="font-semibold text-slate-800 line-clamp-1">{cert.certificateType}</div>
                        {cert.major && (
                          <div className="text-[11px] text-slate-500 line-clamp-1">Ngành: {cert.major}</div>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono whitespace-nowrap text-slate-600">
                        {cert.certificateNumber || '—'}
                      </td>

                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={cert.issuingAuthority || ''}>
                        {cert.issuingAuthority || 'Chưa cập nhật'}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                        {formatDate(cert.issueDate) || '—'}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {cert.status === 'rejected' || cert.verificationStatus === 'rejected' ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        Bị từ chối
                      </span>
                    ) : cert.verificationStatus === 'unverified' || cert.status === 'pending' || cert.status === 'unverified' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Chờ HR duyệt
                          </span>
                        ) : (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] border ${expiryInfo.badgeClass}`}>
                            {expiryInfo.label}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {cert.fileUrl ? (
                          <a
                            href={cert.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 font-semibold"
                          >
                            <Icon name="fileText" size={13} />
                            <span>Tệp scan</span>
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">Không có</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {(cert.verificationStatus === 'unverified' || cert.status === 'pending' || cert.status === 'unverified' || cert.status === 'rejected') && (
                            <button
                              type="button"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              onClick={() => setDeletingCert(cert)}
                              title="Thu hồi bản khai báo"
                            >
                              <Icon name="close" size={13} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="button secondary text-xs py-1 px-2.5"
                            onClick={() => setSelectedCert(cert)}
                          >
                            <Icon name="eye" size={12} />
                            <span>Chi tiết</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedCert && (
        <CertificateDetailModal
          certificate={selectedCert}
          onClose={() => setSelectedCert(null)}
        />
      )}

      {/* Create Modal */}
      {createModalOpen && (
        <MyCertificateCreateModal
          onClose={() => setCreateModalOpen(false)}
          onSave={handleSaveCreate}
          busy={savingCreate}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingCert && (
        <Modal
          title="Xác nhận thu hồi hồ sơ"
          onClose={() => {
            if (!busyDelete) setDeletingCert(null);
          }}
          busy={busyDelete}
        >
          <div className="space-y-4 text-xs text-slate-600">
            <p>
              Bạn có chắc chắn muốn thu hồi bản khai báo{' '}
              <strong className="text-slate-800">{deletingCert.certificateType}</strong>
              {deletingCert.certificateNumber ? ` (Số: ${deletingCert.certificateNumber})` : ''}?
            </p>
            <p className="text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              Hồ sơ này đang ở trạng thái chờ duyệt. Sau khi thu hồi, thông tin khai báo sẽ được xóa khỏi hệ thống.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="button secondary text-xs"
                onClick={() => setDeletingCert(null)}
                disabled={busyDelete}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="button danger text-xs"
                onClick={() => void handleConfirmDelete()}
                disabled={busyDelete}
              >
                {busyDelete ? 'Đang thu hồi...' : 'Xác nhận thu hồi'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
