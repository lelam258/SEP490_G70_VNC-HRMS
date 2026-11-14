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
  computeFreeTimeRangesUntil17h,
  formatRuleFormula,
  formatSingleTimeVn,
  formatTimeRangeVn,
  parseProcedureTimeRange,
  parseTimePointToMinutes,
  PROCEDURE_ROLES,
  RULE_SOURCE_LABELS,
} from '../../utils/procedureHelpers';

interface DraftAssignmentRow {
  rowKey: string;
  staffId: string;
  role: ProcedureCommissionRole;
}

export interface EvaluatedDepartmentStaff extends ProcedureStaffAvailability {
  status: 'available' | 'busy' | 'off';
  canSelect: boolean;
  statusText: string;
  busyTimeRangeText: string | null;
  freeUntil17hText: string | null;
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
  const [timeRangeInput, setTimeRangeInput] = useState<string>('13h-13h30');
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
      const rawLookupData = await procedureSlipApi.getLookups();
      const sampleServices = rawLookupData.services.slice(0, 3);
      const lookupData: ProcedureLookups = {
        ...rawLookupData,
        services: sampleServices,
      };
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

        if (sampleServices.length > 0) {
          const firstService = sampleServices[0];
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

  // Load staff schedule & procedure bookings whenever procedureDate, departmentId, or facilityId changes
  useEffect(() => {
    if (!procedureDate || !departmentId) {
      setStaffAvailabilityList([]);
      return;
    }

    let cancelled = false;
    setAvailabilityLoading(true);

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
        if (!cancelled) {
          setStaffAvailabilityList([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setAvailabilityLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [procedureDate, departmentId, facilityId, id]);

  // Evaluate staff of the selected department & facility from the published weekly schedule
  const departmentStaffList = useMemo<EvaluatedDepartmentStaff[]>(() => {
    if (!departmentId) return [];

    const rawDeptStaff = staffAvailabilityList.filter((s) => s.departmentId === departmentId);

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

      if (!merged.isWorkingToday) {
        const offLabel = merged.offReason || 'Nghỉ hôm nay';
        return {
          ...merged,
          status: 'off',
          canSelect: false,
          busyTimeRangeText: isBusy ? busyRanges : null,
          freeUntil17hText: null,
          statusText: isBusy ? `${offLabel} • Bận (${busyRanges})` : offLabel,
        };
      }

      // Tính các khoảng thời gian còn rảnh từ giờ bắt đầu dự kiến đến 17h (5h nghỉ)
      const windowStartMin = parsedTimeRange ? parsedTimeRange.startMinutes : 8 * 60;
      const freeSlotsUntil17h = computeFreeTimeRangesUntil17h(
        windowStartMin,
        merged.bookingsToday,
        17 * 60
      );
      const freeUntil17hText =
        windowStartMin >= 17 * 60
          ? 'Sau 17h (Ngoài giờ HC)'
          : freeSlotsUntil17h.length > 0
          ? `Rảnh đến 17h: ${freeSlotsUntil17h.join(', ')}`
          : 'Kín lịch đến 17h';

      if (isBusy) {
        return {
          ...merged,
          status: 'busy',
          canSelect: false,
          busyTimeRangeText: busyRanges,
          freeUntil17hText,
          statusText: `Bận (${busyRanges}) • ${freeUntil17hText}`,
        };
      }

      const shiftSuffix =
        merged.shiftsToday.length > 0 ? ` (Ca ${merged.shiftsToday.join(', ')})` : '';

      return {
        ...merged,
        status: 'available',
        canSelect: true,
        busyTimeRangeText: null,
        freeUntil17hText,
        statusText: `Đang rảnh${shiftSuffix} • ${freeUntil17hText}`,
      };
    });
  }, [departmentId, staffAvailabilityList, parsedTimeRange]);

  const departmentStaffMap = useMemo(() => {
    const map = new Map<string, EvaluatedDepartmentStaff>();
    for (const s of departmentStaffList) {
      map.set(s.staffId, s);
    }
    return map;
  }, [departmentStaffList]);

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
    <div className="space-y-6">
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
          <p className="muted">
            {isAccountant
              ? 'Kế toán điều chỉnh nhân viên thực hiện hoặc thời gian dự kiến của ca thủ thuật. Các thông tin tài chính và dịch vụ được giữ nguyên.'
              : isEditMode
              ? 'Cập nhật các trường được phép của phiếu thủ thuật và gửi lại vào quy trình kiểm duyệt.'
              : 'Điền thông tin ca thủ thuật, chọn khoa/phòng thực hiện cùng nhân sự tham gia kíp và tự động áp dụng định mức hoa hồng.'}
          </p>
        </div>
      </div>

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

      <form onSubmit={handleSubmit} className="space-y-6">
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
                    : 'border-rose-400 bg-rose-50/40 text-rose-900'
                }`}
              />
              <div className="mt-1 text-[11px]">
                {parsedTimeRange ? (
                  <span className="text-emerald-700 font-medium">
                    Dự kiến: {parsedTimeRange.displayLabel} ({parsedTimeRange.durationHours} giờ)
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
                      {d.name} ({d.deptCode}){d.facilityLabel ? ` • ${d.facilityLabel}` : ''}
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
                  <>
                    {departmentStaffList.length === 0 ? (
                      <div className="text-xs text-slate-500 bg-white rounded-lg border border-slate-200 px-3 py-2">
                        {availabilityLoading
                          ? 'Đang kiểm tra lịch làm việc tuần của khoa/phòng tại cơ sở đã chọn...'
                          : `Chưa có nhân sự nào thuộc khoa/phòng này được phân tại ${
                              selectedFacilityName || 'cơ sở đã chọn'
                            } trong lịch làm việc tuần (đã chốt).`}
                      </div>
                    ) : (
                      <div className="max-h-[208px] overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {departmentStaffList.map((st) => {
                          const badgeStyle =
                            st.status === 'available'
                              ? 'border-emerald-200 bg-emerald-50/70 text-emerald-900'
                              : st.status === 'busy'
                              ? 'border-amber-300 bg-amber-50/80 text-amber-900'
                              : 'border-slate-200 bg-slate-100/80 text-slate-500';

                          const pillStyle =
                            st.status === 'available'
                              ? 'bg-emerald-600 text-white'
                              : st.status === 'busy'
                              ? 'bg-amber-600 text-white'
                              : 'bg-slate-400 text-white';

                          const pillLabel =
                            st.status === 'available'
                              ? 'Rảnh'
                              : st.status === 'busy'
                              ? `Bận (${st.busyTimeRangeText})`
                              : 'Nghỉ hôm nay';

                          return (
                            <div
                              key={st.staffId}
                              className={`h-[64px] rounded-lg border px-3 py-1.5 text-xs flex items-center justify-between gap-2 ${badgeStyle}`}
                            >
                              <div className="min-w-0">
                                <div className="font-semibold truncate">
                                  {st.staffCode} - {st.fullName}
                                </div>
                                <div className="text-[11px] opacity-80 truncate">
                                  {st.positionName || 'Nhân viên y tế'}
                                  {st.isWorkingToday && st.shiftsToday.length > 0
                                    ? ` • Ca ${st.shiftsToday.join(', ')}`
                                    : ''}
                                </div>
                                {st.isWorkingToday && st.freeUntil17hText && (
                                  <div
                                    className="text-[11px] font-medium text-sky-800 truncate"
                                    title={st.freeUntil17hText}
                                  >
                                    {st.freeUntil17hText}
                                  </div>
                                )}
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0 ${pillStyle}`}
                              >
                                {pillLabel}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
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
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 flex items-center justify-between min-h-[34px]">
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

                  <div className="md:col-span-1 flex justify-end pt-5">
                    <button
                      type="button"
                      disabled={assignments.length <= 1}
                      onClick={() => handleRemoveAssignment(row.rowKey)}
                      className="button text-xs py-1.5 px-2.5 text-rose-600 hover:bg-rose-50 disabled:opacity-40"
                      title="Xóa dòng"
                    >
                      ✕
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
        <div className="flex items-center justify-end gap-3">
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
              ? '💾 Lưu điều chỉnh ca & Gửi thông báo cho Bác sĩ'
              : isEditMode
              ? existingSlip?.status === 'rejected'
                ? 'Lưu cập nhật & Gửi duyệt lại (Pending)'
                : 'Lưu cập nhật phiếu thủ thuật'
              : 'Lưu phiếu thủ thuật (Trạng thái Pending)'}
          </button>
        </div>
      </form>
    </div>
  );
}
