import type { AttendanceOptions } from '../../types/attendance';
import { attendanceLabel } from '../../utils/attendance';

export type AttendanceSearch = { month: string; facilityId: string; departmentId: string; staffId: string; search: string; status: string; source: string };
export default function AttendanceFilters({ value, options, change, onCall = false }: {
  value: AttendanceSearch; options?: AttendanceOptions; change: (value: AttendanceSearch) => void; onCall?: boolean;
}) {
  const update = (key: keyof AttendanceSearch, next: string) => change({ ...value, [key]: next, ...(key === 'departmentId' ? { staffId: '' } : {}) });
  return <div className="operations-filters">
    <label htmlFor="attendance-month">Tháng<input id="attendance-month" type="month" required min="2000-01" max="9998-12" value={value.month} onChange={event => { if (event.target.value) update('month', event.target.value); }} /></label>
    <label htmlFor="attendance-facility">Cơ sở<select id="attendance-facility" value={value.facilityId} onChange={event => update('facilityId', event.target.value)}><option value="">Tất cả cơ sở</option>{options?.facilities.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label htmlFor="attendance-department">Khoa/phòng<select id="attendance-department" value={value.departmentId} onChange={event => update('departmentId', event.target.value)}><option value="">Tất cả khoa/phòng</option>{options?.departments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label htmlFor="attendance-staff">Nhân viên<select id="attendance-staff" value={value.staffId} onChange={event => update('staffId', event.target.value)}><option value="">Tất cả nhân viên được xem</option>{options?.staff.filter(item => !value.departmentId || item.departmentId === value.departmentId).map(item => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}</select></label>
    <label htmlFor="attendance-search">Mã / tên nhân viên<input id="attendance-search" type="search" maxLength={100} value={value.search} onChange={event => update('search', event.target.value)} /></label>
    <label htmlFor="attendance-status">Trạng thái<select id="attendance-status" value={value.status} onChange={event => update('status', event.target.value)}><option value="">Tất cả trạng thái</option>{(onCall ? ['pending', 'confirmed', 'rejected', 'cancelled'] : ['imported', 'pending', 'flagged', 'confirmed']).map(item => <option key={item} value={item}>{attendanceLabel(item)}</option>)}</select></label>
    {!onCall && <label htmlFor="attendance-source">Nguồn<select id="attendance-source" value={value.source} onChange={event => update('source', event.target.value)}><option value="">Tất cả nguồn</option>{['machine', 'manual', 'on_call'].map(item => <option key={item} value={item}>{attendanceLabel(item)}</option>)}</select></label>}
  </div>;
}
