import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AttendanceShell from '../../components/attendance/AttendanceShell';
import AttendanceImportAnalysis from '../../components/attendance/AttendanceImportAnalysis';
import ResourceState from '../../components/attendance/ResourceState';
import useApiResource from '../../hooks/useApiResource';
import { attendanceApi } from '../../services/attendanceApi';
import { useAuthStore } from '../../store/useAuthStore';
import type { AttendanceOptions, ImportAnalysis, ImportAnalysisQuery } from '../../types/attendance';
import { clinicToday } from '../../utils/schedule';

const columns: [string, string][] = [['date', 'Ngày công'], ['device', 'Mã nhân viên trên máy'], ['in1', 'Vào lần 1'], ['out1', 'Ra lần 1'], ['in2', 'Vào lần 2'], ['out2', 'Ra lần 2'], ['in3', 'Vào lần 3'], ['out3', 'Ra lần 3'], ['hours', 'Tổng giờ máy báo'], ['late', 'Đi muộn'], ['early', 'Về sớm'], ['symbol', 'Ký hiệu công'], ['shift', 'Ca']];
const initialQuery: ImportAnalysisQuery = { status: '', errorCode: '', page: 1, pageSize: 20 };

export default function AttendanceImportUploadPage() {
  const navigate = useNavigate();
  const actor = useAuthStore(state => state.session?.user);
  const options = useApiResource<AttendanceOptions>('/attendance/options');
  const [month, setMonth] = useState(clinicToday().slice(0, 7));
  const monthEdited = useRef(false);
  const [facilityId, setFacility] = useState('');
  const [deviceSource, setDeviceSource] = useState('');
  const [file, setFile] = useState<File>();
  const [mapping, setMapping] = useState<Record<string, number>>({});
  const [dateOrder, setDateOrder] = useState('auto');
  const [analysis, setAnalysis] = useState<ImportAnalysis>();
  const [query, setQuery] = useState(initialQuery);
  const [analyzing, setAnalyzing] = useState(false);
  const [staging, setStaging] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<{ generation: number; controller?: AbortController }>({ generation: 0 });
  const stagingRequest = useRef(false);

  function invalidateAnalysis() {
    request.current.generation += 1;
    request.current.controller?.abort();
    setAnalysis(undefined); setAnalyzing(false); setError(''); setQuery(initialQuery);
  }

  useEffect(() => {
    invalidateAnalysis();
    if (!monthEdited.current && options.data?.serverNow) {
      const serverDate = new Date(options.data.serverNow);
      if (!Number.isNaN(serverDate.getTime())) setMonth(new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' }).format(serverDate).slice(0, 7));
    }
  }, [options.data, actor?.id, actor?.role]);
  useEffect(() => () => { request.current.generation += 1; request.current.controller?.abort(); }, []);

  function validateSource() {
    if (!file) return 'Chọn tệp chấm công cần đọc.';
    if (!/\.(xlsx|xls)$/i.test(file.name) || !file.size || file.size > 10 * 1024 * 1024) return 'Chọn tệp .xls hoặc .xlsx từ 1 byte đến 10 MB.';
    if (!facilityId || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return 'Chọn cơ sở và tháng chấm công.';
    if (Object.keys(mapping).length && (!mapping.date || !Object.keys(mapping).some(key => /^(in|out)[123]$/.test(key)))) return 'Khi ánh xạ thủ công, cần chọn cột Ngày công và cột Vào/Ra.';
    if (new Set(Object.values(mapping)).size !== Object.keys(mapping).length) return 'Mỗi trường phải sử dụng một cột riêng. Kiểm tra các số cột bị trùng.';
    return '';
  }

  async function analyze(nextQuery: ImportAnalysisQuery = initialQuery, nextMonth = month) {
    if (stagingRequest.current) return;
    const validation = validateSource();
    if (validation || !file) { setError(validation); return; }
    request.current.controller?.abort();
    const controller = new AbortController();
    const generation = ++request.current.generation;
    request.current.controller = controller;
    setError(''); setAnalyzing(true); setQuery(nextQuery);
    try {
      const result = await attendanceApi.analyze(file, facilityId, nextMonth, deviceSource, mapping, dateOrder, nextQuery, controller.signal);
      if (generation === request.current.generation && !controller.signal.aborted) setAnalysis(result);
    } catch (cause) {
      if (generation === request.current.generation && !controller.signal.aborted) {
        setAnalysis(undefined);
        setError(cause instanceof Error ? cause.message : 'Không đọc được tệp chấm công.');
      }
    } finally {
      if (generation === request.current.generation && !controller.signal.aborted) setAnalyzing(false);
    }
  }

  function submit(event: FormEvent) { event.preventDefault(); void analyze(); }
  function useSuggestedMonth(nextMonth: string) {
    invalidateAnalysis(); monthEdited.current = true; setMonth(nextMonth);
    void analyze(initialQuery, nextMonth);
  }
  async function stage() {
    if (!file || !analysis?.canStage || analyzing || stagingRequest.current) return;
    stagingRequest.current = true; setStaging(true); setError('');
    const generation = request.current.generation;
    try {
      const result = await attendanceApi.upload(file, facilityId, month, deviceSource, mapping, dateOrder);
      if (generation === request.current.generation) navigate(`/attendance/imports/${result.id}/preview`, { state: { notice: result.message } });
    } catch (cause) {
      if (generation === request.current.generation) {
        setAnalysis(current => current ? { ...current, canStage: false } : current);
        setError(`${cause instanceof Error ? cause.message : 'Không tạo được đợt nhập.'} Hãy đọc lại tệp để kiểm tra trạng thái tháng trước khi tạo lại đợt nhập.`);
      }
    } finally { stagingRequest.current = false; setStaging(false); }
  }

  return <AttendanceShell title="Nhập tệp chấm công" description="Đọc tệp để kiểm tra ngày công, nhân viên và các cặp Vào/Ra. Bạn có thể xem lỗi trước khi tạo đợt nhập."
    actions={<Link className="button" to="/attendance/imports">Lịch sử nhập</Link>}>
    <ResourceState {...options} />
    {error && <p className="alert error" role="alert">{error}</p>}
    <form className="operations-panel operations-form" onSubmit={submit}><fieldset disabled={staging || options.loading || !!options.error}>
      <div className="operations-grid">
        <label htmlFor="upload-facility">Cơ sở<select id="upload-facility" required value={facilityId} onChange={event => { invalidateAnalysis(); setFacility(event.target.value); }}><option value="">Chọn cơ sở</option>{options.data?.facilities.filter(item => item.status === 'active').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label htmlFor="upload-month">Tháng chấm công<input id="upload-month" type="month" required min="2000-01" value={month} onChange={event => { invalidateAnalysis(); monthEdited.current = true; setMonth(event.target.value); }} /></label>
        <label htmlFor="upload-date-order">Định dạng ngày trong tệp<select id="upload-date-order" value={dateOrder} onChange={event => { invalidateAnalysis(); setDateOrder(event.target.value); }}><option value="auto">Tự nhận diện từ dữ liệu</option><option value="dmy">Ngày / tháng / năm (D/M/YYYY)</option><option value="mdy">Tháng / ngày / năm (M/D/YYYY)</option></select></label>
        <label htmlFor="upload-device">Nguồn / máy chấm công<input id="upload-device" maxLength={100} value={deviceSource} onChange={event => { invalidateAnalysis(); setDeviceSource(event.target.value); }} placeholder="Ví dụ: Máy số 1 – Cơ sở 1" /></label>
        <label htmlFor="upload-file">Tệp Excel<input id="upload-file" type="file" accept=".xlsx,.xls" required onChange={event => { invalidateAnalysis(); setFile(event.target.files?.[0]); }} /></label>
      </div>
      <p className="operations-note">Hỗ trợ .xls và .xlsx, tối đa 10 MB và 10.000 dòng ngày công. Hệ thống nhận diện ngày, tối đa ba cặp Vào/Ra, giờ máy báo và ký hiệu; các tổng đầu bảng không được dùng thay cho ngày công đã xác nhận.</p>
      <p className="operations-note">Ví dụ 8/1/2026 có thể là 01/08 hoặc 08/01. Nếu tệp chỉ có ngày dễ nhầm và không đủ căn cứ nhận diện, hãy chọn đúng định dạng ngày; hệ thống giữ các ngày chưa rõ trong kết quả lỗi.</p>
      <details><summary>Chọn cột thủ công khi tệp có tiêu đề khác</summary><p className="operations-note">Để trống để nhận diện tự động. Khi chọn thủ công, khai báo Ngày công và toàn bộ cặp Vào/Ra cần đọc; mỗi trường dùng một cột riêng. Số cột tính từ 1; ví dụ A là 1, B là 2. Với tệp có khối Mã nhân viên, có thể bỏ trống cột mã.</p>
        <div className="operations-grid">{columns.map(([key, label]) => <label key={key} htmlFor={`mapping-${key}`}>{label}<input id={`mapping-${key}`} type="number" min={1} max={256} value={mapping[key] || ''} onChange={event => { invalidateAnalysis(); const value = event.target.value; setMapping(current => { const next = { ...current }; if (value) next[key] = Number(value); else delete next[key]; return next; }); }} /></label>)}</div>
      </details>
      <p className="operations-note">Đọc và xem trước chưa tạo đợt nhập hay lưu ngày công. Tháng đã khóa vẫn xem được kết quả kiểm tra tệp.</p>
      <div className="form-actions"><Link className="button" to="/attendance/imports">Hủy</Link><button id="analyze-attendance-file" className="button primary" type="submit" disabled={analyzing || !file}>{analyzing ? 'Đang đọc và kiểm tra tệp…' : 'Đọc tệp và xem trước'}</button></div>
    </fieldset></form>
    {analyzing && <p className="directory-loading" role="status">Đang đọc và kiểm tra tệp…</p>}
    {analysis && <AttendanceImportAnalysis data={analysis} facilityName={options.data?.facilities.find(item => item.id === analysis.facilityId)?.name}
      query={query} busy={analyzing || staging} staging={staging} onQueryChange={next => void analyze(next)} onSuggestedMonth={useSuggestedMonth} onStage={() => void stage()} onMappingSaved={() => void analyze(query)} />}
  </AttendanceShell>;
}
