import { useState, useEffect, useCallback, useMemo } from 'react';
import { leaveApprovalApi } from '../../services/leaveApprovalApi';
import { departmentApi, type Department } from '../../services/departmentApi';
import type { LeaveApprovalSummary, LeaveApprovalDetail } from '../../types/leaveApproval';
import { useAuthStore } from '../../store/useAuthStore';
import ReviewLeaveModal from '../../components/leaves/ReviewLeaveModal';
import Icon from '../../components/ui/Icon';

const LEAVE_TYPES = [
  { value: 'all', label: 'Tất cả loại nghỉ' },
  { value: 'unpaid', label: 'Nghỉ việc riêng' },
  { value: 'sick', label: 'Nghỉ ốm đau' },
  { value: 'maternity', label: 'Nghỉ thai sản' },
];

export default function LeaveApprovalPage() {
  const { session } = useAuthStore();
  const user = session?.user;
  const isGlobalManager = user?.role === 'hr_manager' || user?.role === 'admin';

  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [search, setSearch] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedLeaveType, setSelectedLeaveType] = useState<string>('all');
  const [departments, setDepartments] = useState<Department[]>([]);

  const [items, setItems] = useState<LeaveApprovalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal review state
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  // Load departments if HR Manager or Admin
  useEffect(() => {
    if (isGlobalManager) {
      departmentApi
        .list()
        .then((data) => setDepartments(data.filter((d) => d.status === 'active')))
        .catch(() => {});
    }
  }, [isGlobalManager]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await leaveApprovalApi.getQueue({
        status: activeTab,
        departmentId: selectedDept !== 'all' ? selectedDept : undefined,
        leaveType: selectedLeaveType !== 'all' ? selectedLeaveType : undefined,
        search: search.trim() || undefined,
      });
      setItems(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể tải danh sách đơn nghỉ phép.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedDept, selectedLeaveType, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadData();
    }, 200);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Handle modal review success
  const handleReviewSuccess = (updated: LeaveApprovalDetail) => {
    setSelectedRequestId(null);
    setSuccessMsg(
      updated.status === 'approved'
        ? `Đã phê duyệt đơn xin nghỉ phép của ${updated.staffName} thành công.`
        : `Đã từ chối đơn xin nghỉ phép của ${updated.staffName}.`
    );
    void loadData();
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const pendingCount = useMemo(() => {
    if (activeTab === 'pending') return items.length;
    return items.filter((x) => x.status === 'pending').length;
  }, [items, activeTab]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const [y, m, d] = dateStr.split('-');
      return `${d}/${m}/${y}`;
    } catch {
      return dateStr;
    }
  };

  const getLeaveTypeBadge = (type: string, name: string) => {
    switch (type.toLowerCase()) {
      case 'annual':
        return <span className="inline-flex items-center rounded-md bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">{name}</span>;
      case 'sick':
        return <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">{name}</span>;
      case 'maternity':
        return <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">{name}</span>;
      case 'personal_paid':
        return <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">{name}</span>;
      case 'unpaid':
        return <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">{name}</span>;
      default:
        return <span className="inline-flex items-center rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">{name}</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 border border-amber-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Chờ duyệt
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 border border-emerald-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Đã duyệt
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 border border-rose-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            Từ chối
          </span>
        );
      case 'withdrawn':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
            Đã rút đơn
          </span>
        );
      default:
        return <span className="text-xs text-slate-500">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 workspace-list-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-700">
              Quản lý nghỉ phép
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
              user?.role === 'department_head'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {user?.role === 'department_head' ? 'Thẩm quyền duyệt cấp Khoa/Phòng' : 'Chế độ theo dõi toàn viện'}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {user?.role === 'department_head' ? 'Duyệt đơn nghỉ phép' : 'Theo dõi & Rà soát đơn nghỉ phép'}
          </h1>
        </div>
      </div>

      {/* Success notification */}
      {successMsg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-sm font-medium text-emerald-800 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <Icon name="check" size={18} />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setSuccessMsg(null)}
            className="text-xs text-emerald-700 hover:text-emerald-900"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Filter & Status Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm space-y-4">
        {/* Top: Tabs & Search row */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-slate-100 pb-3">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-100/70 p-0.5 rounded-lg self-start">
            <button
              onClick={() => setActiveTab('pending')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition ${
                activeTab === 'pending'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Chờ duyệt</span>
              {pendingCount > 0 && (
                <span className="rounded-full bg-amber-500 px-1.5 py-0 text-[10px] font-bold text-white leading-tight">
                  {pendingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('approved')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                activeTab === 'approved'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Đã duyệt
            </button>
            <button
              onClick={() => setActiveTab('rejected')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                activeTab === 'rejected'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Từ chối
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                activeTab === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tất cả
            </button>
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex items-center h-8 w-48 sm:w-56 rounded-lg border border-slate-200 bg-white px-2.5 shadow-xs focus-within:border-teal-500 focus-within:ring-1 focus-within:ring-teal-500">
              <span className="shrink-0 text-slate-400 flex items-center pointer-events-none">
                <Icon name="search" size={14} />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm tên, mã nhân viên..."
                style={{ height: '22px', minHeight: 'unset', padding: '0 0 0 6px', border: 'none', background: 'transparent' }}
                className="w-full border-0 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="shrink-0 text-xs text-slate-400 hover:text-slate-600 ml-1"
                >
                  ×
                </button>
              )}
            </div>

            <button
              onClick={() => void loadData()}
              title="Tải lại"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 shadow-xs transition"
            >
              <Icon name="refresh" size={14} />
            </button>
          </div>
        </div>

        {/* Bottom row: Sub-filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Department Filter (Only for HR Manager / Admin) */}
          {isGlobalManager && (
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500">Khoa phòng:</label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                style={{ width: 'auto', minWidth: '170px', height: '36px', minHeight: 'unset', padding: '0 28px 0 10px', fontSize: '12px' }}
                className="rounded-lg border border-slate-200 bg-white text-xs text-slate-700 shadow-sm focus:border-teal-500 focus:outline-none cursor-pointer"
              >
                <option value="all">Tất cả khoa phòng</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Leave Type Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Loại nghỉ:</label>
            <select
              value={selectedLeaveType}
              onChange={(e) => setSelectedLeaveType(e.target.value)}
              style={{ width: 'auto', minWidth: '160px', height: '36px', minHeight: 'unset', padding: '0 28px 0 10px', fontSize: '12px' }}
              className="rounded-lg border border-slate-200 bg-white text-xs text-slate-700 shadow-sm focus:border-teal-500 focus:outline-none cursor-pointer"
            >
              {LEAVE_TYPES.map((lt) => (
                <option key={lt.value} value={lt.value}>
                  {lt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="ml-auto text-xs text-slate-500">
            Tìm thấy <strong className="text-slate-800">{items.length}</strong> đơn nghỉ phép
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden workspace-list-panel">
        {error && (
          <div className="p-4 bg-rose-50 border-b border-rose-100 text-xs text-rose-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto workspace-table-viewport">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-slate-600 font-semibold">
                <th className="py-3 px-4">Nhân viên</th>
                <th className="py-3 px-4">Khoa phòng</th>
                <th className="py-3 px-4">Loại nghỉ</th>
                <th className="py-3 px-4">Thời gian nghỉ</th>
                <th className="py-3 px-4 text-center">Số ngày</th>
                <th className="py-3 px-4">Ngày gửi</th>
                <th className="py-3 px-4 text-center">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="inline-flex items-center gap-2 text-xs">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
                      <span>Đang tải danh sách đơn...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <p className="text-sm font-medium text-slate-600">Không có đơn xin nghỉ phép nào</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Chưa có yêu cầu nghỉ phép nào phù hợp với bộ lọc hiện tại.
                    </p>
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr
                    key={item.requestId}
                    onClick={() => setSelectedRequestId(item.requestId)}
                    className="hover:bg-teal-50/30 transition cursor-pointer"
                    title="Bấm để xem chi tiết đơn nghỉ phép"
                  >
                    {/* Staff */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{item.staffName}</div>
                      <div className="text-[11px] font-mono text-slate-400">{item.staffCode}</div>
                    </td>

                    {/* Department */}
                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium">{item.departmentName}</div>
                      {item.positionName && (
                        <div className="text-[11px] text-slate-400">{item.positionName}</div>
                      )}
                    </td>

                    {/* Leave Type */}
                    <td className="py-3 px-4">
                      {getLeaveTypeBadge(item.leaveType, item.leaveTypeName)}
                      {item.annualLeaveBalance !== null && (
                        <div className="mt-1 text-[11px] text-slate-400">
                          Dư: {item.annualLeaveBalance} ngày
                        </div>
                      )}
                    </td>

                    {/* Dates */}
                    <td className="py-3 px-4 font-medium text-slate-800">
                      <div>
                        {formatDate(item.startDate)} → {formatDate(item.endDate)}
                      </div>
                    </td>

                    {/* Total days */}
                    <td className="py-3 px-4 text-center font-semibold text-slate-900 tabular-nums">
                      {item.totalDays} công
                    </td>

                    {/* Created at */}
                    <td className="py-3 px-4 text-slate-500">
                      {formatDate(item.createdAt?.slice(0, 10))}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4 text-center">
                      {getStatusBadge(item.status)}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRequestId(item.requestId);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition shadow-xs cursor-pointer ${
                          item.status === 'pending' && user?.role === 'department_head'
                            ? 'border border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100 hover:border-teal-400 font-semibold'
                            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                        title="Xem chi tiết đơn nghỉ phép"
                      >
                        <Icon name="eye" size={13} />
                        <span>{item.status === 'pending' && user?.role === 'department_head' ? 'Xem & Duyệt' : 'Xem chi tiết'}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail & Review Modal */}
      {selectedRequestId && (
        <ReviewLeaveModal
          requestId={selectedRequestId}
          onClose={() => setSelectedRequestId(null)}
          onSuccess={handleReviewSuccess}
        />
      )}
    </div>
  );
}
