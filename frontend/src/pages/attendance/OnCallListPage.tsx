import { useState } from 'react';
import { Link } from 'react-router-dom';
import AttendanceShell from '../../components/attendance/AttendanceShell';
import AttendanceFilters, { type AttendanceSearch } from '../../components/attendance/AttendanceFilters';
import ResourceState from '../../components/attendance/ResourceState';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import useApiResource from '../../hooks/useApiResource';
import { useAuthStore } from '../../store/useAuthStore';
import type { AttendanceOptions, OnCallItem, PageResult } from '../../types/attendance';
import { clinicToday, shortDate } from '../../utils/schedule';
import { attendanceLabel, clockTime } from '../../utils/attendance';

export default function OnCallListPage() {
  const manager = useAuthStore(state => state.session?.user.role === 'hr_staff');
  const [filter, setFilter] = useState<AttendanceSearch>({ month: clinicToday().slice(0, 7), facilityId: '', departmentId: '', staffId: '', search: '', status: '', source: '' });
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(20);
  const options = useApiResource<AttendanceOptions>('/attendance/options');
  const resource = useApiResource<PageResult<OnCallItem>>('/attendance/on-call-shifts', { ...filter, page, pageSize });
  return <AttendanceShell title="Hồ sơ ca trực" description="Ghi nhận trực trưa và trực tối thực tế, liên kết bằng chứng trước khi xác nhận."
    actions={manager && <Link className="button primary" to="/attendance/on-call/new">Ghi nhận ca trực</Link>}>
    <section className="operations-panel"><AttendanceFilters value={filter} options={options.data} onCall change={value => { setFilter(value); setPage(1); }} />
      <ResourceState loading={resource.loading || options.loading} error={resource.error || options.error} reload={() => { resource.reload(); options.reload(); }} />
      {resource.data && <>{resource.data.lockedReason && <p className="alert warning">{resource.data.lockedReason}</p>}<DataTable rows={resource.data.items} rowKey={item => item.id} emptyMessage="Không tìm thấy hồ sơ trực phù hợp." columns={[
        { key: 'staff', label: 'Nhân viên', render: item => <><Link to={`/attendance/on-call/${item.id}`}>{item.staffName}</Link><small className="table-secondary">{item.staffCode} · {item.departmentName}</small></> },
        { key: 'date', label: 'Ngày / ca', render: item => <>{shortDate(item.date, true)}<small className="table-secondary">{attendanceLabel(item.category)}</small></> },
        { key: 'facility', label: 'Cơ sở', render: item => item.facilityName || 'Chưa xác định' },
        { key: 'time', label: 'Giờ thực tế', render: item => `${clockTime(item.start)} – ${clockTime(item.end)}` },
        { key: 'status', label: 'Trạng thái', render: item => <>{attendanceLabel(item.status)}{item.reviewNote && <small className="table-secondary">{item.reviewNote}</small>}</> },
        { key: 'actions', label: 'Thao tác', render: item => <div className="operations-actions"><Link className="button" to={`/attendance/on-call/${item.id}`}>Chi tiết</Link>{manager && item.status === 'pending' && !resource.data?.lockedReason && <Link className="button" to={`/attendance/on-call/${item.id}/edit`}>Sửa</Link>}</div> },
      ]} /><Pagination total={resource.data.total} page={resource.data.page} pageSize={resource.data.pageSize} label="ca trực" onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} /></>}
    </section>
  </AttendanceShell>;
}
