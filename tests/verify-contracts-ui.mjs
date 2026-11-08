// System test for tasks 20–23 (contract list, create, detail, edit).
// Run from repository root with Vite on :5173. All API requests use isolated fixtures; no database is touched.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = process.cwd(), profile = resolve(root, '.local/contracts-ui-profile');
await mkdir(profile, { recursive: true });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9341', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
const actor = { id: 'hr-manager', username: 'hr.preview', name: 'Quản lý nhân sự', role: 'hr_manager', email: null };
const departments = [{ id: 'd1', code: 'XN', name: 'Khoa Xét nghiệm', status: 'active' }, { id: 'd2', code: 'BS', name: 'Khoa Bác sĩ', status: 'active' }];
const employees = [
  { id: 's1', code: 'T01', name: 'Nhân viên Một', departmentId: 'd1', department: 'Khoa Xét nghiệm', email: null, status: 'active' },
  { id: 's2', code: 'T02', name: 'Nhân viên Hai', departmentId: 'd2', department: 'Khoa Bác sĩ', email: null, status: 'active' },
  { id: 's3', code: 'T03', name: 'Nhân viên Đã nghỉ', departmentId: null, department: 'Chưa phân khoa', email: null, status: 'inactive' },
];
const row = (id, code, staff, type, from, to, displayStatus, extra = {}) => ({ contractId: id, contractCode: code, staffId: staff.id, staffCode: staff.code, staffName: staff.name, departmentId: staff.departmentId, departmentName: staff.departmentId ? staff.department : null, positionName: 'Kỹ thuật viên', siteName: 'Cơ sở 1', contractType: type, salaryType: 'monthly', effectiveFrom: from, effectiveTo: to, status: displayStatus === 'inactive' ? 'inactive' : 'active', fileUrl: null, displayStatus, ...extra });
let contracts = [
  row('c1', 'HD-2026/T01', employees[0], 'Hợp đồng không xác định thời hạn', '2026-01-01', null, 'active'),
  row('c2', 'HD-2025/T02', employees[1], 'Hợp đồng xác định thời hạn', '2025-01-01', '2025-06-30', 'expired'),
  row('c3', 'HD-2026/T02', employees[1], 'Hợp đồng xác định thời hạn', '2026-01-01', '2026-11-20', 'expiring', { fileUrl: 'https://files.test/c3.pdf' }),
];
const detailOf = c => ({ ...c, staffEmail: null, dailyRate: 181488.46, monthlySalary: 4718700, standardWorkingDays: 26, isInsuranceEligible: true, insuranceSalaryBasis: 4718700, taxMethod: 'progressive', createdAt: '2026-11-01T02:00:00', updatedAt: '2026-11-01T02:00:00' });
let lastCreate, lastUpdate, socket; const runtimeErrors = [];
try {
  let pages; for (let i = 0; i < 50; i++) { try { pages = await (await fetch('http://127.0.0.1:9341/json/list')).json(); if (pages.length) break } catch { } await new Promise(r => setTimeout(r, 150)) }
  socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl); await new Promise((done, fail) => { socket.addEventListener('open', done, { once: true }); socket.addEventListener('error', fail, { once: true }) });
  let sequence = 0; const waiting = new Map(); const send = (method, params = {}) => new Promise((done, fail) => { const id = ++sequence; waiting.set(id, { done, fail }); socket.send(JSON.stringify({ id, method, params })) });
  socket.addEventListener('message', async event => {
    const message = JSON.parse(event.data); if (message.id) { const pending = waiting.get(message.id); if (pending) { waiting.delete(message.id); message.error ? pending.fail(message.error) : pending.done(message.result) } }
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.text);
    if (message.method !== 'Fetch.requestPaused') return;
    const request = message.params.request, path = new URL(request.url).pathname; let data = [], code = 200;
    if (path === '/api/auth/me') data = actor;
    else if (path === '/api/departments') data = departments;
    else if (path === '/api/employees') data = employees;
    else if (path === '/api/contracts' && request.method === 'GET') data = contracts;
    else if (path === '/api/contracts' && request.method === 'POST') {
      lastCreate = JSON.parse(request.postData); const staff = employees.find(e => e.id === lastCreate.staffId);
      const created = row('c-new', lastCreate.contractCode.toUpperCase(), staff, lastCreate.contractType, lastCreate.effectiveFrom, lastCreate.effectiveTo, 'active');
      contracts = [created, ...contracts]; data = detailOf(created); code = 201;
    } else if (path.startsWith('/api/contracts/') && request.method === 'GET') {
      const found = contracts.find(c => c.contractId === path.split('/').at(-1)); if (found) data = detailOf(found); else { code = 404; data = { message: 'Không tìm thấy hợp đồng lao động.' } }
    } else if (path.startsWith('/api/contracts/') && request.method === 'PUT') {
      lastUpdate = JSON.parse(request.postData); const found = contracts.find(c => c.contractId === path.split('/').at(-1)); Object.assign(found, lastUpdate); data = detailOf(found);
    } else if (request.method !== 'GET') { code = 405; data = { message: 'Unhandled fixture request' } }
    try { await send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: code, responseHeaders: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }], body: Buffer.from(JSON.stringify(data)).toString('base64') }) } catch { }
  });
  const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value };
  const waitFor = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 70)) } throw Error(`Timed out: ${expression}`) };
  const check = (ok, name) => { if (!ok) throw Error(name); console.log('PASS ' + name) };
  const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); await new Promise(r => setTimeout(r, 70)) };
  const value = async (selector, v, select = false) => { await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(${select ? 'HTMLSelectElement' : 'HTMLInputElement'}.prototype,'value').set.call(el,${JSON.stringify(v)});el.dispatchEvent(new Event('${select ? 'change' : 'input'}',{bubbles:true}));})()`); await new Promise(r => setTimeout(r, 70)) };
  const screenshot = async name => { await evaluate('scrollTo(0,0)'); await writeFile(resolve(root, `.local/${name}.png`), Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })).data, 'base64')) };
  const listReady = `!!document.querySelector('.directory-pagination')&&document.querySelector('.directory-panel')?.getAttribute('aria-busy')==='false'`;
  const rows = `document.querySelectorAll('.directory-table tbody tr').length`;
  await send('Page.enable'); await send('Runtime.enable'); await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*', requestStage: 'Request' }] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `sessionStorage.setItem('vnc.hrms.auth.v2',JSON.stringify({state:{session:{accessToken:'fixture-only',expiresAt:'2099-01-01T00:00:00Z',user:${JSON.stringify(actor)}}},version:0}));` });

  // ---- Task 20: list ----
  await send('Page.navigate', { url: 'http://localhost:5173/contracts' }); await waitFor(listReady);
  check(await evaluate(`${rows}===3&&!!document.querySelector('nav a[href="/contracts"].selected')`), 'HR Manager sees all contracts and the Hợp đồng menu is active');
  check(await evaluate(`document.querySelector('.directory-table tbody tr').textContent.includes('Đang hiệu lực')&&document.querySelector('.directory-table').textContent.includes('Không thời hạn')&&!!document.querySelector('.directory-status.expired')&&!!document.querySelector('.directory-status.expiring')`), 'Rows show derived status badges, active first, and "Không thời hạn" for indefinite contracts');
  check(await evaluate(`!document.querySelector('.directory-panel').textContent.includes('₫')&&!document.querySelector('.directory-panel').textContent.includes('4.718.700')`), 'List shows no salary amounts');
  await screenshot('contracts-list-desktop');
  await value('#contract-search', 'hd-2025/t02');
  check(await evaluate(`${rows}===1&&document.querySelector('.directory-table').textContent.includes('HD-2025/T02')`), 'Search matches contract code case-insensitively');
  await value('#contract-search', 'nhan vien mot');
  check(await evaluate(`${rows}===1&&document.querySelector('.directory-table').textContent.includes('T01')`), 'Search matches staff name without accents');
  await click('.directory-filter-summary button');
  await value('#contract-filter-status', 'expired', true);
  check(await evaluate(`${rows}===1&&!!document.querySelector('.directory-status.expired')`), 'Status filter narrows to expired contracts');
  await click('.directory-filter-summary button'); await value('#contract-filter-department', 'd2', true); await value('#contract-filter-type', 'Hợp đồng xác định thời hạn', true);
  check(await evaluate(`${rows}===2`), 'Department and contract type filters combine');
  await value('#contract-search', 'không-có');
  check(await evaluate(`!!document.querySelector('.directory-empty')&&document.querySelector('.directory-empty').textContent.includes('Không tìm thấy hợp đồng')`), 'No match shows the empty state');
  await click('.directory-filter-summary button');
  check(await evaluate(`${rows}===3&&!!document.querySelector('a[href="https://files.test/c3.pdf"]')`), 'Clearing filters restores the list; scanned file link is shown when present');

  // ---- Task 22: open a record ----
  await click('.directory-table tbody tr .directory-person-link');
  await waitFor(`document.querySelector('.page-heading h1')?.textContent==='Chi tiết hợp đồng'`);
  check(await evaluate(`location.pathname==='/contracts/c1'&&document.querySelector('#cd-code').value==='HD-2026/T01'&&document.querySelector('#cd-to').value==='Không thời hạn'&&document.querySelector('#cd-salary').value.includes('4.718.700')&&document.querySelector('#cd-insurance').value==='Có'`), 'Selected contract opens with contract, staff and salary details');
  await screenshot('contract-detail-desktop');
  await send('Page.navigate', { url: 'http://localhost:5173/contracts/missing' }); await waitFor(`!!document.querySelector('.alert.error')`);
  check(await evaluate(`document.querySelector('.alert.error').textContent.includes('Không tìm thấy hợp đồng')`), 'Unknown contract shows an error with a way back');

  // ---- Task 21: create ----
  await send('Page.navigate', { url: 'http://localhost:5173/contracts' }); await waitFor(listReady);
  await click('.directory-heading .button.primary'); await waitFor(`!!document.querySelector('#contract-staff option[value="s1"]')`);
  check(await evaluate(`!document.querySelector('#contract-staff option[value="s3"]')`), 'Inactive staff are not offered for a new contract');
  check(await evaluate(`document.querySelector('#contract-to').disabled`), 'End date is disabled for an indefinite contract');
  await click('form .form-actions .primary'); await waitFor(`!!document.querySelector('form .alert.error')`);
  check(await evaluate(`document.querySelector('form .alert.error').textContent.includes('chọn nhân viên')`) && !lastCreate, 'Missing staff is reported without calling the API');
  await value('#contract-staff', 's1', true); await value('#contract-code', '0925/hđlđ-vn'); await value('#contract-from', '2026-12-01'); await value('#contract-base-salary', '4718700');
  await screenshot('contract-create-desktop');
  await click('form .form-actions .primary'); await waitFor(`location.pathname==='/contracts/c-new'`);
  check(lastCreate.staffId === 's1' && lastCreate.contractCode === '0925/hđlđ-vn' && lastCreate.contractType === 'Hợp đồng không xác định thời hạn' && lastCreate.salaryType === 'monthly' && lastCreate.baseSalary === 4718700 && lastCreate.effectiveTo === null && lastCreate.standardWorkingDays === null, 'Create sends the entered contract with base salary and no end date');
  await waitFor(`!!document.querySelector('.alert.success')`);
  check(await evaluate(`document.querySelector('.alert.success').textContent.includes('Đã tạo hợp đồng 0925/HĐLĐ-VN')`), 'After creating, the new contract opens with a success notice');

  // ---- Task 23: edit ----
  await click('.page-heading .button.primary'); await waitFor(`document.querySelector('.page-heading h1')?.textContent==='Chỉnh sửa hợp đồng'`);
  check(await evaluate(`document.querySelector('#contract-staff').readOnly&&!!document.querySelector('#contract-amount-readonly')?.readOnly&&!document.querySelector('#contract-base-salary')`), 'Edit keeps staff and salary read-only');
  await value('#contract-type', 'Hợp đồng xác định thời hạn', true);
  await click('form .form-actions .primary'); await waitFor(`!!document.querySelector('form .alert.error')`);
  check(await evaluate(`document.querySelector('form .alert.error').textContent.includes('phải có ngày kết thúc')`) && !lastUpdate, 'Fixed-term contract requires an end date before saving');
  await value('#contract-to', '2027-11-30'); await value('#contract-status', 'inactive', true);
  await screenshot('contract-edit-desktop');
  await click('form .form-actions .primary'); await waitFor(`document.querySelector('.page-heading h1')?.textContent==='Chi tiết hợp đồng'`);
  check(lastUpdate.contractType === 'Hợp đồng xác định thời hạn' && lastUpdate.effectiveTo === '2027-11-30' && lastUpdate.status === 'inactive' && !('baseSalary' in lastUpdate) && !('staffId' in lastUpdate), 'Edit sends only permitted fields');
  check(await evaluate(`document.querySelector('.alert.success').textContent.includes('Đã cập nhật hợp đồng')&&document.querySelector('#cd-to').value==='30/11/2027'`), 'Saved changes appear on the detail page');

  // ---- Responsive ----
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 1000, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: 'http://localhost:5173/contracts' }); await waitFor(listReady);
  await screenshot('contracts-list-mobile');
  check(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), 'Contract list fits a phone screen without horizontal scrolling');
  check(runtimeErrors.length === 0, `No browser runtime exceptions: ${runtimeErrors.join(',')}`);
} finally { if (socket) socket.close(); chrome.kill() }
