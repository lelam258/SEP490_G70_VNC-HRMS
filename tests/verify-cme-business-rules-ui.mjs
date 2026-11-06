// Run from the repository root with Vite on :5173. API traffic uses isolated fixtures.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const profile = resolve('.local/cme-business-rules-browser');
await mkdir(profile, { recursive: true });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9346', `--user-data-dir=${profile}`, 'about:blank',
], { windowsHide: true, stdio: 'ignore' });
const actor = { id: 'hr-test', username: 'hr.test', name: 'HR kiểm thử', role: 'hr_manager', email: null };
let socket, rejectLock = true, locked = false, pending = false, lockCalls = 0;
const runtimeErrors = [];
const cycle = () => ({ certificateId: 'cert-test', certificateType: 'Chứng chỉ kiểm thử', cycleId: 'cycle-test', cycleNumber: 1,
  cycleStart: '2026-01-01', cycleEnd: '2099-01-01', requiredCredits: 1, earnedCredits: pending ? 0 : 1,
  remainingCredits: pending ? 1 : 0, certificateStatus: 'active', cycleStatus: locked ? 'locked' : 'active',
  isCurrentCycle: true, hasCmeCreditsRequirement: false });
const record = () => ({ cmeId: 'record-test', certificateId: 'cert-test', certificateType: 'Chứng chỉ kiểm thử',
  staffId: 'staff-test', staffCode: 'NV01', staffName: 'Nguyễn An', cmeCycleId: 'cycle-test', cycleNumber: 1,
  courseName: 'Khóa học kiểm thử', completedDate: '2026-01-01', credits: 1, verified: !pending });
try {
  let pages;
  for (let attempt = 0; attempt < 50; attempt++) {
    try { pages = await (await fetch('http://127.0.0.1:9346/json/list')).json(); if (pages.length) break; } catch {}
    await new Promise(done => setTimeout(done, 100));
  }
  assert.ok(pages?.length, 'Chrome started');
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((done, fail) => { socket.addEventListener('open', done, { once: true }); socket.addEventListener('error', fail, { once: true }); });
  let sequence = 0;
  const waiting = new Map();
  const send = (method, params = {}) => new Promise((done, fail) => {
    const id = ++sequence; waiting.set(id, { done, fail }); socket.send(JSON.stringify({ id, method, params }));
  });
  socket.addEventListener('message', async event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const item = waiting.get(message.id);
      if (item) { waiting.delete(message.id); message.error ? item.fail(message.error) : item.done(message.result); }
    }
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.text);
    if (message.method !== 'Fetch.requestPaused') return;
    const path = new URL(message.params.request.url).pathname;
    let data = [], status = 200;
    if (path === '/api/auth/me') data = actor;
    else if (path === '/api/cme-records/employees') data = [{ staffId: 'staff-test', staffCode: 'NV01', fullName: 'Nguyễn An', certificateCount: 1 }];
    else if (path.endsWith('/complete-cycle')) {
      lockCalls++;
      if (rejectLock) { status = 409; data = { message: 'Không thể khóa: dữ liệu đã thay đổi.' }; }
      else { locked = true; data = cycle(); }
    } else if (path.endsWith('/cycles')) data = [cycle()];
    else if (path === '/api/cme-records/employee/staff-test') data = [record()];
    else if (path === '/api/certificates/employee/staff-test') data = [{ certificateId: 'cert-test', category: 'certificate', cmeRequiredCredits: null }];
    try { await send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: status,
      responseHeaders: [{ name: 'Content-Type', value: 'application/json; charset=utf-8' }], body: Buffer.from(JSON.stringify(data)).toString('base64') }); } catch {}
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const waitFor = async expression => {
    for (let attempt = 0; attempt < 100; attempt++) { if (await evaluate(expression)) return; await new Promise(done => setTimeout(done, 75)); }
    throw new Error(`Timed out: ${expression}`);
  };
  const lockButton = `[...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Xác nhận khóa')`;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: '*://*/api/*', requestStage: 'Request' }] });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `window.confirm=()=>true;
    sessionStorage.setItem('vnc.hrms.auth.v2',JSON.stringify({state:{session:{accessToken:'fixture',expiresAt:'2099-01-01T00:00:00Z',user:${JSON.stringify(actor)}}},version:0}));
    localStorage.setItem('vnc_hrms_locked_cme_cycles',JSON.stringify(['cert-test:1']));` });
  await send('Page.navigate', { url: 'http://localhost:5173/cme-records?staffId=staff-test' });
  await waitFor(`!!(${lockButton})`);
  console.log('PASS Old browser lock state cannot override an open server cycle');
  await evaluate(`(${lockButton}).click()`);
  await waitFor(`document.body.textContent.includes('Không thể khóa: dữ liệu đã thay đổi.')`);
  assert.equal(lockCalls, 1);
  assert.ok(await evaluate(`!!(${lockButton}) && !document.body.textContent.includes('Đã xác nhận khóa bảng tiến độ hiện tại thành công.')`));
  console.log('PASS Server lock failure stays an error and keeps the cycle open');
  rejectLock = false;
  await evaluate(`(${lockButton}).click()`);
  await waitFor(`!(${lockButton}) && document.body.textContent.includes('Đã xác nhận khóa bảng tiến độ hiện tại thành công.')`);
  assert.equal(lockCalls, 2);
  await evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim()==='Chi tiết').click()`);
  await waitFor(`!!document.querySelector('dialog[open]')`);
  assert.ok(await evaluate(`!document.querySelector('dialog').textContent.includes('Hủy xác minh')`));
  console.log('PASS Server-confirmed cycle lock removes verification controls');
  locked = false; pending = true;
  await send('Page.reload');
  await waitFor(`document.body.textContent.includes('Khóa học kiểm thử') && document.body.textContent.includes('Chờ thẩm định')`);
  assert.ok(await evaluate(`!(${lockButton})`));
  console.log('PASS A pending non-credit CME record cannot satisfy the completion target');
  assert.deepEqual(runtimeErrors, []);
} finally {
  if (socket) socket.close();
  chrome.kill();
}
