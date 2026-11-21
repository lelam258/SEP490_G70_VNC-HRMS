import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
await mkdir(resolve(root, '.local/attendance-browser'), { recursive: true });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9336', `--user-data-dir=${resolve(root, '.local/attendance-browser')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
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
  for (let i = 0; i < 50; i++) { try { pages = await (await fetch('http://127.0.0.1:9336/json/list')).json(); if (pages.length) break; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
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
      if (path === '/api/auth/me') data = actor;
      else if (path === '/api/users/employee-options') data = [];
      else if (path === '/api/users' && request.method === 'GET') data = accounts;
      else if (/\/api\/users\/[^/]+\/(status|role)$/.test(path)) {
        const input = JSON.parse(request.postData), account = accounts.find(item => item.id === path.split('/')[3]);
        if (path.endsWith('/status')) account.status = input.status; else account.role = input.role;
        account.version = `v${Date.now()}`; data = account;
      } else if (path === '/api/roles') data = Object.entries(roleNames).map(([id, name]) => ({ id, name, description: `Phạm vi chức năng của ${name}`, areas: ['Tra cứu dữ liệu được phép', 'Nghiệp vụ theo vai trò'], accountCount: accounts.filter(account => account.role === id).length }));
      else if (path === '/api/audit-logs/options' || path === '/api/attendance/history/options') data = { users: [{ id: adminId, name: 'Quản trị viên' }], actions: ['assign_role', 'create_on_call'], modules: ['accounts', 'attendance', 'on_call', 'schedules'], facilities: options.facilities };
      else if (path === `/api/audit-logs/${eventId}` || path === `/api/attendance/history/${eventId}`) data = auditEvent;
      else if (path === '/api/audit-logs' || path === '/api/attendance/history') data = { total: 1, page: 1, pageSize: 20, items: [auditEvent] };
      else if (path === '/api/attendance/options') data = options;
      else if (path === '/api/attendance/records') data = { total: 1, page: 1, pageSize: 20, items: [record], counts: { confirmed: 0, unconfirmed: 1, flagged: 0 }, month, lockedReason: null };
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
      else if (path === '/api/attendance/imports') data = { total: 1, page: 1, pageSize: 20, items: [batch] };
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
      else if (path === '/api/attendance/on-call-shifts' && request.method === 'GET') data = { total: 1, page: 1, pageSize: 20, lockedReason: null, items: [duty] };
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

  await visit('admin', '/roles'); await waitFor(`document.querySelectorAll('.operations-role-card').length===6`);
  check(await evaluate(`!!document.querySelector('a[href="/audit-logs"]')&&!!document.querySelector('a[href="/roles"]')`), 'Administrator discovers role management and audit log from navigation');
  await evaluate(`document.querySelectorAll('.operations-role-card')[2].click()`); await select('#role-target-account', employeeId);
  await evaluate(`document.querySelector('.operations-filters button').click()`); await waitFor(`!!document.querySelector('dialog[open]')`);
  check(await evaluate(`document.querySelector('dialog').textContent.includes('HR Staff')&&document.querySelector('dialog').textContent.includes('staff.preview')`), 'Role assignment requires account and target-role confirmation');
  await click('dialog .form-actions .primary'); await waitFor(`!document.querySelector('dialog[open]')&&document.querySelector('.alert.success')`);
  check(accounts[1].role === 'hr_staff', 'Confirmed role assignment refreshes the catalog and assigned users');
  await visit('admin', `/accounts/${employeeId}`); await waitFor(`document.querySelector('h1')?.textContent==='Chi tiết tài khoản'`);
  await evaluate(`[...document.querySelectorAll('.page-heading button')].find(button=>button.textContent.includes('Ngừng hoạt động')).click()`); await waitFor(`!!document.querySelector('dialog[open]')`);
  check(await evaluate(`document.querySelector('dialog').textContent.includes('Lịch sử tài khoản được giữ lại')`), 'Account deactivation confirmation explains session termination and retained history');
  await click('dialog .form-actions .primary'); await waitFor(`!document.querySelector('dialog[open]')&&document.querySelector('#account-status')?.value==='inactive'`);
  check(accounts[1].status === 'inactive', 'Account access action updates status without deleting the account');
  await visit('admin', '/audit-logs'); await waitFor(`!!document.querySelector('#audit-module')&&!!document.querySelector('tbody tr')`);
  await select('#audit-module', 'accounts'); await click('.operations-filters .primary'); await waitFor(`!!document.querySelector('tbody tr')`);
  await evaluate(`[...document.querySelectorAll('tbody button')].find(button=>button.textContent==='Xem sự kiện').click()`); await waitFor(`!!document.querySelector('dialog .operations-json')`);
  check(await evaluate(`document.querySelector('dialog').textContent.includes('Đã ẩn')&&!document.querySelector('dialog input,dialog textarea,dialog select')`), 'Audit event details display masked before/after values in read-only mode');

  await visit('hr_staff', '/attendance/imports/new'); await waitFor(`!!document.querySelector('#upload-file')&&!document.querySelector('fieldset').disabled`);
  check(await evaluate(`!document.querySelector('#upload-facility option[value="${guid(21)}"]')`), 'Import form excludes inactive facilities');
  await select('#upload-date-order', 'mdy');
  check(await evaluate(`document.querySelector('#upload-date-order').value==='mdy'&&!!document.querySelector('#upload-date-order option[value="auto"]')&&!!document.querySelector('#upload-date-order option[value="dmy"]')`), 'Import form supports explicit month/day/year and automatic or day/month/year date choices');
  await select('#upload-facility', facilityId); await input('#upload-device', 'Máy số 1');
  const document = await send('DOM.getDocument'); const node = await send('DOM.querySelector', { nodeId: document.root.nodeId, selector: '#upload-file' });
  await send('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [resolve(root, '.local/attendance-workflow-fixture.xlsx')] });
  await evaluate(`document.querySelector('details').open=true`); await input('#mapping-date', '1'); await input('#mapping-in1', '2'); await input('#mapping-out1', '2');
  await click('button[type="submit"]'); await waitFor(`!!document.querySelector('[role="alert"]')`);
  check(await evaluate(`document.querySelector('[role="alert"]').textContent.includes('cột bị trùng')&&document.querySelector('#upload-file').files.length===1`), 'Duplicate source-column mappings are rejected while preserving the chosen workbook');
  await input('#mapping-date', ''); await input('#mapping-in1', ''); await input('#mapping-out1', '');
  await click('button[type="submit"]'); await waitFor(`!!document.querySelector('#attendance-import-analysis')&&!!document.querySelector('#stage-attendance-import')`);
  check(await evaluate(`location.pathname==='/attendance/imports/new'&&!document.querySelector('#stage-attendance-import').disabled`), 'Reading a file opens transient analysis and requires a separate staging action');
  await click('#stage-attendance-import'); await waitFor(`document.querySelector('h1')?.textContent==='Xem trước nhập chấm công'&&!!document.querySelector('tbody tr')`);
  check(await evaluate(`document.querySelector('.operations-stats').textContent.includes('Hợp lệ')&&document.querySelector('tbody').textContent.includes('Chưa xác định')`), 'Uploading a workbook opens validation preview without silently accepting unresolved identities');
  check(await evaluate(`document.querySelector('main').textContent.includes('Định dạng ngày nguồn: Tháng / ngày / năm')`), 'Preview displays the selected source date order for human review');
  const punchRow = await evaluate(`(()=>{const row=[...document.querySelectorAll('tbody tr')].find(row=>row.querySelector('td[data-label="Dòng nguồn"]')?.textContent.includes('Mã máy: 007'));return {text:row?.textContent, intervals:row?.querySelector('td[data-label="Vào / ra"]')?.children.length,hours:row?.querySelector('td[data-label="Giờ tính / giờ máy"]')?.textContent,minutes:row?.querySelector('td[data-label="Muộn / sớm (phút)"]')?.textContent}})()`);
  check(punchRow.intervals === 3 && punchRow.hours === '10 / 24' && punchRow.minutes?.includes('20 / 2') && punchRow.text?.includes('XXX') && punchRow.text?.includes('chỉ tính một lần'), 'Repeated machine punches remain visible with distinct calculated/reported hours, minutes and a warning: ' + JSON.stringify(punchRow));
  await click('.operations-panel .operations-checkbox input');
  check(await evaluate(`!![...document.querySelectorAll('button')].find(button=>button.textContent.includes('Lưu 2 dòng'))`), 'Machine warnings require an explicit operator choice before entering the eligible queue');
  await click('.operations-panel .operations-checkbox input');
  await evaluate(`[...document.querySelectorAll('tbody tr')].find(row=>row.textContent.includes('999')).querySelector('button').click()`); await waitFor(`!!document.querySelector('dialog .operations-json')`);
  check(await evaluate(`document.querySelector('dialog .operations-json').textContent.includes('07:00')`), 'Original row evidence remains inspectable');
  await click('dialog button[aria-label="Đóng"]'); await waitFor(`!document.querySelector('dialog[open]')`);
  await evaluate(`[...document.querySelectorAll('tbody tr')].find(row=>row.textContent.includes('999')).querySelectorAll('button')[2].click()`); await waitFor(`!!document.querySelector('#exclude-import-reason')`);
  check(await evaluate(`document.querySelector('dialog .primary').disabled`), 'Excluding an import row requires a reason before confirmation');
  await textarea('#exclude-import-reason', 'Bỏ dòng thừa, chờ kiểm tra tại nguồn'); await click('dialog .primary'); await waitFor(`!document.querySelector('dialog[open]')&&document.querySelector('tbody').textContent.includes('Khôi phục / điều chỉnh')`);
  check(rows[1].validationStatus === 'excluded' && rows[1].rawValues[1] === '07:00' && !rows[1].attendanceId, 'Exclusion retains raw evidence without creating or deleting attendance');
  await evaluate(`[...document.querySelectorAll('tbody tr')].find(row=>row.textContent.includes('999')).querySelectorAll('button')[1].click()`); await waitFor(`!!document.querySelector('#correction-staff')`);
  await select('#correction-staff', staffId); await input('input[aria-label="Ra lần 1"]', '11:30'); await textarea('#correction-reason', 'Đối chiếu phiếu gốc');
  await click('dialog button[type="submit"]'); await waitFor(`!!document.querySelector('dialog [role="alert"]')`);
  check(await evaluate(`document.querySelector('#correction-reason').value==='Đối chiếu phiếu gốc'`), 'Failed correction preserves the evidence reason and entered values');
  failCorrection = false; await click('dialog button[type="submit"]'); await waitFor(`!document.querySelector('dialog[open]')&&document.querySelector('.operations-stats').textContent.includes('2Hợp lệ')`);
  await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Lưu 2 dòng')).click()`); await waitFor(`!!document.querySelector('dialog[open]')`);
  check(await evaluate(`document.querySelector('dialog .form-actions .primary').disabled`), 'Commit is blocked until the operator confirms mapping and source review');
  await click('dialog input[type="checkbox"]'); await click('dialog .form-actions .primary'); await waitFor(`!document.querySelector('dialog[open]')&&document.querySelector('[role="alert"]')?.textContent.includes('đã thay đổi')&&!!document.querySelector('tbody')`);
  check(rows.every(row => !row.attendanceId), 'A changed-preview commit preserves all rows and reloads the latest validation');
  await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Lưu 2 dòng')).click()`); await waitFor(`!!document.querySelector('dialog[open]')`);
  check(await evaluate(`document.querySelector('dialog .form-actions .primary').disabled&&!document.querySelector('dialog input[type="checkbox"]').checked`), 'A refreshed preview requires a new explicit review confirmation');
  await click('dialog input[type="checkbox"]'); await click('dialog .form-actions .primary'); await waitFor(`!document.querySelector('dialog[open]')&&document.querySelector('.operations-stats').textContent.includes('2Đã lưu')`);
  check(await evaluate(`document.querySelector('[role="status"]').textContent.includes('hàng chờ xác nhận')`), 'Committing valid rows reports the unconfirmed attendance queue');

  await visit('hr_staff', `/attendance/records/${recordId}`); await waitFor(`document.querySelector('h1')?.textContent==='Chi tiết chấm công'&&document.querySelectorAll('.operations-stats span').length===3`);
  check(await evaluate(`document.querySelector('main').textContent.includes('Máy chấm công')&&document.querySelector('main').textContent.includes('attendance-workflow-fixture.xlsx')&&!!document.querySelector('#side-by-side-reconciliation')&&!!document.querySelector('#attendance-workflow-dock')`), 'Attendance details display all punch pairs, side-by-side comparison and reconciliation/verification dock');
  check(await evaluate(`document.documentElement.scrollHeight<=innerHeight+8`), 'Attendance detail & reconciliation screen (UC 4.11/4.13) fits in a single desktop viewport without vertical scrolling');
  await textarea('#reconcile-reason', 'Đã kiểm tra bảng chấm công giấy Khoa Điều dưỡng');
  await click('#reconcile-submit'); await waitFor(`document.querySelector('[role="status"]')?.textContent.includes('MSG03')&&document.querySelector('#tab-verify')?.classList.contains('active')`);
  check(record.status === 'reconciled', 'Submitting UC 4.11 reconciliation updates status to reconciled and switches to UC 4.13 verification tab');
  await click('#verify-submit'); await waitFor(`document.querySelector('[role="status"]')?.textContent.includes('MSG03')`);
  check(record.status === 'confirmed', 'Submitting UC 4.13 verification confirms the attendance record');

  await visit('hr_staff', '/attendance/records/new'); await waitFor(`document.querySelector('h1')?.textContent==='Nhập chấm công thủ công'&&!!document.querySelector('#manual-staff')`);
  await select('#manual-staff', staffId); await select('#manual-facility', facilityId);
  await waitFor(`document.querySelector('#manual-context-panel')?.textContent.includes('Lịch phân công đã công bố')`);
  check(await evaluate(`document.documentElement.scrollHeight<=innerHeight+8`), 'Manual attendance entry screen (UC 4.12) fits in a single desktop viewport without vertical scrolling');
  await textarea('#manual-reason', 'Máy vân tay bảo trì buổi sáng, nhập từ bảng công giấy');
  await click('#manual-submit'); await waitFor(`document.querySelector('h1')?.textContent==='Chi tiết chấm công'`);
  check(true, 'UC 4.12 manual attendance submission navigates to the record detail screen');

  await visit('hr_staff', `/attendance/monthly?month=${month}`); await waitFor(`document.querySelector('h1')?.textContent==='Chốt bảng chấm công tháng'&&document.querySelectorAll('.att-kpi').length===6`);
  check(await evaluate(`document.documentElement.scrollHeight<=innerHeight+8&&!document.querySelector('#lock-monthly-btn').disabled`), 'Monthly attendance consolidation screen (UC 4.14) displays 6 KPIs and fits in a single desktop viewport without vertical scrolling');
  await click('#lock-monthly-btn'); await waitFor(`!!document.querySelector('dialog[open]')`);
  await textarea('#lock-monthly-note', 'Đã đối chiếu đủ 2 cơ sở');
  await click('#confirm-lock-monthly-btn'); await waitFor(`!document.querySelector('dialog[open]')&&document.querySelector('[role="status"]')?.textContent.includes('MSG03')`);
  check(monthlyStatus === 'locked', 'Confirming monthly attendance locks the timesheet for payroll');
  await visit('hr_staff', '/attendance/on-call/new'); await waitFor(`!!document.querySelector('#oncall-staff')`);
  await select('#oncall-staff', staffId); await select('#oncall-facility', facilityId); await waitFor(`!!document.querySelector('#oncall-evidence')&&!document.querySelector('button[type="submit"]').disabled`);
  await select('#oncall-evidence', recordId); await click('button[type="submit"]'); await waitFor(`document.querySelector('h1')?.textContent==='Chi tiết hồ sơ trực'`);
  check(await evaluate(`document.querySelector('main').textContent.includes('Chờ xác nhận')`), 'New on-call records remain pending confirmation');
  await evaluate(`[...document.querySelectorAll('a')].find(link=>link.textContent==='Sửa hồ sơ trực').click()`); await waitFor(`!!document.querySelector('#oncall-reason')`);
  check(await evaluate(`document.querySelector('#oncall-reason').required&&document.querySelector('#oncall-evidence').value==='${recordId}'`), 'Editing a duty requires a reason and retains linked attendance evidence');
  await textarea('#oncall-reason', 'Điều chỉnh theo biên bản'); await input('#oncall-end', '13:15'); await click('button[type="submit"]'); await waitFor(`document.querySelector('h1')?.textContent==='Chi tiết hồ sơ trực'`);
  check(duty.end.includes('13:15'), 'Pending duty edits save the revised actual end time');
  duty.status = 'confirmed'; await visit('hr_staff', `/attendance/on-call/${dutyId}/edit`); await waitFor(`!!document.querySelector('[role="alert"]')`);
  check(await evaluate(`!document.querySelector('#oncall-start')&&document.querySelector('[role="alert"]').textContent.includes('xác nhận')`), 'Confirmed duty records expose no direct edit form');

  onCallScheduled = false; onCallHasEvidence = false;
  await visit('hr_staff', '/attendance/on-call/new'); await waitFor(`!!document.querySelector('#oncall-staff')`);
  await select('#oncall-staff', staffId); await select('#oncall-facility', facilityId);
  await waitFor(`!!document.querySelector('#oncall-outside-schedule')&&!!document.querySelector('#oncall-evidence-hint')&&!document.querySelector('button[type="submit"]').disabled`);
  check(await evaluate(`document.querySelector('#oncall-outside-schedule').textContent.includes('có thể ghi nhận trực ngoài lịch')&&document.querySelector('#oncall-evidence-hint').textContent.includes('vẫn lưu được')`), 'Missing schedules and punches explain the available pending-record path');
  const beforeMissingReason = onCallWrites;
  await click('button[type="submit"]'); await waitFor(`document.activeElement.id==='oncall-reason'`);
  check(onCallWrites === beforeMissingReason && await evaluate(`document.querySelector('#oncall-save-status').textContent.includes('căn cứ quản lý')`), 'Missing outside-roster justification focuses the required field without sending a save');
  await textarea('#oncall-reason', 'Synthetic outside-roster duty review'); await textarea('#oncall-supervisor', 'Synthetic manager reference for a disposable UI fixture');
  await waitFor(`document.querySelector('#oncall-save-status').textContent.includes('Có thể lưu')`);
  await writeFile(resolve(root, '.local/oncall-guidance-desktop.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 950, deviceScaleFactor: 1, mobile: true });
  check(await evaluate(`document.documentElement.scrollWidth<=innerWidth&&!document.querySelector('button[type="submit"]').disabled`), 'On-call guidance and save controls remain usable on a narrow viewport');
  await writeFile(resolve(root, '.local/oncall-guidance-mobile.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await click('button[type="submit"]'); await waitFor(`document.querySelector('h1')?.textContent==='Chi tiết hồ sơ trực'`);
  check(onCallWrites === beforeMissingReason + 1 && duty.status === 'pending' && duty.attendanceEvidenceId === null && !!duty.supervisorEvidence, 'Documented outside-roster duty without punches can be submitted pending review');

  onCallScheduled = true; onCallHasEvidence = true;
  await visit('hr_staff', '/attendance/on-call/new'); await waitFor(`!!document.querySelector('#oncall-staff')`);
  await select('#oncall-staff', staffId); await select('#oncall-facility', facilityId);
  await waitFor(`document.querySelectorAll('#oncall-attendance-date option').length>1&&!document.querySelector('#oncall-attendance-date').disabled`);
  await select('#oncall-attendance-date', recordId); await waitFor(`document.querySelector('#oncall-evidence')?.value==='${recordId}'`);
  check(await evaluate(`document.querySelector('#oncall-date').value==='${today}'&&document.querySelector('main').textContent.includes('Khoa Điều dưỡng')`), 'Selecting existing attendance fills its date and evidence and shows the employee department');
  await select('#oncall-category', 'evening'); await input('#oncall-end', '21:00'); await textarea('#oncall-reason', 'Synthetic future-time validation');
  await waitFor(`document.querySelector('#oncall-save-status').textContent.includes('chưa diễn ra')`);
  const beforeFutureTime = onCallWrites;
  await click('button[type="submit"]'); await waitFor(`document.activeElement.id==='oncall-end'&&document.querySelector('[role="alert"]')?.textContent.includes('chưa diễn ra')`);
  check(onCallWrites === beforeFutureTime, 'Future actual end time is explained using the server clock before any save request');

  onCallLockedReason = 'Kỳ đã khóa: không thể ghi nhận trực.';
  await visit('hr_staff', '/attendance/on-call/new'); await waitFor(`!!document.querySelector('#oncall-staff')`);
  await select('#oncall-staff', staffId); await select('#oncall-facility', facilityId);
  await waitFor(`document.querySelector('#oncall-save-status').textContent.includes('Kỳ đã khóa')`);
  check(await evaluate(`document.querySelector('button[type="submit"]').disabled`), 'A locked period still blocks saving and explains the reason beside the form');
  onCallLockedReason = null;

  await visit('employee', '/attendance/records'); await waitFor(`!!document.querySelector('tbody tr')`);
  check(await evaluate(`!document.querySelector('a[href="/attendance/imports/new"]')&&!document.querySelector('a[href="/roles"]')`), 'Medical staff see attendance without import or administration actions');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 950, deviceScaleFactor: 1, mobile: true });
  check(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), 'Attendance layout fits mobile viewport');
  await writeFile(resolve(root, '.local/attendance-mobile.png'), Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await visit('employee', '/roles'); await waitFor(`document.body.textContent.includes('Bạn không có quyền truy cập chức năng này')`);
  check(await evaluate(`document.querySelectorAll('.operations-role-card').length===0`), 'Protected routes block unauthorized role management');
  check(errors.length === 0, `No browser runtime errors: ${errors.join(', ')}`);
  console.log(`Passed ${checks} browser checks for attendance and account workflows.`);
} finally { if (socket) socket.close(); chrome.kill(); }
