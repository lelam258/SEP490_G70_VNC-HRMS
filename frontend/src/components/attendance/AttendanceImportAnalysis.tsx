import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../ui/DataTable';
import Pagination from '../ui/Pagination';
import Modal from '../ui/Modal';
import type { ImportAnalysis, ImportAnalysisQuery, ImportRow } from '../../types/attendance';
import { attendanceLabel, clockTime } from '../../utils/attendance';
import { shortDate } from '../../utils/schedule';
import ImportIdentityResolver from './ImportIdentityResolver';

const issueLabels: Record<string, string> = {
  unknown_device: 'Mã máy chưa khớp', ambiguous_device: 'Mã máy bị trùng', malformed_date: 'Ngày sai / chưa rõ định dạng',
  invalid_time: 'Thiếu/sai giờ', repeated_time_pairs: 'Máy lặp cặp Vào/Ra', cross_month: 'Khác tháng',
  existing_record: 'Trùng bản ghi đã lưu', duplicate_file: 'Trùng trong tệp', facility_conflict: 'Khác cơ sở',
  shift_conflict: 'Không khớp ca đã công bố', leave_conflict: 'Trùng nghỉ phép', needs_reconciliation: 'Cần đối chiếu',
  inactive_staff: 'Nhân viên/khoa không hoạt động', future_date: 'Ngày tương lai', future_time: 'Giờ thực tế tương lai',
  employment_dates: 'Ngoài thời gian công tác', invalid_shift: 'Ca không hợp lệ', inactive_facility: 'Cơ sở ngừng hoạt động',
};

