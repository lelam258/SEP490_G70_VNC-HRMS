import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AttendanceShell from '../../components/attendance/AttendanceShell';
import AttendanceFilters, { type AttendanceSearch } from '../../components/attendance/AttendanceFilters';
import ResourceState from '../../components/attendance/ResourceState';
import DataTable from '../../components/ui/DataTable';
import Pagination from '../../components/ui/Pagination';
import Modal from '../../components/ui/Modal';
import { attendanceApi } from '../../services/attendanceApi';
import useApiResource from '../../hooks/useApiResource';
import { useAuthStore } from '../../store/useAuthStore';
import type { AttendanceItem, AttendanceList, AttendanceOptions, BulkAttendanceReview, BulkAttendanceResult, BulkAttendanceFailure } from '../../types/attendance';
import { clinicToday, shortDate } from '../../utils/schedule';
import { attendanceLabel, clockTime, formatAttendanceNote, lastAttendanceMonth, rememberAttendanceMonth } from '../../utils/attendance';

export default function AttendanceRecordListPage() {
  const role = useAuthStore(state => state.session?.user.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const [filter, setFilter] = useState<AttendanceSearch>({
    month: searchParams.get('month') || lastAttendanceMonth(clinicToday().slice(0, 7)),
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [review, setReview] = useState<BulkAttendanceReview>();
  const [reviewMonth, setReviewMonth] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [reason, setReason] = useState('');
  const [bulkResult, setBulkResult] = useState<(BulkAttendanceResult & { skipped: BulkAttendanceFailure[] })>();
  const selectable = (item: AttendanceItem) => ['imported', 'pending', 'reconciled'].includes(item.status);
  const pageIds = data?.items.filter(selectable).map(item => item.id) || [];
  async function prepareBulk(allMatching: boolean) {
    if (bulkBusy) return;
    setBulkBusy(true); setBulkError(''); setBulkResult(undefined); setReviewConfirmed(false); setReason('');
    try {
      const selection = allMatching ? { month: filter.month, filter: { ...filter, facilityId: filter.facilityId || null,
        departmentId: filter.departmentId || null, staffId: filter.staffId || null } } : { month: filter.month, ids: [...selected] };
      const result = await attendanceApi.previewBulkVerify(selection);
      setReviewMonth(filter.month); setReview(result);
    } catch (error) { setBulkError(error instanceof Error ? error.message : 'Không rà soát được các dòng đã chọn.'); }
    finally { setBulkBusy(false); }
  }
  async function confirmBulk() {
    if (!review || !reviewConfirmed || bulkBusy || !review.items.length) return;
    setBulkBusy(true); setBulkError('');
    try {
      const result = await attendanceApi.bulkVerify(reviewMonth, review.items.map(({ id, version }) => ({ id, version })), reason.trim());
      setBulkResult({ ...result, skipped: review.skipped }); setReview(undefined); setSelected(new Set()); resource.reload();
    } catch (error) { setBulkError(error instanceof Error ? error.message : 'Không xác nhận được các dòng đã chọn.'); }
    finally { setBulkBusy(false); }
  }

  return (
    <AttendanceShell layout="list"
      title="Bảng chấm công"
      description="Tra cứu ngày công, đối chiếu nguồn chấm công, nhập thủ công và xác nhận ngày công."
      actions={
        role === 'hr_staff' && (
          <>
            <Link className="button" to="/attendance/records/new">
              Nhập thủ công
            </Link>
            <Link className="button" to={`/attendance/monthly?month=${filter.month}`}>
              Chốt công tháng
            </Link>
            <Link className="button primary" to="/attendance/imports/new">
              Nhập tệp chấm công
            </Link>
          </>
        )
      }
    >
      <section className="operations-panel workspace-list-panel">
        <fieldset disabled={bulkBusy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><AttendanceFilters
          value={filter}
          options={options.data}
          change={value => {
            setSelected(new Set()); setReview(undefined); setBulkResult(undefined); setBulkError('');
            rememberAttendanceMonth(value.month);
            const next = new URLSearchParams(searchParams); next.set('month', value.month); setSearchParams(next, { replace: true });
            setFilter(value);
            setPage(1);
          }}
        /></fieldset>
        {bulkError && <p className="alert error" role="alert">{formatAttendanceNote(bulkError)}</p>}
        {bulkResult && <section className="operations-panel" aria-label="Kết quả xác nhận hàng loạt">
          <p role="status">Đã xác nhận {bulkResult.confirmed} dòng. Không xác nhận được {bulkResult.failed.length} dòng. Bỏ qua khi rà soát: {bulkResult.skipped.length} dòng.</p>
          {[...bulkResult.failed, ...bulkResult.skipped].length > 0 && <details><summary>Xem các dòng chưa xác nhận</summary><ul>{[...bulkResult.failed, ...bulkResult.skipped].map(item => <li key={item.id}><Link to={`/attendance/records/${item.id}`}>{item.staffCode || 'Bản ghi'} · {item.workDate || '—'}</Link>: {formatAttendanceNote(item.message)}</li>)}</ul></details>}
        </section>}
        <ResourceState
          loading={resource.loading}
          error={resource.error}
          reload={() => {
            resource.reload();
            options.reload();
          }}
        />
        {options.error && <ResourceState loading={false} error={options.error} reload={options.reload} />}
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
                  <strong>{data.counts.reconciled}</strong>Chờ xác nhận
                </span>
              )}
            </div>
            {data.lockedReason && (
              <p className="alert warning">{formatAttendanceNote(data.lockedReason)} Có thể tiếp tục xem dữ liệu và lịch sử.</p>
            )}
            {role === 'hr_staff' && <div className="operations-actions" aria-label="Xác nhận hàng loạt">
              <button className="button" type="button" disabled={bulkBusy || !!data.lockedReason || !pageIds.length} onClick={() => setSelected(current => {
                const next = new Set(current); const remove = pageIds.every(id => next.has(id));
                pageIds.forEach(id => remove ? next.delete(id) : next.add(id)); return next;
              })}>{pageIds.length > 0 && pageIds.every(id => selected.has(id)) ? 'Bỏ chọn trang này' : 'Chọn trang này'}</button>
              <button className="button" type="button" disabled={bulkBusy || !selected.size || !!data.lockedReason} onClick={() => void prepareBulk(false)}>Rà soát {selected.size} dòng đã chọn</button>
              <button id="review-all-attendance" className="button primary" type="button" disabled={bulkBusy || !!data.lockedReason || !data.counts.unconfirmed} onClick={() => void prepareBulk(true)}>{bulkBusy ? 'Đang xử lý…' : `Rà soát ${data.counts.unconfirmed} dòng chưa xác nhận theo bộ lọc`}</button>
            </div>}
            <DataTable
              rows={data.items}
              rowKey={item => item.id}
              emptyMessage="Không tìm thấy bản ghi chấm công phù hợp."
              columns={[
                ...(role === 'hr_staff' ? [{ key: 'select', label: 'Chọn', render: (item: AttendanceItem) => <input type="checkbox" aria-label={`Chọn ${item.staffCode} ngày ${item.workDate}`} checked={selected.has(item.id)} disabled={bulkBusy || !!data.lockedReason || !selectable(item)} onChange={event => setSelected(current => { const next = new Set(current); if (event.target.checked) next.add(item.id); else next.delete(item.id); return next; })} /> }] : []),
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
              disabled={resource.loading || bulkBusy}
              onPageChange={setPage}
              onPageSizeChange={size => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        )}
      </section>
      {review && <Modal title="Xác nhận chấm công hàng loạt" busy={bulkBusy} onClose={() => { if (!bulkBusy) setReview(undefined); }}><div className="operations-panel">
        <p>Tháng {reviewMonth}: <strong>{review.items.length} dòng có thể xác nhận</strong>, bỏ qua {review.skipped.length} dòng cần xử lý riêng. Tối đa 1.000 dòng mỗi lần.</p>
        <p>Hệ thống kiểm tra lại từng dòng khi lưu. Dòng lỗi giữ nguyên; các dòng thành công được xác nhận độc lập và ghi lịch sử.</p>
        <details><summary>Xem {review.items.length} dòng sẽ xác nhận</summary><div style={{ maxHeight: 300, overflow: 'auto' }}><ul>{review.items.map(item => <li key={item.id}>{item.staffCode} · {item.staffName} · {shortDate(item.workDate, true)} · {attendanceLabel(item.shiftType)} · {item.actualHours ?? '—'} giờ</li>)}</ul></div></details>
        {review.skipped.length > 0 && <details><summary>Các dòng bị bỏ qua</summary><ul>{review.skipped.map(item => <li key={item.id}>{item.staffCode || 'Bản ghi'} · {item.workDate || '—'}: {formatAttendanceNote(item.message)}</li>)}</ul></details>}
        <label htmlFor="bulk-attendance-reason">Ghi chú xác nhận (không bắt buộc)<textarea id="bulk-attendance-reason" maxLength={1000} value={reason} disabled={bulkBusy} onChange={event => setReason(event.target.value)} /></label>
        <label className="operations-checkbox"><input id="confirm-bulk-attendance-review" type="checkbox" checked={reviewConfirmed} disabled={bulkBusy || !review.items.length} onChange={event => setReviewConfirmed(event.target.checked)} />Tôi đã kiểm tra các dòng và đồng ý xác nhận chấm công.</label>
        {bulkError && <p className="alert error" role="alert">{formatAttendanceNote(bulkError)}</p>}
        <div className="form-actions"><button className="button" type="button" disabled={bulkBusy} onClick={() => setReview(undefined)}>Đóng</button><button id="confirm-bulk-attendance" className="button primary" type="button" disabled={bulkBusy || !reviewConfirmed || !review.items.length} onClick={() => void confirmBulk()}>{bulkBusy ? 'Đang xác nhận…' : `Xác nhận ${review.items.length} dòng`}</button></div>
      </div></Modal>}
    </AttendanceShell>
  );
}
