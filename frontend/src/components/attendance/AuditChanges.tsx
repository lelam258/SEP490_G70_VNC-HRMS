import type { ReactNode } from 'react';
import { attendanceLabel } from '../../utils/attendance';

const labels: Record<string, string> = {
  staffId: 'Nhân viên', facilityId: 'Cơ sở', departmentId: 'Khoa/phòng', userId: 'Tài khoản',
  confirmedBy: 'Người xác nhận', reconciledBy: 'Người đối chiếu', correctedBy: 'Người điều chỉnh',
  lockedBy: 'Người khóa', recordedBy: 'Người ghi nhận', actorId: 'Người thao tác',
  workDate: 'Ngày làm việc', payMonth: 'Tháng công', shiftType: 'Ca làm việc', shift: 'Ca làm việc',
  status: 'Trạng thái', pairs: 'Các cặp Vào/Ra', correctionReason: 'Lý do điều chỉnh',
  reason: 'Lý do', note: 'Ghi chú', rowId: 'Mã dòng nhập', actualHours: 'Giờ làm thực tế',
  source: 'Nguồn', checkIn: 'Giờ vào', checkOut: 'Giờ ra', in: 'Vào', out: 'Ra',
  action: 'Phương án xử lý', reconcileNote: 'Ghi chú đối chiếu', fullName: 'Họ tên',
  staffCode: 'Mã nhân viên', username: 'Tên đăng nhập', role: 'Vai trò', detail: 'Nội dung',
};
const aliases: Record<string, string> = { validationstatus: 'status', timepairsjson: 'pairs' };

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => {
      const name = key.charAt(0).toLowerCase() + key.slice(1);
      if (name.toLowerCase() === 'timepairsjson' && typeof item === 'string') {
        try { item = JSON.parse(item); } catch { /* Preserve legacy text that is not JSON. */ }
      }
      return [aliases[name.toLowerCase()] || name, normalize(item)];
    }));
  }
  return value;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const technicalFields = new Set(['id', 'rowId', 'entityId', 'importId', 'weekId', 'coverageId', 'attendanceId', 'onCallShiftId', 'version', 'expectedVersion']);

function display(value: unknown, field = '', references: Record<string, string> = {}): ReactNode {
  if (value === null || value === undefined || value === '') return 'Chưa có';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (Array.isArray(value)) return value.length
    ? <ol className="audit-value-list">{value.map((item, index) => <li key={index}>{display(item, field, references)}</li>)}</ol> : 'Không có';
  if (typeof value === 'object') return <dl className="audit-value-fields">{Object.entries(value).filter(([key]) => !technicalFields.has(key)).map(([key, item]) =>
    <div key={key}><dt>{labels[key] || key}</dt><dd>{display(item, key, references)}</dd></div>)}</dl>;
  if (typeof value === 'string') {
    if (uuid.test(value)) return references[`${field.toLowerCase()}:${value.toLowerCase()}`] || 'Không có thông tin tên';
    if (field === 'in' || field === 'out' || field === 'checkIn' || field === 'checkOut') {
      const match = value.match(/^\d{4}-\d{2}-\d{2}T(\d{2}:\d{2}(?::\d{2})?)/);
      if (match) return match[1];
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split('-').reverse().join('/');
    if (['status', 'shiftType', 'shift', 'source', 'action'].includes(field)) return attendanceLabel(value);
  }
  return String(value);
}

function fields(value: unknown): Record<string, unknown> {
  const normalized = normalize(value);
  return normalized && typeof normalized === 'object' && !Array.isArray(normalized)
    ? normalized as Record<string, unknown> : normalized == null ? {} : { detail: normalized };
}

export default function AuditChanges({ before, after, references = {} }: { before: unknown; after: unknown; references?: Record<string, string> }) {
  const oldFields = fields(before);
  const newFields = fields(after);
  const keys = [...new Set([...Object.keys(oldFields), ...Object.keys(newFields)])].filter(key => !technicalFields.has(key));
  return <section aria-label="So sánh thay đổi">
    <h3>Nội dung thay đổi</h3>
    <p className="operations-note">“Không ghi nhận” nghĩa là sự kiện không lưu trường này, không đồng nghĩa dữ liệu đã bị xóa. Hàng tô màu có giá trị thay đổi ở cả hai phía.</p>
    {keys.length ? <div className="audit-comparison-scroll"><table className="audit-comparison">
      <thead><tr><th scope="col">Thông tin</th><th scope="col">Trước thay đổi</th><th scope="col">Sau thay đổi</th></tr></thead>
      <tbody>{keys.map(key => <tr key={key} className={key in oldFields && key in newFields && JSON.stringify(oldFields[key]) !== JSON.stringify(newFields[key]) ? 'audit-changed' : undefined}>
        <th scope="row">{labels[key] || key}</th>
        <td>{key in oldFields ? display(oldFields[key], key, references) : 'Không ghi nhận'}</td>
        <td>{key in newFields ? display(newFields[key], key, references) : 'Không ghi nhận'}</td>
      </tr>)}</tbody>
    </table></div> : <p>Sự kiện không lưu nội dung trước/sau thay đổi.</p>}
    <details className="audit-raw"><summary>Xem JSON chi tiết</summary>
      <h4>Trước thay đổi</h4><pre className="operations-json">{JSON.stringify(before, null, 2) ?? '—'}</pre>
      <h4>Sau thay đổi</h4><pre className="operations-json">{JSON.stringify(after, null, 2) ?? '—'}</pre>
    </details>
  </section>;
}
