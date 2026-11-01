import { useCallback, useEffect, useMemo, useState } from 'react';
import { myCmeApi } from '../../services/myCmeApi';
import { myCertificateApi } from '../../services/myCertificateApi';
import type { CertificateCycle, CmeRecord, SaveCmeRecordInput } from '../../types/cme';
import type { Certificate } from '../../types/certificates';
import { formatDate } from '../../utils/format';
import Alert from '../../components/ui/Alert';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import CmeRecordDetailModal from '../../components/cme/CmeRecordDetailModal';
import MyCmeCreateModal from '../../components/cme/MyCmeCreateModal';

function isRecordInCycle(record: CmeRecord, cycle: CertificateCycle): boolean {
  // 1. If record has explicit cycleNumber, that is the definitive source of truth
  if (record.cycleNumber != null && cycle.cycleNumber != null) {
    return record.cycleNumber === cycle.cycleNumber;
  }

  // 2. If record has explicit cmeCycleId and cycle has cycleId, match them
  if (record.cmeCycleId && cycle.cycleId) {
    return record.cmeCycleId.toLowerCase() === cycle.cycleId.toLowerCase();
  }

  // 3. Fallback only when the record has NO assigned cycle
  if (cycle.cycleStart && cycle.cycleEnd && record.completedDate) {
    return record.completedDate >= cycle.cycleStart && record.completedDate <= cycle.cycleEnd;
  }

  return false;
}

