import { useCallback, useEffect, useMemo, useState } from 'react';
import { cmeApi } from '../../services/cmeApi';
import { certificateApi } from '../../services/certificateApi';
import { departmentApi, type Department } from '../../services/departmentApi';
import type { Certificate, CertificateCategory } from '../../types/certificates';
import type {
  CmeRecord,
  SaveCmeRecordInput,
  StaffCmeSummary,
  UpdateCmeRecordInput,
} from '../../types/cme';
import { initials, formatDate } from '../../utils/format';
import Alert from '../../components/ui/Alert';
import Icon from '../../components/ui/Icon';
import CmeRecordCreateModal from '../../components/cme/CmeRecordCreateModal';
import CmeRecordEditModal from '../../components/cme/CmeRecordEditModal';
import CmeRecordDetailModal from '../../components/cme/CmeRecordDetailModal';

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
  };
}

export default function CmeRecordListPage() {
  const [staffList, setStaffList] = useState<StaffCmeSummary[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Selected staff for split-view
  const [selectedStaff, setSelectedStaff] = useState<StaffCmeSummary | null>(null);
  const [staffCertificates, setStaffCertificates] = useState<Certificate[]>([]);
  const [staffRecords, setStaffRecords] = useState<CmeRecord[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Filter states
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [cmeFilter, setCmeFilter] = useState<
    'all' | 'has_cme_req' | 'completed' | 'in_progress' | 'pending_verify'
  >('all');
  const [selectedCertFilter, setSelectedCertFilter] = useState<string>('all');
  const [verifyFilter, setVerifyFilter] = useState<'all' | 'verified' | 'unverified'>('all');

  // Modals
  const [viewingRecord, setViewingRecord] = useState<CmeRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<CmeRecord | null>(null);
  const [creatingForStaff, setCreatingForStaff] = useState<StaffCmeSummary | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [summaries, depts] = await Promise.all([
        cmeApi.listStaffSummaries(),
        departmentApi.list(),
      ]);
      setStaffList(summaries);
      setDepartments(depts);

      if (selectedStaff) {
        const found = summaries.find(s => s.staffId === selectedStaff.staffId);
        if (found) setSelectedStaff(found);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu CME.');
    } finally {
      setLoading(false);
    }
  }, [selectedStaff?.staffId]);

  useEffect(() => {
    void loadData();
  }, []);

  const loadStaffCmeDetails = useCallback(async (staffId: string) => {
    setLoadingDetails(true);
    try {
      const [certs, records] = await Promise.all([
        certificateApi.listByStaff(staffId),
        cmeApi.listByStaff(staffId),
      ]);
      const onlyCerts = certs
        .map(normalizeCertificate)
        .filter(c => c.category === 'certificate');
      setStaffCertificates(onlyCerts);
      setStaffRecords(records);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được chi tiết CME của nhân viên.');
    } finally {
      setLoadingDetails(false);
    }
  }, []);

  function handleSelectStaff(staff: StaffCmeSummary) {
    setSelectedStaff(staff);
    setSelectedCertFilter('all');
    setVerifyFilter('all');
    void loadStaffCmeDetails(staff.staffId);
  }

  function handleCloseSplitView() {
    setSelectedStaff(null);
    setStaffCertificates([]);
    setStaffRecords([]);
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
        normalize(`${s.staffCode} ${s.fullName} ${s.departmentName} ${s.email || ''}`).includes(
          term
        );
      const matchesDept = !departmentId || s.departmentId === departmentId;

      const isCompleted =
        s.totalRequiredCredits > 0 && s.verifiedCredits >= s.totalRequiredCredits;
      const isInProgress =
        s.totalRequiredCredits > 0 && s.verifiedCredits < s.totalRequiredCredits;

      const matchesCmeFilter =
        cmeFilter === 'all'
          ? true
          : cmeFilter === 'has_cme_req'
          ? s.totalRequiredCredits > 0 || s.cmeRecordCount > 0
          : cmeFilter === 'completed'
          ? isCompleted
          : cmeFilter === 'in_progress'
          ? isInProgress
          : s.pendingVerifyCount > 0;

      return matchesSearch && matchesDept && matchesCmeFilter;
    });
  }, [staffList, search, departmentId, cmeFilter]);

  // Filtered CME records of selected staff
  const filteredRecords = useMemo(() => {
    return staffRecords.filter(r => {
      const matchesCert = selectedCertFilter === 'all' || r.certificateId === selectedCertFilter;
      const matchesVerify =
        verifyFilter === 'all'
          ? true
          : verifyFilter === 'verified'
          ? r.verified
          : !r.verified;
      return matchesCert && matchesVerify;
    });
  }, [staffRecords, selectedCertFilter, verifyFilter]);

  // Overall stats
  const stats = useMemo(() => {
    const totalStaffWithCme = staffList.filter(
      s => s.totalRequiredCredits > 0 || s.cmeRecordCount > 0
    ).length;
    const totalRecords = staffList.reduce((acc, s) => acc + s.cmeRecordCount, 0);
    const totalCredits = staffList.reduce((acc, s) => acc + s.verifiedCredits, 0);
    const pendingVerify = staffList.reduce((acc, s) => acc + s.pendingVerifyCount, 0);
    return { totalStaffWithCme, totalRecords, totalCredits, pendingVerify };
  }, [staffList]);

  async function refreshSummariesSilently(staffId?: string) {
    try {
      const summaries = await cmeApi.listStaffSummaries();
      setStaffList(summaries);
      if (staffId) {
        const found = summaries.find(s => s.staffId === staffId);
        if (found) setSelectedStaff(found);
      }
    } catch {
      // ignore silent refresh failure
    }
  }

  async function handleCreateRecord(input: SaveCmeRecordInput) {
    if (!selectedStaff) return;
    setActionBusy(true);
    try {
      const created = await cmeApi.create(input);
      setStaffRecords(prev => [created, ...prev]);
      await refreshSummariesSilently(selectedStaff.staffId);
      setNotice(`Đã thêm khóa CME "${created.courseName}" (+${created.credits} tín chỉ) thành công.`);
      setCreatingForStaff(null);
    } finally {
      setActionBusy(false);
    }
  }

  async function handleUpdateRecord(id: string, input: UpdateCmeRecordInput) {
    if (!selectedStaff) return;
    setActionBusy(true);
    try {
      const updated = await cmeApi.update(id, input);
      setStaffRecords(prev => prev.map(r => (r.cmeId === id ? updated : r)));
      await refreshSummariesSilently(selectedStaff.staffId);
      setNotice(`Đã cập nhật bản ghi CME "${updated.courseName}" thành công.`);
      setEditingRecord(null);
    } finally {
      setActionBusy(false);
    }
  }

  async function handleToggleVerify(record: CmeRecord) {
    if (!selectedStaff) return;
    setActionBusy(true);
    setError('');
    try {
      const updated = await cmeApi.verify(record.cmeId, !record.verified);
      setStaffRecords(prev => prev.map(r => (r.cmeId === record.cmeId ? updated : r)));
      if (viewingRecord?.cmeId === record.cmeId) {
        setViewingRecord(updated);
      }
      await refreshSummariesSilently(selectedStaff.staffId);
      setNotice(
        updated.verified
          ? `Đã xác minh bản ghi CME "${updated.courseName}".`
          : `Đã hủy xác minh bản ghi CME "${updated.courseName}".`
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không cập nhật được trạng thái xác minh.');
    } finally {
      setActionBusy(false);
    }
  }

  return (
    <section>
      {/* Page Heading */}
      <div className="page-heading">
        <div>
          <span className="eyebrow">ĐÀO TẠO LIÊN TỤC Y KHOA (CME)</span>
          <h1>Quản lý Hồ sơ CME (CME Records)</h1>
          <p className="muted">
            Theo dõi quá trình tích lũy tín chỉ đào tạo liên tục (CME), xác minh chứng nhận khóa học và đánh giá định mức theo chứng chỉ chuyên môn.
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
                Nhân sự theo dõi CME
              </span>
              <div className="text-2xl font-bold text-slate-800 mt-1">
                {stats.totalStaffWithCme}
              </div>
            </div>
            <div className="stat-icon bg-emerald-50 text-teal-700">
              <Icon name="users" size={22} />
            </div>
          </div>
          <small className="text-slate-400">Có chứng chỉ yêu cầu CME hoặc bản ghi CME</small>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Tổng bản ghi CME
              </span>
              <div className="text-2xl font-bold text-teal-700 mt-1">{stats.totalRecords}</div>
            </div>
            <div className="stat-icon bg-teal-50 text-teal-700">
              <Icon name="fileText" size={22} />
            </div>
          </div>
          <small className="text-slate-400">Khóa học & hội thảo đã ghi nhận</small>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
                Tổng tín chỉ đã xác minh
              </span>
              <div className="text-2xl font-bold text-blue-700 mt-1">
                {stats.totalCredits}
              </div>
            </div>
            <div className="stat-icon bg-blue-50 text-blue-700">
              <Icon name="award" size={22} />
            </div>
          </div>
          <small className="text-slate-400">
            {stats.pendingVerify > 0
              ? `Còn ${stats.pendingVerify} bản ghi chờ xác minh`
              : 'Tất cả bản ghi đã được xác minh'}
          </small>
        </div>
      </div>

      {/* Main Split Layout */}
      <div className={selectedStaff ? 'cert-split-container' : ''}>
        {/* LEFT PANEL: Staff CME Table */}
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
              aria-label="Lọc tiến độ CME"
              value={cmeFilter}
              onChange={e => setCmeFilter(e.target.value as any)}
            >
              <option value="all">Tất cả nhân viên</option>
              <option value="has_cme_req">Có yêu cầu / hồ sơ CME</option>
              <option value="completed">Đã đủ tín chỉ CME</option>
              <option value="in_progress">Chưa đủ tín chỉ CME</option>
              <option value="pending_verify">Có bản ghi chờ xác minh</option>
            </select>
          </div>

          {loading ? (
            <p className="loading-state" role="status">
              Đang tải danh sách CME nhân viên…
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
                    <th scope="col" className="text-center">
                      Số khóa CME
                    </th>
                    <th scope="col">Tiến độ Tín chỉ CME</th>
                    <th scope="col" className="text-right">
                      Hành động
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.map(staff => {
                    const isSelected = selectedStaff?.staffId === staff.staffId;
                    const req = staff.totalRequiredCredits;
                    const verified = staff.verifiedCredits;
                    const pct =
                      req > 0 ? Math.min(100, Math.round((verified / req) * 100)) : 0;

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
                              <small className="text-slate-400 block">
                                {staff.departmentName} • {staff.certificateCount} chứng chỉ
                              </small>
                            </div>
                          </div>
                        </td>
                        {!selectedStaff && <td>{staff.departmentName}</td>}
                        <td className="text-center">
                          <span
                            className={`cert-count-badge ${
                              staff.cmeRecordCount > 0 ? 'has-certs' : 'zero'
                            }`}
                          >
                            {staff.cmeRecordCount}
                          </span>
                          {staff.pendingVerifyCount > 0 && (
                            <span className="block text-[10px] text-amber-600 font-semibold mt-0.5">
                              {staff.pendingVerifyCount} chờ duyệt
                            </span>
                          )}
                        </td>
                        <td>
                          {req > 0 ? (
                            <div style={{ minWidth: 130 }}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className="font-semibold text-slate-700">
                                  {verified} / {req} tín chỉ
                                </span>
                                <span
                                  className={`font-bold ${
                                    pct >= 100 ? 'text-emerald-600' : 'text-amber-600'
                                  }`}
                                >
                                  {pct}%
                                </span>
                              </div>
                              <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    pct >= 100 ? 'bg-emerald-600' : 'bg-teal-600'
                                  }`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          ) : staff.totalEarnedCredits > 0 ? (
                            <span className="text-xs font-semibold text-teal-700">
                              {verified} tín chỉ đã xác minh
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">Chưa có định mức CME</span>
                          )}
                        </td>
                        <td className="text-right" onClick={e => e.stopPropagation()}>
                          <button
                            className={`button ${isSelected ? 'primary' : ''}`}
                            style={{ padding: '6px 12px', minHeight: 34, fontSize: 12 }}
                            onClick={() => handleSelectStaff(staff)}
                          >
                            <Icon name="eye" size={16} />
                            {isSelected ? 'Đang xem' : 'Quản lý CME'}
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

        {/* RIGHT PANEL: CME Records of Selected Staff */}
        {selectedStaff && (
          <div className="cert-right-panel panel">
            {/* Header */}
            <div className="list-heading border-b border-slate-200">
              <div className="flex items-center gap-3">
                <span className="avatar" style={{ width: 42, height: 42, fontSize: 15 }}>
                  {initials(selectedStaff.fullName)}
                </span>
                <div>
                  <h2 className="flex items-center gap-2">
                    {selectedStaff.fullName}
                    <span className="count-badge">{staffRecords.length} khóa CME</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Mã NV: <strong>{selectedStaff.staffCode}</strong> • Khoa:{' '}
                    <strong>{selectedStaff.departmentName}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  className="button primary"
                  style={{ padding: '7px 14px', minHeight: 36, fontSize: 12 }}
                  onClick={() => setCreatingForStaff(selectedStaff)}
                  disabled={staffCertificates.length === 0}
                  title={
                    staffCertificates.length === 0
                      ? 'Nhân viên cần có ít nhất 1 chứng chỉ chuyên môn để thêm CME'
                      : 'Thêm khóa đào tạo CME mới'
                  }
                >
                  <Icon name="plus" size={16} /> Thêm CME
                </button>
                <button
                  className="icon-button"
                  onClick={handleCloseSplitView}
                  title="Đóng xem chi tiết"
                  aria-label="Đóng bảng chi tiết"
                >
                  <Icon name="close" size={18} />
                </button>
              </div>
            </div>

            {/* Certificate CME Summary Cards */}
            {staffCertificates.length > 0 && (
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Chứng chỉ chuyên môn & Định mức CME ({staffCertificates.length})
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all ${
                      selectedCertFilter === 'all'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                    onClick={() => setSelectedCertFilter('all')}
                  >
                    Tất cả chứng chỉ ({staffRecords.length})
                  </button>

                  {staffCertificates.map(cert => {
                    const certRecords = staffRecords.filter(
                      r => r.certificateId === cert.certificateId
                    );
                    const earnedVerified = certRecords
                      .filter(r => r.verified)
                      .reduce((sum, r) => sum + r.credits, 0);
                    const req = cert.cmeRequiredCredits || 0;
                    const isActive = selectedCertFilter === cert.certificateId;

                    return (
                      <button
                        key={cert.certificateId}
                        type="button"
                        className={`text-xs px-3 py-1.5 rounded-md font-medium transition-all inline-flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-teal-700 text-white shadow-sm'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-teal-50'
                        }`}
                        onClick={() => setSelectedCertFilter(cert.certificateId)}
                      >
                        <span>{cert.certificateType}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            isActive ? 'bg-black/20 text-white' : 'bg-slate-100 text-teal-800'
                          }`}
                        >
                          {req > 0 ? `${earnedVerified}/${req} TC` : `${earnedVerified} TC`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Filter by Verification status */}
            {staffRecords.length > 0 && (
              <div className="flex items-center justify-between px-6 py-2 bg-white border-b border-slate-100 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium">Trạng thái:</span>
                  <button
                    type="button"
                    className={`px-2.5 py-1 rounded ${
                      verifyFilter === 'all'
                        ? 'bg-slate-100 font-semibold text-slate-800'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    onClick={() => setVerifyFilter('all')}
                  >
                    Tất cả
                  </button>
                  <button
                    type="button"
                    className={`px-2.5 py-1 rounded ${
                      verifyFilter === 'verified'
                        ? 'bg-emerald-50 font-semibold text-emerald-700'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    onClick={() => setVerifyFilter('verified')}
                  >
                    Đã xác minh ({staffRecords.filter(r => r.verified).length})
                  </button>
                  <button
                    type="button"
                    className={`px-2.5 py-1 rounded ${
                      verifyFilter === 'unverified'
                        ? 'bg-amber-50 font-semibold text-amber-700'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    onClick={() => setVerifyFilter('unverified')}
                  >
                    Chờ xác minh ({staffRecords.filter(r => !r.verified).length})
                  </button>
                </div>

                <span className="text-slate-500">
                  Tổng đã xác minh:{' '}
                  <strong className="text-teal-700">
                    {selectedStaff.verifiedCredits}
                    {selectedStaff.totalRequiredCredits > 0
                      ? ` / ${selectedStaff.totalRequiredCredits}`
                      : ''}{' '}
                    tín chỉ
                  </strong>
                </span>
              </div>
            )}

            {/* CME Records Table */}
            {loadingDetails ? (
              <p className="loading-state" role="status">
                Đang tải hồ sơ CME của {selectedStaff.fullName}…
              </p>
            ) : staffCertificates.length === 0 ? (
              <div className="empty-state p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-3">
                  <Icon name="award" size={26} />
                </div>
                <h3 className="font-semibold text-slate-700">
                  Nhân viên chưa có Chứng chỉ chuyên môn
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                  Bản ghi CME cần được liên kết với một Chứng chỉ chuyên môn. Vui lòng thêm chứng chỉ cho nhân viên tại mục Bằng cấp & Chứng chỉ trước.
                </p>
              </div>
            ) : staffRecords.length === 0 ? (
              <div className="empty-state p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Icon name="fileText" size={26} />
                </div>
                <h3 className="font-semibold text-slate-700">Chưa có bản ghi CME nào</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1 mb-4">
                  Nhân viên {selectedStaff.fullName} ({selectedStaff.staffCode}) chưa có khóa đào tạo liên tục (CME) nào được ghi nhận.
                </p>
                <button
                  className="button primary"
                  style={{ padding: '8px 16px', fontSize: 13 }}
                  onClick={() => setCreatingForStaff(selectedStaff)}
                >
                  <Icon name="plus" size={16} /> Thêm bản ghi CME đầu tiên
                </button>
              </div>
            ) : filteredRecords.length === 0 ? (
              <div className="empty-state p-8 text-center">
                <p className="text-xs text-slate-500">
                  Không có bản ghi CME nào khớp với bộ lọc đang chọn.
                </p>
              </div>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Khóa học / Hội thảo CME</th>
                      <th scope="col">Chứng chỉ liên kết</th>
                      <th scope="col">Ngày hoàn thành</th>
                      <th scope="col" className="text-center">
                        Số tín chỉ
                      </th>
                      <th scope="col">Trạng thái</th>
                      <th scope="col" className="text-right">
                        Hành động
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecords.map(rec => (
                      <tr key={rec.cmeId}>
                        <td>
                          <div>
                            <strong className="text-slate-800 block font-medium">
                              {rec.courseName}
                            </strong>
                            <small className="text-slate-500 block">
                              Đơn vị: {rec.provider || 'Chưa cập nhật'}
                            </small>
                          </div>
                        </td>
                        <td>
                          <span className="inline-flex items-center text-xs font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {rec.certificateType}
                          </span>
                        </td>
                        <td>
                          <span className="text-xs text-slate-700">
                            {formatDate(rec.completedDate)}
                          </span>
                        </td>
                        <td className="text-center">
                          <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
                            +{rec.credits}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`status-badge ${rec.verified ? 'active' : 'pending'}`}
                            style={{ width: 'fit-content', cursor: 'pointer' }}
                            title="Nhấn để đổi nhanh trạng thái xác minh"
                            onClick={() => void handleToggleVerify(rec)}
                          >
                            <i />
                            {rec.verified ? 'Đã xác minh' : 'Chờ xác minh'}
                          </span>
                        </td>
                        <td className="text-right">
                          <div className="table-actions justify-end">
                            <button
                              className="icon-button"
                              title="Xem chi tiết"
                              aria-label={`Xem chi tiết ${rec.courseName}`}
                              onClick={() => setViewingRecord(rec)}
                            >
                              <Icon name="eye" size={18} />
                            </button>
                            <button
                              className="icon-button"
                              title="Chỉnh sửa"
                              aria-label={`Chỉnh sửa ${rec.courseName}`}
                              onClick={() => setEditingRecord(rec)}
                            >
                              <Icon name="edit" size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {viewingRecord && (
        <CmeRecordDetailModal
          record={viewingRecord}
          busy={actionBusy}
          onClose={() => setViewingRecord(null)}
          onEdit={rec => setEditingRecord(rec)}
          onToggleVerify={rec => void handleToggleVerify(rec)}
        />
      )}

      {editingRecord && (
        <CmeRecordEditModal
          record={editingRecord}
          certificates={staffCertificates}
          busy={actionBusy}
          onClose={() => setEditingRecord(null)}
          onSave={handleUpdateRecord}
        />
      )}

      {creatingForStaff && (
        <CmeRecordCreateModal
          staff={creatingForStaff}
          certificates={staffCertificates}
          defaultCertificateId={
            selectedCertFilter !== 'all' ? selectedCertFilter : undefined
          }
          busy={actionBusy}
          onClose={() => setCreatingForStaff(null)}
          onSave={handleCreateRecord}
        />
      )}
    </section>
  );
}
