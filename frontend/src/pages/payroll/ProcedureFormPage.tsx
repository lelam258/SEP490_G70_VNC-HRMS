import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '../../components/ui/Alert';
import MoneyInput from '../../components/ui/MoneyInput';
import { procedureSlipApi } from '../../services/procedureSlipApi';
import { useAuthStore } from '../../store/useAuthStore';
import type {
  PreviewAssignmentCommissionItem,
  ProcedureCommissionRole,
  ProcedureLookups,
  ProcedureSlipDetail,
} from '../../types/procedureSlip';
import { formatVnd, todayVn } from '../../utils/format';
import {
  formatRuleFormula,
  PROCEDURE_ROLES,
  RULE_SOURCE_LABELS,
} from '../../utils/procedureHelpers';

interface DraftAssignmentRow {
  rowKey: string;
  staffId: string;
  role: ProcedureCommissionRole;
  useCustomAmount: boolean;
  customCommissionAmount: number;
}

export default function ProcedureFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.session?.user);

  const [lookups, setLookups] = useState<ProcedureLookups | null>(null);
  const [existingSlip, setExistingSlip] = useState<ProcedureSlipDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Form fields
  const [slipNumber, setSlipNumber] = useState<string>('');
  const [procedureDate, setProcedureDate] = useState<string>(() => todayVn());
  const [patientCode, setPatientCode] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [serviceId, setServiceId] = useState<string>('');
  const [chargedAmount, setChargedAmount] = useState<number>(0);
  const [directCost, setDirectCost] = useState<number>(0);
  const [isAfterHours, setIsAfterHours] = useState<boolean>(false);
  const [durationHours, setDurationHours] = useState<string>('1');
  const [indicatingStaffId, setIndicatingStaffId] = useState<string>('');

  const [assignments, setAssignments] = useState<DraftAssignmentRow[]>([
    {
      rowKey: 'row-1',
      staffId: '',
      role: 'performing',
      useCustomAmount: false,
      customCommissionAmount: 0,
    },
  ]);

  const [previews, setPreviews] = useState<PreviewAssignmentCommissionItem[]>([]);
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);

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

      // Xác định nhân sự tương ứng với tài khoản đang tạo phiếu
      const matchedCreatorStaff =
        lookupData.staff.find((st) => st.staffId === lookupData.currentUserStaffId) ||
        lookupData.staff.find(
          (st) =>
            currentUser?.name &&
            st.fullName.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
        ) ||
        null;

      if (id) {
        const detail = await procedureSlipApi.getSlipDetail(id);
        setExistingSlip(detail);
        setSlipNumber(detail.slipNumber);
        setProcedureDate(detail.procedureDate);
        setPatientCode(detail.patientCode || '');
        setDepartmentId(detail.departmentId || '');
        setServiceId(detail.serviceId);
        setChargedAmount(detail.chargedAmount);
        setDirectCost(detail.directCost);
        setIsAfterHours(detail.isAfterHours);
        setDurationHours(detail.durationHours != null ? String(detail.durationHours) : '');
        setIndicatingStaffId(
          detail.indicatingStaffId || matchedCreatorStaff?.staffId || ''
        );

        if (detail.assignments.length > 0) {
          setAssignments(
            detail.assignments.map((a, idx) => ({
              rowKey: a.assignmentId || `edit-${idx}`,
              staffId: a.staffId,
              role: a.role,
              useCustomAmount: a.ruleSource === 'manual',
              customCommissionAmount: a.commissionAmount,
            }))
          );
        }
      } else {
        if (sampleServices.length > 0) {
          const firstService = sampleServices[0];
          setServiceId(firstService.id);
          setChargedAmount(firstService.basePrice ?? 0);
        }

        const creatorStaffId =
          lookupData.currentUserStaffId || matchedCreatorStaff?.staffId || '';
        setIndicatingStaffId(creatorStaffId);

        const defaultDeptId =
          lookupData.currentUserDepartmentId ||
          matchedCreatorStaff?.departmentId ||
          lookupData.departments[0]?.departmentId ||
          '';
        if (defaultDeptId) {
          setDepartmentId(defaultDeptId);
        }

        if (creatorStaffId) {
          setAssignments([
            {
              rowKey: 'row-1',
              staffId: creatorStaffId,
              role: 'performing',
              useCustomAmount: false,
              customCommissionAmount: 0,
            },
          ]);
        }
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

  // Run live commission preview when service, date, amounts, or assignments change
  useEffect(() => {
    const validAssignments = assignments.filter((a) => a.staffId);
    if (!serviceId || !procedureDate || validAssignments.length === 0) {
      setPreviews([]);
      return;
    }

    const timer = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const parsedDuration = durationHours.trim() ? Number(durationHours) : null;
        const result = await procedureSlipApi.previewCommission({
          serviceId,
          procedureDate,
          chargedAmount: chargedAmount || 0,
          directCost: directCost || 0,
          isAfterHours,
          durationHours: parsedDuration && parsedDuration > 0 ? parsedDuration : null,
          assignments: validAssignments.map((a) => ({
            staffId: a.staffId,
            role: a.role,
            customCommissionAmount: a.useCustomAmount ? a.customCommissionAmount : null,
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
  }, [serviceId, procedureDate, chargedAmount, directCost, isAfterHours, durationHours, assignments]);

  const handleServiceChange = (newServiceId: string) => {
    setServiceId(newServiceId);
    const matched = lookups?.services.find((s) => s.id === newServiceId);
    if (matched && matched.basePrice != null && (!isEditMode || chargedAmount === 0)) {
      setChargedAmount(matched.basePrice);
    }
  };

  const handleAddAssignment = () => {
    setAssignments((prev) => [
      ...prev,
      {
        rowKey: `row-${Date.now()}-${prev.length}`,
        staffId: '',
        role: 'assisting',
        useCustomAmount: false,
        customCommissionAmount: 0,
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

    const validAssignments = assignments.filter((a) => a.staffId);
    if (validAssignments.length === 0) {
      setError('Vui lòng chọn ít nhất 1 nhân sự tham gia trong kíp thực hiện.');
      return;
    }

    const parsedDuration = durationHours.trim() ? Number(durationHours) : null;
    if (parsedDuration !== null && (Number.isNaN(parsedDuration) || parsedDuration <= 0 || parsedDuration > 48)) {
      setError('Thời lượng thực hiện phải nằm trong khoảng 0.1 đến 48 giờ.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        serviceId,
        departmentId: departmentId || null,
        slipNumber: isEditMode ? slipNumber : slipNumber.trim() || null,
        procedureDate,
        patientCode: patientCode.trim() || null,
        chargedAmount,
        directCost: directCost || 0,
        isAfterHours,
        durationHours: parsedDuration,
        indicatingStaffId: indicatingStaffId || null,
        assignments: validAssignments.map((a) => ({
          staffId: a.staffId,
          role: a.role,
          customCommissionAmount: a.useCustomAmount ? a.customCommissionAmount : null,
        })),
      };

      const saved = isEditMode && id
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
                navigate(isEditMode && id ? `/procedures/${id}` : '/procedures')
              }
              className="text-xs font-medium text-sky-700 hover:underline cursor-pointer"
            >
              ← {isEditMode ? 'Quay lại chi tiết phiếu' : 'Danh sách phiếu thủ thuật'}
            </button>
          </div>
          <h1>
            {isEditMode
              ? `Chỉnh sửa phiếu thủ thuật: ${existingSlip?.slipNumber || ''}`
              : 'Lập phiếu thủ thuật y tế mới'}
          </h1>
          <p className="muted">
            {isEditMode
              ? 'Cập nhật các trường được phép của phiếu thủ thuật và gửi lại vào quy trình HR kiểm tra.'
              : 'Điền thông tin ca thủ thuật, nhân sự tham gia kíp và tự động áp dụng định mức hoa hồng.'}
          </p>
        </div>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {isEditMode && existingSlip?.status === 'rejected' && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-sm text-rose-900">
          <div className="font-bold text-rose-800">
            Lý do bị từ chối cần khắc phục trước khi gửi duyệt lại:
          </div>
          <div className="mt-1">{existingSlip.rejectedReason}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Khối 1: Thông tin chung & Dịch vụ kỹ thuật */}
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
                value={patientCode}
                onChange={(e) => setPatientCode(e.target.value)}
                placeholder="VD: BN20261101"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Khoa / Phòng thực hiện *
              </label>
              <select
                required
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                <option value="">-- Chọn Khoa / Phòng ban --</option>
                {lookups?.departments.map((d) => (
                  <option key={d.departmentId} value={d.departmentId}>
                    {d.name} ({d.deptCode})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Dịch vụ kỹ thuật / Thủ thuật y tế *
              </label>
              <select
                required
                value={serviceId}
                onChange={(e) => handleServiceChange(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
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
              <MoneyInput value={chargedAmount} onChange={(val) => setChargedAmount(val ?? 0)} />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Chi phí vật tư trực tiếp (VNĐ)
              </label>
              <MoneyInput value={directCost} onChange={(val) => setDirectCost(val ?? 0)} />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Thời lượng thực hiện (Giờ)
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="48"
                value={durationHours}
                onChange={(e) => setDurationHours(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
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

        {/* Khối 2: Kíp thực hiện & Phân bổ hoa hồng */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                2. Nhân sự tham gia kíp thủ thuật & Tính hoa hồng
              </h2>
              <p className="text-xs text-slate-500">
                Hệ thống tự động đối chiếu quy tắc hoa hồng theo từng vai trò. Bạn cũng có thể điều chỉnh mức hoa hồng cụ thể nếu cần.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddAssignment}
              className="button text-xs py-1.5 px-3 text-sky-700 border-sky-300 bg-sky-50 hover:bg-sky-100"
            >
              + Thêm nhân sự vào kíp
            </button>
          </div>

          <div className="space-y-3">
            {assignments.map((row, index) => {
              const previewItem = previews.find(
                (p) => p.staffId === row.staffId && p.role === row.role
              );
              return (
                <div
                  key={row.rowKey}
                  className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center p-3 rounded-lg border border-slate-200 bg-slate-50/60"
                >
                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      Nhân sự #{index + 1} *
                    </label>
                    <select
                      required
                      value={row.staffId}
                      onChange={(e) =>
                        handleUpdateAssignment(row.rowKey, { staffId: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm bg-white"
                    >
                      <option value="">-- Chọn nhân viên y tế --</option>
                      {lookups?.staff.map((st) => (
                        <option key={st.staffId} value={st.staffId}>
                          {st.staffCode} - {st.fullName}{' '}
                          {st.positionName ? `(${st.positionName})` : ''}
                        </option>
                      ))}
                    </select>
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

                  <div className="md:col-span-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-medium text-slate-600">
                        Hoa hồng được hưởng
                      </span>
                      <label className="inline-flex items-center gap-1 text-[11px] text-sky-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={row.useCustomAmount}
                          onChange={(e) =>
                            handleUpdateAssignment(row.rowKey, {
                              useCustomAmount: e.target.checked,
                              customCommissionAmount: previewItem?.commissionAmount ?? 0,
                            })
                          }
                        />
                        <span>Nhập số tiền cố định</span>
                      </label>
                    </div>

                    {row.useCustomAmount ? (
                      <MoneyInput
                        value={row.customCommissionAmount}
                        onChange={(val) =>
                          handleUpdateAssignment(row.rowKey, { customCommissionAmount: val ?? 0 })
                        }
                      />
                    ) : (
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 flex items-center justify-between">
                        <span className="text-xs text-slate-500">
                          {previewItem
                            ? `${RULE_SOURCE_LABELS[previewItem.ruleSource] || previewItem.ruleSource} (${formatRuleFormula(
                                previewItem.valueType,
                                previewItem.ruleValue
                              )})`
                            : 'Chọn nhân sự để tính tự động'}
                        </span>
                        <strong className="text-sm text-emerald-700 font-[tabular-nums]">
                          {formatVnd(previewItem?.commissionAmount ?? 0)}
                        </strong>
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-1 flex justify-end pt-4">
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
              {previewLoading ? 'Đang tính lại hoa hồng...' : `Tổng số thành viên: ${assignments.filter((a) => a.staffId).length} người`}
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
              navigate(isEditMode && id ? `/procedures/${id}` : '/procedures')
            }
          >
            Hủy bỏ
          </button>
          <button type="submit" disabled={submitting} className="button primary">
            {submitting
              ? 'Đang lưu...'
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