export default function AttendanceImportAnalysis({ data, facilityName, query, busy, staging, onQueryChange, onSuggestedMonth, onStage, onMappingSaved }: {
  data: ImportAnalysis; facilityName?: string; query: ImportAnalysisQuery; busy: boolean; staging: boolean;
  onQueryChange: (query: ImportAnalysisQuery) => void; onSuggestedMonth: (month: string) => void; onStage: () => void; onMappingSaved: () => void;
}) {
  const [inspect, setInspect] = useState<ImportRow>();
  const pendingIdentity = data.identity?.unresolvedRows || 0;
  const sourceQuality = data.sourceTimeQuality;
  useEffect(() => { setInspect(undefined); }, [data]);
  return <>
    <section id="attendance-import-analysis" className="operations-panel" aria-labelledby="attendance-analysis-title" aria-busy={busy}>
      <h2 id="attendance-analysis-title">Kết quả đọc tệp · {data.fileName}</h2>
      <p>Tháng chọn: <strong>{data.payMonth}</strong> · {facilityName || 'Cơ sở đã chọn'} · {data.deviceSource || 'Máy chấm công'}</p>
      <p>Ngày công trong tệp: <strong>{data.dateFrom ? shortDate(data.dateFrom, true) : 'Chưa xác định'} – {data.dateTo ? shortDate(data.dateTo, true) : 'Chưa xác định'}</strong>.</p>
      <p className="operations-note">Định dạng ngày nguồn: {data.dateOrder === 'mdy' ? 'Tháng / ngày / năm' : data.dateOrder === 'dmy' ? 'Ngày / tháng / năm' : 'Tự nhận diện từ dữ liệu'}. Giờ tính là thời lượng chấm công, chưa phải giờ được trả lương.</p>
      <div className="operations-stats"><span><strong>{data.totalRows}</strong>dòng ngày công</span><span><strong>{data.employeeCodes}</strong>mã nhân viên trên máy</span>{data.identity ? <><span><strong>{data.identity.mappedCodes}/{data.employeeCodes}</strong>mã đã liên kết</span><span><strong>{pendingIdentity}</strong>dòng chờ liên kết</span><span><strong>{data.otherErrorRows ?? 0}</strong>dòng có lỗi khác</span><span><strong>{data.counts.warning}</strong>dòng cần đối chiếu</span><span><strong>{data.counts.valid}</strong>dòng hợp lệ</span></> : Object.entries(data.counts).map(([key, count]) => <span key={key}><strong>{count}</strong>{attendanceLabel(key)}</span>)}</div>
      {pendingIdentity > 0 && <div id="import-identity-summary" className="alert warning"><p><strong>Việc cần làm trước: đối chiếu {data.identity?.unresolvedCodes} mã máy.</strong> {pendingIdentity} dòng đang chờ liên kết nhân viên. Bạn không cần sửa từng ngày công; liên kết một mã sẽ kiểm tra lại tất cả dòng thuộc mã đó.</p><a className="button" href="#import-identity-resolver">Liên kết ngay tại đây</a></div>}
      {data.sourceMonths.length > 0 && <p>Tháng có trong dữ liệu ngày công: {data.sourceMonths.map(item => `${item.month} (${item.rows} dòng)`).join(', ')}.</p>}
      {data.suggestedMonth && data.suggestedMonth !== data.payMonth && <div className="alert warning" role="status"><p>Dữ liệu ngày công được nhận diện thuộc tháng {data.suggestedMonth}. Chọn tháng này để kiểm tra lại các dòng.</p><button id="use-source-month" className="button" type="button" disabled={busy} onClick={() => onSuggestedMonth(data.suggestedMonth!)}>Dùng tháng {data.suggestedMonth}</button></div>}
      {data.lockedReason && <div id="import-period-blocker" className="alert warning" role="status"><p><strong>Kỳ {data.payMonth} chưa cho phép lưu.</strong> Đây là điều kiện của kỳ, tách biệt với chất lượng tệp và liên kết nhân viên.</p><p>{data.lockedReason.replace(' theo GB-59', '')}</p><p>Bạn vẫn có thể hoàn thành liên kết mã máy và kiểm tra tệp. Việc điều chỉnh kỳ thuộc chức năng quản lý kỳ lương.</p></div>}
      {(data.items.some(item => item.errorCode === 'unknown_device' || item.errorCode === 'ambiguous_device') || ['unknown_device', 'ambiguous_device'].includes(query.errorCode)) && <p className="operations-note">Một số mã máy chưa xác định được nhân viên. <Link id="analysis-device-mappings" to="/attendance/device-mappings">Liên kết mã máy với nhân viên</Link>, sau đó đọc lại tệp để kiểm tra.</p>}
      <p className="operations-note">Kết quả này chưa lưu ngày công. Sau khi liên kết nhân viên và kỳ cho phép lưu, tạo đợt nhập để xử lý các dòng cần điều chỉnh rồi xác nhận lưu.</p>
      <button id="stage-attendance-import" className="button primary" type="button" disabled={busy || !data.canStage} onClick={onStage}>{staging ? 'Đang tạo đợt nhập…' : 'Tạo đợt nhập'}</button>
      {!data.canStage && <p id="import-stage-help" className="operations-note">{data.suggestedMonth ? 'Chọn đúng tháng nguồn rồi kiểm tra lại.' : 'Nút này chưa dùng được vì kỳ đang khóa; đọc và liên kết mã máy vẫn hoạt động.'}</p>}
    </section>
    {data.identity && data.identity.unresolvedCodes > 0 && <ImportIdentityResolver identities={data.identity.items} busy={busy} onSaved={onMappingSaved} />}
    {sourceQuality && <section id="import-source-quality" className="operations-panel"><h2>2. Kiểm tra giờ trong tệp</h2><p>Các số liệu này được đọc từ nguồn, kể cả khi chưa liên kết nhân viên. Đủ cặp giờ chưa đồng nghĩa với công hợp lệ hoặc công được trả lương.</p><div className="operations-stats"><span><strong>{sourceQuality.completeRows}</strong>dòng đủ cặp giờ</span><span><strong>{sourceQuality.missingTimeRows}</strong>dòng thiếu giờ vào/ra</span><span><strong>{sourceQuality.noPunchRows}</strong>dòng không có lượt chấm</span><span><strong>{sourceQuality.invalidTimeRows + sourceQuality.invalidDateRows}</strong>dòng sai ngày/giờ</span></div>{sourceQuality.reportedHourMismatchRows > 0 && <p>{sourceQuality.reportedHourMismatchRows} dòng có giờ máy báo khác thời lượng Vào/Ra; cần đối chiếu cách tính giờ, không tự coi đó là công được trả lương.</p>}{sourceQuality.repeatedPairRows > 0 && <p>{sourceQuality.repeatedPairRows} dòng lặp cặp Vào/Ra giống hệt nhau; mỗi khoảng giờ chỉ được tính một lần và vẫn cần đối chiếu.</p>}</section>}
    <section className="operations-panel" aria-label="Các dòng đọc từ tệp" aria-busy={busy}>
      <div className="operations-filters">
        <label htmlFor="analysis-row-status">Trạng thái<select id="analysis-row-status" value={query.status} disabled={busy} onChange={event => onQueryChange({ ...query, status: event.target.value, page: 1 })}><option value="">Tất cả dòng</option>{['valid', 'warning', 'error', 'duplicate'].map(item => <option key={item} value={item}>{attendanceLabel(item)}</option>)}</select></label>
        <label htmlFor="analysis-row-issue">Loại vấn đề<select id="analysis-row-issue" value={query.errorCode} disabled={busy} onChange={event => onQueryChange({ ...query, errorCode: event.target.value, page: 1 })}><option value="">Tất cả vấn đề</option>{Object.entries(issueLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div>
      <DataTable rows={data.items} rowKey={item => item.id} caption="Kết quả kiểm tra từng dòng trong tệp Excel" emptyMessage="Không có dòng phù hợp với bộ lọc." columns={[
        { key: 'source', label: 'Dòng nguồn', render: item => <>{item.sheetName} · {item.rowNumber}<small className="table-secondary">Mã máy: {item.deviceEnrollId || 'Chưa có'}</small></> },
        { key: 'staff', label: 'Nhân viên', render: item => item.staffName || 'Chưa xác định' },
        { key: 'date', label: 'Ngày / ca', render: item => <>{item.workDate ? shortDate(item.workDate, true) : item.rawDate || 'Ngày thiếu'}<small className="table-secondary">{attendanceLabel(item.shiftType)}</small></> },
        { key: 'times', label: 'Vào / ra', render: item => item.pairs.length ? item.pairs.map((pair, index) => <div key={index}>{clockTime(pair.in)} – {clockTime(pair.out)}</div>) : 'Thiếu giờ' },
        { key: 'hours', label: 'Giờ Vào/Ra / giờ máy', render: item => `${item.sourceHours ?? item.actualHours ?? '—'} / ${item.reportedHours ?? '—'}` },
        { key: 'minutes', label: 'Muộn / sớm (phút)', render: item => <>{item.lateMinutes ?? '—'} / {item.earlyMinutes ?? '—'}<small className="table-secondary">Ký hiệu: {item.attendanceSymbol || '—'}</small></> },
        { key: 'status', label: 'Kiểm tra', render: item => <>{item.errorCode === 'unknown_device' || item.errorCode === 'ambiguous_device' ? 'Chờ liên kết nhân viên' : attendanceLabel(item.validationStatus)}<small className="table-secondary">{item.validationNote || (item.errorCode ? issueLabels[item.errorCode] || item.errorCode : '')}</small></> },
        { key: 'actions', label: 'Thao tác', render: item => <button className="button" type="button" onClick={() => setInspect(item)} aria-label={`Dữ liệu gốc dòng ${item.rowNumber} ${item.sheetName}`}>Dữ liệu gốc</button> },
      ]} />
      <Pagination total={data.total} page={data.page} pageSize={data.pageSize} disabled={busy} label="dòng đọc từ tệp" onPageChange={page => onQueryChange({ ...query, page })} onPageSizeChange={pageSize => onQueryChange({ ...query, pageSize, page: 1 })} />
    </section>
    {inspect && <Modal title={`Dữ liệu gốc · Dòng ${inspect.rowNumber}`} onClose={() => setInspect(undefined)} maxWidth="760px"><div className="operations-panel"><p>{inspect.sheetName} · Dòng {inspect.rowNumber}</p><p>{inspect.employeeBlock || 'Tệp dạng danh sách nhân viên'}</p><p>Mã máy: {inspect.deviceEnrollId || '—'} · Ngày gốc: {inspect.rawDate || '—'}</p><pre className="operations-json">{JSON.stringify(inspect.rawValues, null, 2)}</pre><button className="button" type="button" onClick={() => setInspect(undefined)}>Đóng</button></div></Modal>}
  </>;
}
