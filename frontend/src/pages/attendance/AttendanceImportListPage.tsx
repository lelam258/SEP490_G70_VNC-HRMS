import { useState } from 'react';
import { Link } from 'react-router-dom';
import AttendanceShell from '../../components/attendance/AttendanceShell';
import ResourceState from '../../components/attendance/ResourceState';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import useApiResource from '../../hooks/useApiResource';
import { useAuthStore } from '../../store/useAuthStore';
import type { AttendanceOptions, ImportBatch, PageResult } from '../../types/attendance';
import { clinicToday } from '../../utils/schedule';
import { attendanceLabel, instant } from '../../utils/attendance';

export default function AttendanceImportListPage() {
  const role = useAuthStore(state => state.session?.user.role);
  const [month, setMonth] = useState(clinicToday().slice(0, 7)); const [facilityId, setFacility] = useState('');
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(20);
  const options = useApiResource<AttendanceOptions>('/attendance/options');
  const resource = useApiResource<PageResult<ImportBatch>>('/attendance/imports', { month, facilityId, page, pageSize });
  return <AttendanceShell title="Nhập chấm công" description="Theo dõi tệp máy chấm công, kết quả kiểm tra và các dòng còn cần xử lý."
    actions={role === 'hr_staff' && <Link className="button primary" to="/attendance/imports/new">Nhập tệp mới</Link>}>
    <section className="operations-panel"><div className="operations-filters"><label htmlFor="import-month">Tháng<input id="import-month" type="month" value={month} onChange={event => { setMonth(event.target.value); setPage(1); }} /></label><label htmlFor="import-facility">Cơ sở<select id="import-facility" value={facilityId} onChange={event => { setFacility(event.target.value); setPage(1); }}><option value="">Tất cả cơ sở</option>{options.data?.facilities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
      <ResourceState loading={resource.loading || options.loading} error={resource.error || options.error} reload={() => { resource.reload(); options.reload(); }} />
      {resource.data && <><DataTable rows={resource.data.items} rowKey={item => item.id} emptyMessage="Chưa có đợt nhập phù hợp." columns={[
        { key: 'file', label: 'Tệp nguồn', render: item => <Link to={`/attendance/imports/${item.id}/preview`}>{item.fileName}</Link> },
        { key: 'facility', label: 'Cơ sở / nguồn', render: item => <>{options.data?.facilities.find(x => x.id === item.facilityId)?.name || '—'}<small className="table-secondary">{item.deviceSource || 'Máy chấm công'}</small></> },
        { key: 'month', label: 'Tháng', render: item => item.payMonth },
        { key: 'total', label: 'Dòng / đã lưu / lỗi', render: item => `${item.totalRows ?? 0} / ${item.successRows ?? 0} / ${item.errorRows ?? 0}` },
        { key: 'date', label: 'Thời điểm nhập', render: item => instant(item.importDate) },
        { key: 'status', label: 'Trạng thái', render: item => attendanceLabel(item.status) },
        { key: 'actions', label: 'Thao tác', render: item => <div className="operations-actions"><Link className="button" to={`/attendance/imports/${item.id}/preview`}>Xem trước</Link><Link className="button" to={`/attendance/imports/${item.id}/errors`}>Kết quả lỗi</Link></div> },
      ]} /><Pagination total={resource.data.total} page={resource.data.page} pageSize={resource.data.pageSize} label="đợt nhập" onPageChange={setPage} onPageSizeChange={size => { setPageSize(size); setPage(1); }} /></>}
    </section>
  </AttendanceShell>;
}
