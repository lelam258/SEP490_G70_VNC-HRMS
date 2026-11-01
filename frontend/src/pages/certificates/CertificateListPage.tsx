import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { certificateApi } from '../../services/certificateApi';
import { departmentApi, type Department } from '../../services/departmentApi';
import type {
  Certificate,
  CertificateCategory,
  SaveCertificateInput,
  StaffCertificateSummary,
  UpdateCertificateInput,
} from '../../types/certificates';
import { initials, formatDate } from '../../utils/format';
import Alert from '../../components/ui/Alert';
import Icon from '../../components/ui/Icon';
import CertificateDetailModal from '../../components/certificates/CertificateDetailModal';
import CertificateEditModal from '../../components/certificates/CertificateEditModal';
import CertificateCreateModal from '../../components/certificates/CertificateCreateModal';

function formatDateTime(val: string | null | undefined): string {
  if (!val) return 'Chưa có';
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function normalizeCertificate(raw: Partial<Certificate>): Certificate {
  let cat: CertificateCategory = raw.category === 'degree' ? 'degree' : 'certificate';
  let catLabel = cat === 'degree' ? 'Bằng cấp' : 'Chứng chỉ';
  let cleanType = raw.certificateType || '';

  if (cleanType.startsWith('[Bằng cấp]')) {
    cat = 'degree';
    catLabel = 'Bằng cấp';
    cleanType = cleanType.slice(10).trim();
  } else if (cleanType.startsWith('[Giấy hành nghề]')) {
    // Đã bỏ giấy hành nghề, chuẩn hóa về chứng chỉ
    cat = 'certificate';
    catLabel = 'Chứng chỉ';
    cleanType = cleanType.slice(16).trim();
  } else if (cleanType.startsWith('[Chứng chỉ]')) {
    cat = 'certificate';
    catLabel = 'Chứng chỉ';
    cleanType = cleanType.slice(11).trim();
  } else {
    const lower = cleanType.toLowerCase();
    if (lower.includes('bằng') || lower.includes('cử nhân') || lower.includes('thạc sĩ') || lower.includes('tiến sĩ') || lower.includes('bác sĩ')) {
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
  };
}

export default function CertificateListPage() {
  const [searchParams] = useSearchParams();
  const staffIdParam = searchParams.get('staffId');
  const [staffList, setStaffList] = useState<StaffCertificateSummary[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Selected staff for split-view
  const [selectedStaff, setSelectedStaff] = useState<StaffCertificateSummary | null>(null);
  const [staffCertificates, setStaffCertificates] = useState<Certificate[]>([]);
  const [loadingCertificates, setLoadingCertificates] = useState(false);

  // Filter states
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [certFilter, setCertFilter] = useState<'all' | 'has_cert' | 'no_cert'>('all');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<'all' | CertificateCategory>('all');

  // Modals
  const [viewingCert, setViewingCert] = useState<Certificate | null>(null);
  const [editingCert, setEditingCert] = useState<Certificate | null>(null);
  const [creatingForStaff, setCreatingForStaff] = useState<StaffCertificateSummary | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Load certificates whenever selected staff changes
  const loadCertificates = useCallback(async (staffId: string) => {
    setLoadingCertificates(true);
    try {
      const certs = await certificateApi.listByStaff(staffId);
      setStaffCertificates(certs.map(normalizeCertificate));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được chứng chỉ của nhân viên.');
    } finally {
      setLoadingCertificates(false);
    }
  }, []);

  // Load staff summaries & departments
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaries, depts] = await Promise.all([
        certificateApi.listStaffSummaries(),
        departmentApi.list(),
      ]);
      setStaffList(summaries);
      setDepartments(depts);

      // If a staff is already selected or passed via ?staffId=, select them and load certificates
      const targetId = selectedStaff?.staffId || staffIdParam;
      if (targetId) {
        const found = summaries.find(s => s.staffId === targetId);
        if (found) {
          setSelectedStaff(found);
          void loadCertificates(found.staffId);
        }
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được danh sách chứng chỉ.');
    } finally {
      setLoading(false);
    }
  }, [selectedStaff?.staffId, staffIdParam, loadCertificates]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function handleSelectStaff(staff: StaffCertificateSummary) {
    setSelectedStaff(staff);
    setSelectedCategoryTab('all');
    void loadCertificates(staff.staffId);
  }

  function handleCloseSplitView() {
    setSelectedStaff(null);
    setStaffCertificates([]);
  }

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    const normalize = (value: string) =>
      value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/[đĐ]/g, 'd')
        .toLowerCase();
    const term = normalize(search.trim());

    return staffList.filter(s => {
      const matchesSearch =
        !term ||
        normalize(`${s.staffCode} ${s.fullName} ${s.departmentName} ${s.email || ''}`).includes(term);
      const matchesDept = !departmentId || s.departmentId === departmentId;
      const matchesCertFilter =
        certFilter === 'all'
          ? true
          : certFilter === 'has_cert'
          ? s.certificateCount > 0
          : s.certificateCount === 0;

      return matchesSearch && matchesDept && matchesCertFilter;
    });
  }, [staffList, search, departmentId, certFilter]);

  // Certificates of selected staff filtered by category tab
  const filteredCertificates = useMemo(() => {
    if (selectedCategoryTab === 'all') return staffCertificates;
    return staffCertificates.filter(c => c.category === selectedCategoryTab);
  }, [staffCertificates, selectedCategoryTab]);

  // Counts by category for selected staff: Chỉ Bằng cấp và Chứng chỉ
  const categoryCounts = useMemo(() => {
    const degrees = staffCertificates.filter(c => c.category === 'degree').length;
    const certs = staffCertificates.filter(c => c.category === 'certificate').length;
    return { degrees, certs, total: staffCertificates.length };
  }, [staffCertificates]);

  // Overall statistics
  const stats = useMemo(() => {
    const totalStaff = staffList.length;
    const staffWithCerts = staffList.filter(s => s.certificateCount > 0).length;
    const totalCerts = staffList.reduce((acc, curr) => acc + curr.certificateCount, 0);
    return { totalStaff, staffWithCerts, totalCerts };
  }, [staffList]);

  // Handle edit certificate save
  async function handleUpdateCertificate(id: string, input: UpdateCertificateInput) {
    setActionBusy(true);
    try {
      const updatedRaw = await certificateApi.update(id, input);
      const updated = normalizeCertificate(updatedRaw);
      setStaffCertificates(prev => prev.map(c => (c.certificateId === id ? updated : c)));
      const label = (updated.categoryLabel?.toLowerCase() || 'hồ sơ');
      setNotice(`Đã cập nhật ${label} "${updated.certificateType}" thành công.`);
      setEditingCert(null);
    } finally {
      setActionBusy(false);
    }
  }

  // Handle create certificate save
  async function handleCreateCertificate(input: SaveCertificateInput) {
    setActionBusy(true);
    try {
      const createdRaw = await certificateApi.create(input);
      const created = normalizeCertificate(createdRaw);
      setStaffCertificates(prev => [created, ...prev]);
      // Increment count in staff list
      setStaffList(prev =>
        prev.map(s =>
          s.staffId === input.staffId
            ? { ...s, certificateCount: s.certificateCount + 1 }
            : s
        )
      );
      if (selectedStaff && selectedStaff.staffId === input.staffId) {
        setSelectedStaff(prev =>
          prev ? { ...prev, certificateCount: prev.certificateCount + 1 } : null
        );
      }
      const label = (created.categoryLabel?.toLowerCase() || 'hồ sơ');
      setNotice(`Đã thêm ${label} "${created.certificateType}" thành công.`);
      setCreatingForStaff(null);
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <section>
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <span className="eyebrow">HỒ SƠ NĂNG LỰC & CHỨNG CHỈ Y TẾ</span>
          <h1>Quản lý Bằng cấp & Chứng chỉ</h1>
          <p className="muted">
            Quản lý và theo dõi danh sách bằng cấp và chứng chỉ chuyên môn của đội ngũ y bác sĩ, nhân viên phòng khám.
          </p>
        </div>
      </div>

      {/* Notifications */}
      {error && <Alert variant="error">{error}</Alert>}
      {notice && (
        <Alert variant="success">
          {notice}
          <button
            className="icon-button"
            style={{ marginLeft: 'auto' }}
            onClick={() => setNotice('')}
            aria-label="Đóng thông báo"
          >
            <Icon name="close" size={16} />
          </button>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="stats-grid mb-6">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Tổng nhân viên
              </span>
              <div className="text-2xl font-bold text-slate-800 mt-1">{stats.totalStaff}</div>
            </div>
            <div className="stat-icon bg-emerald-50 text-teal-700">
              <Icon name="users" size={22} />
            </div>
          </div>
          <small className="text-slate-400">Nhân sự toàn phòng khám</small>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Có hồ sơ chuyên môn
              </span>
              <div className="text-2xl font-bold text-teal-700 mt-1">{stats.staffWithCerts}</div>
            </div>
            <div className="stat-icon bg-teal-50 text-teal-700">
              <Icon name="award" size={22} />
            </div>
          </div>
          <small className="text-slate-400">
            {stats.totalStaff ? Math.round((stats.staffWithCerts / stats.totalStaff) * 100) : 0}% trên tổng nhân sự
          </small>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Tổng số bằng cấp / CC
              </span>
              <div className="text-2xl font-bold text-blue-700 mt-1">{stats.totalCerts}</div>
            </div>
            <div className="stat-icon bg-blue-50 text-blue-700">
              <Icon name="fileText" size={22} />
            </div>
          </div>
          <small className="text-slate-400">Bằng cấp & chứng chỉ chuyên môn</small>
        </div>
      </div>

      {/* Main Split Layout or Single Table */}
      <div className={selectedStaff ? 'cert-split-container' : ''}>
        {/* LEFT PANEL: Staff Table */}
        <div className="cert-left-panel panel">
          <div className="list-heading">
            <div>
              <h2>
                Danh sách nhân viên <span className="count-badge">{filteredStaff.length}</span>
              </h2>
              {selectedStaff && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Đang xem:{' '}
                  <strong className="text-teal-700">{selectedStaff.fullName}</strong>
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selectedStaff && (
                <button
                  className="button"
                  style={{ padding: '6px 12px', minHeight: 32, fontSize: 12 }}
                  onClick={handleCloseSplitView}
                  title="Đóng chia đôi màn hình"
                >
                  Toàn màn hình
                </button>
              )}
              <button
                className="text-button"
                disabled={loading}
                onClick={() => void loadData()}
              >
                Làm mới
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="filter-bar">
            <input
              aria-label="Tìm nhân viên"
              placeholder="Mã NV, họ tên, khoa phòng..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select
              aria-label="Lọc khoa phòng"
              value={departmentId}
              onChange={e => setDepartmentId(e.target.value)}
            >
              <option value="">Tất cả khoa/phòng</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Lọc chứng chỉ"
              value={certFilter}
              onChange={e => setCertFilter(e.target.value as any)}
            >
              <option value="all">Tất cả nhân viên</option>
              <option value="has_cert">Có hồ sơ ({stats.staffWithCerts})</option>
              <option value="no_cert">Chưa có hồ sơ ({stats.totalStaff - stats.staffWithCerts})</option>
            </select>
          </div>

          {loading ? (
            <p className="loading-state" role="status">
              Đang tải danh sách nhân viên…
            </p>
          ) : filteredStaff.length === 0 ? (
            <div className="empty-state">
              <p>Không có nhân viên phù hợp.</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Mã NV</th>
                    <th scope="col">Nhân viên</th>
                    {!selectedStaff && <th scope="col">Khoa / Phòng</th>}
                    <th scope="col" className="text-center">Số bằng cấp / CC</th>
                    <th scope="col" className="text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map(staff => {
                    const isSelected = selectedStaff?.staffId === staff.staffId;
                    return (
                      <tr
                        key={staff.staffId}
                        className={isSelected ? 'table-row-selected' : ''}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSelectStaff(staff)}
                      >
                        <td>
                          <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                            {staff.staffCode}
                          </span>
                        </td>
                        <td>
                          <div className="person-cell">
                            <span className="avatar small">{initials(staff.fullName)}</span>
                            <div>
                              <strong className="text-slate-800 block">{staff.fullName}</strong>
                              <small className="text-slate-400 block">{staff.departmentName}</small>
                            </div>
                          </div>
                        </td>
                        {!selectedStaff && <td>{staff.departmentName}</td>}
                        <td className="text-center">
                          <span
                            className={`cert-count-badge ${
                              staff.certificateCount > 0 ? 'has-certs' : 'zero'
                            }`}
                          >
                            {staff.certificateCount}
                          </span>
                        </td>
                        <td className="text-right" onClick={e => e.stopPropagation()}>
                          <button
                            className={`button ${isSelected ? 'primary' : ''}`}
                            style={{ padding: '6px 12px', minHeight: 34, fontSize: 12 }}
                            onClick={() => handleSelectStaff(staff)}
                            title="Xem các bằng cấp / chứng chỉ của nhân viên"
                          >
                            <Icon name="eye" size={16} />
                            {isSelected ? 'Đang xem' : 'Xem hồ sơ'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Certificates / Degrees of Selected Staff (Split View) */}
        {selectedStaff && (
          <div className="cert-right-panel panel">
            {/* Header of Right Panel */}
            <div className="list-heading border-b border-slate-200">
              <div className="flex items-center gap-3">
                <span className="avatar" style={{ width: 42, height: 42, fontSize: 15 }}>
                  {initials(selectedStaff.fullName)}
                </span>
                <div>
                  <h2 className="flex items-center gap-2">
                    {selectedStaff.fullName}
                    <span className="count-badge">
                      {staffCertificates.length} hồ sơ
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mã NV: <strong>{selectedStaff.staffCode}</strong> • Khoa: <strong>{selectedStaff.departmentName}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="button primary"
                  style={{ padding: '7px 14px', minHeight: 36, fontSize: 12 }}
                  onClick={() => setCreatingForStaff(selectedStaff)}
                >
                  <Icon name="plus" size={16} /> Thêm mới
                </button>
                <button
                  className="icon-button"
                  onClick={handleCloseSplitView}
                  title="Đóng xem chi tiết (Toàn màn hình)"
                  aria-label="Đóng bảng chi tiết"
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
            </div>

            {/* Category Filter Tabs: Chỉ còn Bằng cấp & Chứng chỉ */}
            {staffCertificates.length > 0 && (
              <div className="flex items-center gap-1.5 px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex-wrap">
                <button
                  type="button"
                  className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
                    selectedCategoryTab === 'all'
                      ? 'bg-slate-800 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                  }`}
                  onClick={() => setSelectedCategoryTab('all')}
                >
                  Tất cả ({categoryCounts.total})
                </button>

                <button
                  type="button"
                  className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all inline-flex items-center gap-1 ${
                    selectedCategoryTab === 'degree'
                      ? 'bg-indigo-700 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-800'
                  }`}
                  onClick={() => setSelectedCategoryTab('degree')}
                >
                  <span>Bằng cấp</span>
                  <span className="text-[10px] font-bold px-1 rounded bg-black/10">
                    {categoryCounts.degrees}
                  </span>
                </button>

                <button
                  type="button"
                  className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all inline-flex items-center gap-1 ${
                    selectedCategoryTab === 'certificate'
                      ? 'bg-amber-700 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-amber-50 hover:text-amber-800'
                  }`}
                  onClick={() => setSelectedCategoryTab('certificate')}
                >
                  <span>Chứng chỉ</span>
                  <span className="text-[10px] font-bold px-1 rounded bg-black/10">
                    {categoryCounts.certs}
                  </span>
                </button>
              </div>
            )}

            {/* Certificates List / Table */}
            {loadingCertificates ? (
              <p className="loading-state" role="status">
                Đang tải hồ sơ của {selectedStaff.fullName}…
              </p>
            ) : staffCertificates.length === 0 ? (
              <div className="empty-state p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Icon name="award" size={26} />
                </div>
                <h3 className="font-semibold text-slate-700">Chưa có bằng cấp hoặc chứng chỉ</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                  Nhân viên {selectedStaff.fullName} ({selectedStaff.staffCode}) chưa được thêm hồ sơ nào vào hệ thống.
                </p>
                <button
                  className="button primary"
                  style={{ padding: '8px 16px', fontSize: 13 }}
                  onClick={() => setCreatingForStaff(selectedStaff)}
                >
                  <Icon name="plus" size={16} /> Thêm bằng cấp / chứng chỉ mới
                </button>
              </div>
            ) : filteredCertificates.length === 0 ? (
              <div className="empty-state p-8 text-center">
                <p className="text-xs text-slate-500">
                  Không có hồ sơ nào thuộc nhóm đang chọn.
                </p>
              </div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Tên & Phân loại</th>
                      <th scope="col">Ngày nhập vào</th>
                      <th scope="col">Ngày thay đổi</th>
                      <th scope="col">Thời hạn / Xác minh</th>
                      <th scope="col" className="text-right">Hành động</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCertificates.map(cert => {
                      const isDegree = cert.category === 'degree';
                      const isExpired = cert.expiryDate
                        ? new Date(cert.expiryDate) < new Date()
                        : false;

                      // Verification status label for Degree
                      const verStatus = cert.verificationStatus || cert.status;
                      const verLabel =
                        verStatus === 'verified'
                          ? 'Đã xác minh'
                          : verStatus === 'rejected'
                          ? 'Không hợp lệ'
                          : 'Chưa xác minh';

                      const verClass =
                        verStatus === 'verified'
                          ? 'active'
                          : verStatus === 'rejected'
                          ? 'inactive'
                          : 'pending';

                      // Status label for Certificate
                      const certStatusClass =
                        cert.status === 'active' && !isExpired
                          ? 'active'
                          : cert.status === 'expired' || isExpired
                          ? 'inactive'
                          : 'pending';

                      const certStatusLabel =
                        cert.status === 'active'
                          ? isExpired
                            ? 'Hết hạn'
                            : 'Đang hiệu lực'
                          : cert.status === 'expired' || isExpired
                          ? 'Hết hạn'
                          : cert.status === 'suspended'
                          ? 'Tạm đình chỉ'
                          : cert.status || 'Chưa xác định';

                      const categoryBadge = isDegree ? (
                        <span className="inline-flex items-center text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          Bằng cấp
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          Chứng chỉ
                        </span>
                      );

                      return (
                        <tr key={cert.certificateId}>
                          <td>
                            <div>
                              <div className="mb-1">{categoryBadge}</div>
                              <strong className="text-slate-800 block font-medium">
                                {cert.certificateType}
                              </strong>
                              {isDegree ? (
                                <small className="text-slate-500 block">
                                  {cert.degreeType && `Trình độ: ${cert.degreeType}`}
                                  {cert.major && ` • Ngành: ${cert.major}`}
                                </small>
                              ) : (
                                <small className="text-slate-500 block">
                                  Nơi cấp: {cert.issuingAuthority || 'Chưa cập nhật'}
                                </small>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className="text-xs text-slate-700 font-mono">
                              {formatDateTime(cert.createdAt)}
                            </span>
                          </td>
                          <td>
                            <span className="text-xs text-slate-700 font-mono">
                              {formatDateTime(cert.updatedAt)}
                            </span>
                          </td>
                          <td>
                            <div className="cert-dates">
                              <span className="text-slate-600">
                                Cấp: {formatDate(cert.issueDate)}
                              </span>
                              {!isDegree && (
                                <span className={isExpired ? 'text-red-600 font-medium' : 'text-slate-600'}>
                                  Hết hạn: {formatDate(cert.expiryDate)}
                                </span>
                              )}
                              <span
                                className={`status-badge ${isDegree ? verClass : certStatusClass}`}
                                style={{ width: 'fit-content' }}
                              >
                                <i />
                                {isDegree ? verLabel : certStatusLabel}
                              </span>
                            </div>
                          </td>
                          <td className="text-right">
                            <div className="table-actions justify-end">
                              <button
                                className="icon-button"
                                title="Xem chi tiết"
                                aria-label={`Xem chi tiết ${cert.certificateType}`}
                                onClick={() => setViewingCert(cert)}
                              >
                                <Icon name="eye" size={18} />
                              </button>
                              <button
                                className="icon-button"
                                title="Chỉnh sửa"
                                aria-label={`Chỉnh sửa ${cert.certificateType}`}
                                onClick={() => setEditingCert(cert)}
                              >
                                <Icon name="edit" size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {viewingCert && (
        <CertificateDetailModal
          certificate={viewingCert}
          onClose={() => setViewingCert(null)}
          onEdit={cert => setEditingCert(cert)}
        />
      )}

      {editingCert && (
        <CertificateEditModal
          certificate={editingCert}
          busy={actionBusy}
          onClose={() => setEditingCert(null)}
          onSave={handleUpdateCertificate}
        />
      )}

      {creatingForStaff && (
        <CertificateCreateModal
          staff={creatingForStaff}
          busy={actionBusy}
          onClose={() => setCreatingForStaff(null)}
          onSave={handleCreateCertificate}
        />
      )}
    </section>
  );
}
