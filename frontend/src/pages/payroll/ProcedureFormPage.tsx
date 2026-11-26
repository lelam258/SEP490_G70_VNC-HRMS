import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '../../components/ui/Alert';
import MoneyInput from '../../components/ui/MoneyInput';
import { isDepartmentInFacility, procedureSlipApi } from '../../services/procedureSlipApi';
import { useAuthStore } from '../../store/useAuthStore';
import type {
  PreviewAssignmentCommissionItem,
  ProcedureCommissionRole,
  ProcedureLookups,
  ProcedureSlipDetail,
  ProcedureStaffAvailability,
} from '../../types/procedureSlip';
import { formatDateOnly, formatVnd, todayVn } from '../../utils/format';
import {
  buildDayTimelineSegments,
  computeStaffFreeIntervals,
  formatIntervalLabel,
  formatRuleFormula,
  formatSingleTimeVn,
  formatTimeRangeVn,
  getStaffShiftIntervals,
  intersectMinuteIntervalLists,
  parseProcedureTimeRange,
  parseTimePointToMinutes,
  PROCEDURE_ROLES,
  RULE_SOURCE_LABELS,
  type TimeMinuteInterval,
  type TimelineSegment,
} from '../../utils/procedureHelpers';

interface DraftAssignmentRow {
  rowKey: string;
  staffId: string;
  role: ProcedureCommissionRole;
}

export interface EvaluatedDepartmentStaff extends ProcedureStaffAvailability {
  status: 'available' | 'busy' | 'off';
  canSelect: boolean;
  isOutsideShift: boolean;
  statusText: string;
  busyTimeRangeText: string | null;
  freeUntil17hText: string | null;
  freeIntervals: TimeMinuteInterval[];
  timelineSegments: TimelineSegment[];
}

function buildFallbackTimeRange(durationHours?: number | null): string {
  const dur = durationHours && durationHours > 0 ? durationHours : 0.5;
  const startMinutes = 13 * 60;
  const endMinutes = Math.min(23 * 60 + 59, Math.round(startMinutes + dur * 60));
  const h1 = Math.floor(startMinutes / 60);
  const m1 = startMinutes % 60;
  const h2 = Math.floor(endMinutes / 60);
  const m2 = endMinutes % 60;
  return `${formatSingleTimeVn(h1, m1)}-${formatSingleTimeVn(h2, m2)}`;
}

function formatStaffOptionLabel(st: EvaluatedDepartmentStaff): string {
  return `${st.staffCode} - ${st.fullName}${st.positionName ? ` (${st.positionName})` : ''} — ${st.statusText}`;
}

interface SearchableStaffSelectProps {
  disabled: boolean;
  value: string;
  options: EvaluatedDepartmentStaff[];
  onChange: (staffId: string) => void;
}

