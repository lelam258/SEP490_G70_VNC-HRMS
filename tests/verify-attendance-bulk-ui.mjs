// Run with Vite on :5173: node --experimental-websocket tests/verify-attendance-bulk-ui.mjs
// All API calls are intercepted; no real attendance is confirmed.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const profile = resolve('.local', `bulk-attendance-browser-${process.pid}`);
await mkdir(profile, { recursive: true });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9358', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket, sequence = 0, script, checks = 0, bulkCalls = 0, failNext = true, locked = false, lastSelection;
const waiting = new Map(), errors = [];
const month = '2026-11', date = '2026-11-20';
let actor = { id: 'hr', username: 'hr.fixture', name: 'HR fixture', role: 'hr_staff', email: null };
const rows = ['imported', 'flagged'].map((status, i) => ({ id: `record-${i}`, staffId: `staff-${i}`, staffCode: `UT00${i}`, staffName: `Nhân viên thử ${i}`, departmentId: 'dept', departmentName: 'Khoa thử', facilityId: 'site', facilityName: 'Cơ sở thử', workDate: date, shiftType: 'main', checkIn: `${date}T07:00:00`, checkOut: `${date}T17:00:00`, actualHours: 8, source: 'machine', status, importId: 'batch', onCallShiftId: null }));
const options = { staff: [], departments: [], facilities: [{ id: 'site', name: 'Cơ sở thử', status: 'active' }], serverNow: '2026-12-01T12:00:00+07:00' };
const send = (method, params = {}) => new Promise((done, fail) => { const id = ++sequence; waiting.set(id, { done, fail }); socket.send(JSON.stringify({ id, method, params })); });
try {
  let pages;
  for (let i = 0; i < 100; i++) { try { pages = await (await fetch('http://localhost:9358/json')).json(); if (pages.some(p => p.type === 'page')) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  socket = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => socket.addEventListener('open', r, { once: true }));
  socket.addEventListener('message', async event => {
    const message = JSON.parse(event.data);
    if (message.id) { const pending = waiting.get(message.id); waiting.delete(message.id); if (pending) message.error ? pending.fail(message.error) : pending.done(message.result); }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.method !== 'Fetch.requestPaused') return;
    const request = message.params.request, path = new URL(request.url).pathname;
    let data = {}, status = 200;
    try {
      if (path === '/api/auth/me') data = actor;
      else if (path === '/api/attendance/options') data = options;
      else if (path === '/api/attendance/records') data = { month, total: rows.length, page: 1, pageSize: 20, lockedReason: locked ? 'Tháng đã khóa' : null, items: rows,
        counts: { confirmed: rows.filter(r => r.status === 'confirmed').length, unconfirmed: rows.filter(r => r.status !== 'confirmed').length, flagged: 1, pending: rows.filter(r => r.status === 'imported').length, reconciled: 0 } };
      else if (path === '/api/attendance/records/bulk-verify/preview') {
        lastSelection = JSON.parse(request.postData);
        const candidates = lastSelection.ids ? rows.filter(r => lastSelection.ids.includes(r.id)) : rows.filter(r => r.status !== 'confirmed');
        data = { items: candidates.filter(r => r.status === 'imported').map(r => ({ ...r, version: 'review-v1' })), skipped: candidates.filter(r => r.status === 'flagged').map(r => ({ id: r.id, staffCode: r.staffCode, workDate: r.workDate, message: 'Cần đối chiếu trước' })) };
      } else if (path === '/api/attendance/records/bulk-verify') {
        bulkCalls++; const input = JSON.parse(request.postData);
        assert.equal(input.month, month); assert.equal(input.items.length, 1); assert.equal(input.items[0].version, 'review-v1');
        if (failNext) { failNext = false; data = { confirmed: 0, failed: [{ id: rows[0].id, staffCode: rows[0].staffCode, workDate: date, message: 'Dữ liệu đã thay đổi. Rà soát lại.' }] }; }
        else { rows[0].status = 'confirmed'; data = { confirmed: 1, failed: [] }; }
      }
    } catch (e) { errors.push(e.message); status = 500; data = { message: e.message }; }
    await send('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: status, responseHeaders: [{ name: 'Content-Type', value: 'application/json' }], body: Buffer.from(JSON.stringify(data)).toString('base64') }).catch(() => {});
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Fetch.enable', { patterns: [{ urlPattern: '*://localhost:5173/api/*' }] });
  const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
  const wait = async expression => { for (let i = 0; i < 150; i++) { if (await evaluate(`!!(${expression})`)) return; await new Promise(r => setTimeout(r, 80)); } throw Error(`Timed out: ${expression}`); };
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const check = (value, message) => { assert.ok(value, message); checks++; console.log('PASS ' + message); };
  const visit = async role => {
    actor = { ...actor, role };
    if (script) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: script });
    script = (await send('Page.addScriptToEvaluateOnNewDocument', { source: `sessionStorage.setItem('vnc.hrms.auth.v3',JSON.stringify({state:{session:{accessToken:'fixture',expiresAt:'2099-01-01T00:00:00Z',user:${JSON.stringify(actor)}}},version:0}));` })).identifier;
    await send('Page.navigate', { url: 'http://localhost:5173/attendance/records?month=2026-11' });
    await wait(`document.querySelectorAll('tbody tr').length===2`);
  };
  await visit('hr_staff');
  check(await evaluate(`document.querySelectorAll('tbody input[type="checkbox"]:disabled').length===1`), 'Flagged rows cannot be selected for bulk verification');
  await click('#review-all-attendance'); await wait(`!!document.querySelector('dialog[open]')`);
  check(lastSelection.filter.month === month && lastSelection.filter.facilityId === null && !lastSelection.ids, 'All-matching review sends the full filter, not only page IDs');
  check(await evaluate(`document.querySelector('#confirm-bulk-attendance').disabled`), 'Confirmation requires explicit review acknowledgement');
  check(await evaluate(`document.querySelector('dialog').textContent.includes('bỏ qua 1')`), 'Review explains which flagged rows are skipped');
  await click('dialog .form-actions button'); await wait(`!document.querySelector('dialog[open]')`);
  check(bulkCalls === 0, 'Canceling review never confirms attendance');
  await click('tbody input[type="checkbox"]:not(:disabled)');
  await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Rà soát 1 dòng đã chọn').click()`);
  await wait(`!!document.querySelector('dialog[open]')`);
  check(lastSelection.ids.length === 1 && lastSelection.ids[0] === rows[0].id && !lastSelection.filter, 'Selected-row mode reviews exactly the selected IDs');
  await click('#confirm-bulk-attendance-review'); await click('#confirm-bulk-attendance');
  await wait(`document.body.textContent.includes('Đã xác nhận 0 dòng.')&&!document.querySelector('dialog[open]')`);
  check(rows[0].status === 'imported' && bulkCalls === 1, 'Failed verification is reported without changing the row');
  await click('#review-all-attendance'); await wait(`!!document.querySelector('dialog[open]')`);
  await click('#confirm-bulk-attendance-review'); await click('#confirm-bulk-attendance');
  await wait(`document.body.textContent.includes('Đã xác nhận 1 dòng.')&&!document.querySelector('dialog[open]')`);
  check(rows[0].status === 'confirmed' && rows[1].status === 'flagged' && bulkCalls === 2, 'Fresh review confirms eligible rows and preserves flagged rows');
  locked = true; await visit('hr_staff');
  check(await evaluate(`document.querySelector('#review-all-attendance').disabled&&[...document.querySelectorAll('tbody input[type="checkbox"]')].every(i=>i.disabled)`), 'Locked month disables bulk actions and selection');
  locked = false; await visit('employee');
  check(await evaluate(`!document.querySelector('#review-all-attendance')&&!document.querySelector('tbody input[type="checkbox"]')`), 'Employee view has no bulk verification controls');
  check(errors.length === 0, `No browser runtime errors: ${errors.join(', ')}`);
  console.log(`Passed ${checks} bulk attendance browser checks.`);
} finally { if (socket) socket.close(); chrome.kill(); }
