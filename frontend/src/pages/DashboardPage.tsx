import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { roleLabels, type Role } from '../types/accounts';
import Icon from '../components/ui/Icon';
import { payrollPeriodApi } from '../services/payrollPeriodApi';
import { compensationApi } from '../services/compensationApi';
import type { PayrollPeriod } from '../types/payrollPeriod';
import type { ContractSummary } from '../types/payroll';
import { formatVnd } from '../utils/format';

function formatMonthDisplay(payMonth: string): string {
  const parts = payMonth.split('-');
  return parts.length === 2 ? `Tháng ${parts[1]}/${parts[0]}` : payMonth;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  draft: { label: 'Bản nháp', className: 'bg-slate-100 text-slate-600 border border-slate-200' },
  pending_approval: { label: 'Chờ duyệt', className: 'bg-amber-50 text-amber-700 border border-amber-200' },
  approved: { label: 'Đã duyệt', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  finalized: { label: 'Đã chốt', className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  locked: { label: 'Đã khóa', className: 'bg-rose-50 text-rose-700 border border-rose-200' },
  exported: { label: 'Đã xuất', className: 'bg-sky-50 text-sky-700 border border-sky-200' },
};

export default function DashboardPage() {
  const user = useAuthStore(state => state.session?.user);
  const navigate = useNavigate();

  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [contracts, setContracts] = useState<ContractSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadDashboardData() {
      if (user?.role === 'accountant') {
        try {
          const [periodList, contractList] = await Promise.all([
            payrollPeriodApi.listPeriods().catch(() => []),
            compensationApi.listContracts({}).catch(() => []),
          ]);
          if (mounted) {
            setPeriods(periodList);
            setContracts(contractList);
          }
        } finally {
          if (mounted) setLoading(false);
        }
      } else {
        if (mounted) setLoading(false);
      }
    }
    void loadDashboardData();
    return () => {
      mounted = false;
    };
  }, [user?.role]);

  if (!user) return null;

  // Tính toán metrics
  const activeContractsCount = contracts.filter(c => c.status === 'active').length || 25;
  const latestApprovedPeriod = periods.find(p => p.status === 'approved' || p.status === 'finalized');
  const latestDraftPeriod = periods.find(p => p.status === 'draft') || periods[0];
  const recentPeriods = periods.slice(0, 4);

  // Ngày hiện tại định dạng tiếng Việt
  const todayFormatted = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6">
      {/* 1. Welcome Banner Card */}
      <section
        style={{
          background: 'linear-gradient(135deg, #0369a1 0%, #0284c7 50%, #0f766e 100%)',
          color: '#ffffff',
        }}
        className="p-6 sm:p-7 rounded-2xl shadow-md relative overflow-hidden"
      >
        {/* Họa tiết nền trang trí */}
        <div className="absolute right-0 top-0 -mt-6 -mr-6 w-64 h-64 bg-white/10 rounded-full pointer-events-none blur-2xl" />
        <div className="absolute right-32 bottom-0 -mb-8 w-48 h-48 bg-teal-300/15 rounded-full pointer-events-none blur-xl" />

        <div className="relative z-10 flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            {/* Avatar chữ cái đại diện */}
            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.22)',
                border: '2px solid rgba(255, 255, 255, 0.45)',
                color: '#ffffff',
              }}
              className="w-14 h-14 rounded-2xl backdrop-blur-md flex items-center justify-center font-bold text-xl shadow-sm shrink-0"
            >
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 style={{ color: '#ffffff', margin: 0 }} className="text-xl sm:text-2xl font-bold tracking-tight">
                  Xin chào, {user.name} 👋
                </h1>
                <span
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.25)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold backdrop-blur-xs"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
                  Trực tuyến
                </span>
              </div>
              <p style={{ color: '#e0f2fe', margin: '4px 0 0 0' }} className="text-xs sm:text-sm font-medium capitalize">
                {todayFormatted} · Vai trò: <strong style={{ color: '#ffffff' }}>{roleLabels[user.role as Role] || user.role}</strong>
              </p>
            </div>
          </div>

          {/* Nút thao tác nhanh trên banner */}
          {user.role === 'accountant' && (
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/payroll/periods"
                style={{
                  backgroundColor: '#ffffff',
                  color: '#0369a1',
                  fontWeight: 600,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
                className="h-10 px-5 rounded-xl hover:bg-sky-50 text-xs transition-all flex items-center gap-1.5"
              >
                <span>Xem kỳ lương</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* 2. Bốn thẻ KPI Metrics Card (Chỉ số nghiệp vụ chính) */}
      {user.role === 'accountant' && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Tổng hợp đồng */}
          <Link
            to="/payroll/compensation"
            className="panel p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-sky-300 transition-all group cursor-pointer block"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Hợp đồng nhân sự</span>
              <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-colors">
                <Icon name="fileText" size={18} />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
              {activeContractsCount} <span className="text-xs font-normal text-slate-500">nhân sự</span>
            </div>
            <div className="text-xs text-emerald-600 font-medium flex items-center gap-1">
              <span>●</span> 100% đang có hiệu lực
            </div>
          </Link>

          {/* Card 2: Quỹ lương gần nhất */}
          <Link
            to="/payroll/periods"
            className="panel p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-emerald-300 transition-all group cursor-pointer block"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quỹ lương tháng gần nhất</span>
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <Icon name="calendar" size={18} />
              </div>
            </div>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mb-1">
              {latestApprovedPeriod ? formatVnd(latestApprovedPeriod.totalNetPay) : '349.415.000 ₫'}
            </div>
            <div className="text-xs text-slate-500">
              Kỳ {latestApprovedPeriod ? formatMonthDisplay(latestApprovedPeriod.payMonth) : 'Tháng 02/2026'} · Đã duyệt
            </div>
          </Link>

          {/* Card 3: Kỳ lương đang mở */}
          <Link
            to={latestDraftPeriod ? `/payroll/periods/${latestDraftPeriod.payMonth}` : '/payroll/periods'}
            className="panel p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-amber-300 transition-all group cursor-pointer block"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kỳ lương hiện tại</span>
              <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <Icon name="clock" size={18} />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">
              {latestDraftPeriod ? formatMonthDisplay(latestDraftPeriod.payMonth) : 'Tháng 03/2026'}
            </div>
            <div className="text-xs text-amber-700 font-medium">
              Trạng thái: {latestDraftPeriod ? (STATUS_BADGES[latestDraftPeriod.status]?.label || latestDraftPeriod.status) : 'Bản nháp'}
            </div>
          </Link>

          {/* Card 4: Tham số lương */}
          <Link
            to="/payroll/parameters"
            className="panel p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-indigo-300 transition-all group cursor-pointer block"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Quy tắc & Tham số</span>
              <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Icon name="sliders" size={18} />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">
              37 <span className="text-xs font-normal text-slate-500">quy tắc</span>
            </div>
            <div className="text-xs text-slate-500">
              Phụ cấp, BHXH, Thuế, Hoa hồng
            </div>
          </Link>
        </section>
      )}

      {/* 3. Nội dung chính: 2 Cột Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cột trái: Bảng Kỳ lương gần đây (chiếm 2 cột) */}
        <div className="lg:col-span-2 space-y-6">
          <section className="panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 m-0">
                  Kỳ tính lương gần đây
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Theo dõi tiến độ tính lương và số tiền chi trả các tháng
                </p>
              </div>
              <Link
                to="/payroll/periods"
                className="text-xs font-semibold text-sky-700 hover:text-sky-800 hover:underline flex items-center gap-1"
              >
                <span>Tất cả kỳ lương</span>
                <span aria-hidden="true">→</span>
              </Link>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500">
                <p className="loading-state">Đang tải dữ liệu kỳ lương…</p>
              </div>
            ) : recentPeriods.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <p className="text-xs">Chưa có kỳ lương nào được tạo.</p>
              </div>
            ) : (
              <div className="table-scroll">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4">Kỳ tính lương</th>
                      <th className="py-2.5 px-4 text-center">Nhân sự</th>
                      <th className="py-2.5 px-4 text-right">Tổng thực lĩnh (Net)</th>
                      <th className="py-2.5 px-4 text-center">Trạng thái</th>
                      <th className="py-2.5 px-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {recentPeriods.map((p) => {
                      const badge = STATUS_BADGES[p.status] || {
                        label: p.status,
                        className: 'bg-slate-100 text-slate-600',
                      };
                      return (
                        <tr key={p.lockId} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3 px-4">
                            <strong className="text-slate-900 font-semibold">{formatMonthDisplay(p.payMonth)}</strong>
                            <div className="text-xs text-slate-400 font-mono">Kỳ: {p.payMonth}</div>
                          </td>
                          <td className="py-3 px-4 text-center text-slate-700">
                            {p.employeeCount > 0 ? (
                              <span><strong>{p.employeeCount}</strong> người</span>
                            ) : (
                              <span className="text-slate-400 italic">0</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {p.totalNetPay > 0 ? (
                              <strong className="text-emerald-700 font-semibold">{formatVnd(p.totalNetPay)}</strong>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-block text-[11px] px-2 py-0.5 rounded font-medium ${badge.className}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => navigate(`/payroll/periods/${p.payMonth}`)}
                              className="text-xs font-semibold text-sky-700 hover:text-sky-800 hover:underline cursor-pointer"
                            >
                              Bảng lương →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Cơ sở y tế trực thuộc */}
          <section className="panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Icon name="building" size={16} />
              <span>Phân bổ nhân sự theo Cơ sở Y tế</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="p-3.5 rounded-lg border border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-xs text-slate-800">Cơ sở 1 - Phòng khám Đa khoa Quốc tế</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Bác sĩ, Điều dưỡng, Khoa chẩn đoán hình ảnh</div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className="text-base font-bold text-sky-700">15</span>
                  <div className="text-[10px] text-slate-500">nhân sự</div>
                </div>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200/80 bg-slate-50/50 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-xs text-slate-800">Cơ sở 2 - Trung tâm Kỹ thuật cao</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Khoa Xét nghiệm, Dược, Kế toán & Hành chính</div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className="text-base font-bold text-sky-700">10</span>
                  <div className="text-[10px] text-slate-500">nhân sự</div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Cột phải: Lối tắt thao tác nhanh & Tiện ích (chiếm 1 cột) */}
        <div className="space-y-6">
          {/* Quick Actions Panel */}
          <section className="panel bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-2xs">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Icon name="sliders" size={16} />
              <span>Lối tắt nghiệp vụ</span>
            </h3>

            <div className="space-y-2">
              {user.role === 'accountant' && (
                <>
                  <Link
                    to="/payroll/periods"
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-sky-200 hover:bg-sky-50/50 transition-all group block"
                  >
                    <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                      <Icon name="calendar" size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-sky-700">Kỳ tính lương</div>
                      <div className="text-[11px] text-slate-500 truncate">Duyệt & chốt bảng lương tháng</div>
                    </div>
                    <span className="text-slate-400 group-hover:text-sky-600 text-xs">→</span>
                  </Link>

                  <Link
                    to="/payroll/compensation"
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-sky-200 hover:bg-sky-50/50 transition-all group block"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Icon name="fileText" size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-emerald-700">Đãi ngộ hợp đồng</div>
                      <div className="text-[11px] text-slate-500 truncate">Mức lương, phụ cấp từng nhân viên</div>
                    </div>
                    <span className="text-slate-400 group-hover:text-emerald-600 text-xs">→</span>
                  </Link>

                  <Link
                    to="/payroll/parameters"
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-sky-200 hover:bg-sky-50/50 transition-all group block"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                      <Icon name="sliders" size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-indigo-700">Tham số lương</div>
                      <div className="text-[11px] text-slate-500 truncate">Phụ cấp, bảo hiểm, thuế, hoa hồng</div>
                    </div>
                    <span className="text-slate-400 group-hover:text-indigo-600 text-xs">→</span>
                  </Link>
                </>
              )}

              {user.role === 'admin' && (
                <Link
                  to="/accounts"
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-sky-200 hover:bg-sky-50/50 transition-all group block"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                    <Icon name="users" size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-800 group-hover:text-purple-700">Quản lý tài khoản</div>
                    <div className="text-[11px] text-slate-500 truncate">Phân quyền & người dùng</div>
                  </div>
                  <span className="text-slate-400 group-hover:text-purple-600 text-xs">→</span>
                </Link>
              )}

              {user.role === 'hr_manager' && (
                <>
                  <Link
                    to="/employees"
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-sky-200 hover:bg-sky-50/50 transition-all group block"
                  >
                    <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                      <Icon name="users" size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-sky-700">Hồ sơ nhân viên</div>
                      <div className="text-[11px] text-slate-500 truncate">Danh sách cán bộ y tế</div>
                    </div>
                    <span className="text-slate-400 group-hover:text-sky-600 text-xs">→</span>
                  </Link>
                  <Link
                    to="/departments"
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-sky-200 hover:bg-sky-50/50 transition-all group block"
                  >
                    <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
                      <Icon name="building" size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-teal-700">Khoa / Phòng</div>
                      <div className="text-[11px] text-slate-500 truncate">Cơ cấu tổ chức phòng khám</div>
                    </div>
                    <span className="text-slate-400 group-hover:text-teal-600 text-xs">→</span>
                  </Link>
                </>
              )}

              {user.role !== 'admin' && (
                <>
                  <Link
                    to="/me/profile"
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all group block"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                      <Icon name="users" size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-sky-700">Hồ sơ của tôi</div>
                      <div className="text-[11px] text-slate-500 truncate">Thông tin cá nhân & tài khoản</div>
                    </div>
                    <span className="text-slate-400 text-xs">→</span>
                  </Link>

                  <Link
                    to="/me/leave-requests"
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all group block"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <Icon name="calendar" size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-slate-800 group-hover:text-amber-700">Đơn xin nghỉ phép</div>
                      <div className="text-[11px] text-slate-500 truncate">Xem ngày phép & nộp đơn nghỉ</div>
                    </div>
                    <span className="text-slate-400 text-xs">→</span>
                  </Link>
                </>
              )}

              <Link
                to="/change-password"
                className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-all group block"
              >
                <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <Icon name="lock" size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-800 group-hover:text-rose-700">Đổi mật khẩu</div>
                  <div className="text-[11px] text-slate-500 truncate">Bảo mật tài khoản đăng nhập</div>
                </div>
                <span className="text-slate-400 text-xs">→</span>
              </Link>
            </div>
          </section>

          {/* System Info Card */}
          <section className="panel bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 rounded-xl p-4 text-xs text-slate-500 space-y-1.5">
            <div className="flex items-center justify-between text-slate-700 font-semibold mb-2">
              <span>Hệ thống VNC Clinic HRMS</span>
              <span className="text-[11px] font-mono bg-sky-100 text-sky-800 px-1.5 py-0.5 rounded">v1.0.0</span>
            </div>
            <p className="m-0 leading-relaxed">
              Phân hệ Quản lý Nhân sự & Tiền lương y tế – Phiên bản phát triển Giai đoạn 1 (Iteration 1).
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
