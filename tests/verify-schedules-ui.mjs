import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=process.cwd(); await mkdir(resolve(root,'.local/refined-browser-profile'),{recursive:true});
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9335',`--user-data-dir=${resolve(root,'.local/refined-browser-profile')}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
let socket; const errors=[]; let actor={id:'head',username:'preview',name:'Vũ Thị Thủy',role:'hr_staff',email:null};
let closed=false; let saveMode='fail', reopenMode='fail', failReload=false, slowDate='', savedRows=[];
const options={departmentId:'nurses',facilities:[{id:'cs1',name:'Cơ sở 1'},{id:'cs2',name:'Cơ sở 2'}],departments:[{id:'nurses',name:'Khoa Điều dưỡng'}],staff:[{id:'staff1',fullName:'Phan Thị Ngát',departmentId:'nurses'},{id:'staff2',fullName:'Nguyễn Phương Thảo',departmentId:'nurses'}],coverage:[{id:'unit1',name:'Điều dưỡng',departmentId:'nurses',facilityId:'cs1'},{id:'unit2',name:'Điều dưỡng',departmentId:'nurses',facilityId:'cs2'}]};
const add=(day,n)=>{const d=new Date(`${day}T12:00:00`);d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
const monday=day=>{const d=new Date(`${day}T12:00:00`);return add(day,-(d.getDay()+6)%7)};
const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Bangkok'}).format(new Date());
const baseRow=(id,date,shift='morning',published=false)=>({assignment:{id,staffId:'staff1',coverageId:'unit1',date,shift,cancelled:false,patientConfirmed:false,actualEndAt:null,reason:'Phân công lịch làm việc tuần',transferConsent:'Trưởng phòng/khoa xác nhận phân công tại cơ sở'},fullName:'Phan Thị Ngát',facility:'Cơ sở 1',facilityId:'cs1',coverage:'Điều dưỡng',published:closed,start:shift==='morning'?'07:00':'13:30',end:shift==='morning'?'11:30':'17:00',dutyCredit:false});
try {
  let pages; for(let i=0;i<40;i++){try{pages=await(await fetch('http://127.0.0.1:9335/json/list')).json();if(pages.length)break}catch{}await new Promise(r=>setTimeout(r,200))}
  socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise((res,rej)=>{socket.addEventListener('open',res,{once:true});socket.addEventListener('error',rej,{once:true})});
  let serial=0;const awaiting=new Map();
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;awaiting.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))});
  socket.addEventListener('message',async e=>{const m=JSON.parse(e.data);if(m.id){const p=awaiting.get(m.id);if(p){awaiting.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result)}}
    if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);
    if(m.method!=='Fetch.requestPaused')return;
    const req=m.params.request,url=new URL(req.url),date=url.searchParams.get('date')||today;let data=[],code=200;
    if(url.pathname==='/api/auth/me')data=actor;
    else if(url.pathname==='/api/schedules/options')data=options;
    else if(url.pathname==='/api/schedules'&&req.method==='GET'){
      if(failReload){code=503;data={message:'Mất kết nối khi tải lại lịch.'}}
      else {const start=monday(date);data=[baseRow(`a-${start}`,start),baseRow(`b-${start}`,add(start,1),'afternoon',true),...savedRows.filter(r=>monday(r.assignment.date)===start)].map(row=>({...row,published:closed}));if(actor.role==='employee')data=data.filter(r=>r.published&&r.assignment.staffId==='staff1')}
    } else if(url.pathname==='/api/schedules/week-status'){
      data={monday:monday(date),closed,assignmentCount:2+savedRows.length};
    } else if(url.pathname==='/api/schedules/assign-week'&&req.method==='POST'){
      if(saveMode==='fail'){code=400;data={message:'Nhân viên đã có lịch trong ca.'}}
      else {const payload=JSON.parse(req.postData);savedRows=payload.days.flatMap(day=>payload.shifts.map(shift=>baseRow(`saved-${day}-${shift}`,add(payload.monday,day),shift)));data={created:savedRows.length};if(saveMode==='reload-fail')failReload=true}
    }
    else if(url.pathname==='/api/schedules/publish'&&req.method==='POST'){closed=true;data={message:'Closed'}}
    else if(url.pathname==='/api/schedules/reopen'&&req.method==='POST'){
      if(reopenMode==='fail'){code=400;data={message:'Không mở lại được tuần, vui lòng thử lại.'}}
      else {const payload=JSON.parse(req.postData);if(!payload.reason.trim()){code=400;data={message:'Cần lý do'}}else{closed=false;data={message:'Reopened'}}}
    }
    if(slowDate&&url.searchParams.get('date')===slowDate)await new Promise(r=>setTimeout(r,700));
    try{await send('Fetch.fulfillRequest',{requestId:m.params.requestId,responseCode:code,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify(data)).toString('base64')})}catch{}
  });
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
  const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,75))}throw Error(`Timed out: ${expression}`)};
  const check=(ok,name)=>{if(!ok)throw Error(name);console.log(`PASS ${name}`)};
  const select=async(selector,value)=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await new Promise(r=>setTimeout(r,80))};
  const setDate=async value=>{await evaluate(`(()=>{const e=document.querySelector('#schedule-view-date');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`)};
  const input=async(selector,value)=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await new Promise(r=>setTimeout(r,80))};
  const screenshot=async name=>writeFile(resolve(root,`.local/${name}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'));
  await send('Page.enable');await send('Runtime.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*/api/*',requestStage:'Request'}]});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`sessionStorage.setItem('vnc.hrms.auth.v2',JSON.stringify({state:{session:{accessToken:'preview',expiresAt:'2099-01-01T00:00:00Z',user:${JSON.stringify(actor)}}},version:0}));`});
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://localhost:5173/schedules'});
  await waitFor(`!!document.querySelector('#schedule-create')&&!document.querySelector('#schedule-create').disabled`);
  check(await evaluate(`!document.querySelector('dialog')&&document.querySelector('.schedule-timetable').getBoundingClientRect().top<430&&!document.querySelector('#schedule-gaps')&&!document.querySelector('.schedule-setup')`),'calendar first without staffing-configuration sections');
  await screenshot('schedule-refined-desktop');
  await evaluate(`document.querySelector('#schedule-create').focus();document.querySelector('#schedule-create').click()`);await waitFor(`!!document.querySelector('dialog[open]')`);
  check(await evaluate(`document.querySelector('.schedule-total').textContent==='14'`),'weekly editor defaults to 14 assignments');
  await select('#schedule-staff','staff1');await select('#schedule-facility','cs1');
  await evaluate(`document.querySelector('.schedule-save-button').click()`);await waitFor(`!!document.querySelector('dialog [role="alert"]')`);
  check(await evaluate(`document.querySelector('#schedule-staff').value==='staff1'&&!!document.querySelector('dialog[open]')`),'failed save keeps modal and values');
  saveMode='success';await evaluate(`document.querySelector('.schedule-save-button').click()`);await waitFor(`!document.querySelector('dialog[open]')&&!document.querySelector('#schedule-create').disabled`);
  check(await evaluate(`document.querySelectorAll('.schedule-event').length===16`),'successful save closes modal and refreshes calendar');
  await evaluate(`document.querySelector('#schedule-create').focus();document.querySelector('#schedule-create').click()`);await waitFor(`!!document.querySelector('dialog[open]')`);
  check(await evaluate(`document.querySelector('#schedule-staff').value===''&&document.querySelector('#schedule-consent').value===''&&!document.querySelector('#schedule-consent-custom')`),'new form resets after previous save');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27,nativeVirtualKeyCode:27});await waitFor(`!document.querySelector('dialog[open]')`);
  check(await evaluate(`document.activeElement.id==='schedule-create'`),'Escape closes dialog and restores focus');
  await evaluate(`document.querySelector('.schedule-event-menu summary').click();document.querySelector('.schedule-event-actions button').click()`);await waitFor(`!!document.querySelector('#schedule-date')`);
  check(await evaluate(`document.querySelector('#schedule-date').min!==''&&document.querySelector('#schedule-date').max!==''&&document.querySelector('#schedule-facility').value==='cs1'`),'edit dates constrained to original week; facility retained');
  await evaluate(`document.querySelector('dialog button[aria-label="Đóng"]').click()`);await waitFor(`!document.querySelector('dialog[open]')`);
  slowDate=add(monday(today),-7);await setDate(slowDate);await new Promise(r=>setTimeout(r,40));await setDate(today);
  await waitFor(`!document.querySelector('#schedule-create').disabled`);await new Promise(r=>setTimeout(r,800));
  check(await evaluate(`!document.querySelector('.alert.error')&&document.querySelector('#schedule-view-date').value===${JSON.stringify(today)}&&document.querySelectorAll('.schedule-event').length===16`),'late previous-week response cannot overwrite current week');
  saveMode='reload-fail';await evaluate(`document.querySelector('#schedule-create').focus();document.querySelector('#schedule-create').click()`);await waitFor(`!!document.querySelector('dialog[open]')`);
  await select('#schedule-staff','staff1');await select('#schedule-facility','cs1');await evaluate(`document.querySelector('.schedule-save-button').click()`);
  await waitFor(`!document.querySelector('dialog[open]')&&!!document.querySelector('.alert.error')`);
  check(await evaluate(`document.querySelector('[role="status"]').textContent.includes('Đã lưu')`),'saved mutation plus reload failure reports saved state without resubmission');
  failReload=false;await evaluate(`document.querySelector('.alert.error button').click()`);await waitFor(`!document.querySelector('.alert.error')&&!document.querySelector('#schedule-create').disabled`);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});await evaluate(`scrollTo(0,0)`);await new Promise(r=>setTimeout(r,250));
  check(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),'mobile page has no horizontal overflow');await screenshot('schedule-refined-mobile');
  await evaluate(`document.querySelector('#schedule-create').focus();document.querySelector('#schedule-create').click()`);await waitFor(`!!document.querySelector('dialog[open]')`);await evaluate(`document.querySelector('.schedule-save-button').scrollIntoView({block:'end',behavior:'instant'})`);
  check(await evaluate(`document.querySelector('.schedule-save-button').getBoundingClientRect().bottom<=innerHeight`),'mobile modal save button reachable');await screenshot('schedule-refined-mobile-editor');
  await evaluate(`document.querySelector('dialog button[aria-label="Đóng"]').click()`);await waitFor(`!document.querySelector('dialog[open]')`);
  await evaluate(`document.querySelector('.schedule-primary-actions button').click()`);await waitFor(`!!document.querySelector('dialog[open]')`);
  check(await evaluate(`document.querySelector('dialog').textContent.includes('tất cả khoa/phòng')&&document.querySelector('.schedule-action-warning').textContent.includes('Không thể tạo, sửa hoặc hủy')`),'closure confirms global scope and edit lock');
  await evaluate(`document.querySelector('dialog button[type="submit"]').click()`);await waitFor(`!document.querySelector('dialog[open]')&&document.querySelector('#schedule-create').disabled`);
  check(await evaluate(`!document.querySelector('.schedule-event-menu')&&!document.querySelector('.schedule-empty-slot-create')&&document.querySelector('.schedule-week-status').textContent.includes('Đã chốt')`),'closed week has no scheduling mutation controls');
  check(await evaluate(`!!document.querySelector('#schedule-reopen')&&!document.querySelector('#schedule-reopen').disabled`),'HR can open the reopen action on a closed current week');
  await evaluate(`document.querySelector('#schedule-reopen').click()`);await waitFor(`!!document.querySelector('#schedule-reopen-reason')`);
  check(await evaluate(`document.querySelector('dialog button[type="submit"]').disabled&&document.querySelector('#schedule-reopen-reason').required&&document.querySelector('#schedule-reopen-reason').maxLength===1000`),'reopen requires a reason before submitting');
  check(await evaluate(`document.querySelector('dialog').textContent.includes('tất cả khoa/phòng')&&document.querySelector('.schedule-action-warning').textContent.includes('cho đến khi chốt lại')`),'reopen explains global scope and temporary draft visibility');
  await input('#schedule-reopen-reason','Chọn nhầm cơ sở khi nhập lịch');
  await evaluate(`document.querySelector('dialog button[type="submit"]').click()`);await waitFor(`!!document.querySelector('dialog [role="alert"]')`);
  check(await evaluate(`document.querySelector('#schedule-reopen-reason').value==='Chọn nhầm cơ sở khi nhập lịch'&&document.querySelector('#schedule-create').disabled`),'failed reopen preserves reason and keeps week locked');
  reopenMode='success';await evaluate(`document.querySelector('dialog button[type="submit"]').click()`);await waitFor(`!document.querySelector('dialog[open]')&&!document.querySelector('#schedule-create').disabled`);
  check(await evaluate(`!document.querySelector('#schedule-reopen')&&document.querySelector('.schedule-week-status').textContent==='Chưa chốt'&&!!document.querySelector('.schedule-event-menu')`),'successful reopen restores draft editing controls');
  await evaluate(`document.querySelector('.schedule-event-menu summary').click();document.querySelector('.schedule-event-actions button').click()`);await waitFor(`!!document.querySelector('#schedule-date')`);
  check(await evaluate(`document.querySelector('dialog h2').textContent==='Sửa phân công'`),'HR can open the correction form after reopening');
  await evaluate(`document.querySelector('dialog button[aria-label="Đóng"]').click()`);await waitFor(`!document.querySelector('dialog[open]')`);
  await evaluate(`document.querySelector('.schedule-primary-actions button').click()`);await waitFor(`!!document.querySelector('dialog[open]')`);
  await evaluate(`document.querySelector('dialog button[type="submit"]').click()`);await waitFor(`!document.querySelector('dialog[open]')&&document.querySelector('#schedule-create').disabled&&!!document.querySelector('#schedule-reopen')`);
  check(await evaluate(`!document.querySelector('.schedule-event-menu')&&document.querySelector('.schedule-week-status').textContent.includes('Đã chốt')`),'republishing locks scheduling changes again');
  await setDate(add(monday(today),-7));await waitFor(`!!document.querySelector('#schedule-reopen')&&document.querySelector('#schedule-reopen').disabled&&!document.querySelector('.schedule-calendar-loading')`);
  check(await evaluate(`document.querySelector('#schedule-reopen').disabled`),'expired weeks cannot be reopened from the UI');
  await setDate(today);await waitFor(`!!document.querySelector('#schedule-reopen')&&!document.querySelector('#schedule-reopen').disabled`);
  actor={...actor,role:'department_head'};await send('Page.reload');await waitFor(`!!document.querySelector('.schedule-timetable')&&!document.querySelector('.schedule-calendar-loading')&&!document.querySelector('#schedule-create')&&!!document.querySelector('#schedule-filter-department')`);
  check(await evaluate(`!document.querySelector('#schedule-create')&&!document.querySelector('#schedule-reopen')&&!document.querySelector('.schedule-primary-actions')&&!!document.querySelector('#schedule-filter-department')`),'department head can read all departments but cannot manage or reopen');
  actor={...actor,role:'employee'};savedRows=[];await send('Page.reload');await waitFor(`!!document.querySelector('.schedule-timetable')&&!document.querySelector('.schedule-calendar-loading')&&!document.querySelector('#schedule-create')&&!document.querySelector('#schedule-filter-department')`);
  check(await evaluate(`!document.querySelector('#schedule-create')&&!document.querySelector('#schedule-gaps')&&!document.querySelector('.schedule-event-menu')`),'employee has no management controls');
  check(errors.length===0,`no runtime errors: ${errors.join(',')}`);
} finally {if(socket)socket.close();chrome.kill()}
