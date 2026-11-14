import { useState } from 'react';
import { Link } from 'react-router-dom';
import AttendanceShell from '../../components/attendance/AttendanceShell';
import AttendanceFilters, { type AttendanceSearch } from '../../components/attendance/AttendanceFilters';
import ResourceState from '../../components/attendance/ResourceState';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import useApiResource from '../../hooks/useApiResource';
import { useAuthStore } from '../../store/useAuthStore';
import type { AttendanceList, AttendanceOptions } from '../../types/attendance';
import { clinicToday, shortDate } from '../../utils/schedule';
import { attendanceLabel, clockTime } from '../../utils/attendance';

export default function AttendanceRecordListPage() {
  const role = useAuthStore(state => state.session?.user.role);
  const [filter, setFilter] = useState<AttendanceSearch>({
    month: clinicToday().slice(0, 7),
    facilityId: '',
    departmentId: '',
    staffId: '',
    search: '',
    status: '',
    source: '',
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const options = useApiResource<AttendanceOptions>('/attendance/options');
  const resource = useApiResource<AttendanceList>('/attendance/records', { ...filter, page, pageSize });
  const data = resource.data;

  return (
    <AttendanceShell
      title="Bảng chấm công"
      description="Tra cứu ngày công, đối chiếu nguồn chấm công (4.11), nhập thủ công (4.12) và xác nhận ngày công (4.13)."
      actions={
        role === 'hr_staff' && (
          <>
            <Link className="button" to="/attendance/records/new">
              Nhập thủ công (4.12)
            </Link>
            <Link className="button" to={`/attendance/monthly?month=${filter.month}`}>
              Chốt công tháng (4.14)
            </Link>
            <Link className="button primary" to="/attendance/imports/new">
              Nhập tệp chấm công
            </Link>
          </>
        )
      }
    >
      <section className="operations-panel">
        <AttendanceFilters
          value={filter}
          options={options.data}
          change={value => {
            setFilter(value);
            setPage(1);
          }}
        />
        <ResourceState
          loading={resource.loading || options.loading}
          error={resource.error || options.error}
          reload={() => {
            resource.reload();
            options.reload();
          }}
        />
        {data && (
          <>
            <div className="operations-stats">
              <span>
                <strong>{data.counts.confirmed}</strong>Đã xác nhận
              </span>
              <span>
                <strong>{data.counts.unconfirmed}</strong>Chưa xác nhận
              </span>
              <span>
                <strong>{data.counts.flagged}</strong>Cần đối chiếu
              </span>
              {typeof data.counts.reconciled === 'number' && (
                <span>
                  <strong>{data.counts.reconciled}</strong>Chờ xác nhận (4.13)
                </span>
              )}
            </div>
            {data.lockedReason && (
              <p className="alert warning">{data.lockedReason} Có thể tiếp tục xem dữ liệu và lịch sử.</p>
            )}
            <DataTable
              rows={data.items}
              rowKey={item => item.id}
              emptyMessage="Không tìm thấy bản ghi chấm công phù hợp."
              columns={[
                {
                  key: 'employee',
                  label: 'Nhân viên',
                  render: item => (
                    <>
                      <Link to={`/attendance/records/${item.id}`}>{item.staffName}</Link>
                      <small className="table-secondary">
                        {item.staffCode} · {item.departmentName || 'Chưa phân khoa'}
                      </small>
                    </>
                  ),
                },
                {
                  key: 'date',
                  label: 'Ngày / ca',
                  render: item => (
                    <>
                      {shortDate(item.workDate, true)}
                      <small className="table-secondary">{attendanceLabel(item.shiftType)}</small>
                    </>
                  ),
                },
                { key: 'facility', label: 'Cơ sở', render: item => item.facilityName || 'Chưa xác định' },
                { key: 'time', label: 'Vào / ra', render: item => `${clockTime(item.checkIn)} – ${clockTime(item.checkOut)}` },
                { key: 'hours', label: 'Giờ ghi nhận', render: item => item.actualHours?.toLocaleString('vi-VN') ?? '—' },
                { key: 'source', label: 'Nguồn', render: item => attendanceLabel(item.source) },
                {
                  key: 'status',
                  label: 'Trạng thái',
                  render: item => (
                    <span className={`att-badge ${item.status}`}>
                      {attendanceLabel(item.status)}
                    </span>
                  ),
                },
                {
                  key: 'action',
                  label: 'Thao tác',
                  render: item => (
                    <Link className="button" to={`/attendance/records/${item.id}`}>
                      {role === 'hr_staff' && item.status !== 'confirmed' ? 'Đối chiếu / XN' : 'Chi tiết'}
                    </Link>
                  ),
                },
              ]}
            />
            <p className="operations-note">
              Số giờ nhập và tổng dòng chỉ phục vụ đối chiếu. Chỉ dữ liệu đã xác nhận mới đủ điều kiện tính lương.
            </p>
            <Pagination
              total={data.total}
              page={data.page}
              pageSize={data.pageSize}
              label="bản ghi"
              disabled={resource.loading}
              onPageChange={setPage}
              onPageSizeChange={size => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </section>
    </AttendanceShell>
  );
}
