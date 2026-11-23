// Run with Vite on localhost:5173: node --experimental-websocket tests/verify-workspace-layout.mjs
// Uses isolated API fixtures. No application database is read or modified.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
await mkdir(resolve(root, '.local/attendance-presentation-test'), { recursive: true });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9357', `--user-data-dir=${resolve(root, '.local/attendance-presentation-test')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const guid = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const adminId = guid(1), hrId = guid(2), employeeId = guid(3), staffId = guid(10), facilityId = guid(20), departmentId = guid(30), batchId = guid(40), rowId = guid(41), recordId = guid(50), dutyId = guid(60), eventId = guid(70);
const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok' }).format(new Date());
const month = today.slice(0, 7), at = `${today}T07:00:00`, stamp = new Date().toISOString();
let actor = { id: adminId, username: 'admin.preview', name: 'Quản trị viên', role: 'admin', email: null };
let accounts = [{ id: adminId, employeeId: null, username: 'admin.preview', fullName: 'Quản trị viên', email: null, role: 'admin', status: 'active', isProvisioned: true, version: 'v1', createdAt: stamp, updatedAt: stamp, lastLogin: null },
  { id: employeeId, employeeId: staffId, username: 'staff.preview', fullName: 'Nhân viên thử nghiệm', email: null, role: 'employee', status: 'active', isProvisioned: true, version: 'v1', createdAt: stamp, updatedAt: stamp, lastLogin: null }];
const roleNames = { admin: 'Administrator', hr_manager: 'HR Manager', hr_staff: 'HR Staff', accountant: 'Accountant', department_head: 'Department Manager', employee: 'Medical Staff' };
const options = { staff: [{ id: staffId, code: 'NV01', name: 'Nhân viên thử nghiệm', departmentId, status: 'active', dateJoined: '2020-01-01', deviceEnrollId: '001' }],
  facilities: [{ id: facilityId, name: 'Cơ sở 1', status: 'active' }, { id: guid(21), name: 'Cơ sở đã ngừng', status: 'inactive' }], departments: [{ id: departmentId, name: 'Khoa Điều dưỡng', status: 'active' }], serverNow: `${today}T20:00:00+07:00` };
const record = { id: recordId, staffId, staffCode: 'NV01', staffName: 'Nhân viên thử nghiệm', departmentId, departmentName: 'Khoa Điều dưỡng', facilityId, facilityName: 'Cơ sở 1', workDate: today, shiftType: 'main', checkIn: at, checkOut: `${today}T17:00:00`, actualHours: 7.75, source: 'machine', status: 'imported', importId: batchId, onCallShiftId: null };
const pairs = [{ in: `${today}T07:00:00`, out: `${today}T09:00:00` }, { in: `${today}T09:15:00`, out: `${today}T11:30:00` }, { in: `${today}T13:30:00`, out: `${today}T17:00:00` }];
let rows = [{ id: guid(42), sheetName: 'Sheet 1', rowNumber: 4, employeeBlock: 'Mã nhân viên: 001', deviceEnrollId: '001', staffId, staffName: 'Nhân viên thử nghiệm', rawDate: today, rawValues: [today, '07:00', '11:30'], workDate: today, shiftType: 'main', pairs, actualHours: 7.75, reportedHours: 7.75, validationStatus: 'valid', errorCode: null, validationNote: null, correctionReason: null, correctedAt: null, attendanceId: null, version: 'v1' },
  { id: rowId, sheetName: 'Sheet 1', rowNumber: 5, employeeBlock: 'Mã nhân viên: 999', deviceEnrollId: '999', staffId: null, staffName: null, rawDate: today, rawValues: [today, '07:00', ''], workDate: today, shiftType: 'main', pairs: [{ in: at, out: null }], actualHours: null, reportedHours: null, validationStatus: 'error', errorCode: 'unknown_device', validationNote: 'Chọn nhân viên và ghi căn cứ xác nhận.', correctionReason: null, correctedAt: null, attendanceId: null, version: 'v1' },
  { id: guid(43), sheetName: 'Sheet 1', rowNumber: 6, employeeBlock: 'Mã nhân viên: 007', deviceEnrollId: '007', staffId, staffName: 'Người thử máy', rawDate: today, rawValues: [today, '07:00', '17:00', '07:00', '17:00', '07:00', '17:00'], workDate: today, shiftType: 'main', pairs: Array.from({ length: 3 }, () => ({ in: at, out: `${today}T17:00:00` })), actualHours: 10, reportedHours: 24, lateMinutes: 20, earlyMinutes: 2, attendanceSymbol: 'XXX', validationStatus: 'warning', errorCode: 'repeated_time_pairs', validationNote: 'Máy xuất lặp cặp Vào/Ra giống hệt nhau. Giờ chỉ tính một lần; cần đối chiếu.', correctionReason: null, correctedAt: null, attendanceId: null, version: 'v1' }];