function SearchableStaffSelect({
  disabled,
  value,
  options,
  onChange,
}: SearchableStaffSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = useMemo(
    () => options.find((o) => o.staffId === value) || null,
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (st) =>
        st.staffCode.toLowerCase().includes(q) ||
        st.fullName.toLowerCase().includes(q) ||
        (st.positionName && st.positionName.toLowerCase().includes(q))
    );
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleSelect = (st: EvaluatedDepartmentStaff) => {
    if (!st.canSelect && st.staffId !== value) return;
    onChange(st.staffId);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className="relative">
      {!open ? (
        <button
          type="button"
          disabled={disabled}
          onClick={handleOpen}
          className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm bg-white text-left flex items-center justify-between gap-2 disabled:bg-slate-100 disabled:text-slate-500 cursor-pointer disabled:cursor-not-allowed"
        >
          <span className={`truncate ${selectedOption ? 'text-slate-900' : 'text-slate-500'}`}>
            {disabled
              ? '-- Vui lòng chọn Khoa / Phòng thực hiện trước --'
              : selectedOption
              ? formatStaffOptionLabel(selectedOption)
              : '-- Chọn hoặc nhập mã/tên nhân sự thuộc khoa phòng --'}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 text-slate-500 shrink-0"
          >
            <path
              fillRule="evenodd"
              d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setOpen(false);
                setQuery('');
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const firstSelectable = filteredOptions.find(
                  (st) => st.canSelect || st.staffId === value
                );
                if (firstSelectable) {
                  handleSelect(firstSelectable);
                }
              }
            }}
            placeholder="Nhập mã hoặc tên để lọc (VD: BS00, BS004)..."
            className="w-full rounded-lg border border-sky-500 ring-2 ring-sky-500/20 px-2.5 py-1.5 pr-8 text-sm bg-white outline-none"
          />
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setQuery('');
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            aria-label="Đóng danh sách"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="h-4 w-4 rotate-180"
            >
              <path
                fillRule="evenodd"
                d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      )}

      {open && !disabled && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-lg border border-slate-300 bg-white shadow-lg py-1 text-sm">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-slate-500">
              Không tìm thấy nhân sự khớp với &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filteredOptions.map((st) => {
              const isSelected = st.staffId === value;
              const isDisabled = !st.canSelect && !isSelected;
              return (
                <button
                  key={st.staffId}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => handleSelect(st)}
                  className={`w-full px-3 py-1.5 text-left text-xs transition-colors flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-sky-600 text-white font-semibold cursor-pointer'
                      : isDisabled
                      ? 'text-slate-400 bg-slate-50/60 cursor-not-allowed'
                      : 'text-slate-800 hover:bg-sky-50 cursor-pointer'
                  }`}
                >
                  <span className="truncate">{formatStaffOptionLabel(st)}</span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

export default function ProcedureFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.session?.user);
  const isAccountant = currentUser?.role === 'accountant';

  const [lookups, setLookups] = useState<ProcedureLookups | null>(null);
  const [existingSlip, setExistingSlip] = useState<ProcedureSlipDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Form fields
  const [slipNumber, setSlipNumber] = useState<string>('');
  const [procedureDate, setProcedureDate] = useState<string>(() => todayVn());
  const [patientCode, setPatientCode] = useState<string>('');
  const [facilityId, setFacilityId] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [serviceId, setServiceId] = useState<string>('');
  const [chargedAmount, setChargedAmount] = useState<number>(0);
  const [directCost, setDirectCost] = useState<number>(0);
  const [isAfterHours, setIsAfterHours] = useState<boolean>(false);
  const [timeRangeInput, setTimeRangeInput] = useState<string>('');
  const [indicatingStaffId, setIndicatingStaffId] = useState<string>('');

  const [assignments, setAssignments] = useState<DraftAssignmentRow[]>([
    {
      rowKey: 'row-1',
      staffId: '',
      role: 'performing',
    },
  ]);

  const [staffAvailabilityList, setStaffAvailabilityList] = useState<ProcedureStaffAvailability[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState<boolean>(false);
  const [showStaffTable, setShowStaffTable] = useState<boolean>(true);
  const [staffFilterStatus, setStaffFilterStatus] = useState<'all' | 'available' | 'busy' | 'off'>('all');
  const [staffSearchQuery, setStaffSearchQuery] = useState<string>('');

  const [previews, setPreviews] = useState<PreviewAssignmentCommissionItem[]>([]);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

  const parsedTimeRange = useMemo(
    () => parseProcedureTimeRange(timeRangeInput),
    [timeRangeInput]
  );

  const selectedFacilityName = useMemo(() => {
    if (!facilityId) return '';
    return lookups?.facilities?.find((f) => f.facilityId === facilityId)?.name || '';
  }, [lookups?.facilities, facilityId]);

  // Filter departments belonging to the selected facility
  const availableDepartments = useMemo(() => {
    const allDepts = lookups?.departments || [];
    if (!facilityId) return allDepts;
    return allDepts.filter((d) =>
      isDepartmentInFacility(d, facilityId, selectedFacilityName)
    );
  }, [lookups?.departments, facilityId, selectedFacilityName]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const lookupData = await procedureSlipApi.getLookups();
      setLookups(lookupData);

      const matchedCreatorStaff =
        lookupData.staff.find((st) => st.staffId === lookupData.currentUserStaffId) ||
        lookupData.staff.find(
          (st) =>
            currentUser?.name &&
            st.fullName.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
        ) ||
        null;

      const defaultFacilityId = lookupData.facilities?.[0]?.facilityId || '';

      if (id) {
        const detail = await procedureSlipApi.getSlipDetail(id);
        setExistingSlip(detail);
        setSlipNumber(detail.slipNumber);
        setProcedureDate(detail.procedureDate);
        setPatientCode(detail.patientCode || '');
        setFacilityId(detail.facilityId || defaultFacilityId);
        setDepartmentId(detail.departmentId || '');
        setServiceId(detail.serviceId);
        setChargedAmount(detail.chargedAmount);
        setDirectCost(detail.directCost);
        setIsAfterHours(detail.isAfterHours);

        if (detail.startTime && detail.endTime) {
          setTimeRangeInput(formatTimeRangeVn(detail.startTime, detail.endTime));
        } else {
          setTimeRangeInput(buildFallbackTimeRange(detail.durationHours));
        }

        setIndicatingStaffId(
          detail.indicatingStaffId || matchedCreatorStaff?.staffId || ''
        );

        if (detail.assignments.length > 0) {
          setAssignments(
            detail.assignments.map((a, idx) => ({
              rowKey: a.assignmentId || `edit-${idx}`,
              staffId: a.staffId,
              role: a.role,
            }))
          );
        }
      } else {
        if (defaultFacilityId) {
          setFacilityId(defaultFacilityId);
        }

        if (lookupData.services.length > 0) {
          const firstService = lookupData.services[0];
          setServiceId(firstService.id);
          setChargedAmount(firstService.basePrice ?? 0);
        }

        const creatorStaffId =
          lookupData.currentUserStaffId || matchedCreatorStaff?.staffId || '';
        setIndicatingStaffId(creatorStaffId);

        const defaultFacName =
          lookupData.facilities?.find((f) => f.facilityId === defaultFacilityId)?.name || '';
        const deptsForDefaultFac = defaultFacilityId
          ? lookupData.departments.filter((d) =>
              isDepartmentInFacility(d, defaultFacilityId, defaultFacName)
            )
          : lookupData.departments;

        const preferredDeptId =
          lookupData.currentUserDepartmentId || matchedCreatorStaff?.departmentId || '';
        const defaultDeptId =
          deptsForDefaultFac.find((d) => d.departmentId === preferredDeptId)?.departmentId ||
          deptsForDefaultFac[0]?.departmentId ||
          '';

        if (defaultDeptId) {
          setDepartmentId(defaultDeptId);
        }

        setAssignments([
          {
            rowKey: 'row-1',
            staffId: '',
            role: 'performing',
          },
        ]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tải được dữ liệu biểu mẫu.');
    } finally {
      setLoading(false);
    }
  }, [id, currentUser?.name]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  // Load staff schedule & procedure bookings whenever procedureDate, departmentId, or facilityId changes (and on window focus)
  useEffect(() => {
    if (!procedureDate || !departmentId) {
      setStaffAvailabilityList([]);
      return;
    }

    let cancelled = false;

    const fetchAvailability = (showSpinner: boolean) => {
      if (showSpinner) setAvailabilityLoading(true);
      procedureSlipApi
        .getStaffAvailability({
          procedureDate,
          departmentId: departmentId || null,
          facilityId: facilityId || null,
          excludeSlipId: id || null,
        })
        .then((res) => {
          if (!cancelled) {
            setStaffAvailabilityList(res);
          }
        })
        .catch(() => {
          if (!cancelled && showSpinner) {
            setStaffAvailabilityList([]);
          }
        })
        .finally(() => {
          if (!cancelled && showSpinner) {
            setAvailabilityLoading(false);
          }
        });
    };

    fetchAvailability(true);

    const handleWindowFocus = () => fetchAvailability(false);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [procedureDate, departmentId, facilityId, id]);

  // Evaluate staff of the selected department & facility from the published weekly schedule
  const departmentStaffList = useMemo<EvaluatedDepartmentStaff[]>(() => {
    if (!departmentId) return [];

    const rawDeptStaff = staffAvailabilityList.filter(
      (s) =>
        !s.departmentId ||
        !departmentId ||
        s.departmentId.toLowerCase() === departmentId.toLowerCase()
    );

    return rawDeptStaff.map((merged) => {
      // Check overlapping bookings against parsedTimeRange
      const overlappingBookings =
        parsedTimeRange && merged.bookingsToday.length > 0
          ? merged.bookingsToday.filter((b) => {
              const bStart = parseTimePointToMinutes(b.startTime);
              const bEnd = parseTimePointToMinutes(b.endTime);
              if (bStart === null || bEnd === null) return false;
              return parsedTimeRange.startMinutes < bEnd && bStart < parsedTimeRange.endMinutes;
            })
          : [];

      const isBusy = overlappingBookings.length > 0;
      const busyRanges = Array.from(
        new Set(overlappingBookings.map((b) => b.timeRangeLabel))
      ).join(', ');

      const timelineSegments = merged.isWorkingToday
        ? buildDayTimelineSegments(merged.shiftsToday, merged.bookingsToday, 7 * 60, 17 * 60, procedureDate)
        : [];

      if (!merged.isWorkingToday) {
        const offLabel = merged.offReason || 'Nghỉ hôm nay';
        if (isAfterHours && !isBusy) {
          const freeIntervals = computeStaffFreeIntervals(
            merged.shiftsToday,
            merged.bookingsToday,
            parsedTimeRange ? parsedTimeRange.startMinutes : null,
            true,
            procedureDate
          );
          return {
            ...merged,
            status: 'available' as const,
            canSelect: true,
            isOutsideShift: false,
            busyTimeRangeText: null,
            freeUntil17hText: 'Ngoài giờ HC / Trực',
            statusText: `Ngoài giờ HC • (Huy động ngoài ca)`,
            freeIntervals,
            timelineSegments,
          };
        }
        return {
          ...merged,
          status: 'off' as const,
          canSelect: false,
          isOutsideShift: false,
          busyTimeRangeText: isBusy ? busyRanges : null,
          freeUntil17hText: null,
          statusText: isBusy ? `${offLabel} • Bận (${busyRanges})` : offLabel,
          freeIntervals: [],
          timelineSegments: [],
        };
      }

      // Tính khoảng giờ rảnh thực tế dựa trên ca làm việc theo mùa (tách nghỉ trưa)
      const shiftIntervals = getStaffShiftIntervals(merged.shiftsToday, isAfterHours, procedureDate);
      const freeIntervals = computeStaffFreeIntervals(
        merged.shiftsToday,
        merged.bookingsToday,
        null,
        isAfterHours,
        procedureDate
      );

      const freeLabels = freeIntervals.map(formatIntervalLabel);
      const freeUntil17hText = isAfterHours
        ? freeLabels.length > 0
          ? `Rảnh (Ngoài giờ HC): ${freeLabels.join(', ')}`
          : 'Kín lịch hôm nay'
        : freeLabels.length > 0
        ? `Rảnh theo ca: ${freeLabels.join(', ')}`
        : 'Kín lịch trong ca';

      if (isBusy) {
        return {
          ...merged,
          status: 'busy' as const,
          canSelect: false,
          isOutsideShift: false,
          busyTimeRangeText: busyRanges,
          freeUntil17hText,
          statusText: `Bận (${busyRanges}) • ${freeUntil17hText}`,
          freeIntervals,
          timelineSegments,
        };
      }

      // Kiểm tra nếu đã nhập khung giờ thực hiện thì khung giờ đó có nằm trong ca làm việc của nhân sự hay không
      const isCoveredByShift =
        !parsedTimeRange ||
        isAfterHours ||
        shiftIntervals.some(
          (seg) =>
            parsedTimeRange.startMinutes >= seg.start &&
            parsedTimeRange.endMinutes <= seg.end
        );

      const shiftSuffix =
        merged.shiftsToday.length > 0 ? ` (Ca ${merged.shiftsToday.join(', ')})` : '';

      if (!isCoveredByShift && parsedTimeRange) {
        const shiftRangeLabels = shiftIntervals.map(formatIntervalLabel).join(', ');
        return {
          ...merged,
          status: 'busy' as const,
          canSelect: false,
          isOutsideShift: true,
          busyTimeRangeText: `Ngoài ca ${shiftRangeLabels || ''}`.trim(),
          freeUntil17hText,
          statusText: `Ngoài ca làm việc${shiftSuffix} • ${freeUntil17hText}`,
          freeIntervals,
          timelineSegments,
        };
      }

      return {
        ...merged,
        status: 'available' as const,
        canSelect: true,
        isOutsideShift: false,
        busyTimeRangeText: null,
        freeUntil17hText,
        statusText: parsedTimeRange
          ? `Đang rảnh${shiftSuffix} • ${freeUntil17hText}`
          : `Có lịch làm${shiftSuffix} • ${freeUntil17hText}`,
        freeIntervals,
        timelineSegments,
      };
    })
    .sort((a, b) => {
      if (a.canSelect !== b.canSelect) return a.canSelect ? -1 : 1;
      if (a.isWorkingToday !== b.isWorkingToday) return a.isWorkingToday ? -1 : 1;
      return a.staffCode.localeCompare(b.staffCode);
    });
  }, [departmentId, staffAvailabilityList, parsedTimeRange, isAfterHours, procedureDate]);

  const departmentStaffMap = useMemo(() => {
    const map = new Map<string, EvaluatedDepartmentStaff>();
    for (const s of departmentStaffList) {
      map.set(s.staffId, s);
    }
    return map;
  }, [departmentStaffList]);

  const staffStatusCounts = useMemo(() => {
    let available = 0;
    let busy = 0;
    let off = 0;
    for (const st of departmentStaffList) {
      if (st.status === 'available') available++;
      else if (st.status === 'busy') busy++;
      else off++;
    }
    return {
      all: departmentStaffList.length,
      available,
      busy,
      off,
    };
  }, [departmentStaffList]);

  const filteredDepartmentStaffList = useMemo(() => {
    const q = staffSearchQuery.trim().toLowerCase();
    return departmentStaffList.filter((st) => {
      if (staffFilterStatus !== 'all' && st.status !== staffFilterStatus) {
        return false;
      }
      if (!q) return true;
      return (
        st.staffCode.toLowerCase().includes(q) ||
        st.fullName.toLowerCase().includes(q) ||
        (st.positionName && st.positionName.toLowerCase().includes(q))
      );
    });
  }, [departmentStaffList, staffFilterStatus, staffSearchQuery]);

  // Tính các khung giờ rảnh chung cho tất cả nhân sự đã được chọn vào kíp
  const teamCommonFreeRanges = useMemo<string[]>(() => {
    const selectedStaffs = Array.from(
      new Set(assignments.map((a) => a.staffId).filter(Boolean))
    )
      .map((sid) => departmentStaffMap.get(sid))
      .filter((st): st is EvaluatedDepartmentStaff => Boolean(st));

    if (selectedStaffs.length === 0) return [];
    if (selectedStaffs.some((st) => st.status === 'off')) return [];

    let common = selectedStaffs[0].freeIntervals;
    for (let i = 1; i < selectedStaffs.length; i++) {
      common = intersectMinuteIntervalLists(common, selectedStaffs[i].freeIntervals);
    }
    return common.map(formatIntervalLabel);
  }, [assignments, departmentStaffMap]);

  // Run live commission preview when service, date, amounts, time range, or assignments change
  useEffect(() => {
    const validAssignments = assignments.filter((a) => a.staffId);
    if (!serviceId || !procedureDate || validAssignments.length === 0) {
      setPreviews([]);
      return;
    }

    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const durationHours = parsedTimeRange ? parsedTimeRange.durationHours : null;
        const result = await procedureSlipApi.previewCommission({
          serviceId,
          procedureDate,
          chargedAmount: chargedAmount || 0,
          directCost: directCost || 0,
          isAfterHours,
          durationHours,
          assignments: validAssignments.map((a) => ({
            staffId: a.staffId,
            role: a.role,
            customCommissionAmount: null,
          })),
        });
        setPreviews(result);
      } catch {
        // Ignore transient preview errors while typing
      } finally {
        setPreviewLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [
    serviceId,
    procedureDate,
    chargedAmount,
    directCost,
    isAfterHours,
    parsedTimeRange,
    assignments,
  ]);

  const isAnesthesiaService = useMemo(() => {
    const s = lookups?.services.find((srv) => srv.id === serviceId);
    const name = (s?.name || '').toLowerCase();
    const cat = (s?.category || '').toLowerCase();
    return name.includes('gây mê') || name.includes('gay me') || cat.includes('gây mê') || cat.includes('gay me');
  }, [lookups?.services, serviceId]);

  const hasAnesthetistInTeam = useMemo(() => {
    return assignments.some((a) => {
      if (!a.staffId) return false;
      const st = departmentStaffMap.get(a.staffId);
      const pos = (st?.positionName || '').toLowerCase();
      return a.role === 'assisting' || pos.includes('mê') || pos.includes('gây mê');
    });
  }, [assignments, departmentStaffMap]);

  const handleQuickAssignFromTable = useCallback((st: EvaluatedDepartmentStaff) => {
    if (!st.canSelect) return;

    setAssignments((prev) => {
      if (prev.length === 0) {
        return [
          {
            rowKey: 'row-1',
            staffId: st.staffId,
            role: 'performing',
          },
        ];
      }

      // Khi có >= 2 dòng nhân sự được phân công, ưu tiên gán vào dòng nhân viên cuối cùng.
      // Nếu chỉ có 1 dòng thì gán vào dòng đầu tiên (hoặc dòng đang trống đầu tiên nếu có nhiều dòng chưa chọn hết).
      let targetIndex = prev.length - 1;
      if (prev.length < 2) {
        targetIndex = 0;
      } else {
        const firstEmptyIndex = prev.findIndex((r) => !r.staffId);
        // Nếu có từ 2 nhân viên trở lên đã được chọn, hoặc dòng cuối đang trống -> ưu tiên dòng cuối
        const assignedCount = prev.filter((r) => Boolean(r.staffId)).length;
        if (assignedCount >= 2 || firstEmptyIndex === -1) {
          targetIndex = prev.length - 1;
        } else {
          targetIndex = firstEmptyIndex;
        }
      }

      return prev.map((row, idx) =>
        idx === targetIndex ? { ...row, staffId: st.staffId } : row
      );
    });
  }, []);

  const handleServiceChange = (newServiceId: string) => {
    setServiceId(newServiceId);
    const matched = lookups?.services.find((s) => s.id === newServiceId);
    if (matched && matched.basePrice != null && (!isEditMode || chargedAmount === 0)) {
      setChargedAmount(matched.basePrice);
    }
  };

  const handleFacilityChange = (newFacilityId: string) => {
    setFacilityId(newFacilityId);
    const newFacilityName =
      lookups?.facilities?.find((f) => f.facilityId === newFacilityId)?.name || '';
    const matchingDepts = (lookups?.departments || []).filter((d) =>
      isDepartmentInFacility(d, newFacilityId, newFacilityName)
    );
    const currentStillValid = matchingDepts.some((d) => d.departmentId === departmentId);
    if (!currentStillValid) {
      const nextDeptId = matchingDepts[0]?.departmentId || '';
      handleDepartmentChange(nextDeptId);
    }
  };

  const handleDepartmentChange = (newDeptId: string) => {
    setDepartmentId(newDeptId);
    // Clear selected staff that do not belong to the newly chosen department
    setAssignments((prev) =>
      prev.map((row) => {
        if (!row.staffId) return row;
        const st = lookups?.staff.find((s) => s.staffId === row.staffId);
        if (!st || st.departmentId !== newDeptId) {
          return { ...row, staffId: '' };
        }
        return row;
      })
    );
  };

  const handleAddAssignment = () => {
    setAssignments((prev) => [
      ...prev,
      {
        rowKey: `row-${Date.now()}-${prev.length}`,
        staffId: '',
        role: 'assisting',
      },
    ]);
  };

  const handleRemoveAssignment = (rowKey: string) => {
    setAssignments((prev) => (prev.length > 1 ? prev.filter((r) => r.rowKey !== rowKey) : prev));
  };

  const handleUpdateAssignment = (rowKey: string, patch: Partial<DraftAssignmentRow>) => {
    setAssignments((prev) =>
      prev.map((row) => (row.rowKey === rowKey ? { ...row, ...patch } : row))
    );
  };

  const totalPreviewCommission = useMemo(
    () => previews.reduce((sum, item) => sum + item.commissionAmount, 0),
    [previews]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!serviceId) {
      setError('Vui lòng chọn dịch vụ thủ thuật.');
      return;
    }

    if (chargedAmount <= 0) {
      setError('Số tiền thu viện phí phải lớn hơn 0.');
      return;
    }

    if (!parsedTimeRange) {
      setError(
        'Vui lòng nhập thời gian thực hiện hợp lệ (VD: 13h-13h30 hoặc 13:00-13:30), giờ kết thúc phải sau giờ bắt đầu.'
      );
      return;
    }

    if (lookups?.facilities && lookups.facilities.length > 0 && !facilityId) {
      setError('Vui lòng chọn Cơ sở thực hiện ở phần Thông tin hành chính.');
      return;
    }

    if (!departmentId) {
      setError('Vui lòng chọn Khoa / Phòng thực hiện ở phần Nhân sự tham gia.');
      return;
    }

    const validAssignments = assignments.filter((a) => a.staffId);
    if (validAssignments.length === 0) {
      setError('Vui lòng chọn ít nhất 1 nhân sự tham gia trong kíp thực hiện.');
      return;
    }

    const participantKeys = validAssignments.map((a) => `${a.staffId}:${a.role}`);
    if (new Set(participantKeys).size !== participantKeys.length) {
      setError('Một nhân viên không được lặp cùng vai trò trong một phiếu thủ thuật.');
      return;
    }

    for (const a of validAssignments) {
      const stEval = departmentStaffMap.get(a.staffId);
      if (!stEval) {
        setError('Nhân sự được chọn không thuộc Khoa / Phòng thực hiện hiện tại.');
        return;
      }
      if (stEval.status === 'off') {
        setError(
          `Nhân sự ${stEval.staffCode} - ${stEval.fullName} không đi làm hôm nay (${stEval.statusText}). Vui lòng chọn nhân sự khác.`
        );
        return;
      }
      if (stEval.status === 'busy') {
        setError(
          `Nhân sự ${stEval.staffCode} - ${stEval.fullName} đang ${stEval.statusText} trong khung giờ dự kiến (${parsedTimeRange.displayLabel}). Vui lòng chọn nhân sự khác hoặc đổi khung giờ.`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        serviceId,
        facilityId: facilityId || null,
        departmentId: departmentId || null,
        slipNumber: isEditMode ? slipNumber : slipNumber.trim() || null,
        procedureDate,
        patientCode: patientCode.trim() || null,
        chargedAmount,
        directCost: directCost || 0,
        isAfterHours,
        durationHours: parsedTimeRange.durationHours,
        startTime: parsedTimeRange.startTime,
        endTime: parsedTimeRange.endTime,
        indicatingStaffId: indicatingStaffId || null,
        assignments: validAssignments.map((a) => ({
          staffId: a.staffId,
          role: a.role,
          customCommissionAmount: null,
        })),
      };

      const saved =
        isEditMode && id
          ? await procedureSlipApi.updateSlip(id, payload)
          : await procedureSlipApi.createSlip(payload);

      navigate(`/procedures/${saved.slipId}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể lưu phiếu thủ thuật.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500">
        Đang tải thông tin biểu mẫu phiếu thủ thuật...
      </div>
    );
  }

  if (isEditMode && existingSlip && !existingSlip.canEdit) {
    return (
      <div className="space-y-4">
        <Alert variant="error">
          Phiếu thủ thuật <strong>{existingSlip.slipNumber}</strong> hiện đang ở trạng thái{' '}
          <strong>{existingSlip.status.toUpperCase()}</strong> hoặc thuộc kỳ lương đã khóa nên không được phép chỉnh sửa.
        </Alert>
        <button
          type="button"
          className="button"
          onClick={() => navigate(`/procedures/${existingSlip.slipId}`)}
        >
          ← Quay lại xem chi tiết phiếu
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 workspace-content-page">
      <div className="page-heading">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() =>
                navigate(
                  isEditMode && id
                    ? `/procedures/${id}`
                    : isAccountant
                    ? '/payroll/procedures'
                    : '/procedures'
                )
              }
              className="text-xs font-medium text-sky-700 hover:underline cursor-pointer"
            >
              ← {isEditMode ? 'Quay lại chi tiết phiếu' : 'Danh sách phiếu thủ thuật'}
            </button>
          </div>
          <h1>
            {isAccountant
              ? `Kế toán điều chỉnh ca thủ thuật: ${existingSlip?.slipNumber || ''}`
              : isEditMode
              ? `Chỉnh sửa phiếu thủ thuật: ${existingSlip?.slipNumber || ''}`
              : 'Lập phiếu thủ thuật y tế mới'}
          </h1>
          {(isAccountant || isEditMode) && (
            <p className="muted">
              {isAccountant
                ? 'Kế toán điều chỉnh nhân viên thực hiện hoặc thời gian dự kiến của ca thủ thuật. Các thông tin tài chính và dịch vụ được giữ nguyên.'
                : 'Cập nhật các trường được phép của phiếu thủ thuật và gửi lại vào quy trình kiểm duyệt.'}
            </p>
          )}
        </div>
      </div>
      <div className="workspace-section-body">

      {error && <Alert variant="error">{error}</Alert>}

      {isAccountant && isEditMode && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-900 flex items-start gap-3">
          <span className="text-xl shrink-0">ℹ</span>
          <div className="text-xs space-y-1">
            <strong className="text-sm text-amber-950 font-bold block">
              Chế độ Kế toán điều chỉnh ca thủ thuật: {slipNumber}
            </strong>
            <p className="m-0 text-amber-800">
              Kế toán có quyền điều chỉnh <strong>nhân viên thực hiện</strong> và <strong>thời gian dự kiến</strong> của ca thủ thuật. Các thông tin về cơ sở, khoa phòng, dịch vụ và viện phí được cố định theo phiếu gốc.
            </p>
            <p className="m-0 text-amber-900 font-semibold">
              Sau khi bấm lưu, hệ thống sẽ tự động gửi thông báo điều chỉnh ca đến Bác sĩ tạo thủ thuật.
            </p>
          </div>
        </div>
      )}

      {isEditMode && existingSlip?.status === 'rejected' && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-900">
          <div className="font-bold text-rose-800">
            Lý do bị từ chối cần khắc phục trước khi gửi duyệt lại:
          </div>
          <div className="mt-1">{existingSlip.rejectedReason}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 workspace-form-panel">
        <div className="workspace-form-fields space-y-6">
        {/* Khối 1: Thông tin hành chính & Dịch vụ kỹ thuật (Đã chuyển Khoa/Phòng xuống Khối 2) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2.5">
            1. Thông tin hành chính & Dịch vụ thủ thuật
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Số phiếu thủ thuật {isEditMode ? '(Chỉ đọc)' : '(Để trống để tự sinh mã)'}
              </label>
              <input
                type="text"
                value={slipNumber}
                disabled={isEditMode}
                onChange={(e) => setSlipNumber(e.target.value)}
                placeholder="Tự động: TT-YYYYMMDD-001"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono disabled:bg-slate-100 disabled:text-slate-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Ngày thực hiện thủ thuật *
              </label>
              <input
                type="date"
                required
                value={procedureDate}
                onChange={(e) => setProcedureDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Mã bệnh nhân (Patient Code) *
              </label>
              <input
                type="text"
                required
                disabled={isAccountant}
                value={patientCode}
                onChange={(e) => setPatientCode(e.target.value)}
                placeholder="VD: BN20261101"
                className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase ${
                  isAccountant ? 'bg-slate-100 text-slate-600 cursor-not-allowed' : ''
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Cơ sở thực hiện *
              </label>
              <select
                required
                disabled={isAccountant}
                value={facilityId}
                onChange={(e) => handleFacilityChange(e.target.value)}
                className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white font-medium ${
                  isAccountant ? 'bg-slate-100 text-slate-600 cursor-not-allowed' : ''
                }`}
              >
                <option value="">-- Chọn cơ sở thực hiện --</option>
                {(lookups?.facilities ?? []).map((fac) => (
                  <option key={fac.facilityId} value={fac.facilityId}>
                    {fac.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Dịch vụ kỹ thuật / Thủ thuật y tế *
              </label>
              <select
                required
                disabled={isAccountant}
                value={serviceId}
                onChange={(e) => handleServiceChange(e.target.value)}
                className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white ${
                  isAccountant ? 'bg-slate-100 text-slate-600 cursor-not-allowed' : ''
                }`}
              >
                <option value="">-- Chọn dịch vụ kỹ thuật --</option>
                {lookups?.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    [{s.code}] {s.name} {s.category ? `(${s.category})` : ''} — Giá chuẩn:{' '}
                    {formatVnd(s.basePrice ?? 0)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Số tiền thu viện phí (VNĐ) *
              </label>
              <MoneyInput
                disabled={isAccountant}
                value={chargedAmount}
                onChange={(val) => setChargedAmount(val ?? 0)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Chi phí vật tư trực tiếp (VNĐ)
              </label>
              <MoneyInput
                disabled={isAccountant}
                value={directCost}
                onChange={(val) => setDirectCost(val ?? 0)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Thời gian thực hiện (Từ giờ - Đến giờ) *
              </label>
              <input
                type="text"
                required
                value={timeRangeInput}
                onChange={(e) => setTimeRangeInput(e.target.value)}
                placeholder="VD: 13h-13h30"
                className={`w-full rounded-lg border px-3 py-2 text-sm font-medium ${
                  parsedTimeRange
                    ? 'border-slate-300 text-slate-900'
                    : timeRangeInput.trim() === ''
                    ? 'border-slate-300 text-slate-900'
                    : 'border-rose-400 bg-rose-50/40 text-rose-900'
                }`}
              />
              <div className="mt-1 text-[11px]">
                {parsedTimeRange ? (
                  <span className="text-emerald-700 font-medium">
                    Dự kiến: {parsedTimeRange.displayLabel} ({parsedTimeRange.durationHours} giờ)
                  </span>
                ) : timeRangeInput.trim() === '' ? (
                  <span className="text-slate-500">
                    Bác sĩ tự chỉ định thời gian (VD: 13h-13h30 hoặc 13:00-13:30)
                  </span>
                ) : (
                  <span className="text-rose-600">
                    Nhập dạng: 13h-13h30 hoặc 13:00-13:30 (giờ kết thúc &gt; giờ bắt đầu)
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Bác sĩ chỉ định (Người đang tạo)
              </label>
              <input
                type="text"
                readOnly
                disabled
                value={
                  isEditMode && existingSlip
                    ? existingSlip.indicatingStaffName ||
                      existingSlip.recordedByName ||
                      lookups?.currentUserFullName ||
                      currentUser?.name ||
                      currentUser?.username ||
                      'Người tạo phiếu'
                    : (() => {
                        const matched = lookups?.staff.find(
                          (st) => st.staffId === indicatingStaffId
                        );
                        if (matched) {
                          return `${matched.staffCode} - ${matched.fullName} (Người đang tạo)`;
                        }
                        const fallbackName =
                          lookups?.currentUserFullName ||
                          currentUser?.name ||
                          currentUser?.username ||
                          'Người đang tạo';
                        return `${fallbackName} (Người đang tạo)`;
                      })()
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-slate-100 text-slate-700 font-medium cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                checked={isAfterHours}
                onChange={(e) => setIsAfterHours(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-sky-600"
              />
              <span>Thực hiện ngoài giờ hành chính / Ca trực đêm / Ngày lễ</span>
            </label>

            <div className="text-xs text-slate-600">
              Doanh thu thuần dự kiến:{' '}
              <strong className="text-sky-700 text-sm font-[tabular-nums]">
                {formatVnd(Math.max(0, chargedAmount - directCost))}
              </strong>
            </div>
          </div>
        </div>

        {/* Khối 2: Khoa / Phòng thực hiện, Nhân sự tham gia kíp thủ thuật & Tính hoa hồng */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                2. Nhân sự tham gia kíp thủ thuật & Tính hoa hồng
              </h2>
              <p className="text-xs text-slate-500">
                Chọn Khoa / Phòng thực hiện để hiển thị các bác sĩ, nhân viên thuộc phòng ban đó theo lịch làm việc và thời gian thực hiện dự kiến.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddAssignment}
              disabled={!departmentId}
              className="button text-xs py-1.5 px-3 text-sky-700 border-sky-300 bg-sky-50 hover:bg-sky-100 disabled:opacity-50 shrink-0"
            >
              + Thêm nhân sự vào kíp
            </button>
          </div>

          {isAnesthesiaService && !hasAnesthetistInTeam && (
            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 text-amber-950 text-xs flex items-start gap-2.5">
              <span className="text-base shrink-0">💡</span>
              <div className="space-y-0.5">
                <div className="font-bold text-amber-900">Khuyến nghị kíp thủ thuật gây mê:</div>
                <div>
                  Dịch vụ kỹ thuật đã chọn có tính chất gây mê / phẫu thuật. Khuyến nghị kíp thực hiện nên phân công thêm <strong>01 Bác sĩ gây mê (Anesthetist)</strong> và <strong>01 Phụ tá (Assisting)</strong> để đảm bảo quy trình chuyên môn.
                </div>
              </div>
            </div>
          )}

          {/* Chọn Khoa / Phòng thực hiện & Bảng đối chiếu lịch làm việc / thời gian rảnh */}
          <div className="p-4 rounded-xl border border-sky-200/80 bg-sky-50/40 space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
              <div className="lg:col-span-5">
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Khoa / Phòng thực hiện *
                </label>
                <select
                  required
                  disabled={isAccountant}
                  value={departmentId}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white font-medium ${
                    isAccountant ? 'bg-slate-100 text-slate-600 cursor-not-allowed' : ''
                  }`}
                >
                  <option value="">
                    {facilityId
                      ? `-- Chọn Khoa / Phòng thuộc ${selectedFacilityName || 'cơ sở đã chọn'} --`
                      : '-- Chọn Khoa / Phòng thực hiện --'}
                  </option>
                  {availableDepartments.map((d) => (
                    <option key={d.departmentId} value={d.departmentId}>
                      {d.name} ({d.deptCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-7 flex flex-wrap items-center gap-2 lg:justify-end">
                {!departmentId && (
                  <span className="text-xs text-slate-500 italic">
                    {facilityId
                      ? `Đang lọc phòng ban thuộc ${selectedFacilityName}. Vui lòng chọn Khoa / Phòng để kiểm tra lịch làm việc tại cơ sở này.`
                      : 'Vui lòng chọn Cơ sở và Khoa / Phòng thực hiện để kiểm tra lịch làm việc của nhân sự.'}
                  </span>
                )}
              </div>
            </div>

            {departmentId && (
              <div className="pt-2 border-t border-sky-200/60">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">
                      Nhân sự của phòng ban{selectedFacilityName ? ` tại ${selectedFacilityName}` : ''} ngày{' '}
                      {formatDateOnly(procedureDate)}
                      {parsedTimeRange ? ` (Khung giờ dự kiến: ${parsedTimeRange.displayLabel})` : ''}:
                    </span>
                    {availabilityLoading && (
                      <span className="text-[11px] text-sky-700">Đang kiểm tra lịch làm việc...</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowStaffTable((prev) => !prev)}
                    aria-label="Đóng/Mở danh sách nhân sự"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-sky-300 bg-white text-sky-700 hover:bg-sky-50 cursor-pointer transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className={`h-4 w-4 transition-transform duration-200 ${
                        showStaffTable ? 'rotate-180' : 'rotate-0'
                      }`}
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>

                {showStaffTable && (
                  <div className="space-y-2.5">
                    {departmentStaffList.length > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 bg-white/80 rounded-lg border border-sky-200/70 px-2.5 py-1.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(
                            [
                              {
                                key: 'all',
                                label: `Tất cả (${staffStatusCounts.all})`,
                                activeCls: 'bg-sky-600 text-white border-sky-600',
                              },
                              {
                                key: 'available',
                                label: `${parsedTimeRange ? 'Đang rảnh' : 'Có lịch làm'} (${
                                  staffStatusCounts.available
                                })`,
                                activeCls: 'bg-emerald-600 text-white border-emerald-600',
                              },
                              {
                                key: 'busy',
                                label: `Bận / Ngoài ca (${staffStatusCounts.busy})`,
                                activeCls: 'bg-amber-600 text-white border-amber-600',
                              },
                              {
                                key: 'off',
                                label: `Nghỉ (${staffStatusCounts.off})`,
                                activeCls: 'bg-slate-600 text-white border-slate-600',
                              },
                            ] as const
                          ).map((chip) => {
                            const isActive = staffFilterStatus === chip.key;
                            return (
                              <button
                                key={chip.key}
                                type="button"
                                onClick={() => setStaffFilterStatus(chip.key)}
                                className={`text-[11px] px-2 py-0.5 rounded-full border font-medium transition-colors cursor-pointer ${
                                  isActive
                                    ? chip.activeCls
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                }`}
                              >
                                {chip.label}
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="hidden sm:flex items-center gap-2 text-[10px] text-slate-500 mr-1">
                            <span className="inline-flex items-center gap-1">
                              <span className="h-2 w-2 rounded-xs bg-emerald-500 inline-block" />
                              Rảnh
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="h-2 w-2 rounded-xs bg-amber-500 inline-block" />
                              Đã có ca
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <span className="h-2 w-2 rounded-xs bg-slate-300 inline-block" />
                              Nghỉ trưa / Ngoài ca
                            </span>
                          </div>
                          <input
                            type="text"
                            value={staffSearchQuery}
                            onChange={(e) => setStaffSearchQuery(e.target.value)}
                            placeholder="Tìm mã, tên, chức danh..."
                            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs w-44 outline-none focus:border-sky-500"
                          />
                        </div>
                      </div>
                    )}

                    {teamCommonFreeRanges.length > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-3 py-1.5 text-xs text-emerald-950">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold text-emerald-800">
                            ⏱ Khung giờ cả kíp đã chọn cùng rảnh:
                          </span>
                          {teamCommonFreeRanges.map((range) => (
                            <button
                              key={range}
                              type="button"
                              onClick={() => {
                                if (!timeRangeInput.trim()) {
                                  setTimeRangeInput(range);
                                }
                              }}
                              title="Bấm để điền khung giờ này vào ô Thời gian thực hiện (nếu đang trống)"
                              className="px-2 py-0.5 rounded bg-white border border-emerald-300 text-emerald-800 font-semibold text-[11px] hover:bg-emerald-100 cursor-pointer transition-colors"
                            >
                              {range}
                            </button>
                          ))}
                        </div>
                        {!parsedTimeRange && (
                          <span className="text-[11px] text-emerald-700 italic">
                            (Bấm vào khung giờ hoặc tự nhập giờ thực hiện ở mục 1)
                          </span>
                        )}
                      </div>
                    )}

                    {departmentStaffList.length === 0 ? (
                      <div className="text-xs text-slate-500 bg-white rounded-lg border border-slate-200 px-3 py-2">
                        {availabilityLoading
                          ? 'Đang kiểm tra lịch làm việc tuần của khoa/phòng tại cơ sở đã chọn...'
                          : `Chưa có nhân sự nào thuộc khoa/phòng này được phân tại ${
                              selectedFacilityName || 'cơ sở đã chọn'
                            } trong lịch làm việc tuần (đã chốt).`}
                      </div>
                    ) : filteredDepartmentStaffList.length === 0 ? (
                      <div className="text-xs text-slate-500 bg-white rounded-lg border border-slate-200 px-3 py-2">
                        Không có nhân sự nào khớp với bộ lọc hiện tại.
                      </div>
                    ) : (
                      <div className="max-h-[260px] overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {filteredDepartmentStaffList.map((st) => {
                          const isAlreadyAssigned = assignments.some(
                            (a) => a.staffId === st.staffId
                          );

                          const badgeStyle =
                            st.status === 'available'
                              ? isAlreadyAssigned
                                ? 'border-sky-500 bg-sky-100/80 text-sky-950 ring-1 ring-sky-400 cursor-pointer hover:bg-sky-100'
                                : 'border-emerald-200 bg-emerald-50/70 text-emerald-900 cursor-pointer hover:border-emerald-400 hover:bg-emerald-100/70'
                              : st.status === 'busy'
                              ? 'border-amber-300 bg-amber-50/80 text-amber-900 cursor-not-allowed'
                              : 'border-slate-200 bg-slate-100/80 text-slate-500 cursor-not-allowed';

                          const pillStyle =
                            st.status === 'available'
                              ? isAlreadyAssigned
                                ? 'bg-sky-600 text-white'
                                : parsedTimeRange
                                ? 'bg-emerald-600 text-white'
                                : 'bg-teal-600 text-white'
                              : st.status === 'busy'
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-400 text-white';

                          const pillLabel =
                            st.status === 'available'
                              ? isAlreadyAssigned
                                ? 'Đã chọn'
                                : parsedTimeRange
                                ? 'Rảnh'
                                : st.bookingsToday.length > 0
                                ? `Đã có ${st.bookingsToday.length} ca`
                                : 'Trống lịch'
                              : st.status === 'busy'
                              ? st.isOutsideShift
                                ? 'Ngoài ca'
                                : `Bận (${st.busyTimeRangeText})`
                              : 'Nghỉ hôm nay';

                          const scheduledBookings = st.bookingsToday.filter(
                            (b) => (b.status || '').toLowerCase() !== 'completed'
                          );
                          const completedBookings = st.bookingsToday.filter(
                            (b) => (b.status || '').toLowerCase() === 'completed'
                          );

                          const scheduledSummaryText =
                            scheduledBookings.length > 0
                              ? scheduledBookings
                                  .map(
                                    (b) =>
                                      `${b.timeRangeLabel}${
                                        b.serviceName ? ` (${b.serviceName})` : ''
                                      }`
                                  )
                                  .join(' • ')
                              : null;

                          const completedSummaryText =
                            completedBookings.length > 0
                              ? completedBookings
                                  .map(
                                    (b) =>
                                      `${b.timeRangeLabel}${
                                        b.serviceName ? ` (${b.serviceName})` : ''
                                      }`
                                  )
                                  .join(' • ')
                              : null;

                          const completedTooltipText =
                            completedBookings.length > 0
                              ? completedBookings
                                  .map(
                                    (b) =>
                                      `${b.timeRangeLabel}${
                                        b.serviceName ? ` (${b.serviceName})` : ''
                                      }${
                                        b.plannedTimeRangeLabel
                                          ? ` [Dự kiến: ${b.plannedTimeRangeLabel}]`
                                          : ''
                                      }`
                                  )
                                  .join(' • ')
                              : null;

                          const bookingSummaryText = [
                            scheduledSummaryText ? `Đã đặt: ${scheduledSummaryText}` : null,
                            completedTooltipText ? `Bận thực tế: ${completedTooltipText}` : null,
                          ]
                            .filter(Boolean)
                            .join(' | ');

                          return (
                            <button
                              key={st.staffId}
                              type="button"
                              disabled={!st.canSelect}
                              onClick={() => handleQuickAssignFromTable(st)}
                              title={
                                st.canSelect
                                  ? `Bấm để chọn ${st.staffCode} - ${st.fullName} xuống phần phân công${
                                      bookingSummaryText
                                        ? `\n${bookingSummaryText}`
                                        : '\nChưa có ca thủ thuật nào trong ngày'
                                    }`
                                  : `Không thể chọn (${st.statusText})`
                              }
                              className={`min-h-[82px] w-full text-left rounded-lg border px-3 py-2 text-xs flex flex-col justify-between gap-1.5 transition-colors ${badgeStyle}`}
                            >
                              <div className="flex items-start justify-between gap-2 w-full">
                                <div className="min-w-0">
                                  <div className="font-semibold truncate">
                                    {st.staffCode} - {st.fullName}
                                  </div>
                                  <div className="text-[11px] opacity-80 truncate">
                                    {st.positionName || 'Nhân viên y tế'}
                                    {st.isWorkingToday && st.shiftsToday.length > 0
                                      ? ` • Ca ${st.shiftsToday.join(', ')}`
                                      : !st.isWorkingToday && st.offReason
                                      ? ` • ${st.offReason}`
                                      : ''}
                                  </div>
                                </div>
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${pillStyle}`}
                                >
                                  {pillLabel}
                                </span>
                              </div>

                              {st.isWorkingToday && (
                                <div className="w-full space-y-1">
                                  {st.freeUntil17hText && (
                                    <div
                                      className="text-[11px] font-medium text-sky-800 truncate"
                                      title={st.freeUntil17hText}
                                    >
                                      {st.freeUntil17hText}
                                    </div>
                                  )}

                                  {scheduledSummaryText && (
                                    <div
                                      className="text-[10px] text-amber-800 font-medium truncate"
                                      title={`Đã đặt: ${scheduledSummaryText}`}
                                    >
                                      Đã đặt: {scheduledSummaryText}
                                    </div>
                                  )}

                                  {completedSummaryText && (
                                    <div
                                      className="text-[10px] text-amber-800 font-medium truncate"
                                      title={`Bận (đã thực hiện): ${completedTooltipText || completedSummaryText}`}
                                    >
                                      Bận: {completedSummaryText}
                                    </div>
                                  )}

                                  {st.timelineSegments.length > 0 && (
                                    <div className="pt-0.5">
                                      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden flex">
                                        {st.timelineSegments.map((seg, segIdx) => (
                                          <div
                                            key={`${seg.start}-${seg.end}-${segIdx}`}
                                            style={{ width: `${seg.widthPercent}%` }}
                                            title={seg.label}
                                            className={`h-full border-r border-white/50 last:border-r-0 ${
                                              seg.type === 'free'
                                                ? 'bg-emerald-500'
                                                : seg.type === 'busy'
                                                ? 'bg-amber-500'
                                                : 'bg-slate-300'
                                            }`}
                                          />
                                        ))}
                                      </div>
                                      <div className="flex justify-between text-[9px] text-slate-400 leading-none mt-0.5">
                                        <span>7h</span>
                                        <span>11h30</span>
                                        <span>13h30</span>
                                        <span>17h</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-3">
            {assignments.map((row, index) => {
              const previewItem = previews.find(
                (p) => p.staffId === row.staffId && p.role === row.role
              );
              const selectedStaffEval = row.staffId ? departmentStaffMap.get(row.staffId) : null;

              return (
                <div
                  key={row.rowKey}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start p-3 rounded-lg border border-slate-200 bg-slate-50/60"
                >
                  <div className="md:col-span-5">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Nhân sự #{index + 1} *
                    </label>
                    <SearchableStaffSelect
                      disabled={!departmentId}
                      value={row.staffId}
                      options={departmentStaffList}
                      onChange={(staffId) =>
                        handleUpdateAssignment(row.rowKey, { staffId })
                      }
                    />

                    {selectedStaffEval && !selectedStaffEval.canSelect && (
                      <div className="mt-1 text-[11px] text-rose-600 font-medium">
                        ⚠ Nhân sự này hiện không thể tham gia ({selectedStaffEval.statusText}). Vui lòng chọn nhân sự đang rảnh.
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Vai trò trong ca *
                    </label>
                    <select
                      value={row.role}
                      onChange={(e) =>
                        handleUpdateAssignment(row.rowKey, {
                          role: e.target.value as ProcedureCommissionRole,
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm bg-white"
                    >
                      {PROCEDURE_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Hoa hồng được hưởng (Theo quy tắc)
                    </label>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center justify-between min-h-[43px]">
                      <span className="text-xs text-slate-500 truncate pr-2">
                        {previewItem
                          ? `${RULE_SOURCE_LABELS[previewItem.ruleSource] || previewItem.ruleSource} (${formatRuleFormula(
                              previewItem.valueType,
                              previewItem.ruleValue
                            )})`
                          : 'Tự động theo quy tắc'}
                      </span>
                      <strong className="text-sm text-emerald-700 font-[tabular-nums] shrink-0">
                        {formatVnd(previewItem?.commissionAmount ?? 0)}
                      </strong>
                    </div>
                  </div>

                  <div className="md:col-span-1 flex justify-end pt-6">
                    <button
                      type="button"
                      disabled={assignments.length <= 1}
                      onClick={() => handleRemoveAssignment(row.rowKey)}
                      className="proc-action-btn reject disabled:opacity-40"
                      title="Xóa dòng"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <span className="text-xs text-slate-500">
              {previewLoading
                ? 'Đang tính lại hoa hồng...'
                : `Tổng số thành viên: ${assignments.filter((a) => a.staffId).length} người`}
            </span>
            <div className="text-sm">
              Tổng quỹ hoa hồng ca thủ thuật:{' '}
              <strong className="text-lg text-emerald-700 font-[tabular-nums]">
                {formatVnd(totalPreviewCommission)}
              </strong>
            </div>
          </div>
        </div>

        {/* Footer Submit Buttons */}
        </div>
        <div className="flex items-center justify-end gap-3 form-actions">
          <button
            type="button"
            className="button"
            disabled={submitting}
            onClick={() =>
              navigate(
                isEditMode && id
                  ? `/procedures/${id}`
                  : isAccountant
                  ? '/payroll/procedures'
                  : '/procedures'
              )
            }
          >
            Hủy bỏ
          </button>
          <button type="submit" disabled={submitting} className="button primary font-semibold">
            {submitting
              ? 'Đang lưu...'
              : isAccountant
              ? 'Lưu điều chỉnh & Chuyển sang Đang thực hiện'
              : isEditMode
              ? existingSlip?.status === 'rejected'
                ? 'Lưu cập nhật & Gửi duyệt lại'
                : 'Lưu cập nhật phiếu thủ thuật'
              : 'Lưu phiếu thủ thuật'}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}