export default function MyCmeListPage() {
  const [cycles, setCycles] = useState<CertificateCycle[]>([]);
  const [records, setRecords] = useState<CmeRecord[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Selected certificate for filtering and cycle progress
  const [selectedCycleCertId, setSelectedCycleCertId] = useState<string>('');
  // Selected cycle within the certificate (defaults to current/active cycle, or 'all')
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');

  // Search and status filters for records table
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending'>('all');

  // Pagination (4 items per page to prevent page overflow and scrolling)
  const PAGE_SIZE = 4;
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [savingCreate, setSavingCreate] = useState(false);
  const [selectedDetailRecord, setSelectedDetailRecord] = useState<CmeRecord | null>(null);

  // Delete Confirm Modal
  const [deletingRecord, setDeletingRecord] = useState<CmeRecord | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  // Unique list of certificates eligible for CME (no duplicates)
  const uniqueCmeCertificates = useMemo(() => {
    const map = new Map<
      string,
      { certificateId: string; certificateType: string; certificateNumber: string | null }
    >();

    // 1. From cycles
    for (const cy of cycles) {
      if (!map.has(cy.certificateId)) {
        map.set(cy.certificateId, {
          certificateId: cy.certificateId,
          certificateType: cy.certificateType,
          certificateNumber: cy.certificateNumber,
        });
      }
    }

    // 2. From certificates (in case a certificate has no cycle yet)
    for (const cert of certificates) {
      if ((cert.category === 'certificate' || !cert.category) && !map.has(cert.certificateId)) {
        map.set(cert.certificateId, {
          certificateId: cert.certificateId,
          certificateType: cert.certificateType,
          certificateNumber: cert.certificateNumber,
        });
      }
    }

    return Array.from(map.values());
  }, [cycles, certificates]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [fetchedCycles, fetchedRecords, fetchedCerts] = await Promise.all([
        myCmeApi.listCycles().catch(() => []),
        myCmeApi.listRecords().catch(() => []),
        myCertificateApi.list().catch(() => []),
      ]);

      const safeCycles = fetchedCycles || [];
      const safeRecords = fetchedRecords || [];
      const safeCerts = fetchedCerts || [];

      setCycles(safeCycles);
      setRecords(safeRecords);
      setCertificates(safeCerts);

      // Auto-select first certificate if not set
      if (!selectedCycleCertId) {
        if (safeCycles.length > 0) {
          setSelectedCycleCertId(safeCycles[0].certificateId);
        } else if (safeCerts.length > 0) {
          const firstEligible = safeCerts.find((c) => c.category === 'certificate') || safeCerts[0];
          setSelectedCycleCertId(firstEligible.certificateId);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tải được hồ sơ đào tạo liên tục CME.');
    } finally {
      setLoading(false);
    }
  }, [selectedCycleCertId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Keep selectedCycleCertId synced if uniqueCmeCertificates is available
  useEffect(() => {
    if (uniqueCmeCertificates.length > 0) {
      const exists = uniqueCmeCertificates.some((c) => c.certificateId === selectedCycleCertId);
      if (!exists) {
        setSelectedCycleCertId(uniqueCmeCertificates[0].certificateId);
        setSelectedCycleId('');
      }
    }
  }, [uniqueCmeCertificates, selectedCycleCertId]);

  // All cycles belonging to the currently selected certificate
  const certCycles = useMemo(() => {
    if (!selectedCycleCertId) return [];
    return cycles
      .filter((c) => c.certificateId === selectedCycleCertId)
      .sort((a, b) => b.cycleNumber - a.cycleNumber);
  }, [cycles, selectedCycleCertId]);

  // Current active / latest cycle for the selected certificate
  const currentActiveCycle = useMemo(() => {
    if (certCycles.length === 0) return null;
    return (
      certCycles.find((c) => c.isCurrentCycle) ||
      certCycles.find((c) => c.cycleStatus === 'active') ||
      certCycles[0]
    );
  }, [certCycles]);

  // The cycle currently chosen by user (defaults to currentActiveCycle)
  const activeCycle = useMemo(() => {
    if (certCycles.length === 0) return null;
    if (selectedCycleId === 'all') return null;
    if (selectedCycleId) {
      const found = certCycles.find(
        (c) =>
          String(c.cycleNumber) === selectedCycleId ||
          (c.cycleId && c.cycleId.toLowerCase() === selectedCycleId.toLowerCase())
      );
      if (found) return found;
    }
    return currentActiveCycle;
  }, [certCycles, selectedCycleId, currentActiveCycle]);

  // Selected value for the Cycle dropdown select
  const selectedCycleSelectValue = useMemo(() => {
    if (selectedCycleId === 'all') return 'all';
    if (selectedCycleId) return selectedCycleId;
    if (currentActiveCycle) {
      return currentActiveCycle.cycleId || String(currentActiveCycle.cycleNumber);
    }
    return '';
  }, [selectedCycleId, currentActiveCycle]);

  // Info of the selected certificate
  const selectedCertInfo = useMemo(() => {
    return uniqueCmeCertificates.find((c) => c.certificateId === selectedCycleCertId) || null;
  }, [uniqueCmeCertificates, selectedCycleCertId]);

  // Reset pagination to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCycleCertId, selectedCycleId, statusFilter, searchTerm]);

  // Filtered CME records for the table: strictly filtered by Selected Certificate and Selected Cycle!
  const filteredRecords = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return records.filter((r) => {
      // 1. Certificate filter: must belong to the selected certificate
      if (selectedCycleCertId && r.certificateId !== selectedCycleCertId) {
        return false;
      }

      // 2. Cycle filter: if a specific cycle is selected, match that cycle using isRecordInCycle
      if (selectedCycleId !== 'all' && activeCycle) {
        if (!isRecordInCycle(r, activeCycle)) {
          return false;
        }
      }

      // 3. Verification status filter
      if (statusFilter === 'verified' && !r.verified) return false;
      if (statusFilter === 'pending' && r.verified) return false;

      // 4. Keyword search
      if (q) {
        const matchCourse = r.courseName.toLowerCase().includes(q);
        const matchProvider = r.provider?.toLowerCase().includes(q);
        if (!matchCourse && !matchProvider) return false;
      }

      return true;
    });
  }, [records, selectedCycleCertId, selectedCycleId, activeCycle, statusFilter, searchTerm]);

  // Total pages and paginated records for the table
  const totalPages = Math.ceil(filteredRecords.length / PAGE_SIZE) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRecords.slice(start, start + PAGE_SIZE);
  }, [filteredRecords, currentPage]);

  // Statistics scoped to the currently selected certificate & cycle
  const stats = useMemo(() => {
    const relevantRecords = records.filter((r) => {
      if (selectedCycleCertId && r.certificateId !== selectedCycleCertId) return false;
      if (selectedCycleId !== 'all' && activeCycle) {
        if (!isRecordInCycle(r, activeCycle)) {
          return false;
        }
      }
      return true;
    });

    const totalRecords = relevantRecords.length;
    let verifiedCredits = 0;
    let pendingCredits = 0;

    for (const r of relevantRecords) {
      if (r.verified) {
        verifiedCredits += r.credits;
      } else {
        pendingCredits += r.credits;
      }
    }

    const targetCycle = activeCycle;
    const currentEarned = targetCycle?.earnedCredits || 0;
    const currentRequired = targetCycle?.requiredCredits || 0;
    const currentRemaining =
      targetCycle?.remainingCredits ?? Math.max(0, currentRequired - currentEarned);
    const percent =
      currentRequired > 0
        ? Math.min(100, Math.round((currentEarned / currentRequired) * 100))
        : 100;

    return {
      totalRecords,
      verifiedCredits: Math.round(verifiedCredits * 10) / 10,
      pendingCredits: Math.round(pendingCredits * 10) / 10,
      currentEarned,
      currentRequired,
      currentRemaining,
      percent,
    };
  }, [records, selectedCycleCertId, selectedCycleId, activeCycle]);

  // Handle Create new record
  const handleSaveCreate = async (input: SaveCmeRecordInput) => {
    setSavingCreate(true);
    try {
      await myCmeApi.createRecord(input);
      setNotice('Khai báo khóa học CME thành công. Hồ sơ đang chờ phòng Nhân sự thẩm định.');
      await loadData();
    } finally {
      setSavingCreate(false);
    }
  };

  // Handle Delete pending record
  const handleConfirmDelete = async () => {
    if (!deletingRecord) return;
    setBusyDelete(true);
    try {
      await myCmeApi.deleteRecord(deletingRecord.cmeId);
      setNotice('Đã thu hồi bản ghi CME thành công.');
      setDeletingRecord(null);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Xóa bản ghi CME thất bại.');
    } finally {
      setBusyDelete(false);
    }
  };

  return (
    <div className="space-y-2.5">
      {/* Top Header - Compact */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg shrink-0">
            <Icon name="fileText" size={18} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight leading-tight">
              Hồ sơ đào tạo liên tục (CME)
            </h1>
            <p className="text-[11px] text-slate-500">
              Tiến độ tích lũy tín chỉ chuyên môn y tế và danh mục khóa học của bạn
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="button secondary text-xs py-1 px-2.5 flex items-center gap-1.5"
            onClick={() => void loadData()}
            disabled={loading}
          >
            <Icon name="sliders" size={12} />
            <span>Làm mới</span>
          </button>

          <button
            type="button"
            className="button primary text-xs py-1 px-2.5 flex items-center gap-1.5"
            onClick={() => setCreateModalOpen(true)}
            disabled={loading}
          >
            <Icon name="plus" size={12} />
            <span>Khai báo CME mới</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="py-2 px-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Icon name="check" size={13} />
            {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice('')}
            className="text-emerald-600 hover:text-emerald-800"
          >
            <Icon name="close" size={12} />
          </button>
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      {/* Unified Compact Dashboard Banner (Certificate + Cycle Selectors & Progress) */}
      {uniqueCmeCertificates.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
            {/* Left side: CME Cycle Progress & Selectors (7 cols) */}
            <div className="lg:col-span-7 p-3 sm:p-3.5 space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Certificate selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500 font-medium shrink-0">Chứng chỉ:</span>
                  <select
                    className="text-xs font-semibold text-slate-800 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 max-w-[200px] truncate"
                    value={selectedCycleCertId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setSelectedCycleCertId(newId);
                      setSelectedCycleId('');
                    }}
                  >
                    {uniqueCmeCertificates.map((cert) => (
                      <option key={cert.certificateId} value={cert.certificateId}>
                        {cert.certificateType}
                        {cert.certificateNumber ? ` (${cert.certificateNumber})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cycle selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500 font-medium shrink-0">Chu kỳ:</span>
                  {certCycles.length > 0 ? (
                    <select
                      className="text-xs font-semibold text-slate-800 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      value={selectedCycleSelectValue}
                      onChange={(e) => setSelectedCycleId(e.target.value)}
                    >
                      {certCycles.map((cy) => {
                        const val = cy.cycleId || String(cy.cycleNumber);
                        return (
                          <option key={val} value={val}>
                            Chu kỳ #{cy.cycleNumber} {cy.isCurrentCycle ? '(Đang hoạt động)' : ''}
                          </option>
                        );
                      })}
                      {certCycles.length > 1 && (
                        <option value="all">Tất cả chu kỳ ({certCycles.length})</option>
                      )}
                    </select>
                  ) : (
                    <span className="text-xs text-slate-400 italic">Chưa có chu kỳ</span>
                  )}
                </div>
              </div>

              {/* Progress bar: ONLY shown when viewing a specific cycle. Hidden when viewing "Tất cả chu kỳ" */}
              {selectedCycleId === 'all' ? (
                <div className="pt-0.5 text-xs text-slate-500 flex items-center gap-1.5">
                  <span className="text-teal-600 shrink-0 inline-flex">
                    <Icon name="fileText" size={13} />
                  </span>
                  <span>
                    Đang hiển thị toàn bộ lịch sử khóa học qua tất cả {certCycles.length} chu kỳ của chứng chỉ này.
                  </span>
                </div>
              ) : activeCycle ? (
                <>
                  {/* Progress numeric summary */}
                  <div className="flex items-baseline justify-between gap-2 pt-0.5">
                    <div>
                      <span className="text-sm font-bold text-slate-900">
                        {activeCycle.earnedCredits}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">
                        {' '}/ {activeCycle.requiredCredits} Tín chỉ
                      </span>
                      <span className="text-xs text-teal-700 font-semibold ml-1.5">
                        ({stats.percent}%)
                      </span>
                    </div>

                    <div>
                      {stats.currentRemaining > 0 ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <Icon name="clock" size={11} />
                          Còn thiếu {stats.currentRemaining} TC
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <Icon name="check" size={11} />
                          Đã đạt định mức chu kỳ
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Clean progress bar */}
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        stats.percent >= 100
                          ? 'bg-emerald-500'
                          : activeCycle.daysLeft != null && activeCycle.daysLeft < 0
                          ? 'bg-red-500'
                          : activeCycle.daysLeft != null && activeCycle.daysLeft <= 90
                          ? 'bg-amber-500'
                          : 'bg-teal-500'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, stats.percent))}%` }}
                    />
                  </div>

                  {/* Date range & remaining days countdown */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Thời hạn: {formatDate(activeCycle.cycleStart)} → {formatDate(activeCycle.cycleEnd)}
                    </span>
                    {activeCycle.daysLeft != null && (
                      <span
                        className={`font-semibold ${
                          activeCycle.daysLeft < 0
                            ? 'text-red-600'
                            : activeCycle.daysLeft <= 90
                            ? 'text-amber-600'
                            : 'text-slate-600'
                        }`}
                      >
                        {activeCycle.daysLeft < 0
                          ? `Quá hạn ${Math.abs(activeCycle.daysLeft)} ngày`
                          : `Còn lại ${activeCycle.daysLeft} ngày`}
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-400 py-1 italic">
                  Chứng chỉ này chưa được thiết lập chu kỳ đào tạo trong hệ thống.
                </div>
              )}
            </div>

            {/* Right side: Compact Key Metrics (5 cols) */}
            <div className="lg:col-span-5 p-3 sm:p-3.5 bg-slate-50/40 flex flex-col justify-between gap-2">
              <div className="grid grid-cols-3 gap-2">
                {/* Total courses */}
                <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                  <div className="text-[11px] text-slate-400 font-medium truncate">Tổng khóa</div>
                  <div className="text-base font-bold text-slate-800 mt-0.5">{stats.totalRecords}</div>
                </div>

                {/* Verified credits */}
                <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                  <div className="text-[11px] text-emerald-600 font-medium truncate">Đã duyệt</div>
                  <div className="text-base font-bold text-emerald-700 mt-0.5">
                    {stats.verifiedCredits} <span className="text-[10px] font-normal text-slate-400">TC</span>
                  </div>
                </div>

                {/* Pending credits */}
                <div className="bg-white p-2 rounded-lg border border-slate-100 text-center">
                  <div className="text-[11px] text-amber-600 font-medium truncate">Chờ duyệt</div>
                  <div className="text-base font-bold text-amber-700 mt-0.5">
                    {stats.pendingCredits} <span className="text-[10px] font-normal text-slate-400">TC</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-slate-500 text-[11px]">
                  {selectedCycleId === 'all'
                    ? 'Phạm vi: Tất cả chu kỳ'
                    : `Chu kỳ #${activeCycle?.cycleNumber || 1}:`}
                </span>
                <span
                  className={`inline-flex items-center gap-1 font-semibold text-[11px] ${
                    selectedCycleId === 'all'
                      ? 'text-slate-700'
                      : stats.percent >= 100
                      ? 'text-emerald-700'
                      : 'text-teal-700'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      selectedCycleId === 'all'
                        ? 'bg-slate-400'
                        : stats.percent >= 100
                        ? 'bg-emerald-500'
                        : 'bg-teal-500'
                    }`}
                  />
                  {selectedCycleId === 'all'
                    ? `${stats.totalRecords} khóa học tích lũy`
                    : stats.percent >= 100
                    ? 'Đã hoàn thành chỉ tiêu'
                    : `Đang tích lũy (${stats.percent}%)`}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Submissions Section */}
      <div className="space-y-2">
        {/* Section Header & Integrated Search / Filter Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 bg-white py-2 px-3 rounded-xl border border-slate-200 shadow-2xs">
          {/* Left: Scope title and Record count */}
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="font-bold text-xs text-slate-900 shrink-0">
              Bản nộp CME
            </span>
            {selectedCertInfo && (
              <span
                className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[150px]"
                title={selectedCertInfo.certificateType}
              >
                {selectedCertInfo.certificateType}
              </span>
            )}
            {activeCycle && selectedCycleId !== 'all' ? (
              <span className="text-[11px] font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200/60 shrink-0">
                Chu kỳ #{activeCycle.cycleNumber} {activeCycle.isCurrentCycle ? '(Hiện tại)' : ''}
              </span>
            ) : selectedCycleId === 'all' ? (
              <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                Tất cả chu kỳ
              </span>
            ) : null}
            <span className="text-[11px] text-slate-400 font-medium shrink-0">
              ({filteredRecords.length} khóa)
            </span>
          </div>

          {/* Right: Search Input & Status Filter */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Search Input */}
            <div className="relative w-40 sm:w-48">
              <input
                type="text"
                className="w-full text-xs pl-7 pr-6 py-1 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                placeholder="Tìm khóa học..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <span className="absolute left-2 top-1.5 text-slate-400 pointer-events-none">
                <Icon name="search" size={12} />
              </span>
              {searchTerm && (
                <button
                  type="button"
                  className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-600"
                  onClick={() => setSearchTerm('')}
                >
                  <Icon name="close" size={12} />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              className="text-xs px-2 py-1 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="verified">Đã duyệt</option>
              <option value="pending">Chờ HR duyệt</option>
            </select>

            {(searchTerm || statusFilter !== 'all') && (
              <button
                type="button"
                className="text-xs text-slate-500 hover:text-teal-700 underline px-1 shrink-0"
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
              >
                Xóa
              </button>
            )}
          </div>
        </div>

        {/* Content Section (Clean Data Table with Pagination & No Horizontal/Vertical Overflow) */}
        {loading ? (
          <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            <div className="animate-spin inline-block w-5 h-5 border-2 border-current border-t-transparent text-teal-600 rounded-full mb-1.5" />
            <p className="text-xs">Đang tải hồ sơ đào tạo liên tục...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="p-6 text-center bg-white rounded-xl border border-slate-200 shadow-2xs">
            <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
              <Icon name="fileText" size={18} />
            </div>
            {records.length === 0 ? (
              <>
                <h3 className="text-xs font-semibold text-slate-800">Chưa có khóa học CME nào</h3>
                <p className="text-[11px] text-slate-500 mt-0.5 max-w-sm mx-auto">
                  Bạn chưa có bản ghi đào tạo liên tục nào trong hệ thống.
                </p>
                <button
                  type="button"
                  className="button primary text-xs mt-2.5 py-1 px-3 inline-flex items-center gap-1.5"
                  onClick={() => setCreateModalOpen(true)}
                >
                  <Icon name="plus" size={12} />
                  <span>Khai báo khóa học ngay</span>
                </button>
              </>
            ) : (
              <>
                <h3 className="text-xs font-semibold text-slate-800">
                  Không tìm thấy khóa đào tạo nào trong chu kỳ này
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Không có khóa học nào khớp với bộ lọc hoặc chu kỳ đang chọn.
                </p>
                <button
                  type="button"
                  className="button primary text-xs mt-2.5 py-1 px-3 inline-flex items-center gap-1.5"
                  onClick={() => setCreateModalOpen(true)}
                >
                  <Icon name="plus" size={12} />
                  <span>Khai báo khóa học cho chu kỳ này</span>
                </button>
              </>
            )}
          </div>
        ) : (
          /* Sleek Table (table-fixed 100% width, No Horizontal Scrollbar) */
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <div className="w-full">
              <table className="cme-table w-full text-left text-xs text-slate-700">
                <colgroup>
                  <col className="w-[32%]" />
                  <col className="w-[17%]" />
                  <col className="w-[13%]" />
                  <col className="w-[10%]" />
                  <col className="w-[11%]" />
                  <col className="w-[11%]" />
                  <col className="w-[6%]" />
                </colgroup>
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase text-[10px] font-semibold tracking-wider">
                  <tr>
                    <th className="py-2 px-3">Khóa đào tạo & Đơn vị</th>
                    <th className="py-2 px-3">Chứng chỉ & Chu kỳ</th>
                    <th className="py-2 px-3">Ngày hoàn thành</th>
                    <th className="py-2 px-3">Tín chỉ</th>
                    <th className="py-2 px-3">Minh chứng</th>
                    <th className="py-2 px-3">Trạng thái</th>
                    <th className="py-2 px-3 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRecords.map((rec) => (
                    <tr key={rec.cmeId} className="hover:bg-slate-50/60 transition-colors">
                      {/* Course name & Provider */}
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-800 truncate" title={rec.courseName}>
                          {rec.courseName}
                        </div>
                        <div
                          className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1 truncate"
                          title={rec.provider || ''}
                        >
                          <Icon name="building" size={10} />
                          <span className="truncate">{rec.provider || 'Chưa cập nhật đơn vị'}</span>
                        </div>
                      </td>

                      {/* Certificate & Cycle */}
                      <td className="py-2.5 px-3">
                        <span
                          className="font-medium text-slate-700 block truncate"
                          title={rec.certificateType}
                        >
                          {rec.certificateType}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {rec.certificateNumber && (
                            <span className="text-[10px] font-mono text-slate-400 truncate">
                              #{rec.certificateNumber}
                            </span>
                          )}
                          {rec.cycleNumber && (
                            <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded shrink-0">
                              Chu kỳ #{rec.cycleNumber}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Completed date */}
                      <td className="py-2.5 px-3 text-slate-600 text-[11px] truncate">
                        {formatDate(rec.completedDate) || '—'}
                      </td>

                      {/* Credits */}
                      <td className="py-2.5 px-3">
                        <span className="inline-flex items-center font-bold text-teal-700 bg-teal-50 border border-teal-200/50 px-1.5 py-0.5 rounded text-[11px]">
                          +{rec.credits} TC
                        </span>
                      </td>

                      {/* Proof File */}
                      <td className="py-2.5 px-3">
                        {rec.fileUrl ? (
                          <a
                            href={rec.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-teal-700 hover:text-teal-900 font-semibold underline truncate"
                          >
                            <Icon name="fileText" size={11} />
                            <span>Xem tệp</span>
                          </a>
                        ) : (
                          <span className="text-slate-300 text-[11px] italic">Không có</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3">
                        {rec.verified ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 truncate"
                            title={
                              rec.verifiedByName
                                ? `Duyệt bởi: ${rec.verifiedByName}`
                                : 'Đã được HR duyệt'
                            }
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            <span className="truncate">Đã xác minh</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 truncate">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                            <span className="truncate">Chờ HR duyệt</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="p-1 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded transition-colors"
                            onClick={() => setSelectedDetailRecord(rec)}
                            title="Xem chi tiết"
                          >
                            <Icon name="eye" size={13} />
                          </button>

                          {!rec.verified && (
                            <button
                              type="button"
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              onClick={() => setDeletingRecord(rec)}
                              title="Thu hồi bản nộp"
                            >
                              <Icon name="close" size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls - Only shown when > 4 records */}
            {filteredRecords.length > PAGE_SIZE && (
              <div className="border-t border-slate-100 px-3 py-2 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
                <span>
                  Hiển thị {(currentPage - 1) * PAGE_SIZE + 1} -{' '}
                  {Math.min(currentPage * PAGE_SIZE, filteredRecords.length)} trên tổng số{' '}
                  {filteredRecords.length} khóa học
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="button secondary text-xs py-0.5 px-2 disabled:opacity-40"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    ‹ Trước
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                    <button
                      key={pg}
                      type="button"
                      className={`w-6 h-6 rounded text-xs font-semibold flex items-center justify-center transition-colors ${
                        pg === currentPage
                          ? 'bg-teal-700 text-white'
                          : 'border border-slate-200 text-slate-700 hover:bg-white'
                      }`}
                      onClick={() => setCurrentPage(pg)}
                    >
                      {pg}
                    </button>
                  ))}

                  <button
                    type="button"
                    className="button secondary text-xs py-0.5 px-2 disabled:opacity-40"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Sau ›
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {createModalOpen && (
        <MyCmeCreateModal
          certificates={certificates}
          initialCertificateId={selectedCycleCertId}
          initialCmeCycleId={activeCycle?.cycleId || undefined}
          onClose={() => setCreateModalOpen(false)}
          onSave={handleSaveCreate}
          busy={savingCreate}
        />
      )}

      {/* Detail Modal */}
      {selectedDetailRecord && (
        <CmeRecordDetailModal
          record={selectedDetailRecord}
          onClose={() => setSelectedDetailRecord(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deletingRecord && (
        <Modal
          title="Xác nhận thu hồi bản ghi CME"
          onClose={() => setDeletingRecord(null)}
          busy={busyDelete}
        >
          <div className="p-6 space-y-4">
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
              <Icon name="clock" size={18} />
              <div>
                Bạn có chắc chắn muốn thu hồi bản ghi đào tạo{' '}
                <strong>"{deletingRecord.courseName}"</strong> ({deletingRecord.credits} tín chỉ)?
                Hồ sơ này sẽ bị xóa khỏi danh sách thẩm định của phòng HR.
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                className="button"
                onClick={() => setDeletingRecord(null)}
                disabled={busyDelete}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="button danger"
                onClick={() => void handleConfirmDelete()}
                disabled={busyDelete}
              >
                {busyDelete ? 'Đang xóa...' : 'Xác nhận thu hồi'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
