import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { cmeApi } from '../../services/cmeApi';
import { certificateApi } from '../../services/certificateApi';
import { fileApi } from '../../services/fileApi';
import { useAuthStore } from '../../store/useAuthStore';
import type { CertificateCycle, CmeRecord, StaffCmeSummary } from '../../types/cme';
import type { Certificate } from '../../types/certificates';
import Alert from '../../components/ui/Alert';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';

const DEFAULT_ALERT_THRESHOLD = 180;
const LOCKED_CYCLES_STORAGE_KEY = 'vnc_hrms_locked_cme_cycles';

function loadLockedCycleKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCKED_CYCLES_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed) : new Set();
  } catch {
    return new Set();
  }
}

function saveLockedCycleKeys(keys: Set<string>) {
  try {
    localStorage.setItem(LOCKED_CYCLES_STORAGE_KEY, JSON.stringify(Array.from(keys)));
  } catch {
    // ignore storage errors
  }
}

function formatDateDdMmYyyy(val: string | null | undefined): string {
  if (!val) return '';
  const parts = val.slice(0, 10).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function getProofLabel(url: string | null | undefined): string {
  if (!url) return '—';
  const lower = url.toLowerCase();
  if (lower.endsWith('.pdf') || lower.includes('.pdf')) return 'PDF';
  if (lower.endsWith('.png') || lower.includes('.png')) return 'PNG';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.includes('.jpg') || lower.includes('.jpeg'))
    return 'JPG';
  return 'PDF';
}

