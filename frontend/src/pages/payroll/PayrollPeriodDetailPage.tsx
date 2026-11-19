import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '../../components/ui/Alert';
import DataTable, { type Column } from '../../components/ui/DataTable';
import Icon from '../../components/ui/Icon';
import Modal from '../../components/ui/Modal';
import { payrollPeriodApi } from '../../services/payrollPeriodApi';
import type {
  PayrollPeriodDetail,
  PayslipDetail,
  PayslipReviewStatus,
  PayslipSummaryItem,
} from '../../types/payrollPeriod';
import {
  formatDateOnly,
  formatNumberWithDots,
  formatVnd,
  parseNumberFromDots,
  todayVn,
} from '../../utils/format';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Bản nháp',
  open: 'Bản nháp',
  pending_approval: 'Chờ duyệt',
  approved: 'Đã xác nhận',
  confirmed: 'Đã xác nhận',
  locked: 'Đã khóa sổ',
  finalized: 'Đã chốt sổ',
  exported: 'Đã xuất ngân hàng',
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ rà soát',
  reviewed: 'Đã rà soát',
  needs_hr: 'Cần sửa HĐ/PC',
  needs_attendance: 'Cần sửa Công',
  needs_procedure: 'Cần sửa Thủ thuật',
};

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case 'finalized':
    case 'locked':
      return 'bg-rose-50 text-rose-700 border border-rose-200/80';
    case 'approved':
    case 'confirmed':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200/80';
    case 'pending_approval':
      return 'bg-amber-50 text-amber-700 border border-amber-200/80';
    case 'exported':
      return 'bg-sky-50 text-sky-700 border border-sky-200/80';
    case 'draft':
    default:
      return 'bg-slate-100 text-slate-600 border border-slate-200';
  }
}

function getReviewBadgeClass(reviewStatus: string): string {
  switch (reviewStatus) {
    case 'reviewed':
      return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'needs_hr':
      return 'bg-rose-50 text-rose-700 border border-rose-200';
    case 'needs_attendance':
      return 'bg-amber-50 text-amber-800 border border-amber-200';
    case 'needs_procedure':
      return 'bg-orange-50 text-orange-800 border border-orange-200';
    case 'pending':
    default:
      return 'bg-slate-100 text-slate-600 border border-slate-200';
  }
}

function formatMonthDisplay(payMonth: string): string {
  const parts = payMonth.split('-');
  return parts.length === 2 ? `Tháng ${parts[1]}/${parts[0]}` : payMonth;
}

const DEFAULT_PERSONAL_DEDUCTION = 15_500_000;
const DEFAULT_DEPENDENT_DEDUCTION = 6_200_000;
const DEFAULT_UNION_FEE = 100_000;
const DEFAULT_FLAT_THRESHOLD = 5_000_000;
const DEFAULT_ROUNDING_UNIT = 1_000;
const PROGRESSIVE_TAX_BRACKETS = [
  { from: 0, to: 10_000_000, rate: 0.05 },
  { from: 10_000_000, to: 30_000_000, rate: 0.1 },
  { from: 30_000_000, to: 60_000_000, rate: 0.2 },
  { from: 60_000_000, to: 100_000_000, rate: 0.3 },
  { from: 100_000_000, to: null as number | null, rate: 0.35 },
];

type InlineTaxMode = 'progressive' | 'flat_10_gross' | 'flat_10_after';

interface InlineBaseRef {
  unitDailyRate: number;
  fixedAllowanceAndOt: number;
  unitDutyRate: number;
  originalGross: number;
  originalInsurance: number;
  originalUnion: number;
  originalTax: number;
  originalNet: number;
  taxMode: InlineTaxMode;
  familyDeduction: number;
}

function calcProgressivePitTax(taxableRaw: number): number {
  if (taxableRaw <= 0) return 0;
  let tax = 0;
  for (const b of PROGRESSIVE_TAX_BRACKETS) {
    if (taxableRaw <= b.from) continue;
    const upper = b.to !== null ? Math.min(taxableRaw, b.to) : taxableRaw;
    const slice = Math.max(0, upper - b.from);
    tax += slice * b.rate;
  }
  return tax;
}

function invertProgressiveTaxable(taxAmount: number): number {
  if (taxAmount <= 0) return 0;
  let remainingTax = taxAmount;
  for (const b of PROGRESSIVE_TAX_BRACKETS) {
    if (b.to === null) {
      return b.from + remainingTax / b.rate;
    }
    const maxBracketTax = (b.to - b.from) * b.rate;
    if (remainingTax <= maxBracketTax + 1e-6) {
      return b.from + remainingTax / b.rate;
    }
    remainingTax -= maxBracketTax;
  }
  return 0;
}

function inferInlineTaxProfile(r: PayslipSummaryItem): {
  taxMode: InlineTaxMode;
  familyDeduction: number;
} {
  const gross = r.grossPay || 0;
  const ins = r.insuranceDeduction || 0;
  const union = r.otherDeduction || 0;
  const tax = r.taxDeduction || 0;
  const afterDed = gross - ins - union;

  if (tax > 0) {
    const inferredTaxable = invertProgressiveTaxable(tax);
    const rawFamilyDed = afterDed - inferredTaxable;
    if (rawFamilyDed < DEFAULT_PERSONAL_DEDUCTION - 1000) {
      if (Math.abs(tax - afterDed * 0.1) < Math.abs(tax - gross * 0.1) && Math.abs(tax - afterDed * 0.1) <= 10) {
        return { taxMode: 'flat_10_after', familyDeduction: DEFAULT_PERSONAL_DEDUCTION };
      }
      return { taxMode: 'flat_10_gross', familyDeduction: DEFAULT_PERSONAL_DEDUCTION };
    }

    const depRaw = Math.max(0, (rawFamilyDed - DEFAULT_PERSONAL_DEDUCTION) / DEFAULT_DEPENDENT_DEDUCTION);
    const depNearest = Math.round(depRaw);
    const snappedFamilyDed = DEFAULT_PERSONAL_DEDUCTION + depNearest * DEFAULT_DEPENDENT_DEDUCTION;
    if (Math.abs(rawFamilyDed - snappedFamilyDed) <= 200) {
      return { taxMode: 'progressive', familyDeduction: snappedFamilyDed };
    }
    return {
      taxMode: 'progressive',
      familyDeduction: Math.max(DEFAULT_PERSONAL_DEDUCTION, Math.round(rawFamilyDed)),
    };
  }

  if (afterDed > DEFAULT_PERSONAL_DEDUCTION) {
    const minDeps = Math.ceil((afterDed - DEFAULT_PERSONAL_DEDUCTION) / DEFAULT_DEPENDENT_DEDUCTION);
    return {
      taxMode: 'progressive',
      familyDeduction: DEFAULT_PERSONAL_DEDUCTION + minDeps * DEFAULT_DEPENDENT_DEDUCTION,
    };
  }

  return { taxMode: 'progressive', familyDeduction: DEFAULT_PERSONAL_DEDUCTION };
}