const batch = { id: batchId, fileName: 'attendance-workflow-fixture.xlsx', payMonth: month, facilityId, deviceSource: 'Máy số 1', importedBy: hrId, importDate: stamp, totalRows: 3, successRows: 0, errorRows: 1, status: 'staged', dateOrder: 'mdy' };
let duty = { id: dutyId, staffId, staffCode: 'NV01', staffName: 'Nhân viên thử nghiệm', departmentId, departmentName: 'Khoa Điều dưỡng', facilityId, facilityName: 'Cơ sở 1', date: today, category: 'noon', start: `${today}T11:30:00`, end: `${today}T13:30:00`, status: 'pending', note: '', deviationReason: '', supervisorEvidence: '', reviewNote: 'Chờ đối chiếu bằng chứng', scheduleAssignmentId: guid(80), attendanceEvidenceId: recordId, recordedBy: hrId, confirmedBy: null, confirmedAt: null, createdAt: stamp, updatedAt: stamp, version: 'v1' };
const auditEvent = { id: eventId, createdAt: stamp, userId: adminId, actor: 'Quản trị viên', action: 'assign_role', module: 'accounts', entityType: 'User', entityId: employeeId, facilityId: null, departmentId: null, staffId: null, workDate: null, result: 'success', oldStatus: 'active', newStatus: 'active', oldValue: { role: 'employee', passwordHash: '[Đã ẩn]' }, newValue: { role: 'hr_staff' }, sourceUrl: `/accounts/${employeeId}` };
let failCorrection = true, failCommit = true, reviewRevision = 0, socket, scriptId, requestSerial = 0;
let onCallScheduled = true, onCallHasEvidence = true, onCallLockedReason = null, onCallWrites = 0;
let monthlyStatus = 'open', monthlyCanLock = true;
const waiting = new Map(), errors = [];
let checks = 0;
try {
  let pages;
  for (let i = 0; i < 50; i++) { try { pages = await (await fetch('http://127.0.0.1:9357/json/list')).json(); if (pages.length) break; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++requestSerial; waiting.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  socket.addEventListener('message', async event => {
    const message = JSON.parse(event.data);
    if (message.id) { const pending = waiting.get(message.id); if (pending) { waiting.delete(message.id); message.error ? pending.reject(message.error) : pending.resolve(message.result); } }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.method !== 'Fetch.requestPaused') return;
    const request = message.params.request, url = new URL(request.url), path = url.pathname;
    let data = {}, status = 200;
    try {
      if (path === '/api/auth/me') data = actor; else if(path==='/api/attendance/device-mappings') data={items:[{staffId,staffCode:'NV01',staffName:'Nhan vien Demo',departmentName:'Khoa Dieu duong',departmentId,status:'active',staffStatus:'active',departmentStatus:'active',deviceEnrollId:'001',version:'v1'}]};
      else if (path === '/api/users/employee-options' || path === '/api/employees') data = Array.from({length:30},(_,i)=>({id:guid(100+i),code:'NV'+i,name:'Employee '+i,departmentId,department:'Nursing',status:'active',dateJoined:'2020-01-01',email:null}));
else if(path==='/api/departments') data=Array.from({length:30},(_,i)=>({id:guid(200+i),code:'D'+i,name:'Department '+i,status:'active',staffCount:2,facilityIds:[facilityId],facilityLabel:'Facility One'}));
else if(path==='/api/contracts') data=Array.from({length:30},(_,i)=>({contractId:guid(300+i),contractCode:'HD'+i,staffId,staffCode:'NV01',staffName:'Employee One',departmentName:'Nursing',contractType:'fixed_term',displayStatus:'active',salaryType:'daily',startDate:'2026-01-01',endDate:'2027-01-01',status:'active',dailyRate:200000}));
else if(path==='/api/procedure-services/categories')data=['General'];
else if(path==='/api/procedure-services')data=Array.from({length:30},(_,i)=>({serviceId:guid(400+i),serviceCode:'TT'+i,serviceName:'Service '+i,status:'active',category:'General',basePrice:200000,slipCount:0,activeRuleCount:0}));
else if(path==='/api/payroll/periods')data=Array.from({length:30},(_,i)=>({lockId:guid(500+i),payMonth:'2026-'+String(i%12+1).padStart(2,'0'),status:'draft',employeeCount:30,totalGrossPay:10000000,totalNetPay:9000000,attendanceLocked:false,proceduresVerified:false,isLate:false,lockedAt:null,createdAt:stamp,openDate:'2026-01-28',standardLockDate:'2026-02-05',correctionDeadline:'2026-02-12'}));
      else if (path === '/api/users' && request.method === 'GET') data = accounts;
      else if (/\/api\/users\/[^/]+\/(status|role)$/.test(path)) {
        const input = JSON.parse(request.postData), account = accounts.find(item => item.id === path.split('/')[3]);
        if (path.endsWith('/status')) account.status = input.status; else account.role = input.role;
        account.version = `v${Date.now()}`; data = account;
      } else if (path === '/api/roles') data = Object.entries(roleNames).map(([id, name]) => ({ id, name, description: `Phạm vi chức năng của ${name}`, areas: ['Tra cứu dữ liệu được phép', 'Nghiệp vụ theo vai trò'], accountCount: accounts.filter(account => account.role === id).length }));
      else if (path === '/api/audit-logs/options' || path === '/api/attendance/history/options') data = { users: [{ id: adminId, name: 'Quản trị viên' }], actions: ['assign_role', 'create_on_call'], modules: ['accounts', 'attendance', 'on_call', 'schedules'], facilities: options.facilities };
      else if (path === `/api/audit-logs/${eventId}` || path === `/api/attendance/history/${eventId}`) data = auditEvent;
      else if (path === '/api/audit-logs' || path === '/api/attendance/history') data = { total: 1, page: 1, pageSize: 20, items: Array.from({length:20},(_,i)=>({...auditEvent,id:guid(600+i)})) };
      else if (path === '/api/attendance/options') data = options;
      else if (path === '/api/attendance/records') data = { total: 1, page: 1, pageSize: 20, items: Array.from({length:20},(_,i)=>({...record,id:guid(700+i)})), counts: { confirmed: 0, unconfirmed: 1, flagged: 0 }, month, lockedReason: null };
      else if (path === `/api/attendance/records/${recordId}` && request.method === 'GET') data = { item: record, pairs, machinePairs: pairs, deviceEnrollId: '001', batch, note: 'Cần đối chiếu với lịch phân công', reconcileNote: record.reconcileNote || null, reconciledAt: record.reconciledAt || null, reconciledBy: record.reconciledBy || null, confirmedAt: record.confirmedAt || null, confirmedBy: record.confirmedBy || null, actors: [{ id: hrId, name: 'HR Staff' }], createdAt: stamp, payslipId: null, lockedReason: null, schedules: [], scheduleDetails: [{ id: guid(80), facilityId, facilityName: 'Cơ sở 1', date: today, shift: 'morning', start: '07:00', end: '11:30', patientConfirmed: false, patientEvidence: null, actualEndAt: null, endNote: null }], leaves: [], onCalls: [], discrepancies: record.status === 'flagged' ? [{ code: 'source_mismatch', label: 'Lệch giờ với lịch phân công', severity: 'warning' }] : [], suggestedClassification: record.status === 'flagged' ? 'source_mismatch' : 'matched', supervisorConfirmed: false, supervisorEvidence: null, version: 'v1', events: [] };
      else if (path === `/api/attendance/records/${recordId}/reconcile` && request.method === 'POST') {
        const input = JSON.parse(request.postData);
        record.status = input.action === 'mark_unresolved' ? 'flagged' : 'reconciled';
        record.reconcileNote = input.reason; record.reconciledBy = hrId; record.reconciledAt = stamp;
        data = { id: recordId, status: record.status, actualHours: record.actualHours, message: 'MSG03: Đã đối chiếu chấm công thành công.' };
      } else if (path === `/api/attendance/records/${recordId}/verify` && request.method === 'POST') {
        const input = JSON.parse(request.postData);
        record.status = input.decision === 'return' ? 'flagged' : 'confirmed';
        record.confirmedBy = input.decision === 'confirm' ? hrId : null; record.confirmedAt = input.decision === 'confirm' ? stamp : null;
        data = { id: recordId, status: record.status, message: 'MSG03: Đã xác nhận bản ghi chấm công thành công.' };
      } else if (path === '/api/attendance/manual-context') data = { staffId, facilityId, date: url.searchParams.get('date') || today, approvedLeave: false, lockedReason: null, schedules: [{ id: guid(80), facilityId, facilityName: 'Cơ sở 1', shift: 'morning', start: '07:00', end: '11:30' }, { id: guid(82), facilityId, facilityName: 'Cơ sở 1', shift: 'afternoon', start: '13:30', end: '17:00' }], leaves: [], existingRecords: [], onCalls: [] };
      else if (path === '/api/attendance/records/manual' && request.method === 'POST') {
        data = { id: recordId, status: 'pending', flagged: false, message: 'MSG03: Đã lưu bản ghi chấm công thủ công chờ xác nhận.' };
      } else if (path === `/api/attendance/monthly-timesheets/${month}` && request.method === 'GET') {
        data = { payMonth: month, status: monthlyStatus, timesheetId: guid(90), lockedBy: monthlyStatus === 'locked' ? hrId : null, lockedByName: monthlyStatus === 'locked' ? 'HR Staff' : null, lockedAt: monthlyStatus === 'locked' ? stamp : null, consolidationOpenDate: `${month}-28`, standardLockDate: `${month}-05`, correctionDeadline: `${month}-12`, windowStatus: monthlyStatus === 'locked' ? 'locked' : 'open', lockedReason: null, consolidationLockReason: null, canLock: monthlyCanLock, version: 'v1', totals: { totalStaff: 1, confirmedMainDays: 22, confirmedNoonDuties: 4, confirmedEveningDuties: 2, confirmedHours: 188, overtimeHours: 12, paidLeaveDays: 1, unpaidLeaveDays: 0, machineRecords: 20, manualRecords: 2, confirmedRecords: 22, flaggedRecords: 0, unconfirmedRecords: 0, missingPunchRecords: 0, pendingOnCalls: 0, unaccountedScheduledShifts: 0 }, facilityTotals: [{ id: facilityId, name: 'Cơ sở 1', staffCount: 1, confirmedMainDays: 22, confirmedNoonDuties: 4, confirmedEveningDuties: 2, confirmedHours: 188, paidLeaveDays: 1, flaggedCount: 0, unconfirmedCount: 0, unaccountedScheduleCount: 0, completed: true }], departmentTotals: [{ id: departmentId, name: 'Khoa Điều dưỡng', staffCount: 1, confirmedMainDays: 22, confirmedNoonDuties: 4, confirmedEveningDuties: 2, confirmedHours: 188, paidLeaveDays: 1, flaggedCount: 0, unconfirmedCount: 0, unaccountedScheduleCount: 0, completed: true }], staffSummaries: [{ staffId, staffCode: 'NV01', staffName: 'Nhân viên thử nghiệm', departmentId, departmentName: 'Khoa Điều dưỡng', plannedMainDays: 22, confirmedMainDays: 22, confirmedNoonDuties: 4, confirmedEveningDuties: 2, confirmedHours: 188, overtimeHours: 12, paidLeaveDays: 1, unpaidLeaveDays: 0, machineRecordCount: 20, manualRecordCount: 2, flaggedCount: 0, unconfirmedCount: 0, missingPunchCount: 0, unaccountedScheduleCount: 0, readyForPayroll: true }], exceptions: [], incompleteScopes: [] };
      } else if (path === `/api/attendance/monthly-timesheets/${month}/lock` && request.method === 'POST') {
        monthlyStatus = 'locked'; monthlyCanLock = false;
        data = { id: guid(90), payMonth: month, status: 'locked', message: 'MSG03: Đã tổng hợp và khóa bảng chấm công tháng thành công.' };
      }
      else if (path === '/api/attendance/imports/analyze') data = { fileName: batch.fileName, payMonth: month, facilityId, deviceSource: batch.deviceSource, dateOrder: 'mdy',
        totalRows: rows.length, employeeCodes: 3, dateFrom: today, dateTo: today, sourceMonths: [{ month, rows: rows.length }], suggestedMonth: null, lockedReason: null, canStage: true,
        counts: Object.fromEntries(['valid', 'warning', 'error', 'duplicate'].map(status => [status, rows.filter(row => row.validationStatus === status).length])), total: rows.length, page: 1, pageSize: 20, items: rows };
      else if (path === '/api/attendance/imports' && request.method === 'POST') data = { id: batchId, reused: false, message: 'Đã đọc tệp và kiểm tra dữ liệu.' };
      else if (path === '/api/attendance/imports') data = { total: 1, page: 1, pageSize: 20, items: Array.from({length:20},(_,i)=>({...batch,id:guid(900+i)})) };
      else if (path === `/api/attendance/imports/${batchId}`) {
        const filter = url.searchParams.get('status'), issue = url.searchParams.get('errorCode');
        const items = rows.filter(row => (!filter || row.validationStatus === filter || (filter === 'issues' && ['error', 'warning', 'duplicate'].includes(row.validationStatus))) && (!issue || row.errorCode === issue));
        data = { batch, version: `batch-${rows.filter(row => row.attendanceId).length}-${rows.filter(row => row.correctionReason).length}-${reviewRevision}`, lockedReason: null, sourceAvailable: true, employeeBlocks: 2, counts: Object.fromEntries(['valid', 'warning', 'error', 'duplicate', 'excluded', 'committed'].map(status => [status, rows.filter(row => row.validationStatus === status).length])), total: items.length, page: 1, pageSize: 20, items };
      } else if (path === `/api/attendance/imports/${batchId}/rows/${rowId}/exclude`) {
        const input = JSON.parse(request.postData), row = rows.find(item => item.id === rowId);
        Object.assign(row, { validationStatus: 'excluded', errorCode: null, validationNote: 'Đã chủ động loại khỏi đợt nhập', correctionReason: input.reason, correctedAt: stamp, version: 'excluded-v2' });
        reviewRevision++; data = { message: 'Đã loại dòng khỏi đợt nhập. Dữ liệu gốc được giữ nguyên.' };
      } else if (path === `/api/attendance/imports/${batchId}/rows/${rowId}`) {
        if (failCorrection) { status = 503; data = { message: 'Chưa lưu được điều chỉnh. Hãy thử lại.' }; }
        else { const input = JSON.parse(request.postData), row = rows.find(item => item.id === rowId); Object.assign(row, { staffId: input.staffId, staffName: 'Nhân viên thử nghiệm', workDate: input.workDate, shiftType: input.shiftType, pairs: input.pairs.map(pair => ({ in: `${input.workDate}T${pair.in}:00`, out: `${input.workDate}T${pair.out}:00` })), actualHours: 4.5, validationStatus: 'valid', errorCode: null, validationNote: null, correctionReason: input.reason, correctedAt: stamp, version: 'v2' }); data = { message: 'Đã lưu điều chỉnh và kiểm tra lại.', status: 'valid' }; }
      } else if (path === `/api/attendance/imports/${batchId}/commit`) {
        if (failCommit) { failCommit = false; reviewRevision++; status = 409; data = { message: 'Kết quả đối chiếu đã thay đổi. Kiểm tra bản xem trước mới.' }; }
        else { const candidates = rows.filter(row => row.validationStatus === 'valid'); candidates.forEach((row, index) => Object.assign(row, { validationStatus: 'committed', attendanceId: index ? guid(51) : recordId })); batch.status = 'committed'; batch.successRows = candidates.length; data = { created: candidates.length, message: 'Đã lưu vào hàng chờ xác nhận.' }; }
      } else if (path === '/api/attendance/on-call-context') data = { staffId, date: url.searchParams.get('date'), facilityId, approvedLeave: false, lockedReason: onCallLockedReason,
        schedules: onCallScheduled ? [{ id: guid(80), facilityId, facilityName: 'Cơ sở 1', shift: 'noon', start: '11:30', end: '13:30' }, { id: guid(81), facilityId, facilityName: 'Cơ sở 1', shift: 'evening', start: '17:00', end: '19:00' }] : [],
        evidence: onCallHasEvidence ? [{ id: recordId, checkIn: at, checkOut: `${today}T17:00:00`, source: 'machine', validationStatus: 'imported' }] : [] };
      else if (path === '/api/attendance/on-call-shifts' && request.method === 'GET') data = { total: 1, page: 1, pageSize: 20, lockedReason: null, items: Array.from({length:20},(_,i)=>({...duty,id:guid(800+i)})) };
      else if (path === `/api/attendance/on-call-shifts/${dutyId}` && request.method === 'GET') data = { item: duty, plannedStart: '11:30', plannedEnd: '13:30', actualHours: 2, lockedReason: null };
      else if (path === '/api/attendance/on-call-shifts' || path === `/api/attendance/on-call-shifts/${dutyId}`) { const input = JSON.parse(request.postData); onCallWrites++; duty = { ...duty, ...input, start: `${input.date}T${input.start}:00`, end: `${input.date}T${input.end}:00`, status: 'pending', version: 'v2' }; data = { id: dutyId, message: 'Đã lưu hồ sơ trực chờ xác nhận.' }; }
      else { status = 404; data = { message: 'No UI fixture for ' + path }; }
    } catch (error) { errors.push(error.message); status = 500; data = { message: error.message }; }
    await send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(data)).toString('base64') }).catch(() => {});
  });
  const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  const waitFor = async expression => { for (let attempt = 0; attempt < 120; attempt++) { if (await evaluate(`!!(${expression})`)) return; await new Promise(resolve => setTimeout(resolve, 75)); } throw Error(`Timed out: ${expression}`); };
  const check = (condition, name) => { if (!condition) throw Error(name); checks++; console.log('PASS ' + name); };
  const input = async (selector, value) => { await evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event('input',{bubbles:true}))})()`); };
  const textarea = async (selector, value) => { await evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event('input',{bubbles:true}))})()`); };
  const select = async (selector, value) => { await evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event('change',{bubbles:true}))})()`); };
  const click = async selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const visit = async (role, path) => {
    actor = { ...actor, id: role === 'admin' ? adminId : role === 'hr_staff' ? hrId : employeeId, role, name: roleNames[role] };
    if (scriptId) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId });
    scriptId = (await send('Page.addScriptToEvaluateOnNewDocument', { source: `sessionStorage.setItem('vnc.hrms.auth.v3',JSON.stringify({state:{session:{accessToken:'preview',expiresAt:'2099-01-01T00:00:00Z',user:${JSON.stringify(actor)}}},version:0}));` })).identifier;
    await send('Page.navigate', { url: `http://localhost:5173${path}` });
  };
  await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*', requestStage: 'Request' }] });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });



  for(const width of [1366,390]){
    await send('Emulation.setDeviceMetricsOverride',{width,height:width===390?844:768,deviceScaleFactor:1,mobile:width===390});
    await visit('hr_staff','/attendance/records');await waitFor("!!document.querySelector('tbody tr')");
    if (width === 390) {
      check(await evaluate("!document.querySelector('.sidebar')"), 'Mobile menu starts closed');
      await click('.topbar button[aria-expanded]');
      check(await evaluate("getComputedStyle(document.querySelector('.sidebar')).position==='fixed'"), 'Mobile menu opens above content');
      await click('.workspace-sidebar-backdrop');
      check(await evaluate("!document.querySelector('.sidebar')"), 'Backdrop closes the mobile menu');
    }
    check(await evaluate("!document.querySelector('#attendance-status')"),'Secondary filters start collapsed');
    await click('.attendance-filter-toggle');await waitFor("!!document.querySelector('#attendance-status')");
    await select('#attendance-status','flagged');await click('.attendance-filter-toggle');
    check(await evaluate("!document.querySelector('#attendance-status')&&document.querySelector('.attendance-filter-toggle').textContent.includes('1')"),'Collapsed filters keep their active count');
    await click('.attendance-filter-toggle');
    check(await evaluate("document.querySelector('#attendance-status').value==='flagged'"),'Reopened filters preserve selection');
    await visit('hr_staff','/attendance/device-mappings');await waitFor("!!document.querySelector('tbody tr')");
    check(await evaluate("document.querySelector('.table-scroll').clientHeight>150"),'Mapping list remains visible');
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('C\u1eadp nh\u1eadt li\u00ean k\u1ebft')).click()");
    await waitFor("!!document.querySelector('#mapping-employee')");
    check(await evaluate("!!document.querySelector('dialog[open] #mapping-employee')"),'Mapping editor opens in a dialog');
    await select('#mapping-employee', staffId);
    await input('#mapping-device', '007');
    await textarea('#mapping-reason', 'Verified against the original enrollment register');
    await click('dialog[open] button[type="submit"]');
    await waitFor("!!document.querySelector('#mapping-confirmed')");
    check(await evaluate("document.querySelectorAll('dialog[open]').length===1"), 'Mapping review replaces the editor without stacked dialogs');
    await visit('hr_staff','/attendance/imports/'+batchId+'/preview');await waitFor("!!document.querySelector('tbody tr')");
    const previewLayout = await evaluate("[...document.querySelectorAll('.workspace-section-body,.attendance-import-summary,.workspace-list-panel,.table-scroll,.directory-pagination')].map(e=>({class:e.className,height:e.clientHeight,scroll:e.scrollHeight}))");
    await writeFile(resolve(root, '.local/attendance-preview-' + width + '.png'), Buffer.from((await send('Page.captureScreenshot', {format:'png'})).data,'base64'));
    check(await evaluate("document.querySelector('.table-scroll').clientHeight>100"),'Import preview leaves room for source rows: ' + JSON.stringify(previewLayout));
    await visit('hr_staff', '/attendance/monthly'); await waitFor("!!document.querySelector('.att-kpi')");
    check(await evaluate("[...document.querySelector('.att-kpi').children].every(e=>getComputedStyle(e).display==='block')"), 'Monthly metric labels, values and captions occupy separate lines');
  }
  check(errors.length===0,'No browser exceptions: '+errors.join(','));
  console.log('Passed '+checks+' attendance presentation checks.');
}finally{if(socket)socket.close();chrome.kill();}
