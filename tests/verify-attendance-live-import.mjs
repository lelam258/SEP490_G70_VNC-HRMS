import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';

const config = JSON.parse(process.env.ATTENDANCE_LIVE_CONFIG || '{}');
if (!config.appUrl || !config.file || !config.hrSession || !config.accountantSession) throw Error('Run via the disposable AttendanceWorkflows fixture.');
const portServer = createServer(); await new Promise(resolve => portServer.listen(0, '127.0.0.1', resolve));
const port = portServer.address().port; await new Promise(resolve => portServer.close(resolve));
const profile = resolve('.local', `attendance-live-browser-${process.pid}`); await mkdir(profile, { recursive: true });
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
let socket, scriptId, serial = 0, checks = 0;
const requests = [], runtimeErrors = [], pending = new Map();
try {
  let pages;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (pages.length) break; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!pages?.length) throw Error('Live Chrome did not start.');
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) { const task = pending.get(message.id); if (task) { pending.delete(message.id); message.error ? task.reject(Error(message.error.message)) : task.resolve(message.result); } }
    if (message.method === 'Network.requestWillBeSent') requests.push({ url: message.params.request.url, method: message.params.request.method });
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.text);
  });
  const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.text); return result.result.value; };
  const waitFor = async expression => { for (let attempt = 0; attempt < 240; attempt++) { if (await evaluate(`!!(${expression})`)) return; await new Promise(resolve => setTimeout(resolve, 100)); } const alerts = await evaluate(`[...document.querySelectorAll('[role="alert"]')].map(x=>x.textContent)`); throw Error(`Live browser timed out: ${expression}; alerts=${JSON.stringify(alerts)}`); };
  const check = (condition, label) => { if (!condition) throw Error(label); checks++; console.log('LIVE PASS ' + label); };
  const input = (selector, value, tag = 'HTMLInputElement', event = 'input') => evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(${tag}.prototype,'value').set.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event(${JSON.stringify(event)},{bubbles:true}))})()`);
  const select = (selector, value) => input(selector, value, 'HTMLSelectElement', 'change');
  const textarea = (selector, value) => input(selector, value, 'HTMLTextAreaElement');
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const visit = async (session, path) => {
    if (scriptId) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId });
    scriptId = (await send('Page.addScriptToEvaluateOnNewDocument', { source: `sessionStorage.setItem('vnc.hrms.auth.v3',${JSON.stringify(JSON.stringify({ state: { session }, version: 0 }))});` })).identifier;
    await send('Page.navigate', { url: config.appUrl + path });
  };
  async function chooseFile(path = config.file) {
    const document = await send('DOM.getDocument'); const node = await send('DOM.querySelector', { nodeId: document.root.nodeId, selector: '#upload-file' });
    await send('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [path] });
  }
  await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });

  await visit(config.hrSession, '/attendance/imports/new');
  await waitFor(`!!document.querySelector('#upload-file')&&!document.querySelector('fieldset').disabled`);
  await select('#upload-facility', config.facilityId); await input('#upload-month', config.defaultMonth); await chooseFile();
  await click('#analyze-attendance-file'); await waitFor(`!!document.querySelector('#attendance-import-analysis')&&!!document.querySelector('#use-source-month')`);
  check(await evaluate(`document.querySelector('#attendance-import-analysis').textContent.includes('${config.rows}')&&document.querySelector('#stage-attendance-import').disabled`), 'Actual workbook analysis shows all rows and prevents an accidental current-month import');
  check(requests.filter(x => x.method === 'POST' && new URL(x.url).pathname === '/api/attendance/imports').length === 0, 'Reading the actual workbook makes no staging request');
  await click('#use-source-month'); await waitFor(`document.querySelector('#upload-month').value==='${config.month}'&&!!document.querySelector('#attendance-import-analysis')&&!document.querySelector('#use-source-month')`);
  check(await evaluate(`document.querySelector('#stage-attendance-import').disabled&&!!document.querySelector('#analysis-device-mappings')`), 'Historical-month lock and unmapped identities remain visible after source-month correction');
  check(await evaluate(`!!document.querySelector('#import-identity-summary')&&!!document.querySelector('#import-source-quality')&&document.querySelector('#import-source-quality').textContent.includes('317')&&document.querySelector('#import-source-quality').textContent.includes('59')&&document.querySelector('#import-source-quality').textContent.includes('74')`), 'The real workbook separates employee prerequisites from its 317 complete, 59 missing and 74 empty time rows');

  check(await evaluate(`!document.querySelector('a[href^="/attendance/import-periods"]')`), 'Attendance screens expose no separate late-collection screen or navigation');
  const removedStatuses = await evaluate(`Promise.all(['','/authorize','/close'].map(async suffix => (await fetch('/api/attendance/import-periods/${config.month}'+suffix,{method:suffix?'POST':'GET',headers:{Authorization:'Bearer '+${JSON.stringify(config.hrSession.accessToken)},'Content-Type':'application/json'},...(suffix?{body:'{}'}:{})})).status))`);
  check(removedStatuses.every(status => status === 404), 'The removed collection API endpoints are unavailable');
  const blockedImport = await evaluate(`(async()=>{const form=new FormData();form.append('file',document.querySelector('#upload-file').files[0]);form.append('facilityId',${JSON.stringify(config.facilityId)});form.append('month',${JSON.stringify(config.month)});const response=await fetch('/api/attendance/imports',{method:'POST',headers:{Authorization:'Bearer '+${JSON.stringify(config.hrSession.accessToken)}},body:form});return response.status})()`);
  check(blockedImport === 400, 'The standard month lock still protects staging even without the separate collection feature');

  await waitFor(`!!document.querySelector('#analysis-mapping-employee')&&!document.querySelector('#import-identity-resolver fieldset').disabled`);
  await select('#analysis-device-code', config.deviceId);
  check(await evaluate(`document.querySelector('#analysis-mapping-employee').value===''`), 'A source device ID never selects or guesses an employee');
  await select('#analysis-mapping-employee', config.staffId); await textarea('#analysis-mapping-reason', 'Synthetic test profile reviewed against the disposable device fixture');
  await click('#review-analysis-mapping'); await waitFor(`!!document.querySelector('#analysis-mapping-confirmed')`);
  check(await evaluate(`document.querySelector('#save-analysis-mapping').disabled`), 'Mapping requires explicit identity review confirmation');
  await click('#analysis-mapping-confirmed'); await click('#save-analysis-mapping');
  await waitFor(`!document.querySelector('dialog[open]')&&!!document.querySelector('#attendance-import-analysis')&&document.querySelector('#attendance-import-analysis').textContent.includes('1/${15}')&&!document.querySelector('#analysis-mapping-employee').disabled`);
  check(await evaluate(`document.querySelector('#upload-file').files.length===1&&location.pathname==='/attendance/imports/new'`), 'Inline identity confirmation rechecks all rows while retaining the chosen file and page');

  await visit(config.hrSession, '/attendance/imports/new'); await waitFor(`!!document.querySelector('#upload-file')&&!document.querySelector('fieldset').disabled`);
  await select('#upload-facility', config.facilityId); await input('#upload-month', config.demoMonth); await chooseFile(config.demoFile);
  await click('#analyze-attendance-file'); await waitFor(`!!document.querySelector('#attendance-import-analysis')&&!document.querySelector('#stage-attendance-import').disabled`);
  check(await evaluate(`!document.querySelector('#import-identity-summary')`), 'A linked source in an open month is ready for staging without Accountant controls');
  await click('#stage-attendance-import'); await waitFor(`location.pathname.endsWith('/preview')&&!!document.querySelector('tbody tr')`);
  await click('.operations-panel .operations-checkbox input');
  await evaluate(`[...document.querySelectorAll('button')].find(x=>/^Lưu 1 dòng đủ điều kiện$/.test(x.textContent)).click()`);
  await waitFor(`!!document.querySelector('dialog input[type="checkbox"]')`);
  await click('dialog input[type="checkbox"]'); await click('dialog .primary');
  await waitFor(`!document.querySelector('dialog[open]')&&document.querySelector('[role="status"].success')?.textContent.includes('hàng chờ xác nhận')`);
  check(true, 'The synthetic open-month file completes staging and explicit unconfirmed commit through the real API');

  await visit(config.accountantSession, '/payroll/periods');
  await waitFor(`!!document.querySelector('h1')&&!!document.querySelector('a[href="/payroll/parameters"]')`);
  const payrollStatus = await evaluate(`(async()=> (await fetch('/api/payroll/periods',{headers:{Authorization:'Bearer '+${JSON.stringify(config.accountantSession.accessToken)}}})).status)()`);
  check(payrollStatus === 200 && await evaluate(`!document.querySelector('a[href^="/attendance/import-periods"]')`), 'Existing Accountant payroll-period access remains available without the removed screen');
  check(runtimeErrors.length === 0, 'No frontend runtime errors with real endpoints');
  console.log(`LIVE Passed ${checks} browser checks without mocked API responses.`);
} finally { if (socket) socket.close(); chrome.kill(); }