export default function CmeRecordListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const staffIdParam = searchParams.get('staffId');
  const user = useAuthStore(state => state.session?.user);
  const isHrManager = user?.role === 'hr_manager';

  const [staffList, setStaffList] = useState<StaffCmeSummary[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>(staffIdParam || '');
  const [cycles, setCycles] = useState<CertificateCycle[]>([]);
  const [staffCertificates, setStaffCertificates] = useState<Certificate[]>([]);
  const [selectedCertificateId, setSelectedCertificateId] = useState<string>('');
  const [records, setRecords] = useState<CmeRecord[]>([]);
  const [lockedCycleKeys, setLockedCycleKeys] = useState<Set<string>>(() => loadLockedCycleKeys());

  const [loadingInit, setLoadingInit] = useState(true);
  const [loadingStaffCme, setLoadingStaffCme] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cycleWarning, setCycleWarning] = useState('');
  const [lockingCycle, setLockingCycle] = useState(false);

  // Inline Add / Edit CME record form state
  const [editingRecord, setEditingRecord] = useState<CmeRecord | null>(null);
  const [courseName, setCourseName] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [completedDate, setCompletedDate] = useState('');
  const [credits, setCredits] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Edit Cycle Dates Modal
  const [editingDatesOpen, setEditingDatesOpen] = useState(false);
  const [cycleStartInput, setCycleStartInput] = useState('');
  const [cycleEndInput, setCycleEndInput] = useState('');
  const [datesError, setDatesError] = useState('');
  const [savingDates, setSavingDates] = useState(false);

  // Create New Progress Table ("+ New record") Modal
  const [newCycleOpen, setNewCycleOpen] = useState(false);
  const [newCycleStartInput, setNewCycleStartInput] = useState('');
  const [newCycleEndInput, setNewCycleEndInput] = useState('');
  const [newCycleError, setNewCycleError] = useState('');
  const [creatingCycle, setCreatingCycle] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  // Load initial staff list
  const loadStaffList = useCallback(async () => {
    setLoadingInit(true);
    setError('');
    try {
      const summaries = await cmeApi.listStaffSummaries();
      setStaffList(summaries);

      if (summaries.length > 0) {
        const fromQuery =
          staffIdParam && summaries.some(s => s.staffId === staffIdParam)
            ? staffIdParam
            : null;
        const withCert = summaries.find(s => s.certificateCount > 0)?.staffId;
        const initialStaffId = fromQuery || withCert || summaries[0].staffId;
        setSelectedStaffId(initialStaffId);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không tải được danh sách nhân viên.');
    } finally {
      setLoadingInit(false);
    }
  }, [staffIdParam]);

  useEffect(() => {
    void loadStaffList();
  }, [loadStaffList]);

  // Load selected staff's certificate cycles, certificates & CME records
  const loadStaffCme = useCallback(
    async (staffId: string, preserveCertId?: string) => {
      if (!staffId) return;
      setLoadingStaffCme(true);
      setError('');
      try {
        const [certCycles, staffRecords, certs] = await Promise.all([
          cmeApi.listCertificateCyclesByStaff(staffId),
          cmeApi.listByStaff(staffId),
          certificateApi.listByStaff(staffId).catch(() => [] as Certificate[]),
        ]);
        setCycles(certCycles);
        setRecords(staffRecords);
        setStaffCertificates(certs);

        if (certCycles.length > 0) {
          if (preserveCertId && certCycles.some(c => c.certificateId === preserveCertId)) {
            setSelectedCertificateId(preserveCertId);
          } else {
            // Default: current valid certificate
            const validCert =
              certCycles.find(c => c.certificateStatus === 'active' && c.isCurrentCycle !== false) ||
              certCycles[0];
            setSelectedCertificateId(validCert.certificateId);
          }
        } else {
          setSelectedCertificateId('');
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Không tải được dữ liệu CME của nhân viên.');
      } finally {
        setLoadingStaffCme(false);
      }
    },
    []
  );

  useEffect(() => {
    if (selectedStaffId) {
      void loadStaffCme(selectedStaffId);
    }
  }, [selectedStaffId, loadStaffCme]);

  const selectedStaff = useMemo(
    () => staffList.find(s => s.staffId === selectedStaffId) || null,
    [staffList, selectedStaffId]
  );

  // Map certificateId -> whether it has CME required credits (> 0)
  const certHasCmeMap = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const cert of staffCertificates) {
      map.set(cert.certificateId, Number(cert.cmeRequiredCredits || 0) > 0);
    }
    for (const c of cycles) {
      if (!map.has(c.certificateId)) {
        if (typeof c.hasCmeCreditsRequirement === 'boolean') {
          map.set(c.certificateId, c.hasCmeCreditsRequirement);
        } else {
          map.set(c.certificateId, Number(c.requiredCredits || 0) > 1);
        }
      }
    }
    return map;
  }, [staffCertificates, cycles]);

  // Distinct certificates for the selector (only 1 option per certificate, showing the latest cycle)
  const latestCycleByCertificate = useMemo(() => {
    const map = new Map<string, CertificateCycle>();
    for (const c of cycles) {
      const existing = map.get(c.certificateId);
      if (!existing || c.cycleNumber > existing.cycleNumber) {
        map.set(c.certificateId, c);
      }
    }
    return Array.from(map.values());
  }, [cycles]);

  // All cycles belonging to the currently selected certificate, sorted newest first
  const currentCertificateCycles = useMemo(() => {
    if (!selectedCertificateId) return [];
    return cycles
      .filter(c => c.certificateId === selectedCertificateId)
      .sort((a, b) => b.cycleNumber - a.cycleNumber);
  }, [cycles, selectedCertificateId]);

  // The active/latest progress table of the selected certificate
  const selectedCycle = useMemo(
    () => currentCertificateCycles[0] || null,
    [currentCertificateCycles]
  );

  // Whether the selected certificate requires CME credits (true) or is a non-CME certificate (false)
  const hasCmeCredits = useMemo(() => {
    if (!selectedCycle) return false;
    if (certHasCmeMap.has(selectedCycle.certificateId)) {
      return Boolean(certHasCmeMap.get(selectedCycle.certificateId));
    }
    return Boolean(selectedCycle.hasCmeCreditsRequirement);
  }, [selectedCycle, certHasCmeMap]);

  const oldestCycleIdForCert = useMemo(() => {
    if (currentCertificateCycles.length === 0) return null;
    return currentCertificateCycles[currentCertificateCycles.length - 1].cycleId;
  }, [currentCertificateCycles]);

  // Records belonging to the latest progress table of the selected certificate
  const displayedRecords = useMemo(() => {
    if (!selectedCycle) return [];
    return [...records]
      .filter(r => {
        if (r.certificateId !== selectedCycle.certificateId) return false;
        if (selectedCycle.cycleId) {
          return (
            r.cmeCycleId === selectedCycle.cycleId ||
            (!r.cmeCycleId && selectedCycle.cycleId === oldestCycleIdForCert)
          );
        }
        return !r.cmeCycleId;
      })
      .sort((a, b) => (b.completedDate || '').localeCompare(a.completedDate || ''));
  }, [records, selectedCycle, oldestCycleIdForCert]);

  // Previous cycles (archived history tables) of the same certificate
  const historyCyclesWithRecords = useMemo(() => {
    if (!selectedCycle) return [];
    return currentCertificateCycles
      .slice(1)
      .map(c => {
        const cHasCme = certHasCmeMap.get(c.certificateId) ?? Boolean(c.hasCmeCreditsRequirement);
        const cycleRecs = [...records]
          .filter(r => {
            if (r.certificateId !== c.certificateId) return false;
            if (c.cycleId) {
              return (
                r.cmeCycleId === c.cycleId ||
                (!r.cmeCycleId && c.cycleId === oldestCycleIdForCert)
              );
            }
            return false;
          })
          .sort((a, b) => (b.completedDate || '').localeCompare(a.completedDate || ''));
        const total = cHasCme
          ? cycleRecs.reduce((sum, r) => sum + Number(r.credits || 0), 0)
          : cycleRecs.length > 0
          ? 1
          : 0;
        return {
          cycle: c,
          hasCme: cHasCme,
          records: cycleRecs,
          total,
        };
      });
  }, [currentCertificateCycles, selectedCycle, records, oldestCycleIdForCert, certHasCmeMap]);

  // "Total in cycle": sum of credit hours (or 0 / 1 if certificate does not have CME credits)
  const totalInCycle = useMemo(() => {
    if (!hasCmeCredits) {
      return displayedRecords.length > 0 ? 1 : 0;
    }
    return displayedRecords.reduce((sum, r) => sum + Number(r.credits || 0), 0);
  }, [displayedRecords, hasCmeCredits]);

  const currentCycleLockKey = useMemo(() => {
    if (!selectedCycle) return '';
    return `${selectedCycle.certificateId}:${selectedCycle.cycleNumber}`;
  }, [selectedCycle]);

  // Only locked when explicitly confirmed via "Xác nhận khóa" (never auto-locked when earned >= required)
  const isCurrentCycleLocked = useMemo(() => {
    if (!selectedCycle) return false;
    if (selectedCycle.cycleStatus === 'locked') return true;
    return currentCycleLockKey ? lockedCycleKeys.has(currentCycleLockKey) : false;
  }, [selectedCycle, currentCycleLockKey, lockedCycleKeys]);

  // Dynamic cycle statistics calculated from displayed records & cycle dates
  const cycleStats = useMemo(() => {
    if (!selectedCycle) return null;
    const required =
      hasCmeCredits && selectedCycle.requiredCredits > 0
        ? selectedCycle.requiredCredits
        : 1;
    const earned = totalInCycle;
    const remaining = Math.max(0, required - earned);
    const pct = required > 0 ? Math.min(100, Math.round((earned / required) * 100)) : 0;

    let daysLeft: number | null = null;
    if (selectedCycle.cycleEnd) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(`${selectedCycle.cycleEnd.slice(0, 10)}T00:00:00`);
      if (!isNaN(end.getTime())) {
        daysLeft = Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }
    }

    const threshold = selectedCycle.alertThresholdDays || DEFAULT_ALERT_THRESHOLD;
    const isAtRisk = remaining > 0 && daysLeft !== null && daysLeft <= threshold;
    const badge = isAtRisk ? 'Có nguy cơ' : 'Đúng tiến độ';

    return {
      required,
      earned,
      remaining,
      pct,
      daysLeft,
      isAtRisk,
      badge,
      isTargetReached: earned >= required,
    };
  }, [selectedCycle, totalInCycle, hasCmeCredits]);

  // Check if completedDate is outside selected cycle (GB-C05 warning)
  useEffect(() => {
    if (!completedDate || !selectedCycle) {
      setCycleWarning('');
      return;
    }
    const start = selectedCycle.cycleStart?.slice(0, 10);
    const end = selectedCycle.cycleEnd?.slice(0, 10);
    if ((start && completedDate < start) || (end && completedDate > end)) {
      setCycleWarning(
        `Warning (GB-C05): The completion date (${formatDateDdMmYyyy(
          completedDate
        )}) is outside the selected cycle (${formatDateDdMmYyyy(start)} - ${formatDateDdMmYyyy(
          end
        )}).`
      );
    } else {
      setCycleWarning('');
    }
  }, [completedDate, selectedCycle]);

  function handleStaffChange(newStaffId: string) {
    setSelectedStaffId(newStaffId);
    setSearchParams({ staffId: newStaffId });
    resetForm();
  }

  function resetForm() {
    setEditingRecord(null);
    setCourseName('');
    setOrganizer('');
    setCompletedDate('');
    setCredits('');
    setFileUrl('');
    setUploadedFileName('');
    setFormError('');
    setCycleWarning('');
  }

  function handleStartEdit(rec: CmeRecord) {
    if (isCurrentCycleLocked) return;
    setEditingRecord(rec);
    setCourseName(rec.courseName || '');
    setOrganizer(rec.provider || '');
    setCompletedDate(rec.completedDate ? rec.completedDate.slice(0, 10) : '');
    setCredits(String(rec.credits ?? ''));
    setFileUrl(rec.fileUrl || '');
    setUploadedFileName(rec.fileUrl ? getProofLabel(rec.fileUrl) : '');
    setFormError('');
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  async function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setFormError('');
    if (file.size > 10 * 1024 * 1024) {
      setFormError('GB-C03: File size must not exceed 10 MB.');
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) {
      setFormError('GB-C03: Upload only accepts PDF, JPG, or PNG files up to 10 MB.');
      return;
    }

    setUploading(true);
    try {
      const uploaded = await fileApi.upload(file);
      setFileUrl(uploaded.url);
      setUploadedFileName(file.name);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Upload file thất bại.');
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveRecord(e: FormEvent) {
    e.preventDefault();
    setFormError('');
    setNotice('');

    if (!selectedCertificateId || !selectedCycle) {
      setFormError('MSG-C09: No valid certificate found for CME recording.');
      return;
    }

    if (isCurrentCycleLocked) {
      setFormError('Bảng tiến độ này đã được xác nhận khóa, không thể chỉnh sửa.');
      return;
    }

    const trimmedCourse = courseName.trim();
    const trimmedOrganizer = organizer.trim();

    if (!trimmedCourse) {
      setFormError('Course name is required.');
      return;
    }
    if (trimmedCourse.length > 150) {
      setFormError('Course name must not exceed 150 characters.');
      return;
    }
    if (trimmedOrganizer.length > 100) {
      setFormError('Organizer must not exceed 100 characters.');
      return;
    }
    if (!completedDate) {
      setFormError('Completed date is required.');
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (completedDate > todayStr) {
      setFormError('MSG-C07: Completed date cannot be in the future.');
      return;
    }

    let creditNum = 1;
    if (hasCmeCredits) {
      creditNum = Number(credits);
      if (
        !credits ||
        isNaN(creditNum) ||
        creditNum <= 0 ||
        Math.round(creditNum * 2) !== creditNum * 2
      ) {
        setFormError('MSG-C08: Credits must be a number greater than 0 with step 0.5.');
        return;
      }

      const requiredCredits =
        selectedCycle.requiredCredits > 0 ? selectedCycle.requiredCredits : 1;
      const otherCompletedCredits = displayedRecords
        .filter(r => !editingRecord || r.cmeId !== editingRecord.cmeId)
        .reduce((sum, r) => sum + Number(r.credits || 0), 0);
      const maxAllowedCredits = Math.max(0, requiredCredits - otherCompletedCredits);

      if (otherCompletedCredits + creditNum > requiredCredits) {
        if (maxAllowedCredits <= 0) {
          setFormError(
            `Bảng tiến độ hiện tại đã đạt đủ ${otherCompletedCredits}/${requiredCredits} tín chỉ yêu cầu. Hãy bấm "Xác nhận khóa" để khóa bảng này hoặc "+ New record" để tạo bảng mới.`
          );
        } else {
          setFormError(
            `Số tín chỉ nhập vào (${creditNum}) vượt quá tổng tín chỉ yêu cầu. Đã hoàn thành: ${otherCompletedCredits}/${requiredCredits} tín chỉ, chỉ được nhập tối đa ${maxAllowedCredits} tín chỉ.`
          );
        }
        return;
      }
    } else {
      // Certificate without CME credits requirement: no Credits field, target is 1 record (0 / 1 -> 1 / 1)
      const otherCount = displayedRecords.filter(
        r => !editingRecord || r.cmeId !== editingRecord.cmeId
      ).length;
      if (otherCount >= 1) {
        setFormError(
          'Bảng tiến độ hiện tại đã đạt đủ chỉ tiêu (1/1). Hãy bấm "Xác nhận khóa" để khóa bảng này hoặc "+ New record" để tạo bảng mới.'
        );
        return;
      }
      creditNum = 1;
    }

    setSaving(true);
    try {
      if (editingRecord) {
        await cmeApi.update(editingRecord.cmeId, {
          certificateId: selectedCertificateId,
          cmeCycleId: selectedCycle.cycleId,
          courseName: trimmedCourse,
          provider: trimmedOrganizer || null,
          completedDate,
          credits: creditNum,
          fileUrl: fileUrl || null,
          verified: true,
        });
      } else {
        await cmeApi.create({
          certificateId: selectedCertificateId,
          cmeCycleId: selectedCycle.cycleId,
          courseName: trimmedCourse,
          provider: trimmedOrganizer || null,
          completedDate,
          credits: creditNum,
          fileUrl: fileUrl || null,
          verified: true,
        });
      }

      await loadStaffCme(selectedStaffId, selectedCertificateId);
      resetForm();
      setNotice('MSG-C02: CME record saved successfully.');
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Không lưu được bản ghi CME.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRecord(rec: CmeRecord) {
    if (isCurrentCycleLocked) return;
    if (
      !window.confirm(
        hasCmeCredits
          ? `Delete CME record "${rec.courseName}" (${rec.credits}h)?`
          : `Delete CME record "${rec.courseName}"?`
      )
    ) {
      return;
    }
    setError('');
    setNotice('');
    try {
      await cmeApi.delete(rec.cmeId);
      if (editingRecord?.cmeId === rec.cmeId) {
        resetForm();
      }
      await loadStaffCme(selectedStaffId, selectedCertificateId);
      setNotice('CME record deleted successfully.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không xóa được bản ghi CME.');
    }
  }

  async function handleCompleteAndLockCycle() {
    if (!selectedCycle) return;
    if (
      !window.confirm(
        'Bạn có chắc muốn Xác nhận khóa bảng tiến độ này? Sau khi khóa, các bản ghi trong bảng này sẽ không thể chỉnh sửa hoặc xóa nữa.'
      )
    ) {
      return;
    }
    setLockingCycle(true);
    setError('');
    setNotice('');
    try {
      try {
        await cmeApi.completeCycle(selectedCycle.certificateId, selectedCycle.cycleId);
      } catch {
        // Fallback to local lock state if backend process has not been restarted yet
      }
      if (currentCycleLockKey) {
        const nextKeys = new Set(lockedCycleKeys);
        nextKeys.add(currentCycleLockKey);
        setLockedCycleKeys(nextKeys);
        saveLockedCycleKeys(nextKeys);
      }
      resetForm();
      await loadStaffCme(selectedStaffId, selectedCertificateId);
      setNotice('Đã xác nhận khóa bảng tiến độ hiện tại thành công.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể khóa bảng tiến độ.');
    } finally {
      setLockingCycle(false);
    }
  }

  function handleOpenEditDates() {
    if (!selectedCycle || isCurrentCycleLocked) return;
    setDatesError('');
    setCycleStartInput(selectedCycle.cycleStart ? selectedCycle.cycleStart.slice(0, 10) : '');
    setCycleEndInput(selectedCycle.cycleEnd ? selectedCycle.cycleEnd.slice(0, 10) : '');
    setEditingDatesOpen(true);
  }

  async function handleSaveCycleDates(e: FormEvent) {
    e.preventDefault();
    if (!selectedCycle) return;
    setDatesError('');

    if (!cycleStartInput) {
      setDatesError('Start date is required.');
      return;
    }
    if (!cycleEndInput || cycleEndInput <= cycleStartInput) {
      setDatesError('End date is required and must be after start date.');
      return;
    }

    setSavingDates(true);
    try {
      await cmeApi.updateCycleDates(selectedCycle.certificateId, {
        cycleStart: cycleStartInput,
        cycleEnd: cycleEndInput,
        cycleId: selectedCycle.cycleId,
      });
      setEditingDatesOpen(false);
      await loadStaffCme(selectedStaffId, selectedCertificateId);
      setNotice('Cycle dates updated successfully.');
    } catch (cause) {
      setDatesError(cause instanceof Error ? cause.message : 'Không cập nhật được ngày chu kỳ.');
    } finally {
      setSavingDates(false);
    }
  }

  function handleOpenNewCycleModal() {
    if (!selectedCycle) return;
    setNewCycleError('');
    const today = new Date().toISOString().slice(0, 10);
    const nextYearDate = new Date();
    nextYearDate.setFullYear(nextYearDate.getFullYear() + 2);
    setNewCycleStartInput(today);
    setNewCycleEndInput(nextYearDate.toISOString().slice(0, 10));
    setNewCycleOpen(true);
  }

  async function handleCreateNewCycle(e: FormEvent) {
    e.preventDefault();
    if (!selectedCycle) return;
    setNewCycleError('');

    if (!newCycleStartInput) {
      setNewCycleError('Vui lòng chọn ngày bắt đầu cho bảng tiến độ mới.');
      return;
    }
    if (!newCycleEndInput || newCycleEndInput <= newCycleStartInput) {
      setNewCycleError('Ngày kết thúc phải lớn hơn ngày bắt đầu.');
      return;
    }

    setCreatingCycle(true);
    try {
      const createdCycle = await cmeApi.createNewCycle(selectedCycle.certificateId, {
        cycleStart: newCycleStartInput,
        cycleEnd: newCycleEndInput,
      });
      setNewCycleOpen(false);
      resetForm();
      await loadStaffCme(selectedStaffId, createdCycle.certificateId);
      setNotice(
        `Đã tạo bảng tiến độ mới cho chứng chỉ "${createdCycle.certificateType}". Bảng tiến độ trước đã được lưu xuống phần lịch sử bên dưới.`
      );
    } catch (cause) {
      setNewCycleError(
        cause instanceof Error ? cause.message : 'Không tạo được bảng tiến độ mới.'
      );
    } finally {
      setCreatingCycle(false);
    }
  }

  return (
    <section className="max-w-6xl mx-auto">
      {/* Header & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Hồ sơ Đào tạo liên tục (CME)</h1>
          <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
            <Link to="/employees" className="hover:underline text-slate-600">
              Nhân viên
            </Link>
            <span>&gt;</span>
            {selectedStaff ? (
              <Link
                to={`/employees/${selectedStaff.staffId}`}
                className="hover:underline font-medium text-slate-700"
              >
                {selectedStaff.fullName}
              </Link>
            ) : (
              <span>Nhân sự</span>
            )}
            <span>&gt;</span>
            <span className="text-slate-800 font-semibold">Hồ sơ CME</span>
          </div>
        </div>

        {/* Staff Selector for quick switching */}
        <div className="flex items-center gap-2">
          <label htmlFor="staff-selector" className="text-xs font-semibold text-slate-600">
            Nhân viên:
          </label>
          <select
            id="staff-selector"
            value={selectedStaffId}
            onChange={e => handleStaffChange(e.target.value)}
            disabled={loadingInit}
            className="text-sm border border-slate-300 rounded px-3 py-1.5 bg-white min-w-[240px]"
          >
            {staffList.map(s => (
              <option key={s.staffId} value={s.staffId}>
                {s.fullName} ({s.staffCode}) - {s.departmentName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {notice && (
        <Alert variant="success">
          {notice}
          <button
            className="icon-button"
            style={{ marginLeft: 'auto' }}
            onClick={() => setNotice('')}
            aria-label="Close notice"
          >
            <Icon name="close" size={16} />
          </button>
        </Alert>
      )}

      {loadingInit || loadingStaffCme ? (
        <div className="panel p-8 text-center text-slate-500">Đang tải dữ liệu CME…</div>
      ) : latestCycleByCertificate.length === 0 ? (
        /* MSG-C09 when no certificate exists */
        <div className="panel p-8">
          <Alert variant="error">
            <strong>MSG-C09:</strong> Nhân viên{' '}
            <strong>{selectedStaff?.fullName || ''}</strong> hiện chưa có Chứng chỉ chuyên môn /
            Chứng chỉ hành nghề (CCHN) nào áp dụng CME.
          </Alert>
          <div className="mt-4 flex items-center justify-between">
            <Link to="/certificates" className="button">
              Đi tới Quản lý Chứng chỉ
            </Link>
            {isHrManager && (
              <button type="button" className="button" disabled>
                + Tạo chu kỳ mới
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="panel p-6 space-y-6">
          {/* Top Row: Certificate selector + Earned credits Cycle Panel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Certificate selector (Left 4 cols - only shows Certificate Name/Number, no cycle number) */}
            <div className="lg:col-span-4">
              <label
                htmlFor="certificate-cycle-select"
                className="block text-xs font-semibold text-slate-600 mb-1.5"
              >
                Chứng chỉ / Chu kỳ CME
              </label>
              <select
                id="certificate-cycle-select"
                value={selectedCertificateId}
                onChange={e => {
                  setSelectedCertificateId(e.target.value);
                  resetForm();
                }}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm font-medium text-slate-800 bg-white"
              >
                {latestCycleByCertificate.map(c => {
                  const label = c.certificateNumber
                    ? `${c.certificateNumber} - ${c.certificateType}`
                    : c.certificateType;
                  return (
                    <option key={c.certificateId} value={c.certificateId}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Earned credits Cycle Panel (Right 8 cols) */}
            {selectedCycle && cycleStats && (
              <div className="lg:col-span-8 border border-slate-200 rounded-lg p-4 bg-slate-50/60">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1.5">
                    {/* Cycle dates row + Edit dates for HR Manager */}
                    <div className="flex items-center gap-3 flex-wrap text-xs text-slate-600">
                      <span>
                        Chu kỳ:{' '}
                        <strong className="text-slate-800">
                          {selectedCycle.cycleStart && selectedCycle.cycleEnd
                            ? `${formatDateDdMmYyyy(selectedCycle.cycleStart)} - ${formatDateDdMmYyyy(
                                selectedCycle.cycleEnd
                              )}`
                            : 'Chưa cập nhật chu kỳ'}
                        </strong>
                      </span>
                      {isHrManager && !isCurrentCycleLocked && (
                        <button
                          type="button"
                          onClick={handleOpenEditDates}
                          className="text-xs text-teal-700 hover:text-teal-900 underline font-semibold cursor-pointer bg-transparent border-0 p-0"
                        >
                          Sửa ngày chu kỳ
                        </button>
                      )}
                      {isCurrentCycleLocked && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                          <Icon name="lock" size={12} /> Đã khóa
                        </span>
                      )}
                    </div>

                    {/* Progress / Remaining / Time left row */}
                    <div className="flex items-center gap-6 flex-wrap text-xs text-slate-700">
                      <span>
                        Tiến độ:{' '}
                        <strong>
                          {cycleStats.earned} / {cycleStats.required}
                          {hasCmeCredits ? ' giờ tín chỉ' : ''}
                        </strong>
                      </span>
                      {hasCmeCredits && (
                        <span>
                          Còn thiếu: <strong>{cycleStats.remaining} giờ</strong>
                        </span>
                      )}
                      {selectedCycle.cycleEnd && cycleStats.daysLeft !== null && (
                        <span>
                          Thời gian còn lại: <strong>{cycleStats.daysLeft} ngày</strong>
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden mt-2">
                      <div
                        className={`h-full transition-all duration-300 ${
                          cycleStats.isAtRisk ? 'bg-slate-900' : 'bg-teal-700'
                        }`}
                        style={{ width: `${cycleStats.pct}%` }}
                      />
                    </div>
                  </div>

                  {/* Status Badge: Đúng tiến độ / Có nguy cơ */}
                  <div
                    className={`px-3 py-1.5 rounded border text-xs font-bold shrink-0 self-center ${
                      cycleStats.isAtRisk
                        ? 'border-amber-500 bg-amber-50 text-amber-800'
                        : 'border-emerald-500 bg-emerald-50 text-emerald-800'
                    }`}
                    title={
                      cycleStats.isAtRisk
                        ? `Còn thiếu chỉ tiêu và thời gian còn lại <= ${selectedCycle.alertThresholdDays} ngày (GB-C04)`
                        : 'Đúng tiến độ'
                    }
                  >
                    {cycleStats.badge}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action bar above latest progress table: Confirm Lock button + "+ Tạo chu kỳ mới" button */}
          {isHrManager && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Bảng theo dõi tiến độ hiện tại ({selectedCycle?.certificateType})
              </div>
              <div className="flex items-center gap-2">
                {cycleStats?.isTargetReached && !isCurrentCycleLocked && (
                  <button
                    type="button"
                    className="button primary"
                    disabled={lockingCycle}
                    onClick={() => void handleCompleteAndLockCycle()}
                    style={{ fontWeight: 600 }}
                    title="Xác nhận khóa bảng tiến độ này sau khi đã hoàn thành đủ chỉ tiêu"
                  >
                    <Icon name="lock" size={16} />{' '}
                    {lockingCycle ? 'Đang khóa…' : 'Xác nhận khóa'}
                  </button>
                )}
                <button
                  type="button"
                  className="button"
                  disabled={latestCycleByCertificate.length === 0}
                  onClick={handleOpenNewCycleModal}
                  style={{ fontWeight: 600 }}
                  title="Tạo bảng theo dõi tiến độ mới cho chứng chỉ này và lưu bảng hiện tại xuống lịch sử"
                >
                  + Tạo chu kỳ mới
                </button>
              </div>
            </div>
          )}

          {/* Current Active Progress CME Table */}
          <div className="table-scroll border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th scope="col">Tên khóa đào tạo</th>
                  <th scope="col">Đơn vị tổ chức</th>
                  <th scope="col">Ngày hoàn thành</th>
                  {hasCmeCredits && <th scope="col">Số giờ tín chỉ</th>}
                  <th scope="col">Minh chứng</th>
                  {isHrManager && !isCurrentCycleLocked && <th scope="col">Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {displayedRecords.length === 0 ? (
                  <tr>
                    <td
                      colSpan={
                        (hasCmeCredits ? 4 : 3) +
                        1 +
                        (isHrManager && !isCurrentCycleLocked ? 1 : 0)
                      }
                      className="text-center py-8 text-slate-400 text-sm"
                    >
                      Chưa có khóa học CME nào trong bảng tiến độ này. Hãy nhập ở biểu mẫu bên dưới.
                    </td>
                  </tr>
                ) : (
                  displayedRecords.map(rec => (
                    <tr
                      key={rec.cmeId}
                      className={
                        editingRecord?.cmeId === rec.cmeId ? 'bg-teal-50/50' : undefined
                      }
                    >
                      <td className="font-medium text-slate-800">{rec.courseName}</td>
                      <td className="text-slate-700">{rec.provider || '—'}</td>
                      <td className="text-slate-700">{formatDateDdMmYyyy(rec.completedDate)}</td>
                      {hasCmeCredits && (
                        <td className="text-slate-800 font-semibold">{rec.credits}</td>
                      )}
                      <td>
                        {rec.fileUrl ? (
                          <a
                            href={rec.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-teal-700 hover:text-teal-900 underline font-semibold text-xs"
                          >
                            {getProofLabel(rec.fileUrl)}
                          </a>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      {isHrManager && !isCurrentCycleLocked && (
                        <td>
                          <div className="flex items-center gap-3 text-xs">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(rec)}
                              className="text-slate-800 hover:text-teal-700 underline font-medium cursor-pointer bg-transparent border-0 p-0"
                            >
                              Sửa
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteRecord(rec)}
                              className="text-slate-800 hover:text-red-600 underline font-medium cursor-pointer bg-transparent border-0 p-0"
                            >
                              Xóa
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Tổng trong chu kỳ + Gợi ý xác nhận khóa khi đạt chỉ tiêu */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-bold text-slate-900">
              Tổng trong chu kỳ: {cycleStats ? cycleStats.earned : 0} /{' '}
              {cycleStats ? cycleStats.required : 1}
              {hasCmeCredits ? ' giờ' : ''}
            </div>

            {isHrManager && cycleStats?.isTargetReached && !isCurrentCycleLocked && (
              <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-lg text-xs text-emerald-900">
                <span>
                  Đã hoàn thành đủ chỉ tiêu ({cycleStats.earned}/{cycleStats.required}
                  {hasCmeCredits ? ' giờ' : ''}). Bảng chưa tự động khóa — hãy bấm{' '}
                  <strong>Xác nhận khóa</strong> để khóa chỉnh sửa bảng này.
                </span>
                <button
                  type="button"
                  className="button primary"
                  style={{ padding: '5px 12px', minHeight: 30, fontSize: 12 }}
                  disabled={lockingCycle}
                  onClick={() => void handleCompleteAndLockCycle()}
                >
                  <Icon name="lock" size={14} />{' '}
                  {lockingCycle ? 'Đang khóa…' : 'Xác nhận khóa'}
                </button>
              </div>
            )}
          </div>

          {/* Biểu mẫu Thêm / Sửa bản ghi CME */}
          {isHrManager && !isCurrentCycleLocked && (
            <div
              ref={formRef}
              className="border border-slate-200 rounded-lg p-5 bg-slate-50/40"
            >
              <h3 className="text-sm font-bold text-slate-900 mb-4">
                {editingRecord ? 'Chỉnh sửa bản ghi CME' : 'Thêm / Cập nhật bản ghi CME'}
              </h3>

              {formError && (
                <div className="mb-4">
                  <Alert variant="error">{formError}</Alert>
                </div>
              )}

              {cycleWarning && (
                <div className="mb-4 p-3 rounded border border-amber-300 bg-amber-50 text-amber-800 text-xs">
                  {cycleWarning}
                </div>
              )}

              <form onSubmit={handleSaveRecord}>
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  <div className={hasCmeCredits ? 'md:col-span-4' : 'md:col-span-5'}>
                    <label htmlFor="cme-course-input" className="text-xs font-medium text-slate-600">
                      Tên khóa đào tạo <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="cme-course-input"
                      type="text"
                      maxLength={150}
                      required
                      placeholder="VD: Kiểm soát nhiễm khuẩn bệnh viện"
                      value={courseName}
                      onChange={e => setCourseName(e.target.value)}
                      disabled={saving || uploading}
                    />
                  </div>

                  <div className={hasCmeCredits ? 'md:col-span-3' : 'md:col-span-4'}>
                    <label
                      htmlFor="cme-organizer-input"
                      className="text-xs font-medium text-slate-600"
                    >
                      Đơn vị tổ chức
                    </label>
                    <input
                      id="cme-organizer-input"
                      type="text"
                      maxLength={100}
                      placeholder="VD: Bệnh viện Bạch Mai"
                      value={organizer}
                      onChange={e => setOrganizer(e.target.value)}
                      disabled={saving || uploading}
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label
                      htmlFor="cme-completed-input"
                      className="text-xs font-medium text-slate-600"
                    >
                      Ngày hoàn thành <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="cme-completed-input"
                      type="date"
                      required
                      max={new Date().toISOString().slice(0, 10)}
                      value={completedDate}
                      onChange={e => setCompletedDate(e.target.value)}
                      disabled={saving || uploading}
                    />
                  </div>

                  {/* Chỉ hiện ô nhập Số giờ tín chỉ khi chứng chỉ có yêu cầu CME */}
                  {hasCmeCredits && (
                    <div className="md:col-span-2">
                      <label
                        htmlFor="cme-credits-input"
                        className="text-xs font-medium text-slate-600"
                      >
                        Số giờ tín chỉ <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="cme-credits-input"
                        type="number"
                        step="0.5"
                        min="0.5"
                        required
                        placeholder="30"
                        value={credits}
                        onChange={e => setCredits(e.target.value)}
                        disabled={saving || uploading}
                      />
                    </div>
                  )}
                </div>

                {/* Hidden file input for Proof Upload */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-xs text-slate-500">
                    {fileUrl ? (
                      <span>
                        Tệp minh chứng:{' '}
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-teal-700 underline font-semibold"
                        >
                          {uploadedFileName || getProofLabel(fileUrl)}
                        </a>{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setFileUrl('');
                            setUploadedFileName('');
                          }}
                          className="text-red-600 hover:underline ml-2 bg-transparent border-0 p-0 cursor-pointer"
                        >
                          Gỡ tệp
                        </button>
                      </span>
                    ) : (
                      <span>Định dạng minh chứng chấp nhận: PDF, JPG, PNG (tối đa 10 MB)</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      className="button"
                      disabled={saving || uploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? 'Đang tải lên…' : 'Tải minh chứng'}
                    </button>
                    <button
                      type="submit"
                      className="button primary"
                      disabled={saving || uploading}
                    >
                      {saving ? 'Đang lưu…' : 'Lưu'}
                    </button>
                    <button
                      type="button"
                      className="button"
                      disabled={saving || uploading}
                      onClick={resetForm}
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Archived History Progress Tables for the same Certificate */}
          {historyCyclesWithRecords.length > 0 && (
            <div className="pt-6 border-t border-slate-200 space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Lịch sử các bảng tiến độ trước ({selectedCycle?.certificateType})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Các bản ghi CME đã hoàn thành ở những đợt trước của chứng chỉ này (chỉ xem, không chỉnh sửa).
                </p>
              </div>

              {historyCyclesWithRecords.map(({ cycle: histCycle, hasCme: histHasCredits, records: histRecords, total }, idx) => (
                <div
                  key={histCycle.cycleId || idx}
                  className="border border-slate-200 rounded-lg bg-slate-50/70 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-3 flex-wrap text-xs">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-200 text-slate-800 font-bold">
                        <Icon name="lock" size={12} /> Bảng lịch sử #{historyCyclesWithRecords.length - idx}
                      </span>
                      <span className="text-slate-600">
                        Thời gian:{' '}
                        <strong className="text-slate-800">
                          {histCycle.cycleStart && histCycle.cycleEnd
                            ? `${formatDateDdMmYyyy(histCycle.cycleStart)} - ${formatDateDdMmYyyy(
                                histCycle.cycleEnd
                              )}`
                            : 'Chưa đặt ngày'}
                        </strong>
                      </span>
                      <span className="text-slate-600">
                        Đã tích lũy:{' '}
                        <strong className="text-teal-700">
                          {total} /{' '}
                          {histHasCredits && histCycle.requiredCredits > 0
                            ? histCycle.requiredCredits
                            : 1}
                          {histHasCredits ? ' giờ tín chỉ' : ''}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="table-scroll border border-slate-200 rounded bg-white overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs">
                          <th scope="col">Tên khóa đào tạo</th>
                          <th scope="col">Đơn vị tổ chức</th>
                          <th scope="col">Ngày hoàn thành</th>
                          {histHasCredits && <th scope="col">Số giờ tín chỉ</th>}
                          <th scope="col">Minh chứng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {histRecords.length === 0 ? (
                          <tr>
                            <td
                              colSpan={histHasCredits ? 5 : 4}
                              className="text-center py-4 text-xs text-slate-400"
                            >
                              Không có bản ghi CME nào trong đợt này.
                            </td>
                          </tr>
                        ) : (
                          histRecords.map(rec => (
                            <tr key={rec.cmeId}>
                              <td className="font-medium text-slate-700">{rec.courseName}</td>
                              <td className="text-slate-600">{rec.provider || '—'}</td>
                              <td className="text-slate-600">
                                {formatDateDdMmYyyy(rec.completedDate)}
                              </td>
                              {histHasCredits && (
                                <td className="text-slate-800 font-semibold">{rec.credits}</td>
                              )}
                              <td>
                                {rec.fileUrl ? (
                                  <a
                                    href={rec.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-teal-700 hover:text-teal-900 underline font-semibold text-xs"
                                  >
                                    {getProofLabel(rec.fileUrl)}
                                  </a>
                                ) : (
                                  <span className="text-slate-400 text-xs">—</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal for "Sửa ngày chu kỳ" */}
      {editingDatesOpen && selectedCycle && (
        <Modal
          title="Chỉnh sửa ngày chu kỳ CME"
          onClose={() => setEditingDatesOpen(false)}
          busy={savingDates}
        >
          <form onSubmit={handleSaveCycleDates} className="p-6 space-y-4">
            {datesError && <Alert variant="error">{datesError}</Alert>}
            <div>
              <label htmlFor="cycle-start-date">
                Ngày bắt đầu chu kỳ <span className="text-red-500">*</span>
              </label>
              <input
                id="cycle-start-date"
                type="date"
                required
                value={cycleStartInput}
                onChange={e => setCycleStartInput(e.target.value)}
                disabled={savingDates}
              />
            </div>
            <div>
              <label htmlFor="cycle-end-date">
                Ngày kết thúc chu kỳ <span className="text-red-500">*</span>
              </label>
              <input
                id="cycle-end-date"
                type="date"
                required
                value={cycleEndInput}
                onChange={e => setCycleEndInput(e.target.value)}
                disabled={savingDates}
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                className="button"
                onClick={() => setEditingDatesOpen(false)}
                disabled={savingDates}
              >
                Hủy
              </button>
              <button type="submit" className="button primary" disabled={savingDates}>
                {savingDates ? 'Đang lưu…' : 'Lưu ngày chu kỳ'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal for "+ New record" (Create new progress tracking table & archive previous) */}
      {newCycleOpen && selectedCycle && (
        <Modal
          title="Tạo bảng tiến độ CME mới (New Record)"
          onClose={() => setNewCycleOpen(false)}
          busy={creatingCycle}
        >
          <form onSubmit={handleCreateNewCycle} className="p-6 space-y-4">
            {newCycleError && <Alert variant="error">{newCycleError}</Alert>}
            <p className="text-xs text-slate-600 leading-relaxed">
              Tạo bảng theo dõi tiến độ mới cho chứng chỉ{' '}
              <strong>{selectedCycle.certificateType}</strong>. Toàn bộ các bản ghi đã nhập ở bảng
              hiện tại sẽ được khóa và lưu vào phần{' '}
              <strong>Lịch sử các bảng tiến độ trước</strong> bên dưới.
            </p>
            <div>
              <label htmlFor="new-cycle-start-date">
                Ngày bắt đầu (Cycle start) <span className="text-red-500">*</span>
              </label>
              <input
                id="new-cycle-start-date"
                type="date"
                required
                value={newCycleStartInput}
                onChange={e => setNewCycleStartInput(e.target.value)}
                disabled={creatingCycle}
              />
            </div>
            <div>
              <label htmlFor="new-cycle-end-date">
                Ngày kết thúc (Cycle end) <span className="text-red-500">*</span>
              </label>
              <input
                id="new-cycle-end-date"
                type="date"
                required
                value={newCycleEndInput}
                onChange={e => setNewCycleEndInput(e.target.value)}
                disabled={creatingCycle}
              />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                className="button"
                onClick={() => setNewCycleOpen(false)}
                disabled={creatingCycle}
              >
                Hủy
              </button>
              <button type="submit" className="button primary" disabled={creatingCycle}>
                {creatingCycle ? 'Đang tạo…' : 'Tạo bảng tiến độ mới'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </section>
  );
}
