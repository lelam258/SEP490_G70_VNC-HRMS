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
import Modal from '../../components/ui/Modal';
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
    rejectionReason: raw.rejectionReason || null,
  };
}

const STAFF_PER_PAGE = 4;
const CERTS_PER_PAGE = 3;

export default function CertificateListPage() {
  const [searchParams] = useSearchParams();
  const staffIdParam = searchParams.get('staffId');
  const [staffList, setStaffList] = useState<StaffCertificateSummary[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [pendingCerts, setPendingCerts] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Selected staff for split-view
  const [selectedStaff, setSelectedStaff] = useState<StaffCertificateSummary | null>(null);
  const [staffCertificates, setStaffCertificates] = useState<Certificate[]>([]);
  const [loadingCertificates, setLoadingCertificates] = useState(false);

  // Pagination states (4 nhân viên/trang, 3 chứng chỉ/trang khi chia đôi)
  const [staffPage, setStaffPage] = useState(1);
  const [certPage, setCertPage] = useState(1);

  // Filter states
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [certFilter, setCertFilter] = useState<'all' | 'has_cert' | 'no_cert' | 'pending'>('all');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<'all' | CertificateCategory | 'pending'>('all');

  // Modals
  const [viewingCert, setViewingCert] = useState<Certificate | null>(null);
  const [editingCert, setEditingCert] = useState<Certificate | null>(null);
  const [creatingForStaff, setCreatingForStaff] = useState<StaffCertificateSummary | null>(null);
  const [rejectingCert, setRejectingCert] = useState<Certificate | null>(null);
  const [quickRejectReason, setQuickRejectReason] = useState('');
  const [quickRejectError, setQuickRejectError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);

  // Set of staff IDs with pending certificates
  const pendingStaffIds = useMemo(() => new Set(pendingCerts.map(c => c.staffId)), [pendingCerts]);

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

  // Load staff summaries, departments & pending certificates
  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaries, depts, pending] = await Promise.all([
        certificateApi.listStaffSummaries(),
        departmentApi.list(),
        certificateApi.listPending().catch(() => []),
      ]);
      setStaffList(summaries);
      setDepartments(depts);
      setPendingCerts(pending.map(normalizeCertificate));

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

  // Handle Review (Approve / Reject) Certificate
  async function handleReviewCertificate(cert: Certificate, action: 'approve' | 'reject', reason?: string) {
    setActionBusy(true);
    try {
      const updatedRaw = await certificateApi.review(cert.certificateId, {
        action,
        rejectionReason: reason,
      });
      const updated = normalizeCertificate(updatedRaw);

      // Update right panel list
      setStaffCertificates(prev => prev.map(c => (c.certificateId === cert.certificateId ? updated : c)));

      // If currently viewing modal, update it
      if (viewingCert?.certificateId === cert.certificateId) {
        setViewingCert(updated);
      }

      // Refresh pending list
      const newPending = await certificateApi.listPending().catch(() => []);
      setPendingCerts(newPending.map(normalizeCertificate));

      setNotice(
        action === 'approve'
          ? `Đã phê duyệt thành công hồ sơ "${updated.certificateType}".`
          : `Đã từ chối hồ sơ "${updated.certificateType}".`
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Thẩm định hồ sơ thất bại.');
    } finally {
      setActionBusy(false);
    }
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
          : certFilter === 'pending'
          ? pendingStaffIds.has(s.staffId)
          : certFilter === 'has_cert'
          ? s.certificateCount > 0
          : s.certificateCount === 0;

      return matchesSearch && matchesDept && matchesCertFilter;
    });
  }, [staffList, search, departmentId, certFilter, pendingStaffIds]);

  // Certificates of selected staff filtered by category tab
  const filteredCertificates = useMemo(() => {
    if (selectedCategoryTab === 'all') return staffCertificates;
    if (selectedCategoryTab === 'pending') {
      return staffCertificates.filter(
        c => c.status === 'unverified' || c.status === 'pending' || c.verificationStatus === 'unverified'
      );
    }
    return staffCertificates.filter(c => c.category === selectedCategoryTab);
  }, [staffCertificates, selectedCategoryTab]);

  // Counts by category for selected staff
  const categoryCounts = useMemo(() => {
    const degrees = staffCertificates.filter(c => c.category === 'degree').length;
    const certs = staffCertificates.filter(c => c.category === 'certificate').length;
    const pending = staffCertificates.filter(
      c => c.status === 'unverified' || c.status === 'pending' || c.verificationStatus === 'unverified'
    ).length;
    return { degrees, certs, pending, total: staffCertificates.length };
  }, [staffCertificates]);

  // Reset staffPage when staff filters change
  useEffect(() => {
    setStaffPage(1);
  }, [search, departmentId, certFilter]);

  // Reset certPage when selected staff or category tab changes
  useEffect(() => {
    setCertPage(1);
  }, [selectedStaff?.staffId, selectedCategoryTab]);

  // Staff pagination (4 staff per page)
  const totalStaffPages = Math.max(1, Math.ceil(filteredStaff.length / STAFF_PER_PAGE));
  const paginatedStaff = useMemo(() => {
    const start = (staffPage - 1) * STAFF_PER_PAGE;
    return filteredStaff.slice(start, start + STAFF_PER_PAGE);
  }, [filteredStaff, staffPage]);

  // Certificate pagination (3 certs per page when split)
  const totalCertPages = Math.max(1, Math.ceil(filteredCertificates.length / CERTS_PER_PAGE));
  const paginatedCertificates = useMemo(() => {
    const start = (certPage - 1) * CERTS_PER_PAGE;
    return filteredCertificates.slice(start, start + CERTS_PER_PAGE);
  }, [filteredCertificates, certPage]);

  // Overall statistics
  const stats = useMemo(() => {
    const totalStaff = staffList.length;
    const staffWithCerts = staffList.filter(s => s.certificateCount > 0).length;
    const totalCerts = staffList.reduce((acc, curr) => acc + curr.certificateCount, 0);
    const pendingTotal = pendingCerts.length;
    return { totalStaff, staffWithCerts, totalCerts, pendingTotal };
  }, [staffList, pendingCerts]);

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
            Quản lý, thẩm định phê duyệt hồ sơ bằng cấp chuyên môn và chứng chỉ hành nghề của nhân sự phòng khám.
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

      {/* Compact Stats Cards (Tiết kiệm chiều cao, không bị cuộn dọc) */}
      <div className="cert-stats-grid">
        <div className="cert-stat-card">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                Tổng nhân viên
              </span>
              <div className="text-xl font-bold text-slate-800 mt-0.5">{stats.totalStaff}</div>
            </div>
            <div className="stat-icon bg-emerald-50 text-teal-700">
              <Icon name="users" size={18} />
            </div>
          </div>
          <small className="text-[10px] text-slate-400 block mt-0.5">Nhân sự phòng khám</small>
        </div>

        <div className="cert-stat-card">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                Có hồ sơ chuyên môn
              </span>
              <div className="text-xl font-bold text-teal-700 mt-0.5">{stats.staffWithCerts}</div>
            </div>
            <div className="stat-icon bg-teal-50 text-teal-700">
              <Icon name="award" size={18} />
            </div>
          </div>
          <small className="text-[10px] text-slate-400 block mt-0.5">
            {stats.totalStaff ? Math.round((stats.staffWithCerts / stats.totalStaff) * 100) : 0}% trên tổng số
          </small>
        </div>

        <div className="cert-stat-card">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                Tổng bằng cấp / CC
              </span>
              <div className="text-xl font-bold text-blue-700 mt-0.5">{stats.totalCerts}</div>
            </div>
            <div className="stat-icon bg-blue-50 text-blue-700">
              <Icon name="fileText" size={18} />
            </div>
          </div>
          <small className="text-[10px] text-slate-400 block mt-0.5">Đã cập nhật vào hồ sơ</small>
        </div>

        {/* Thẻ Thống kê Chờ thẩm định */}
        <div
          className={`cert-stat-card cursor-pointer transition-all ${
            stats.pendingTotal > 0 ? 'border-amber-300 bg-amber-50/40 hover:bg-amber-50' : ''
          }`}
          onClick={() => setCertFilter(certFilter === 'pending' ? 'all' : 'pending')}
          title="Bấm để lọc các nhân viên có hồ sơ đang chờ duyệt"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] text-amber-700 font-semibold uppercase tracking-wider block">
                Chờ HR thẩm định
              </span>
              <div className="text-xl font-bold text-amber-600 mt-0.5 flex items-center gap-1.5">
                {stats.pendingTotal}
                {stats.pendingTotal > 0 && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                )}
              </div>
            </div>
            <div className="stat-icon bg-amber-100 text-amber-700">
              <Icon name="award" size={18} />
            </div>
          </div>
          <small className="text-[10px] text-amber-700 font-medium block mt-0.5">
            {certFilter === 'pending' ? '● Đang lọc chờ duyệt' : 'Bấm để lọc'}
          </small>
        </div>
      </div>

      {/* Main Split-view Layout */}
      <div className={`cert-split-container ${selectedStaff ? 'is-split' : ''}`}>
        {/* LEFT PANEL: Staff Directory */}
        <div className="cert-left-panel panel">
          {/* Header of Left Panel */}
          <div className="list-heading border-b border-slate-200">
            <div>
              <h2 className="flex items-center gap-2">
                Danh sách nhân viên
                <span className="count-badge">{filteredStaff.length}</span>
              </h2>
              {certFilter === 'pending' && (
                <p className="text-xs text-amber-700 mt-0.5 font-medium">
                  Đang lọc {filteredStaff.length} nhân viên có hồ sơ nộp mới chờ thẩm định.
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
              aria-label="Lọc có chứng chỉ"
              value={certFilter}
              onChange={e => setCertFilter(e.target.value as typeof certFilter)}
            >
              <option value="all">Tất cả nhân sự</option>
              <option value="pending">Chờ HR thẩm định ({stats.pendingTotal})</option>
              <option value="has_cert">Đã có bằng cấp / CC</option>
              <option value="no_cert">Chưa có bằng cấp / CC</option>
            </select>
          </div>

          {/* Staff Table */}
          {loading ? (
            <p className="loading-state" role="status">
              Đang tải danh sách nhân viên…
            </p>
          ) : filteredStaff.length === 0 ? (
            <div className="empty-state p-8 text-center">
              <p className="text-slate-500 text-sm">
                {certFilter === 'pending'
                  ? 'Hiện không có nhân viên nào có hồ sơ chờ thẩm định.'
                  : 'Không tìm thấy nhân viên nào phù hợp với bộ lọc.'}
              </p>
            </div>
          ) : (
            <div className="cert-table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: selectedStaff ? '20%' : '14%' }}>Mã NV</th>
                    <th scope="col" style={{ width: selectedStaff ? '44%' : '38%' }}>Họ và tên</th>
                    {!selectedStaff && <th scope="col" style={{ width: '22%' }}>Khoa / Phòng</th>}
                    <th scope="col" style={{ width: selectedStaff ? '18%' : '14%' }} className="text-center">
                      {selectedStaff ? 'Số CC' : 'Số bằng cấp / CC'}
                    </th>
                    <th scope="col" style={{ width: selectedStaff ? '18%' : '12%' }} className="text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStaff.map(staff => {
                    const isSelected = selectedStaff?.staffId === staff.staffId;
                    const hasPending = pendingStaffIds.has(staff.staffId);

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
                            <div className="truncate">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <strong className="text-slate-800 truncate block text-xs">{staff.fullName}</strong>
                                {hasPending && (
                                  <span className="inline-flex items-center px-1 py-0.2 rounded text-[9px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                    ● Chờ duyệt
                                  </span>
                                )}
                              </div>
                              <small className="text-slate-400 block text-[10px] truncate">{staff.departmentName}</small>
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
                            style={{ padding: '3px 8px', minHeight: 28, fontSize: 11 }}
                            onClick={() => handleSelectStaff(staff)}
                            title="Xem các bằng cấp / chứng chỉ của nhân viên"
                          >
                            <Icon name="eye" size={13} />
                            <span>{isSelected ? 'Đang xem' : selectedStaff ? 'Xem' : 'Xem hồ sơ'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Staff Pagination Bar (4 staff/page - luôn ghim ở đáy) */}
              <div className="cert-pagination-bar">
                <span>
                  Trang <strong>{staffPage}</strong> / <strong>{totalStaffPages}</strong> ({filteredStaff.length} NV)
                </span>
                {totalStaffPages > 1 ? (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="button"
                      style={{ padding: '2px 7px', fontSize: 11, minHeight: 24 }}
                      disabled={staffPage <= 1}
                      onClick={() => setStaffPage(p => Math.max(1, p - 1))}
                    >
                      ← Trước
                    </button>
                    <button
                      type="button"
                      className="button"
                      style={{ padding: '2px 7px', fontSize: 11, minHeight: 24 }}
                      disabled={staffPage >= totalStaffPages}
                      onClick={() => setStaffPage(p => Math.min(totalStaffPages, p + 1))}
                    >
                      Sau →
                    </button>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-400">Đã hiển thị hết</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Certificates / Degrees of Selected Staff (Split View) */}
        {selectedStaff && (
          <div className="cert-right-panel panel">
            {/* Header of Right Panel (Cân bằng chiều cao với Left Panel list-heading) */}
            <div className="list-heading border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <span className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>
                  {initials(selectedStaff.fullName)}
                </span>
                <div>
                  <h2 className="flex items-center gap-1.5 text-xs font-bold text-slate-800 m-0">
                    <span>{selectedStaff.fullName}</span>
                    <span className="count-badge">
                      {staffCertificates.length} hồ sơ
                    </span>
                  </h2>
                  <p className="text-[10px] text-slate-500 m-0 mt-0.5">
                    Mã: <strong>{selectedStaff.staffCode}</strong> • Khoa: <strong>{selectedStaff.departmentName}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  className="button primary"
                  style={{ padding: '3px 9px', minHeight: 28, fontSize: 11 }}
                  onClick={() => setCreatingForStaff(selectedStaff)}
                >
                  <Icon name="plus" size={13} /> <span>Thêm mới</span>
                </button>
                <button
                  className="icon-button"
                  style={{ width: 28, height: 28 }}
                  onClick={handleCloseSplitView}
                  title="Đóng xem chi tiết (Toàn màn hình)"
                  aria-label="Đóng bảng chi tiết"
                >
                  <Icon name="close" size={15} />
                </button>
              </div>
            </div>

            {/* Category Filter Tabs (Cân bằng chiều cao với filter-bar bên trái) */}
            <div className="cert-tabs-bar">
              <button
                type="button"
                className={`text-[11px] px-2.5 py-1 rounded font-medium transition-all ${
                  selectedCategoryTab === 'all'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
                onClick={() => setSelectedCategoryTab('all')}
              >
                Tất cả ({categoryCounts.total})
              </button>

              {categoryCounts.pending > 0 && (
                <button
                  type="button"
                  className={`text-[11px] px-2.5 py-1 rounded font-medium transition-all inline-flex items-center gap-1 ${
                    selectedCategoryTab === 'pending'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-amber-50 hover:text-amber-800'
                  }`}
                  onClick={() => setSelectedCategoryTab('pending')}
                >
                  <span>Chờ duyệt</span>
                  <span className="text-[9px] font-bold px-1 rounded bg-amber-500 text-white animate-pulse">
                    {categoryCounts.pending}
                  </span>
                </button>
              )}

              <button
                type="button"
                className={`text-[11px] px-2.5 py-1 rounded font-medium transition-all inline-flex items-center gap-1 ${
                  selectedCategoryTab === 'degree'
                    ? 'bg-indigo-700 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-indigo-50 hover:text-indigo-800'
                }`}
                onClick={() => setSelectedCategoryTab('degree')}
              >
                <span>Bằng cấp</span>
                <span className="text-[9px] font-bold px-1 rounded bg-black/10">
                  {categoryCounts.degrees}
                </span>
              </button>

              <button
                type="button"
                className={`text-[11px] px-2.5 py-1 rounded font-medium transition-all inline-flex items-center gap-1 ${
                  selectedCategoryTab === 'certificate'
                    ? 'bg-amber-700 text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-amber-50 hover:text-amber-800'
                }`}
                onClick={() => setSelectedCategoryTab('certificate')}
              >
                <span>Chứng chỉ</span>
                <span className="text-[9px] font-bold px-1 rounded bg-black/10">
                  {categoryCounts.certs}
                </span>
              </button>
            </div>

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
              <div className="cert-table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th scope="col" style={{ width: '40%' }}>Tên & Phân loại</th>
                      <th scope="col" style={{ width: '19%' }}>Thời gian</th>
                      <th scope="col" style={{ width: '23%' }}>Thời hạn & Trạng thái</th>
                      <th scope="col" style={{ width: '18%' }} className="text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCertificates.map(cert => {
                      const isDegree = cert.category === 'degree';
                      const isExpired = cert.expiryDate
                        ? new Date(cert.expiryDate) < new Date()
                        : false;

                      const isPending =
                        cert.status === 'unverified' ||
                        cert.status === 'pending' ||
                        cert.verificationStatus === 'unverified';

                      const isRejected =
                        cert.status === 'rejected' ||
                        cert.verificationStatus === 'rejected';

                      // Verification status label for Degree
                      const verStatus = cert.verificationStatus || cert.status;
                      const verLabel =
                        verStatus === 'verified'
                          ? 'Đã xác minh'
                          : verStatus === 'rejected'
                          ? 'Bị từ chối'
                          : 'Chờ xác minh';

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
                          : cert.status === 'expired' || isExpired || cert.status === 'rejected'
                          ? 'inactive'
                          : 'pending';

                      const certStatusLabel =
                        cert.status === 'active'
                          ? isExpired
                            ? 'Hết hạn'
                            : 'Đang hiệu lực'
                          : cert.status === 'pending' || cert.status === 'unverified'
                          ? 'Chờ HR duyệt'
                          : cert.status === 'rejected'
                          ? 'Bị từ chối'
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
                        <tr key={cert.certificateId} className={isPending ? 'bg-amber-50/30' : undefined}>
                          <td>
                            <div>
                              <div className="mb-1 flex items-center gap-1.5 flex-wrap">
                                {categoryBadge}
                                {isPending && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                                    ● Chờ duyệt
                                  </span>
                                )}
                              </div>
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
                                  {cert.certificateNumber ? `Số: ${cert.certificateNumber} • ` : ''}
                                  Nơi cấp: {cert.issuingAuthority || 'Chưa cập nhật'}
                                </small>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="text-[11px] text-slate-600 space-y-0.5">
                              <div><span className="text-slate-400">Tạo:</span> {formatDate(cert.createdAt)}</div>
                              <div><span className="text-slate-400">Sửa:</span> {formatDate(cert.updatedAt)}</div>
                            </div>
                          </td>
                          <td>
                            <div className="cert-dates text-[11px] space-y-1">
                              <div>
                                <span className="text-slate-600">Cấp: {formatDate(cert.issueDate)}</span>
                                {!isDegree && (
                                  <span className={`block ${isExpired ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                                    Hạn: {formatDate(cert.expiryDate) || 'Vô thời hạn'}
                                  </span>
                                )}
                              </div>
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
                            <div className="table-actions justify-end items-center gap-1">
                              {/* Nút Phê duyệt nhanh & Từ chối nhanh cho HR */}
                              {isPending && (
                                <>
                                  <button
                                    type="button"
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                    title="Phê duyệt nhanh"
                                    aria-label={`Phê duyệt ${cert.certificateType}`}
                                    onClick={() => handleReviewCertificate(cert, 'approve')}
                                    disabled={actionBusy}
                                  >
                                    <Icon name="check" size={17} />
                                  </button>
                                  <button
                                    type="button"
                                    className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                                    title="Từ chối hồ sơ"
                                    aria-label={`Từ chối ${cert.certificateType}`}
                                    onClick={() => {
                                      setQuickRejectReason('');
                                      setQuickRejectError('');
                                      setRejectingCert(cert);
                                    }}
                                    disabled={actionBusy}
                                  >
                                    <Icon name="close" size={17} />
                                  </button>
                                </>
                              )}

                              <button
                                className="icon-button"
                                title="Xem chi tiết & thẩm định"
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

                {/* Certificate Pagination Bar (3 certs/page - luôn ghim ở đáy để cân bằng 2 bảng) */}
                <div className="cert-pagination-bar">
                  <span>
                    Trang <strong>{certPage}</strong> / <strong>{totalCertPages}</strong> ({filteredCertificates.length} hồ sơ)
                  </span>
                  {totalCertPages > 1 ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="button"
                        style={{ padding: '2px 7px', fontSize: 11, minHeight: 24 }}
                        disabled={certPage <= 1}
                        onClick={() => setCertPage(p => Math.max(1, p - 1))}
                      >
                        ← Trước
                      </button>
                      <button
                        type="button"
                        className="button"
                        style={{ padding: '2px 7px', fontSize: 11, minHeight: 24 }}
                        disabled={certPage >= totalCertPages}
                        onClick={() => setCertPage(p => Math.min(totalCertPages, p + 1))}
                      >
                        Sau →
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-400">Đã hiển thị hết</span>
                  )}
                </div>
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
          onReview={handleReviewCertificate}
          busyReview={actionBusy}
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

      {/* Modal Từ chối hồ sơ nhanh từ bảng */}
      {rejectingCert && (
        <Modal
          title="Từ chối phê duyệt hồ sơ"
          onClose={() => !actionBusy && setRejectingCert(null)}
          busy={actionBusy}
        >
          <div className="p-5 space-y-4 text-xs">
            <p className="text-slate-600">
              Nhập lý do từ chối hồ sơ <strong>{rejectingCert.certificateType}</strong>:
            </p>
            {quickRejectError && <Alert variant="error">{quickRejectError}</Alert>}
            <textarea
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20"
              rows={3}
              placeholder="Ví dụ: Tệp scan bị mờ, không rõ chữ ký hoặc dấu mộc..."
              value={quickRejectReason}
              onChange={(e) => setQuickRejectReason(e.target.value)}
              disabled={actionBusy}
            />
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                className="button secondary text-xs"
                onClick={() => setRejectingCert(null)}
                disabled={actionBusy}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="button danger text-xs"
                onClick={async () => {
                  if (!quickRejectReason.trim()) {
                    setQuickRejectError('Vui lòng nhập lý do từ chối hồ sơ.');
                    return;
                  }
                  await handleReviewCertificate(rejectingCert, 'reject', quickRejectReason.trim());
                  setRejectingCert(null);
                }}
                disabled={actionBusy}
              >
                {actionBusy ? 'Đang gửi...' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