export default function PayrollPeriodDetailPage() {
  const { month } = useParams<{ month: string }>();
  const navigate = useNavigate();

  const [detail, setDetail] = useState<PayrollPeriodDetail | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [exceptionFilter, setExceptionFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Workflow loading states
  const [calculating, setCalculating] = useState(false);
  const [reviewingAll, setReviewingAll] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Modal Chi tiết & Rà soát phiếu lương (Tasks 72 & 73)
  const [selectedSummary, setSelectedSummary] = useState<PayslipSummaryItem | null>(null);
  const [payslipDetail, setPayslipDetail] = useState<PayslipDetail | null>(null);
  const [loadingPayslipDetail, setLoadingPayslipDetail] = useState(false);
  const [payslipDetailError, setPayslipDetailError] = useState('');
  const [reviewStatusInput, setReviewStatusInput] = useState<PayslipReviewStatus | string>('reviewed');
  const [reviewNoteInput, setReviewNoteInput] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');

  // Modal Chốt & Khóa sổ chính thức - MSG13 (Task 75)
  const [finalizeModalOpen, setFinalizeModalOpen] = useState(false);
  const [finalizeNote, setFinalizeNote] = useState('');
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState('');

  // Modal Mở lại kỳ lương
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopening, setReopening] = useState(false);
  const [reopenError, setReopenError] = useState('');

  // Modal Xóa kỳ lương nháp
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // Chỉnh sửa trực tiếp từng dòng trên bảng lương (Inline Edit)
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [savingInline, setSavingInline] = useState(false);
  const [inlineBaseRef, setInlineBaseRef] = useState<InlineBaseRef | null>(null);
  const [inlineDraft, setInlineDraft] = useState({
    workDays: '0',
    onCallDays: '0',
    basePay: '0',
    allowanceAndDutyTotal: '0',
    commissionTotal: '0',
  });

  const loadDetail = useCallback(async () => {
    if (!month) return;
    setLoading(true);
    setError('');
    try {
      const data = await payrollPeriodApi.getPeriodDetail(month);
      setDetail(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không tải được chi tiết kỳ tính lương.');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const openPayslipDetailModal = async (item: PayslipSummaryItem) => {
    if (!month) return;
    setSelectedSummary(item);
    setPayslipDetail(null);
    setPayslipDetailError('');
    setReviewError('');
    setReviewStatusInput(item.reviewStatus || 'reviewed');
    setReviewNoteInput(item.reviewNote || '');
    setLoadingPayslipDetail(true);

    try {
      const full = await payrollPeriodApi.getPayslipDetail(month, item.payslipId);
      setPayslipDetail(full);
      setReviewStatusInput(full.reviewStatus === 'pending' ? 'reviewed' : full.reviewStatus);
      setReviewNoteInput(full.reviewNote || '');
    } catch (err: unknown) {
      setPayslipDetailError(err instanceof Error ? err.message : 'Không tải được chi tiết phiếu lương.');
    } finally {
      setLoadingPayslipDetail(false);
    }
  };

  // Task 70: Tính lương tháng tự động (Cơ sở 1)
  const handleCalculatePayroll = async () => {
    if (!month) return;
    setEditingRowId(null);
    setCalculating(true);
    setError('');
    setNotice('');
    try {
      const updated = await payrollPeriodApi.calculatePeriod(month);
      setDetail(updated);
      setNotice(
        `Đã tính lương tự động (Cơ sở 1) cho ${updated.employeeCount} nhân sự kỳ ${formatMonthDisplay(
          month
        )}. Tổng thực lĩnh: ${formatVnd(updated.totalNetPay)}.`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tính lương cho kỳ này.');
    } finally {
      setCalculating(false);
    }
  };

  // Task 73: Rà soát nhanh tất cả phiếu hợp lệ
  const handleReviewAllValid = async () => {
    if (!month) return;
    setEditingRowId(null);
    setReviewingAll(true);
    setError('');
    setNotice('');
    try {
      const updated = await payrollPeriodApi.reviewAllValid(month);
      setDetail(updated);
      setNotice('Đã đánh dấu Đã rà soát cho tất cả phiếu lương hợp lệ.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể rà soát nhanh bảng lương.');
    } finally {
      setReviewingAll(false);
    }
  };

  // Task 73: Lưu trạng thái rà soát cho từng phiếu lương
  const handleSavePayslipReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!month || !selectedSummary) return;

    if (reviewStatusInput.startsWith('needs_') && !reviewNoteInput.trim()) {
      setReviewError('Vui lòng nhập ghi chú lý do khi gắn cờ cần kiểm tra / hiệu chỉnh.');
      return;
    }

    setSavingReview(true);
    setReviewError('');
    try {
      const updatedSlip = await payrollPeriodApi.reviewPayslip(month, selectedSummary.payslipId, {
        reviewStatus: reviewStatusInput,
        note: reviewNoteInput.trim() || undefined,
      });
      setPayslipDetail(updatedSlip);
      setNotice(
        `Đã cập nhật trạng thái rà soát cho ${updatedSlip.staffName || 'nhân viên'}: ${
          REVIEW_STATUS_LABELS[updatedSlip.reviewStatus] || updatedSlip.reviewStatus
        }.`
      );
      await loadDetail();
    } catch (err: unknown) {
      setReviewError(err instanceof Error ? err.message : 'Không thể lưu trạng thái rà soát.');
    } finally {
      setSavingReview(false);
    }
  };

  // Task 74: Xác nhận bảng lương
  const handleConfirmPeriod = async () => {
    if (!month) return;
    setEditingRowId(null);
    setInlineBaseRef(null);
    setConfirming(true);
    setError('');
    setNotice('');
    try {
      const updated = await payrollPeriodApi.confirmPeriod(month, {});
      setDetail(updated);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể xác nhận bảng lương.');
    } finally {
      setConfirming(false);
    }
  };

  // Task 75: Chốt & Khóa sổ chính thức (MSG13)
  const handleFinalizePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!month) return;
    setFinalizing(true);
    setFinalizeError('');
    setError('');
    setNotice('');
    try {
      const updated = await payrollPeriodApi.finalizePeriod(month, {
        confirmLock: true,
        note: finalizeNote.trim() || undefined,
      });
      setDetail(updated);
      setFinalizeModalOpen(false);
      setFinalizeNote('');
      setNotice(
        `Kỳ lương ${formatMonthDisplay(
          month
        )} đã được CHỐT & KHÓA SỔ CHÍNH THỨC. Phiếu lương đã sẵn sàng để nhân viên xem và xuất ngân hàng.`
      );
    } catch (err: unknown) {
      setFinalizeError(err instanceof Error ? err.message : 'Không thể chốt sổ kỳ lương.');
    } finally {
      setFinalizing(false);
    }
  };

  const handleReopenPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!month || !reopenReason.trim()) {
      setReopenError('Vui lòng nhập lý do mở lại kỳ tính lương (bắt buộc).');
      return;
    }

    setReopening(true);
    setReopenError('');
    try {
      const updated = await payrollPeriodApi.reopenPeriod(month, {
        reason: reopenReason.trim(),
      });
      setDetail(updated);
      setReopenModalOpen(false);
      setReopenReason('');
      setNotice(
        `Kỳ lương ${formatMonthDisplay(
          month
        )} đã được mở lại thành công về trạng thái Bản nháp (được gắn cờ Trễ hạn).`
      );
    } catch (err: unknown) {
      setReopenError(err instanceof Error ? err.message : 'Không thể mở lại kỳ tính lương.');
    } finally {
      setReopening(false);
    }
  };

  // Xóa kỳ lương nháp
  const handleDeletePeriod = async () => {
    if (!month) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await payrollPeriodApi.deletePeriod(month);
      setDeleteModalOpen(false);
      navigate('/payroll/periods');
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Không thể xóa kỳ tính lương nháp.');
    } finally {
      setDeleting(false);
    }
  };

  // Bắt đầu sửa trực tiếp 1 dòng bảng lương
  const handleStartInlineEdit = (r: PayslipSummaryItem) => {
    const dutyAndAllowance = (r.allowanceTotal || 0) + (r.onCallPay || 0) + (r.overtimePay || 0);
    const { taxMode, familyDeduction } = inferInlineTaxProfile(r);
    setError('');
    setNotice('');
    setEditingRowId(r.payslipId);
    setInlineBaseRef({
      unitDailyRate: (r.workDays || 0) > 0 ? (r.basePay || 0) / (r.workDays || 1) : 0,
      fixedAllowanceAndOt: (r.allowanceTotal || 0) + (r.overtimePay || 0),
      unitDutyRate: (r.onCallDays || 0) > 0 && (r.onCallPay || 0) > 0 ? (r.onCallPay || 0) / (r.onCallDays || 1) : 100_000,
      originalGross: r.grossPay || 0,
      originalInsurance: r.insuranceDeduction || 0,
      originalUnion: r.otherDeduction || 0,
      originalTax: r.taxDeduction || 0,
      originalNet: r.netPay || 0,
      taxMode,
      familyDeduction,
    });
    setInlineDraft({
      workDays: String(r.workDays || 0),
      onCallDays: String(r.onCallDays || 0),
      basePay: formatNumberWithDots(Math.round(r.basePay || 0)),
      allowanceAndDutyTotal: formatNumberWithDots(Math.round(dutyAndAllowance)),
      commissionTotal: formatNumberWithDots(Math.round(r.commissionTotal || 0)),
    });
  };

  const handleCancelInlineEdit = () => {
    if (savingInline) return;
    setEditingRowId(null);
    setInlineBaseRef(null);
  };

  const handleWorkDaysChange = (value: string) => {
    const trimmed = value.trim();
    const parsed = Number(trimmed);
    setInlineDraft((prev) => {
      const next = { ...prev, workDays: value };
      if (trimmed !== '' && !isNaN(parsed) && parsed >= 0 && inlineBaseRef && inlineBaseRef.unitDailyRate > 0) {
        const recalcBasePay = Math.round(inlineBaseRef.unitDailyRate * parsed);
        next.basePay = formatNumberWithDots(recalcBasePay);
      }
      return next;
    });
  };

  const handleOnCallDaysChange = (value: string) => {
    const trimmed = value.trim();
    const parsed = Number(trimmed);
    setInlineDraft((prev) => {
      const next = { ...prev, onCallDays: value };
      if (trimmed !== '' && !isNaN(parsed) && parsed >= 0 && inlineBaseRef) {
        const recalcAllowDuty = Math.round(
          inlineBaseRef.fixedAllowanceAndOt + inlineBaseRef.unitDutyRate * parsed
        );
        next.allowanceAndDutyTotal = formatNumberWithDots(recalcAllowDuty);
      }
      return next;
    });
  };

  const handleSaveInlineEdit = async (payslipId: string) => {
    if (!month || savingInline) return;

    const workDaysVal = Number(inlineDraft.workDays);
    const onCallDaysVal = Number(inlineDraft.onCallDays);
    if (isNaN(workDaysVal) || workDaysVal < 0 || workDaysVal > 31) {
      setError('Số ngày công phải nằm trong khoảng từ 0 đến 31.');
      return;
    }
    if (isNaN(onCallDaysVal) || onCallDaysVal < 0 || onCallDaysVal > 62) {
      setError('Số ca trực phải nằm trong khoảng từ 0 đến 62.');
      return;
    }

    setSavingInline(true);
    setError('');
    setNotice('');
    try {
      const updated = await payrollPeriodApi.updatePayslipInline(month, payslipId, {
        workDays: workDaysVal,
        onCallDays: onCallDaysVal,
        basePay: parseNumberFromDots(inlineDraft.basePay),
        allowanceAndDutyTotal: parseNumberFromDots(inlineDraft.allowanceAndDutyTotal),
        commissionTotal: parseNumberFromDots(inlineDraft.commissionTotal),
      });
      setDetail(updated);
      setEditingRowId(null);
      setInlineBaseRef(null);
      const savedItem = updated.payslips.find((p) => p.payslipId === payslipId);
      setNotice(
        `Đã lưu điều chỉnh phiếu lương cho ${savedItem?.staffName || 'nhân viên'}. Hệ thống đã tự động tính lại Thuế TNCN và Thực lĩnh.`
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể lưu điều chỉnh phiếu lương.');
    } finally {
      setSavingInline(false);
    }
  };

  const handleInlineKeyDown = (e: React.KeyboardEvent, payslipId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleSaveInlineEdit(payslipId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelInlineEdit();
    }
  };

  const liveInlineMetrics = useMemo(() => {
    const gross =
      parseNumberFromDots(inlineDraft.basePay) +
      parseNumberFromDots(inlineDraft.allowanceAndDutyTotal) +
      parseNumberFromDots(inlineDraft.commissionTotal);

    if (!inlineBaseRef) {
      return { gross, insAndUnion: 0, tax: 0, totalDeduction: 0, net: gross };
    }

    // Khi chưa đổi tổng thu nhập, giữ nguyên chính xác số liệu gốc của phiếu lương
    if (Math.abs(gross - inlineBaseRef.originalGross) < 1) {
      const insAndUnion = inlineBaseRef.originalInsurance + inlineBaseRef.originalUnion;
      const tax = inlineBaseRef.originalTax;
      return {
        gross,
        insAndUnion,
        tax,
        totalDeduction: insAndUnion + tax,
        net: inlineBaseRef.originalNet,
      };
    }

    const insurance = gross > 0 ? inlineBaseRef.originalInsurance : 0;
    const unionThreshold = inlineBaseRef.originalUnion > 0 ? inlineBaseRef.originalUnion : DEFAULT_UNION_FEE;
    const unionFee = inlineBaseRef.originalUnion > 0 && gross > unionThreshold ? inlineBaseRef.originalUnion : 0;
    const insAndUnion = insurance + unionFee;
    const afterDed = gross - insAndUnion;

    let taxRaw = 0;
    if (inlineBaseRef.taxMode === 'flat_10_gross') {
      taxRaw = gross >= DEFAULT_FLAT_THRESHOLD ? gross * 0.1 : 0;
    } else if (inlineBaseRef.taxMode === 'flat_10_after') {
      taxRaw = afterDed >= DEFAULT_FLAT_THRESHOLD ? afterDed * 0.1 : 0;
    } else {
      taxRaw = calcProgressivePitTax(afterDed - inlineBaseRef.familyDeduction);
    }

    const tax = Math.round(taxRaw);
    const takeHomeRaw = afterDed - taxRaw;
    const net = Math.round(takeHomeRaw / DEFAULT_ROUNDING_UNIT) * DEFAULT_ROUNDING_UNIT;

    return {
      gross,
      insAndUnion,
      tax,
      totalDeduction: insAndUnion + tax,
      net,
    };
  }, [inlineDraft, inlineBaseRef]);

  const departments = useMemo(() => {
    if (!detail?.payslips) return [];
    const set = new Set<string>();
    detail.payslips.forEach((p) => {
      if (p.departmentName) set.add(p.departmentName);
    });
    return Array.from(set).sort();
  }, [detail?.payslips]);

  const reviewStats = useMemo(() => {
    const slips = detail?.payslips ?? [];
    const total = slips.length;
    const reviewed = slips.filter((p) => p.reviewStatus === 'reviewed').length;
    const pending = slips.filter((p) => !p.reviewStatus || p.reviewStatus === 'pending').length;
    const flagged = slips.filter((p) => p.reviewStatus?.startsWith('needs_')).length;
    return { total, reviewed, pending, flagged };
  }, [detail?.payslips]);

  const filteredPayslips = useMemo(() => {
    if (!detail?.payslips) return [];
    return detail.payslips.filter((p) => {
      if (departmentFilter !== 'all' && p.departmentName !== departmentFilter) {
        return false;
      }

      if (exceptionFilter === 'pending_review' && p.reviewStatus !== 'pending') return false;
      if (exceptionFilter === 'reviewed' && p.reviewStatus !== 'reviewed') return false;
      if (exceptionFilter === 'needs_fix' && !p.reviewStatus?.startsWith('needs_')) return false;
      if (exceptionFilter === 'no_contract' && p.hasContract) return false;
      if (exceptionFilter === 'unconfirmed_attendance' && p.attendanceConfirmed) return false;
      if (exceptionFilter === 'unconfirmed_procedure' && p.procedureConfirmed) return false;
      if (exceptionFilter === 'has_exception' && p.hasContract && p.attendanceConfirmed && p.procedureConfirmed) {
        return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        return (
          p.staffName?.toLowerCase().includes(q) ||
          p.staffCode?.toLowerCase().includes(q) ||
          p.departmentName?.toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [detail?.payslips, departmentFilter, exceptionFilter, searchTerm]);

  const metrics = useMemo(() => {
    if (!detail?.payslips) {
      return { totalGross: 0, totalDeductions: 0, totalNet: detail?.totalNetPay || 0 };
    }
    const totalGross = detail.payslips.reduce((acc, p) => acc + (p.grossPay || 0), 0);
    const totalDeductions = detail.payslips.reduce(
      (acc, p) => acc + (p.insuranceDeduction || 0) + (p.otherDeduction || 0) + (p.taxDeduction || 0),
      0
    );
    return {
      totalGross,
      totalDeductions,
      totalNet: detail.totalNetPay,
    };
  }, [detail]);

  const handleExportCsv = () => {
    if (!filteredPayslips.length || !detail) return;
    const header = [
      'Mã nhân viên',
      'Họ và tên',
      'Khoa phòng',
      'Loại HĐ',
      'Ngày công',
      'Ca trực',
      'Lương ngày công (VND)',
      'Tiền trực & OT (VND)',
      'Phụ cấp (VND)',
      'Hoa hồng TT (VND)',
      'Tổng Gross (VND)',
      'BHXH 10.5% (VND)',
      'Đoàn phí (VND)',
      'Thuế TNCN (VND)',
      'Thực lĩnh Net (VND)',
      'Rà soát',
      'Ghi chú rà soát',
    ];

    const rows = filteredPayslips.map((p) => [
      `"${p.staffCode || ''}"`,
      `"${p.staffName || ''}"`,
      `"${p.departmentName || ''}"`,
      `"${p.contractType || ''}"`,
      p.workDays || 0,
      p.onCallDays || 0,
      p.basePay || 0,
      (p.onCallPay || 0) + (p.overtimePay || 0),
      p.allowanceTotal || 0,
      p.commissionTotal || 0,
      p.grossPay || 0,
      p.insuranceDeduction || 0,
      p.otherDeduction || 0,
      p.taxDeduction || 0,
      p.netPay || 0,
      `"${REVIEW_STATUS_LABELS[p.reviewStatus] || p.reviewStatus || ''}"`,
      `"${(p.reviewNote || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [header.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `BangLuong_CS1_${detail.payMonth}_${todayVn()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const normStatus = (detail?.status || 'draft').toLowerCase();
  const isFinalizedOrLocked = normStatus === 'locked' || normStatus === 'finalized' || normStatus === 'exported';
  const isConfirmed = normStatus === 'approved' || normStatus === 'confirmed';
  const isDraft = !isFinalizedOrLocked && !isConfirmed;
  const isStrictDraft = normStatus === 'draft' || normStatus === 'open';
  const hasPayslips = (detail?.payslips?.length || 0) > 0;

  const currentStep = isFinalizedOrLocked ? 4 : isConfirmed ? 3 : hasPayslips ? 2 : 1;

  const columns: Column<PayslipSummaryItem>[] = [
    {
      key: 'staff',
      label: 'Nhân viên & Khoa phòng',
      sortable: true,
      sortValue: (r) => r.staffName || '',
      className: 'pl-4! pr-2.5! py-3!',
      render: (r: PayslipSummaryItem) => {
        const hasWarning = !r.hasContract || !r.attendanceConfirmed || !r.procedureConfirmed;
        return (
          <div className="space-y-0.5 leading-tight">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-slate-900 dark:text-white text-xs">{r.staffName || '—'}</span>
              {hasWarning && (
                <span
                  className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0"
                  title={
                    !r.hasContract
                      ? 'Chưa có hợp đồng lao động'
                      : !r.attendanceConfirmed
                      ? 'Chưa chốt công'
                      : 'Thủ thuật y tế chờ duyệt'
                  }
                />
              )}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <span className="font-mono">{r.staffCode || '—'}</span>
              {r.departmentName && <span>· {r.departmentName}</span>}
              {!r.hasContract && (
                <span className="text-[10px] text-rose-600 bg-rose-50 px-1 rounded border border-rose-200">
                  Thiếu HĐ
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'basePay',
      label: 'Công & Lương CB',
      sortable: true,
      sortValue: (r) => r.basePay || 0,
      className: 'px-2.5! py-3!',
      render: (r: PayslipSummaryItem) => {
        if (editingRowId === r.payslipId) {
          return (
            <div className="space-y-1">
              <input
                type="text"
                inputMode="numeric"
                aria-label="Lương cơ bản"
                value={inlineDraft.basePay}
                onChange={(e) =>
                  setInlineDraft((prev) => ({ ...prev, basePay: formatNumberWithDots(e.target.value) }))
                }
                onKeyDown={(e) => handleInlineKeyDown(e, r.payslipId)}
                disabled={savingInline}
                style={{ width: '108px', height: '28px', minHeight: '28px', padding: '2px 6px', fontSize: '12px' }}
                className="rounded border border-sky-400 bg-white text-slate-900 font-semibold tabular-nums focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                <input
                  type="number"
                  min={0}
                  max={31}
                  step="0.5"
                  aria-label="Số ngày công"
                  value={inlineDraft.workDays}
                  onChange={(e) => handleWorkDaysChange(e.target.value)}
                  onKeyDown={(e) => handleInlineKeyDown(e, r.payslipId)}
                  disabled={savingInline}
                  style={{ width: '48px', height: '22px', minHeight: '22px', padding: '1px 4px', fontSize: '11px' }}
                  className="rounded border border-slate-300 bg-white text-slate-800 tabular-nums focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <span>công ·</span>
                <input
                  type="number"
                  min={0}
                  max={62}
                  step="0.5"
                  aria-label="Số ca trực"
                  value={inlineDraft.onCallDays}
                  onChange={(e) => handleOnCallDaysChange(e.target.value)}
                  onKeyDown={(e) => handleInlineKeyDown(e, r.payslipId)}
                  disabled={savingInline}
                  style={{ width: '44px', height: '22px', minHeight: '22px', padding: '1px 4px', fontSize: '11px' }}
                  className="rounded border border-slate-300 bg-white text-slate-800 tabular-nums focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <span>trực</span>
              </div>
            </div>
          );
        }
        return (
          <div className="tabular-nums leading-tight">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {formatVnd(r.basePay || 0)}
            </div>
            <div className="text-[10px] text-slate-500">
              {r.workDays || 0} công · {r.onCallDays || 0} trực
            </div>
          </div>
        );
      },
    },
    {
      key: 'allowanceTotal',
      label: 'Trực & Phụ cấp',
      sortable: true,
      sortValue: (r) => (r.allowanceTotal || 0) + (r.onCallPay || 0) + (r.overtimePay || 0),
      className: 'px-2.5! py-3!',
      render: (r: PayslipSummaryItem) => {
        if (editingRowId === r.payslipId) {
          return (
            <input
              type="text"
              inputMode="numeric"
              aria-label="Tổng trực và phụ cấp"
              value={inlineDraft.allowanceAndDutyTotal}
              onChange={(e) =>
                setInlineDraft((prev) => ({
                  ...prev,
                  allowanceAndDutyTotal: formatNumberWithDots(e.target.value),
                }))
              }
              onKeyDown={(e) => handleInlineKeyDown(e, r.payslipId)}
              disabled={savingInline}
              style={{ width: '104px', height: '28px', minHeight: '28px', padding: '2px 6px', fontSize: '12px' }}
              className="rounded border border-sky-400 bg-white text-slate-900 font-medium tabular-nums focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          );
        }
        const dutyOt = (r.onCallPay || 0) + (r.overtimePay || 0);
        const total = (r.allowanceTotal || 0) + dutyOt;
        return (
          <div className="tabular-nums leading-tight">
            <div className="text-xs font-medium text-slate-800 dark:text-slate-200">{formatVnd(total)}</div>
            {dutyOt > 0 && (
              <div className="text-[10px] text-slate-500">
                Trực/OT: {formatVnd(dutyOt)}
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'commissionTotal',
      label: 'Hoa hồng TT',
      sortable: true,
      sortValue: (r) => r.commissionTotal || 0,
      className: 'px-2.5! py-3!',
      render: (r: PayslipSummaryItem) => {
        if (editingRowId === r.payslipId) {
          return (
            <input
              type="text"
              inputMode="numeric"
              aria-label="Hoa hồng thủ thuật"
              value={inlineDraft.commissionTotal}
              onChange={(e) =>
                setInlineDraft((prev) => ({
                  ...prev,
                  commissionTotal: formatNumberWithDots(e.target.value),
                }))
              }
              onKeyDown={(e) => handleInlineKeyDown(e, r.payslipId)}
              disabled={savingInline}
              style={{ width: '96px', height: '28px', minHeight: '28px', padding: '2px 6px', fontSize: '12px' }}
              className="rounded border border-sky-400 bg-white text-slate-900 font-medium tabular-nums focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          );
        }
        return (
          <span className="text-xs font-medium text-slate-800 dark:text-slate-200 tabular-nums">
            {formatVnd(r.commissionTotal || 0)}
          </span>
        );
      },
    },
    {
      key: 'grossPay',
      label: 'Tổng Gross',
      sortable: true,
      sortValue: (r) => r.grossPay || 0,
      className: 'px-2.5! py-3!',
      render: (r: PayslipSummaryItem) => {
        if (editingRowId === r.payslipId) {
          return (
            <div className="tabular-nums leading-tight">
              <div className="text-xs font-bold text-sky-700">{formatVnd(liveInlineMetrics.gross)}</div>
              <div className="text-[10px] text-sky-600">Tạm tính</div>
            </div>
          );
        }
        return (
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {formatVnd(r.grossPay || 0)}
          </span>
        );
      },
    },
    {
      key: 'deductions',
      label: 'BHXH, CĐ & Thuế',
      sortable: true,
      sortValue: (r) => (r.insuranceDeduction || 0) + (r.otherDeduction || 0) + (r.taxDeduction || 0),
      className: 'px-2.5! py-3!',
      render: (r: PayslipSummaryItem) => {
        if (editingRowId === r.payslipId) {
          return (
            <div className="tabular-nums leading-tight">
              <div className="text-xs font-medium text-rose-700 dark:text-rose-400">
                {formatVnd(liveInlineMetrics.totalDeduction)}
              </div>
              {liveInlineMetrics.insAndUnion > 0 && (
                <div className="text-[10px] text-slate-500">
                  BH/CĐ: {formatVnd(liveInlineMetrics.insAndUnion)}
                </div>
              )}
              {liveInlineMetrics.tax > 0 && (
                <div className="text-[10px] text-slate-500">Thuế: {formatVnd(liveInlineMetrics.tax)}</div>
              )}
            </div>
          );
        }
        const insAndUnion = (r.insuranceDeduction || 0) + (r.otherDeduction || 0);
        const totalDed = insAndUnion + (r.taxDeduction || 0);
        return (
          <div className="tabular-nums leading-tight">
            <div className="text-xs font-medium text-rose-700 dark:text-rose-400">{formatVnd(totalDed)}</div>
            {insAndUnion > 0 && (
              <div className="text-[10px] text-slate-500">BH/CĐ: {formatVnd(insAndUnion)}</div>
            )}
            {(r.taxDeduction || 0) > 0 && (
              <div className="text-[10px] text-slate-500">Thuế: {formatVnd(r.taxDeduction)}</div>
            )}
          </div>
        );
      },
    },
    {
      key: 'netPay',
      label: 'Thực lĩnh (Net)',
      sortable: true,
      sortValue: (r) => r.netPay || 0,
      className: 'px-2.5! py-3!',
      render: (r: PayslipSummaryItem) => {
        if (editingRowId === r.payslipId) {
          return (
            <div className="tabular-nums leading-tight">
              <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                {formatVnd(liveInlineMetrics.net)}
              </div>
              <div className="text-[10px] text-sky-600">Tạm tính</div>
            </div>
          );
        }
        return (
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {formatVnd(r.netPay || 0)}
          </span>
        );
      },
    },
    {
      key: 'reviewStatus',
      label: 'Rà soát',
      sortable: true,
      sortValue: (r) => r.reviewStatus || 'pending',
      className: 'px-2! py-3!',
      render: (r: PayslipSummaryItem) => (
        <div className="space-y-0.5 leading-tight">
          <span
            className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${getReviewBadgeClass(
              r.reviewStatus
            )}`}
            title={r.reviewNote || undefined}
          >
            {REVIEW_STATUS_LABELS[r.reviewStatus] || r.reviewStatus}
          </span>
          {r.reviewNote && (
            <div className="text-[10px] text-rose-600 max-w-[110px] truncate" title={r.reviewNote}>
              {r.reviewNote}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Thao tác',
      className: 'pl-2! pr-4! py-3!',
      render: (r: PayslipSummaryItem) => {
        if (editingRowId === r.payslipId) {
          return (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <button
                type="button"
                className="h-7 px-2.5 rounded bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-semibold cursor-pointer disabled:opacity-60 transition-colors"
                disabled={savingInline}
                onClick={() => void handleSaveInlineEdit(r.payslipId)}
              >
                {savingInline ? 'Lưu…' : 'Lưu'}
              </button>
              <button
                type="button"
                className="h-7 px-2 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-medium cursor-pointer disabled:opacity-60 transition-colors"
                disabled={savingInline}
                onClick={handleCancelInlineEdit}
              >
                Hủy
              </button>
            </div>
          );
        }

        return (
          <div className="flex items-center gap-2 whitespace-nowrap">
            {!isFinalizedOrLocked && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:text-teal-800 border border-teal-200 bg-teal-50/70 hover:bg-teal-100 px-2 py-0.5 rounded cursor-pointer transition-colors"
                title="Sửa trực tiếp số liệu dòng lương này"
                disabled={Boolean(editingRowId) && editingRowId !== r.payslipId}
                onClick={() => handleStartInlineEdit(r)}
              >
                <Icon name="edit" size={11} />
                <span>Sửa</span>
              </button>
            )}
            <button
              type="button"
              className="text-xs font-semibold text-sky-700 hover:text-sky-800 hover:underline cursor-pointer flex items-center gap-1 whitespace-nowrap"
              onClick={() => void openPayslipDetailModal(r)}
            >
              <span>Chi tiết</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        );
      },
    },
  ];

  const steps = [
    { step: 1, label: '1. Tính lương' },
    { step: 2, label: `2. Rà soát (${reviewStats.reviewed}/${reviewStats.total})` },
    { step: 3, label: '3. Xác nhận' },
    { step: 4, label: '4. Chốt sổ' },
  ];

  return (
    <div className="space-y-4">
      {notice && <Alert variant="success">{notice}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {/* Compact Header: Inline Breadcrumb + Title + Actions */}
      <div className="page-heading mb-0! flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <button
              type="button"
              className="text-xs font-medium text-slate-500 hover:text-teal-700 inline-flex items-center gap-1 cursor-pointer transition-colors"
              onClick={() => navigate('/payroll/periods')}
            >
              <span aria-hidden="true">←</span>
              <span>Danh sách kỳ lương</span>
            </button>
            <span className="text-slate-300 text-xs">/</span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-teal-700">
              QUẢN LÝ LƯƠNG &amp; ĐÃI NGỘ • CƠ SỞ 1
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="whitespace-nowrap">Chi tiết kỳ lương {month ? formatMonthDisplay(month) : ''}</h1>
            {detail && (
              <>
                <span
                  className={`inline-block shrink-0 text-xs px-2.5 py-0.5 rounded-full font-medium whitespace-nowrap ${getStatusBadgeClass(
                    normStatus
                  )}`}
                >
                  {STATUS_LABELS[normStatus] || detail.status}
                </span>

                {detail.isLate && (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap"
                    title="Kỳ lương được đánh dấu Trễ hạn."
                  >
                    Trễ hạn
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {detail && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isFinalizedOrLocked && (
              <button
                type="button"
                className={
                  hasPayslips
                    ? 'h-9 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60 whitespace-nowrap'
                    : 'h-9 px-3.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60 whitespace-nowrap'
                }
                onClick={() => void handleCalculatePayroll()}
                disabled={calculating || confirming}
                title="Tính toán lại toàn bộ bảng lương Cơ sở 1 từ dữ liệu công, ca trực và thủ thuật"
              >
                <Icon name="refresh" size={13} />
                <span>{calculating ? 'Đang tính…' : hasPayslips ? 'Tính lại lương' : 'Tính lương tháng'}</span>
              </button>
            )}

            {isDraft && hasPayslips && reviewStats.pending > 0 && (
              <button
                type="button"
                className="h-9 px-3 rounded-lg border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-800 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60 whitespace-nowrap"
                onClick={() => void handleReviewAllValid()}
                disabled={reviewingAll || calculating}
                title="Đánh dấu Đã rà soát cho toàn bộ phiếu lương hợp lệ"
              >
                <Icon name="check" size={13} />
                <span>{reviewingAll ? 'Đang rà soát…' : 'Rà soát nhanh'}</span>
              </button>
            )}

            {isDraft && hasPayslips && (
              <button
                type="button"
                className="h-9 px-3.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60 whitespace-nowrap"
                onClick={() => void handleConfirmPeriod()}
                disabled={confirming || calculating || reviewStats.flagged > 0}
                title={
                  reviewStats.flagged > 0
                    ? `Còn ${reviewStats.flagged} phiếu đang gắn cờ chờ hiệu chỉnh`
                    : 'Xác nhận bảng lương sẵn sàng chốt sổ'
                }
              >
                <Icon name="check" size={13} />
                <span>{confirming ? 'Đang xác nhận…' : 'Xác nhận bảng lương'}</span>
              </button>
            )}

            {isConfirmed && !isFinalizedOrLocked && (
              <button
                type="button"
                className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                onClick={() => {
                  setFinalizeError('');
                  setFinalizeNote('');
                  setFinalizeModalOpen(true);
                }}
              >
                <Icon name="lock" size={13} />
                <span>Chốt &amp; Khóa sổ</span>
              </button>
            )}

            {(isFinalizedOrLocked || isConfirmed) && (
              <button
                type="button"
                className="h-9 px-3 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs whitespace-nowrap"
                onClick={() => {
                  setReopenError('');
                  setReopenReason('');
                  setReopenModalOpen(true);
                }}
              >
                <Icon name="refresh" size={13} />
                <span>Mở lại kỳ lương</span>
              </button>
            )}

            {isStrictDraft && (
              <button
                type="button"
                className="h-9 px-2.5 rounded-lg border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60 whitespace-nowrap"
                title="Xóa kỳ lương nháp này"
                onClick={() => {
                  setDeleteError('');
                  setDeleteModalOpen(true);
                }}
                disabled={calculating || confirming || reviewingAll}
              >
                <Icon name="trash" size={13} />
                <span>Xóa</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Unified Overview Card: Progress Stepper + Readiness & Financial KPI Strip */}
      {detail && (
        <section className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
          {/* Upper Bar: Stepper + Readiness & Deadlines */}
          <div className="px-4 py-2.5 bg-slate-50/60 border-b border-slate-200/70 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              {/* Left: Compact 4-Step Progress */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {steps.map((s, idx) => {
                  const completed = isFinalizedOrLocked ? true : s.step < currentStep;
                  const active = !isFinalizedOrLocked && s.step === currentStep;
                  return (
                    <div key={s.step} className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                          completed
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : active
                            ? 'bg-sky-50 text-sky-800 border border-sky-300 font-semibold shadow-2xs'
                            : 'bg-white text-slate-500 border border-slate-200/80'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                            completed
                              ? 'bg-emerald-600 text-white'
                              : active
                              ? 'bg-sky-600 text-white'
                              : 'bg-slate-300 text-white'
                          }`}
                        >
                          {completed ? '✓' : s.step}
                        </span>
                        <span>{s.label}</span>
                      </span>
                      {idx < steps.length - 1 && (
                        <span className="text-slate-300 text-xs select-none" aria-hidden="true">
                          ›
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Right: Readiness Pills & Key Dates */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-medium ${
                    detail.attendanceLocked
                      ? 'bg-emerald-50/70 text-emerald-800 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                  title={
                    detail.attendanceLocked
                      ? 'Dữ liệu chấm công toàn cơ sở đã được HR chốt hợp lệ.'
                      : 'Cần HR Staff hoàn thành khóa bảng công trước khi chốt sổ.'
                  }
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      detail.attendanceLocked ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  <span>Công tháng: {detail.attendanceLocked ? 'Đã khóa' : 'Chưa chốt'}</span>
                </span>

                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-medium ${
                    detail.proceduresVerified
                      ? 'bg-emerald-50/70 text-emerald-800 border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                  title={
                    detail.proceduresVerified
                      ? 'Tất cả phiếu thủ thuật đã được xác minh.'
                      : 'Còn phiếu thủ thuật chưa được duyệt.'
                  }
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      detail.proceduresVerified ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                  />
                  <span>Thủ thuật: {detail.proceduresVerified ? 'Đã duyệt' : 'Chờ duyệt'}</span>
                </span>

                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 bg-white text-slate-600 tabular-nums">
                  <span>
                    Khóa: <strong className="text-slate-800">{formatDateOnly(detail.standardLockDate)}</strong>
                  </span>
                  <span className="text-slate-300">•</span>
                  <span>
                    Hạn sửa: <strong className="text-amber-700">{formatDateOnly(detail.correctionDeadline)}</strong>
                  </span>
                </span>
              </div>
            </div>

            {detail.reopenReason && (
              <div className="text-[11px] text-amber-800 bg-amber-50/80 border border-amber-200/80 rounded-lg px-2.5 py-1 flex items-center gap-1.5">
                <strong className="shrink-0">Lý do mở lại kỳ:</strong>
                <span>{detail.reopenReason}</span>
              </div>
            )}
          </div>

          {/* Lower Strip: 4 Compact Financial Metrics with Hairline Dividers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <div className="px-4 py-3 border-b sm:border-r lg:border-b-0 border-slate-200/70">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                Nhân sự Cơ sở 1
              </span>
              <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                <span className="text-lg font-bold text-slate-900 tabular-nums">
                  {detail.employeeCount || 0} nhân sự
                </span>
                <span
                  className={`text-xs ${
                    reviewStats.flagged > 0 ? 'text-rose-600 font-medium' : 'text-slate-500'
                  }`}
                >
                  {reviewStats.flagged > 0
                    ? `• ${reviewStats.flagged} cần hiệu chỉnh`
                    : `• Đã rà soát ${reviewStats.reviewed}/${reviewStats.total}`}
                </span>
              </div>
            </div>

            <div className="px-4 py-3 border-b lg:border-r lg:border-b-0 border-slate-200/70">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                Tổng thu nhập Gross
              </span>
              <div className="mt-1 text-lg font-bold text-slate-900 tabular-nums">
                {formatVnd(metrics.totalGross)}
              </div>
            </div>

            <div className="px-4 py-3 border-b sm:border-b-0 sm:border-r border-slate-200/70">
              <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
                Tổng giảm trừ (BH, CĐ, Thuế)
              </span>
              <div className="mt-1 text-lg font-bold text-rose-600 tabular-nums">
                {formatVnd(metrics.totalDeductions)}
              </div>
            </div>

            <div className="px-4 py-3 bg-emerald-50/25">
              <span className="text-[11px] font-medium text-emerald-700 uppercase tracking-wider block">
                Tổng thực lĩnh (Net Pay)
              </span>
              <div className="mt-1 text-lg font-bold text-emerald-700 tabular-nums">
                {formatVnd(metrics.totalNet)}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Status notification banners */}
      {isConfirmed && !isFinalizedOrLocked && (
        <div className="px-3.5 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <span className="font-semibold uppercase tracking-wider text-emerald-700">
              Đã xác nhận bảng lương:
            </span>
            <span>
              Toàn bộ số liệu đã qua rà soát. Hãy nhấn <strong>Chốt &amp; Khóa sổ</strong> để khóa dữ liệu và phát hành phiếu lương.
            </span>
          </div>
        </div>
      )}

      {isFinalizedOrLocked && (
        <div className="px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold uppercase tracking-wider">
              Chế độ chỉ đọc (Read-only):
            </span>
            <span>
              Kỳ lương này đã được chốt và khóa sổ chính thức. Dữ liệu bảng lương được bảo toàn bất biến.
            </span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            Khóa lúc: {detail?.lockedAt ? formatDateOnly(detail.lockedAt) : 'Đã khóa'}
          </span>
        </div>
      )}

      {reviewStats.flagged > 0 && isDraft && (
        <Alert variant="warning">
          Hiện có <strong>{reviewStats.flagged}</strong> phiếu lương đang được gắn cờ cần kiểm tra/hiệu chỉnh.
          Vui lòng xử lý và cập nhật lại trạng thái rà soát trước khi Xác nhận bảng lương.
        </Alert>
      )}

      {/* Main Staff Payslips Table */}
      <section className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 pl-3 pr-2 h-9 w-52 sm:w-64 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 shadow-xs transition-all">
              <span className="shrink-0 text-slate-400 flex items-center pointer-events-none">
                <Icon name="search" size={14} />
              </span>
              <input
                type="text"
                placeholder="Tìm tên, mã nhân viên..."
                className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
                style={{ padding: 0, minHeight: 'unset', border: 'none', background: 'transparent' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  className="shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded transition-colors cursor-pointer"
                  onClick={() => setSearchTerm('')}
                  title="Xóa tìm kiếm"
                >
                  <Icon name="close" size={12} />
                </button>
              )}
            </div>

            <select
              className="h-9 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer shadow-xs transition-colors"
              style={{ width: 'auto', minWidth: '150px', height: '36px', minHeight: 'unset', padding: '0 28px 0 10px' }}
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
            >
              <option value="all">Tất cả khoa phòng</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            <select
              className="h-9 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 cursor-pointer shadow-xs transition-colors"
              style={{ width: 'auto', minWidth: '170px', height: '36px', minHeight: 'unset', padding: '0 28px 0 10px' }}
              value={exceptionFilter}
              onChange={(e) => setExceptionFilter(e.target.value)}
            >
              <option value="all">Tất cả trạng thái rà soát</option>
              <option value="pending_review">Chờ rà soát</option>
              <option value="reviewed">Đã rà soát</option>
              <option value="needs_fix">Gắn cờ cần hiệu chỉnh</option>
              <option value="has_exception">Có cảnh báo dữ liệu</option>
              <option value="no_contract">Thiếu HĐLĐ</option>
              <option value="unconfirmed_attendance">Chưa chốt công</option>
              <option value="unconfirmed_procedure">Chưa duyệt thủ thuật</option>
            </select>

            {(searchTerm || departmentFilter !== 'all' || exceptionFilter !== 'all') && (
              <button
                type="button"
                className="h-9 px-2.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1"
                onClick={() => {
                  setSearchTerm('');
                  setDepartmentFilter('all');
                  setExceptionFilter('all');
                }}
                title="Đặt lại bộ lọc về mặc định"
              >
                <Icon name="refresh" size={12} />
                <span>Đặt lại lọc</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-9 px-3.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 shadow-xs transition-colors text-xs font-medium whitespace-nowrap flex items-center gap-1.5 cursor-pointer"
              onClick={handleExportCsv}
              disabled={!filteredPayslips.length}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              <span>Xuất CSV</span>
            </button>

            <button
              type="button"
              className="h-9 w-9 shrink-0 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200 shadow-xs flex items-center justify-center transition-colors cursor-pointer"
              title="Làm mới dữ liệu"
              aria-label="Làm mới"
              onClick={() => void loadDetail()}
              disabled={loading}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className={`text-slate-500 dark:text-slate-400 ${loading ? 'animate-spin' : ''}`}
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
              </svg>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">
            <p className="loading-state">Đang tải chi tiết bảng lương…</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={filteredPayslips}
            rowKey={(r) => r.payslipId}
            emptyMessage={
              searchTerm || departmentFilter !== 'all' || exceptionFilter !== 'all'
                ? 'Không có nhân sự nào phù hợp với bộ lọc.'
                : 'Kỳ lương chưa có dữ liệu. Nhấn "Tính lương tháng (CS1)" để hệ thống tổng hợp tự động.'
            }
          />
        )}
      </section>

      {/* Modal Drill-down & Review: Phiếu lương chi tiết & Đối soát */}
      {selectedSummary && detail && (
        <Modal
          title="Phiếu lương chi tiết &amp; Đối soát kế toán"
          subtitle={
            <span>
              Nhân viên: <strong className="text-slate-800">{selectedSummary.staffName}</strong> (
              {selectedSummary.staffCode}) · {selectedSummary.departmentName || 'Chưa phân khoa'} · Kỳ{' '}
              {formatMonthDisplay(detail.payMonth)}
            </span>
          }
          maxWidth="820px"
          onClose={() => {
            if (!savingReview) {
              setSelectedSummary(null);
              setPayslipDetail(null);
            }
          }}
        >
          <div className="p-5 space-y-4">
            {payslipDetailError && <Alert variant="error">{payslipDetailError}</Alert>}

            {loadingPayslipDetail ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Đang tải chi tiết công thức lương và bậc thuế TNCN…
              </div>
            ) : payslipDetail ? (
              <>
                {/* Cảnh báo ngoại lệ nếu có */}
                {(!payslipDetail.hasContract ||
                  !payslipDetail.attendanceConfirmed ||
                  !payslipDetail.procedureConfirmed) && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                    <div className="font-semibold text-amber-800">Cảnh báo dữ liệu đầu vào:</div>
                    <ul className="list-disc list-inside text-amber-800/90 space-y-0.5">
                      {!payslipDetail.hasContract && <li>Nhân sự chưa có hợp đồng lao động hiệu lực.</li>}
                      {!payslipDetail.attendanceConfirmed && <li>Bảng chấm công tháng chưa được chốt xác nhận đủ.</li>}
                      {!payslipDetail.procedureConfirmed && <li>Phiếu thủ thuật y tế trong tháng chưa được duyệt hết.</li>}
                    </ul>
                  </div>
                )}

                {/* Top 4-Card KPI Summary Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                    <span className="text-[11px] font-medium text-slate-500 block">Công &amp; Ca trực</span>
                    <strong className="text-sm font-bold text-slate-900 block mt-0.5 tabular-nums">
                      {payslipDetail.workDays} công
                    </strong>
                    <span className="text-[10px] text-slate-500">
                      {payslipDetail.onCallDays} ca trực · {payslipDetail.overtimeHours}h OT
                    </span>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                    <span className="text-[11px] font-medium text-slate-500 block">Tổng thu nhập (Gross)</span>
                    <strong className="text-sm font-bold text-slate-900 block mt-0.5 tabular-nums">
                      {formatVnd(payslipDetail.grossPay)}
                    </strong>
                    <span className="text-[10px] text-slate-500">Lương, trực, PC &amp; hoa hồng</span>
                  </div>

                  <div className="rounded-xl border border-rose-200/80 bg-rose-50/40 px-3 py-2.5">
                    <span className="text-[11px] font-medium text-rose-700 block">Tổng khấu trừ</span>
                    <strong className="text-sm font-bold text-rose-800 block mt-0.5 tabular-nums">
                      {formatVnd(
                        payslipDetail.insuranceDeduction +
                          payslipDetail.unionFeeDeduction +
                          payslipDetail.taxDeduction
                      )}
                    </strong>
                    <span className="text-[10px] text-rose-600/90">BHXH, Công đoàn &amp; Thuế</span>
                  </div>

                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2.5">
                    <span className="text-[11px] font-medium text-emerald-700 block">Thực lĩnh (Net Pay)</span>
                    <strong className="text-sm font-bold text-emerald-800 block mt-0.5 tabular-nums">
                      {formatVnd(payslipDetail.netPay)}
                    </strong>
                    <span className="text-[10px] text-emerald-700/80">Làm tròn hàng nghìn</span>
                  </div>
                </div>

                {/* Block 1: Hợp đồng & Căn cứ công */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                    <div className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-200 pb-1">
                      Hợp đồng &amp; Mức đóng BHXH
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Chức danh / HĐ:</span>
                      <strong className="text-slate-800 text-right">
                        {payslipDetail.positionName || '—'} · {payslipDetail.contractCode || 'Chưa có'}
                      </strong>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Hình thức trả lương:</span>
                      <strong className="text-slate-800 text-right">
                        {payslipDetail.salaryType === 'daily'
                          ? `Theo ngày (${formatVnd(payslipDetail.dailyRate)}/ngày)`
                          : `Theo tháng (${formatVnd(payslipDetail.monthlySalary)} / ${payslipDetail.standardWorkingDays} công)`}
                      </strong>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Mức đóng BHXH / Công đoàn:</span>
                      <strong className="text-slate-800 text-right">
                        {payslipDetail.isInsuranceEligible ? formatVnd(payslipDetail.insuranceSalaryBase) : 'Không đóng BH'} ·{' '}
                        {payslipDetail.isUnionMember ? 'Có CĐ' : 'Không CĐ'}
                      </strong>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Phương pháp thuế / NPT:</span>
                      <strong className="text-slate-800 text-right">
                        {payslipDetail.taxMethod === 'flat_10' ? 'Khấu trừ 10%' : 'Lũy tiến 5 bậc'} ·{' '}
                        {payslipDetail.dependentCount} người phụ thuộc
                      </strong>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                    <div className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] border-b border-slate-200 pb-1">
                      Chấm công &amp; Ca trực xác nhận
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Ngày công tính lương (Gồm phép):</span>
                      <strong className="text-slate-800 text-right">
                        {payslipDetail.workDays} công ({payslipDetail.paidLeaveDays} phép lương,{' '}
                        {payslipDetail.unpaidLeaveDays} không lương)
                      </strong>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Số ca trực tối / trực trưa:</span>
                      <strong className="text-slate-800 text-right">
                        {payslipDetail.eveningDutyCount} trực tối · {payslipDetail.noonDutyCount} trực trưa
                      </strong>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Giờ làm thêm (Ngoài giờ):</span>
                      <strong className="text-slate-800 text-right">{payslipDetail.overtimeHours} giờ (× 150%)</strong>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-500">Trạng thái rà soát:</span>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${getReviewBadgeClass(
                          payslipDetail.reviewStatus
                        )}`}
                      >
                        {REVIEW_STATUS_LABELS[payslipDetail.reviewStatus] || payslipDetail.reviewStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Block 2: Thu nhập (+) & Khấu trừ (-) với chiều cao cân bằng & tổng căn đáy */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                  {/* Cột Thu nhập (+) */}
                  <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 flex flex-col justify-between h-full">
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-emerald-800 uppercase tracking-wide border-b border-slate-200 pb-1.5 flex items-center justify-between">
                        <span>1. Chi tiết thu nhập (+):</span>
                        <span className="text-[11px] font-normal text-slate-500">VND</span>
                      </h4>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                          <span className="text-slate-600">Lương ngày công ({payslipDetail.workDays} công):</span>
                          <strong className="text-slate-800 tabular-nums">{formatVnd(payslipDetail.basePay)}</strong>
                        </div>
                        {payslipDetail.eveningDutyPay > 0 && (
                          <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                            <span className="text-slate-600">Tiền trực tối ({payslipDetail.eveningDutyCount} ca):</span>
                            <strong className="text-slate-800 tabular-nums">{formatVnd(payslipDetail.eveningDutyPay)}</strong>
                          </div>
                        )}
                        {payslipDetail.noonDutyPay > 0 && (
                          <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                            <span className="text-slate-600">Tiền trực trưa ({payslipDetail.noonDutyCount} ca):</span>
                            <strong className="text-slate-800 tabular-nums">{formatVnd(payslipDetail.noonDutyPay)}</strong>
                          </div>
                        )}
                        {payslipDetail.overtimePay > 0 && (
                          <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                            <span className="text-slate-600">Tiền làm thêm giờ ({payslipDetail.overtimeHours}h):</span>
                            <strong className="text-slate-800 tabular-nums">{formatVnd(payslipDetail.overtimePay)}</strong>
                          </div>
                        )}
                        {payslipDetail.allowances.map((a) => (
                          <div key={a.id} className="flex justify-between py-1 border-b border-dashed border-slate-200">
                            <span className="text-slate-600">PC {a.name}:</span>
                            <strong className="text-slate-800 tabular-nums">{formatVnd(a.amount)}</strong>
                          </div>
                        ))}
                        <div className="flex justify-between py-1 border-b border-dashed border-slate-200">
                          <span className="text-slate-600">Hoa hồng thủ thuật:</span>
                          <strong className="text-slate-800 tabular-nums">{formatVnd(payslipDetail.commissionTotal)}</strong>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200/80">
                      <div className="flex justify-between py-1.5 text-xs font-semibold text-slate-900 bg-emerald-50/80 px-2.5 rounded-lg">
                        <span>Tổng thu nhập Gross:</span>
                        <span className="text-emerald-700 tabular-nums">{formatVnd(payslipDetail.grossPay)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Cột Khấu trừ (-) & Bậc thuế */}
                  <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50/50 flex flex-col justify-between h-full">
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-rose-800 uppercase tracking-wide border-b border-slate-200 pb-1.5 flex items-center justify-between">
                        <span>2. Giảm trừ &amp; Thuế TNCN (-):</span>
                        <span className="text-[11px] font-normal text-slate-500">VND</span>
                      </h4>
                      <div className="space-y-1.5 text-xs">
                        {payslipDetail.deductions.length > 0 ? (
                          payslipDetail.deductions.map((d) => (
                            <div key={d.payslipDeductionId + d.deductionName} className="flex justify-between py-1 border-b border-dashed border-slate-200">
                              <span className="text-slate-600">
                                {d.deductionName}
                                {d.ratePercent ? ` (${d.ratePercent}%)` : ''}:
                              </span>
                              <strong className="text-slate-800 tabular-nums">{formatVnd(d.amount)}</strong>
                            </div>
                          ))
                        ) : (
                          <div className="text-slate-400 italic py-1">Không phát sinh khoản khấu trừ nào.</div>
                        )}

                        <div className="pt-2 border-t border-slate-200 space-y-1 text-[11px] text-slate-600">
                          <div className="flex justify-between">
                            <span>Giảm trừ bản thân:</span>
                            <span className="tabular-nums">{formatVnd(payslipDetail.personalDeduction)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Giảm trừ người phụ thuộc ({payslipDetail.dependentCount}):</span>
                            <span className="tabular-nums">{formatVnd(payslipDetail.dependentDeduction)}</span>
                          </div>
                          <div className="flex justify-between font-medium text-slate-800">
                            <span>Thu nhập tính thuế:</span>
                            <span className="tabular-nums">{formatVnd(payslipDetail.taxableIncome)}</span>
                          </div>
                        </div>

                        {payslipDetail.taxBrackets.length > 0 && (
                          <div className="mt-2 p-2 rounded-lg bg-white border border-slate-200 text-[11px] space-y-1">
                            <div className="font-semibold text-slate-700">Chi tiết thuế theo bậc:</div>
                            {payslipDetail.taxBrackets.map((b) => (
                              <div key={b.bracketIndex} className="flex justify-between text-slate-600">
                                <span>
                                  Bậc {b.bracketIndex} ({b.rangeText} · {b.ratePercent}%):
                                </span>
                                <span className="font-medium text-slate-800 tabular-nums">{formatVnd(b.taxAmount)}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {payslipDetail.taxCalculationNote && (
                          <p className="text-[11px] text-slate-500 italic">{payslipDetail.taxCalculationNote}</p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200/80">
                      <div className="flex justify-between py-1.5 text-xs font-semibold text-slate-900 bg-rose-50/80 px-2.5 rounded-lg">
                        <span>Tổng tiền khấu trừ:</span>
                        <span className="text-rose-700 tabular-nums">
                          {formatVnd(
                            payslipDetail.insuranceDeduction +
                              payslipDetail.unionFeeDeduction +
                              payslipDetail.taxDeduction
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Net Pay Card */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-xs flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-emerald-100 font-semibold block">
                      THỰC LĨNH CHUYỂN KHOẢN (NET PAY)
                    </span>
                    <span className="text-[11px] opacity-90">
                      Làm tròn đến hàng nghìn (Đã trừ BHXH, Công đoàn &amp; Thuế TNCN)
                    </span>
                  </div>
                  <div className="text-2xl font-bold tracking-tight tabular-nums">{formatVnd(payslipDetail.netPay)}</div>
                </div>

                {/* Interactive Accountant Review Bar */}
                {!isFinalizedOrLocked && !payslipDetail.isLocked && (
                  <form
                    onSubmit={handleSavePayslipReview}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5"
                  >
                    <div className="text-xs font-semibold text-slate-800">
                      Kết quả đối soát của Kế toán
                    </div>
                    {reviewError && <Alert variant="error">{reviewError}</Alert>}

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
                      <div className="md:col-span-4">
                        <label
                          htmlFor="payslip-review-status"
                          className="block text-[11px] font-medium text-slate-600 mb-1!"
                        >
                          Trạng thái kiểm tra
                        </label>
                        <select
                          id="payslip-review-status"
                          className="w-full h-9! min-h-0! py-1! px-2.5! text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                          value={reviewStatusInput}
                          onChange={(e) => setReviewStatusInput(e.target.value)}
                          disabled={savingReview}
                        >
                          <option value="reviewed">Đã rà soát hợp lệ</option>
                          <option value="needs_hr">Cần sửa Hợp đồng / Phụ cấp</option>
                          <option value="needs_attendance">Cần sửa Chấm công / Ca trực</option>
                          <option value="needs_procedure">Cần kiểm tra lại Thủ thuật</option>
                          <option value="pending">Đưa về Chờ rà soát</option>
                        </select>
                      </div>

                      <div className="md:col-span-5">
                        <label
                          htmlFor="payslip-review-note"
                          className="block text-[11px] font-medium text-slate-600 mb-1!"
                        >
                          Ghi chú rà soát {reviewStatusInput.startsWith('needs_') && <span className="text-rose-500">*</span>}
                        </label>
                        <input
                          id="payslip-review-note"
                          type="text"
                          className="w-full h-9! min-h-0! py-1! px-2.5! text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
                          placeholder="Nhập ghi chú đối soát hoặc yêu cầu sửa..."
                          value={reviewNoteInput}
                          onChange={(e) => setReviewNoteInput(e.target.value)}
                          disabled={savingReview}
                        />
                      </div>

                      <div className="md:col-span-3 flex justify-end gap-2">
                        <button
                          type="button"
                          className="h-9 px-3 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium cursor-pointer whitespace-nowrap"
                          onClick={() => {
                            setSelectedSummary(null);
                            setPayslipDetail(null);
                          }}
                          disabled={savingReview}
                        >
                          Đóng
                        </button>
                        <button
                          type="submit"
                          className="h-9 px-3.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-60 whitespace-nowrap"
                          disabled={savingReview}
                        >
                          {savingReview ? 'Đang lưu…' : 'Lưu đối soát'}
                        </button>
                      </div>
                    </div>
                  </form>
                )}

                {(isFinalizedOrLocked || payslipDetail.isLocked) && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      className="h-9 px-4 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-medium transition-colors cursor-pointer"
                      onClick={() => {
                        setSelectedSummary(null);
                        setPayslipDetail(null);
                      }}
                    >
                      Đóng
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </Modal>
      )}

      {/* Modal Chốt & Khóa sổ chính thức - MSG13 (Task 75) */}
      {finalizeModalOpen && detail && (
        <Modal
          title={`Chốt & Khóa sổ kỳ lương ${formatMonthDisplay(detail.payMonth)}`}
          subtitle="Xác nhận phát hành phiếu lương chính thức (MSG13)"
          onClose={() => {
            if (!finalizing) {
              setFinalizeModalOpen(false);
            }
          }}
          busy={finalizing}
          maxWidth="540px"
        >
          <form onSubmit={handleFinalizePeriod} className="p-5 space-y-4">
            {finalizeError && <Alert variant="error">{finalizeError}</Alert>}

            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
              <div className="font-semibold text-amber-900">
                Bạn có chắc chắn muốn chốt và khóa bảng lương chính thức không?
              </div>
              <p className="text-amber-800/90">
                Sau khi khóa sổ, toàn bộ {detail.employeeCount} phiếu lương của Cơ sở 1 sẽ chuyển sang chế độ chỉ đọc
                và cho phép nhân viên xem phiếu lương chính thức.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-600">1. Trạng thái Bảng công tháng:</span>
                <strong className={detail.attendanceLocked ? 'text-emerald-700' : 'text-rose-600'}>
                  {detail.attendanceLocked ? '✓ Đã khóa công (Hợp lệ)' : '✗ Chưa khóa công'}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">2. Thủ thuật y tế trong tháng:</span>
                <strong className={detail.proceduresVerified ? 'text-emerald-700' : 'text-rose-600'}>
                  {detail.proceduresVerified ? '✓ Đã xác minh đủ' : '✗ Còn phiếu chưa duyệt'}
                </strong>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="text-slate-600">Tổng nhân sự / Tổng Gross:</span>
                <strong className="text-slate-800">
                  {detail.employeeCount} người · {formatVnd(metrics.totalGross)}
                </strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Tổng Thực lĩnh chi trả (Net Pay):</span>
                <strong className="text-emerald-700">{formatVnd(metrics.totalNet)}</strong>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="finalize-note" className="block text-xs font-medium text-slate-700">
                Ghi chú chốt sổ (tùy chọn)
              </label>
              <textarea
                id="finalize-note"
                rows={2}
                className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                placeholder="VD: Đã đối chiếu xong toàn bộ chấm công và hoa hồng Cơ sở 1..."
                value={finalizeNote}
                onChange={(e) => setFinalizeNote(e.target.value)}
                disabled={finalizing}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                className="h-9 px-4 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium cursor-pointer"
                onClick={() => setFinalizeModalOpen(false)}
                disabled={finalizing}
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                disabled={finalizing}
              >
                {finalizing ? 'Đang chốt sổ…' : 'Xác nhận Chốt & Khóa sổ'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal Mở lại kỳ lương */}
      {reopenModalOpen && (
        <Modal
          title={`Mở lại kỳ tính lương ${formatMonthDisplay(month || '')}`}
          subtitle="Quy trình hiệu chỉnh kỳ tính lương đã khóa"
          onClose={() => {
            if (!reopening) {
              setReopenModalOpen(false);
              setReopenReason('');
              setReopenError('');
            }
          }}
          busy={reopening}
          maxWidth="520px"
        >
          <div className="p-5 space-y-4">
            {reopenError && <Alert variant="error">{reopenError}</Alert>}

            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1.5">
              <div className="font-semibold flex items-center gap-1.5 text-amber-800">
                <span>Lưu ý khi mở lại kỳ lương:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-amber-800/90">
                <li>Kỳ lương sẽ được chuyển về trạng thái <strong>Bản nháp</strong> để hiệu chỉnh và tính toán lại.</li>
                <li>Hệ thống sẽ gắn cờ <strong>Trễ hạn (Late)</strong> và ghi nhật ký kiểm toán (Audit Log).</li>
                <li>
                  Toàn bộ quá trình hiệu chỉnh phải hoàn thành trước{' '}
                  <strong>{detail ? formatDateOnly(detail.correctionDeadline) : 'ngày 12'}</strong>.
                </li>
              </ul>
            </div>

            <form onSubmit={handleReopenPeriod} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="reopen-reason-input"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                >
                  Lý do mở lại kỳ tính lương <span className="text-rose-500">*</span>
                </label>
                <textarea
                  id="reopen-reason-input"
                  rows={3}
                  className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none"
                  placeholder="Nhập chi tiết lý do cần mở lại kỳ lương..."
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  disabled={reopening}
                  maxLength={500}
                  required
                />
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Bắt buộc</span>
                  <span>{reopenReason.length}/500</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  className="h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium transition-colors cursor-pointer"
                  onClick={() => {
                    setReopenModalOpen(false);
                    setReopenReason('');
                    setReopenError('');
                  }}
                  disabled={reopening}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                  disabled={reopening || !reopenReason.trim()}
                >
                  {reopening ? 'Đang xử lý…' : 'Xác nhận mở lại kỳ lương'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Modal Xác nhận xóa kỳ lương nháp */}
      {deleteModalOpen && detail && (
        <Modal
          title={`Xóa kỳ lương nháp ${formatMonthDisplay(month || detail.payMonth)}`}
          subtitle="Thao tác dọn dẹp kỳ tính lương chưa xác nhận / chưa chốt sổ"
          onClose={() => {
            if (!deleting) {
              setDeleteModalOpen(false);
              setDeleteError('');
            }
          }}
          busy={deleting}
          maxWidth="480px"
        >
          <div className="p-5 space-y-4">
            {deleteError && <Alert variant="error">{deleteError}</Alert>}

            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1.5">
              <div className="font-semibold text-rose-800">
                Bạn có chắc chắn muốn xóa kỳ tính lương {formatMonthDisplay(month || detail.payMonth)} (mã {detail.payMonth})?
              </div>
              <ul className="list-disc list-inside space-y-1 text-rose-800/90">
                <li>
                  Toàn bộ <strong>{detail.employeeCount} phiếu lương nháp</strong> cùng chi tiết phụ cấp và khấu trừ của kỳ này sẽ bị xóa.
                </li>
                <li>
                  Thao tác này không thể hoàn tác, nhưng bạn vẫn có thể tạo lại kỳ lương tháng này bất kỳ lúc nào.
                </li>
                <li>
                  <strong>Dữ liệu gốc</strong> (chấm công, lịch trực, hợp đồng, phiếu thủ thuật) hoàn toàn được giữ nguyên.
                </li>
              </ul>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                className="h-9 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium transition-colors cursor-pointer"
                onClick={() => {
                  setDeleteModalOpen(false);
                  setDeleteError('');
                }}
                disabled={deleting}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="h-9 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
                onClick={() => void handleDeletePeriod()}
                disabled={deleting}
              >
                <Icon name="trash" size={13} />
                <span>{deleting ? 'Đang xóa…' : 'Xác nhận xóa kỳ nháp'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
