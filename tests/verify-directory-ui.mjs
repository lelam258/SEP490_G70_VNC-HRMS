// Run from repository root with Vite on :5173. All API requests use isolated fixtures.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root=process.cwd(), profile=resolve(root,'.local/directory-ui-profile');
await mkdir(profile,{recursive:true});
const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=9340',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
const actor={id:'hr-manager',username:'hr.preview',name:'Quản lý nhân sự',role:'hr_manager',email:null};
const departmentNames=['Ban Giám đốc','Khoa Bác sĩ','Khoa Điều dưỡng','Khoa Kỹ thuật viên','Khoa Xét nghiệm','Bộ phận Dược','Hành chính - Kế toán','Bộ phận Hậu cần','Răng Hàm Mặt'];
let departments=departmentNames.map((name,i)=>({id:`d${i+1}`,code:`CS1-D${String(i+1).padStart(2,'0')}`,name,status:i===8?'inactive':'active'}));
const names=['Nguyễn Mạnh Tuyến','Trần Thị Chính','Lê Ngọc Mai','Nguyễn Văn Thịnh','Đỗ Tấn Phú','Trương Đình Hoàng','Lý Văn Đoàn','Đinh Hà Nam','Vũ Thị Thủy','Phan Thị Ngát','Đỗ Thị Hương Liên','Nguyễn Phương Thảo','Nguyễn Thị Hằng','Nguyễn Thị Hải','Nguyễn Hà Chi','Lê Thu Trang','Nguyễn Thị Mai','Vũ Thị Thu','Phạm Thị Thu Trang','Đỗ Ngọc Mai','Nguyễn Công Minh','Bà Mười','Trần Hữu Hoàn','Nguyễn Văn Tư','Nguyễn Văn Ba','Triệu Tử Long','Nguyễn Văn Thành'];
let employees=names.map((name,i)=>({id:`e${i+1}`,code:`CS1-${String(i+1).padStart(3,'0')}`,name,departmentId:i>24?null:departments[i%9].id,department:i>24?'Chưa phân khoa':departments[i%9].name,email:i%6===1?`nhanvien${i+1}@example.com`:null,status:i===24||i===25?'inactive':'active'}));
const originalEmployees=structuredClone(employees);
let failEmployees=false,failDepartmentStatus=true,socket,lastEmployeeUpdate,lastEmployeeCreate;const runtimeErrors=[];
for (const employee of employees) Object.assign(employee,{phone:'0901234567',dateOfBirth:'1990-01-02',gender:'female',idCardNumber:'012345678901',avatarUrl:null,scopeOfPractice:'Chuyên môn đã có',dateJoined:'2025-01-01',dateLeft:null,dependentCount:2});
try {
  let pages;for(let i=0;i<50;i++){try{pages=await(await fetch('http://127.0.0.1:9340/json/list')).json();if(pages.length)break}catch{}await new Promise(r=>setTimeout(r,150))}
  socket=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise((done,fail)=>{socket.addEventListener('open',done,{once:true});socket.addEventListener('error',fail,{once:true})});
  let sequence=0;const waiting=new Map();const send=(method,params={})=>new Promise((done,fail)=>{const id=++sequence;waiting.set(id,{done,fail});socket.send(JSON.stringify({id,method,params}))});
  socket.addEventListener('message',async event=>{
    const message=JSON.parse(event.data);if(message.id){const pending=waiting.get(message.id);if(pending){waiting.delete(message.id);message.error?pending.fail(message.error):pending.done(message.result)}}
    if(message.method==='Runtime.exceptionThrown')runtimeErrors.push(message.params.exceptionDetails.text);
    if(message.method!=='Fetch.requestPaused')return;
    const request=message.params.request,path=new URL(request.url).pathname;let data=[],code=200;
    if(path==='/api/auth/me')data=actor;
    else if(path==='/api/employees'&&request.method==='GET'){if(failEmployees){code=503;data={message:'Không tải được danh sách nhân viên.'}}else data=employees}
    else if(path==='/api/employees/unlinked-accounts'&&request.method==='GET')data=[{userId:'precreated-user',username:'nhansu.moi',fullName:'Nhân sự mới',email:'nhansu.moi@example.com',role:'employee'}];
    else if(path.startsWith('/api/employees/')&&request.method==='GET')data=employees.find(e=>e.id===path.split('/').at(-1));
    else if(path==='/api/departments'&&request.method==='GET')data=departments;
    else if(path.startsWith('/api/employees/')&&request.method==='PUT'){
      const id=path.split('/').at(-1),input=JSON.parse(request.postData),item=employees.find(e=>e.id===id);
      lastEmployeeUpdate=input;
      Object.assign(item,input,{department:departments.find(d=>d.id===input.departmentId)?.name||'Chưa phân khoa'});data=item;
    }else if(path==='/api/employees'&&request.method==='POST'){
      const input=JSON.parse(request.postData);lastEmployeeCreate=input;data={...input,id:`new-${employees.length}`,status:'active',department:departments.find(d=>d.id===input.departmentId)?.name||'Chưa phân khoa'};employees.push(data);
    }else if(path.startsWith('/api/departments/')&&request.method==='PATCH'){
      if(failDepartmentStatus){code=400;data={message:'Khoa/phòng vẫn đang được sử dụng.'}}
      else{const id=path.split('/').at(-2),item=departments.find(d=>d.id===id);Object.assign(item,JSON.parse(request.postData));data=item}
    }else if(path.startsWith('/api/departments/')&&request.method==='PUT'){
      const id=path.split('/').at(-1),item=departments.find(d=>d.id===id);Object.assign(item,JSON.parse(request.postData));data=item;
    }else if(request.method!=='GET'){code=405;data={message:'Unhandled fixture request'}}
    try{await send('Fetch.fulfillRequest',{requestId:message.params.requestId,responseCode:code,responseHeaders:[{name:'Content-Type',value:'application/json; charset=utf-8'}],body:Buffer.from(JSON.stringify(data)).toString('base64')})}catch{}
  });
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
  const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,70))}throw Error(`Timed out: ${expression}`)};
  const check=(ok,name)=>{if(!ok)throw Error(name);console.log('PASS '+name)};
  const click=async selector=>{await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);await new Promise(r=>setTimeout(r,70))};
  const value=async(selector,value,select=false)=>{await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(${select?'HTMLSelectElement':'HTMLInputElement'}.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('${select?'change':'input'}',{bubbles:true}));})()`);await new Promise(r=>setTimeout(r,70))};
  const screenshot=async name=>{await evaluate('scrollTo(0,0)');await writeFile(resolve(root,`.local/${name}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false})).data,'base64'))};
  const ready=`!!document.querySelector('.directory-pagination')&&document.querySelector('.directory-panel')?.getAttribute('aria-busy')==='false'`;
  await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Fetch.enable',{patterns:[{urlPattern:'*/api/*',requestStage:'Request'}]});
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`sessionStorage.setItem('vnc.hrms.auth.v2',JSON.stringify({state:{session:{accessToken:'fixture-only',expiresAt:'2099-01-01T00:00:00Z',user:${JSON.stringify(actor)}}},version:0}));`});
  await send('Page.navigate',{url:'http://localhost:5173/employees'});await waitFor(ready);
  check(await evaluate(`document.querySelectorAll('.directory-table tbody tr').length===10&&document.querySelector('.directory-page-info').textContent.includes('1–10')&&document.querySelector('[aria-label="Trang trước"]').disabled`),'employees default to ten rows with range and first-page bounds');
  await screenshot('employees-directory-desktop');
  await click('[aria-label="Trang 3"]');
  check(await evaluate(`document.querySelectorAll('.directory-table tbody tr').length===7&&document.querySelector('[aria-label="Trang sau"]').disabled&&document.querySelector('.directory-table tbody').textContent.includes('CS1-027')`),'last employee page contains only the seven remaining records');
  await click('[aria-label="Sửa hồ sơ Nguyễn Văn Thành"]');await waitFor(`!!document.querySelector('#employee-department')`);await value('#employee-department','d3',true);await click('dialog button:not([type])');
  await waitFor(`!document.querySelector('dialog[open]')&&${ready}`);
  check(await evaluate(`document.querySelector('.directory-pagination [aria-current="page"]').textContent==='3'&&[...document.querySelectorAll('.directory-table tbody tr')].find(row=>row.textContent.includes('CS1-027')).textContent.includes('Khoa Điều dưỡng')`),'editing updates department and preserves the current page');
  check(lastEmployeeUpdate.phone==='0901234567'&&lastEmployeeUpdate.dateOfBirth==='1990-01-02'&&lastEmployeeUpdate.scopeOfPractice==='Chuyên môn đã có'&&lastEmployeeUpdate.dependentCount===2&&lastEmployeeUpdate.status==='active','quick department edit preserves the full Dev employee profile');
  await value('#employee-search','tuyen');
  check(await evaluate(`document.querySelectorAll('.directory-table tbody tr').length===1&&document.querySelector('.directory-pagination [aria-current="page"]').textContent==='1'&&document.querySelector('.directory-table').textContent.includes('Nguyễn Mạnh Tuyến')`),'accent-insensitive employee search resets pagination to page one');
  await value('#employee-search','nobody-matches');
  check(await evaluate(`!!document.querySelector('.directory-empty')&&document.querySelector('.directory-page-info').textContent.includes('0–0')&&document.querySelector('[aria-label="Trang sau"]').disabled`),'empty results show a helpful message and zero range');
  await click('.directory-filter-summary button');await value('.directory-page-info select','5',true);await click('[aria-label="Trang 6"]');await value('#employee-filter-status','inactive',true);
  check(await evaluate(`document.querySelectorAll('.directory-table tbody tr').length===2&&document.querySelector('.directory-pagination [aria-current="page"]').textContent==='1'`),'status filter resets the last page and counts filtered records');
  await click('.directory-filter-summary button');await value('#employee-filter-department','d3',true);
  check(await evaluate(`document.querySelectorAll('.directory-table tbody tr').length===4&&document.querySelector('.directory-page-info').textContent.includes('trong 4')`),'department filter uses the complete employee list before pagination');
  await click('.directory-filter-summary button');await value('.directory-page-info select','20',true);
  check(await evaluate(`document.querySelectorAll('.directory-table tbody tr').length===20&&document.querySelector('.directory-pagination [aria-current="page"]').textContent==='1'`),'page-size control changes visible row count and resets page');
  await value('.directory-page-info select','5',true);await click('[aria-label="Trang 6"]');employees=employees.slice(0,4);await click('.directory-refresh');await waitFor(ready);
  check(await evaluate(`document.querySelectorAll('.directory-table tbody tr').length===4&&document.querySelector('.directory-pagination [aria-current="page"]').textContent==='1'`),'refresh clamps pagination when the record count shrinks');
  failEmployees=true;await click('.directory-refresh');await waitFor(`!!document.querySelector('.alert.error')&&${ready}`);
  check(await evaluate(`document.querySelector('.directory-heading button').disabled&&document.querySelector('.directory-action').disabled`),'reload error preserves existing rows and disables unsafe edits');
  failEmployees=false;employees=structuredClone(originalEmployees);await click('.directory-refresh');await waitFor(`!document.querySelector('.alert.error')&&${ready}`);
  await value('.directory-page-info select','10',true);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});await screenshot('employees-directory-mobile');
  check(await evaluate(`document.documentElement.scrollWidth<=innerWidth&&getComputedStyle(document.querySelector('.directory-table tbody tr')).display==='grid'`),'employee table becomes readable cards on mobile without page overflow');
  await click('[aria-label="Trang sau"]');check(await evaluate(`document.querySelector('.directory-pagination [aria-current="page"]').textContent==='2'`),'mobile pagination remains operable');
  employees=Array.from({length:153},(_,i)=>({...originalEmployees[i%originalEmployees.length],id:`bulk-${i}`,code:`VNC-${String(i+1).padStart(3,'0')}`}));
  await click('.directory-refresh');await waitFor(`${ready}&&document.querySelector('.directory-page-info').textContent.includes('153')`);
  await click('[aria-label="Trang 16"]');for(let i=0;i<8;i++)await click('[aria-label="Trang trước"]');
  check(await evaluate(`document.querySelector('.directory-pagination [aria-current="page"]').textContent==='8'&&document.querySelectorAll('.directory-page-item button').length===5&&document.querySelectorAll('.directory-page-ellipsis').length===2&&document.documentElement.scrollWidth<=innerWidth`),'large page counts use compact ellipses without mobile overflow');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await click('.directory-person-link');await waitFor(`!!document.querySelector('form[aria-label="Hồ sơ nhân viên"]')&&document.querySelector('.page-heading h1')?.textContent==='Chi tiết hồ sơ nhân viên'`);
  check(await evaluate(`location.pathname.startsWith('/employees/')`),'Dev full employee detail route remains accessible from the directory');
  await click('.page-heading .primary');await waitFor(`document.querySelector('.page-heading h1')?.textContent==='Chỉnh sửa hồ sơ nhân viên'`);
  check(await evaluate(`location.pathname.endsWith('/edit')&&!!document.querySelector('form[aria-label="Hồ sơ nhân viên"]')`),'Dev full employee edit route remains available');
  await send('Page.navigate',{url:'http://localhost:5173/employees'});await waitFor(ready);await click('.directory-heading button');await waitFor(`!!document.querySelector('#unlinked-account-select option[value="precreated-user"]')`);
  await value('#unlinked-account-select','precreated-user',true);await value('#employee-code','NEW-154');
  check(await evaluate(`document.querySelector('#employee-name').value==='Nhân sự mới'&&document.querySelector('#employee-email').value==='nhansu.moi@example.com'`),'creating an employee still prefills a pre-created account from Dev');
  await click('dialog .form-actions .primary');await waitFor(`!document.querySelector('dialog[open]')&&${ready}`);
  check(lastEmployeeCreate?.userId==='precreated-user'&&await evaluate(`document.querySelector('.alert.success').textContent.includes('Cập nhật chứng chỉ')`),'creation preserves account linking and the Dev certificate follow-up action');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:'http://localhost:5173/departments'});await waitFor(`!!document.querySelector('#department-search')&&${ready}`);
  await screenshot('departments-directory-desktop');
  check(await evaluate(`document.querySelectorAll('.directory-table tbody tr').length===9&&document.querySelectorAll('.directory-status.active').length===8`),'department directory renders real status badges and pagination');
  await value('.directory-page-info select','5',true);await click('[aria-label="Trang 2"]');await value('#department-search','dieu duong');
  check(await evaluate(`document.querySelectorAll('.directory-table tbody tr').length===1&&document.querySelector('.directory-pagination [aria-current="page"]').textContent==='1'`),'department search handles accents and resets page');
  await click('.directory-filter-summary button');await value('#department-filter-status','inactive',true);
  check(await evaluate(`document.querySelectorAll('.directory-table tbody tr').length===1&&document.querySelector('.directory-table').textContent.includes('Răng Hàm Mặt')`),'department status filter works across all pages');
  await click('.directory-filter-summary button');await value('#department-filter-status','active',true);await click('[aria-label="Ngừng hoạt động Ban Giám đốc"]');await waitFor(`!!document.querySelector('dialog[open]')`);
  check(await evaluate(`document.querySelector('.directory-table .directory-status').textContent==='Hoạt động'`),'department status requires explicit confirmation');
  await click('dialog .form-actions .primary');await waitFor(`!!document.querySelector('dialog [role="alert"]')`);
  check(await evaluate(`document.querySelector('dialog').textContent.includes('vẫn đang được sử dụng')`),'failed status change keeps confirmation and error');
  failDepartmentStatus=false;await click('dialog .form-actions .primary');await waitFor(`!document.querySelector('dialog[open]')&&${ready}`);
  check(await evaluate(`!document.querySelector('.directory-table').textContent.includes('Ban Giám đốc')&&document.querySelector('.directory-page-info').textContent.includes('trong 7')`),'successful status change refreshes the filtered list and pagination');
  await click('.directory-filter-summary button');await value('.directory-page-info select','10',true);await click('[aria-label="Sửa khoa/phòng Khoa Bác sĩ"]');await waitFor(`!!document.querySelector('#department-name')`);await value('#department-name','Khoa Bác sĩ mới');await click('dialog .form-actions .primary');await waitFor(`!document.querySelector('dialog[open]')&&${ready}`);
  check(await evaluate(`document.querySelector('.directory-table').textContent.includes('Khoa Bác sĩ mới')`),'department editing still saves correctly');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:true});await screenshot('departments-directory-mobile');
  check(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),'department actions and cards fit the mobile viewport');
  await value('#department-search','absent-department');check(await evaluate(`!!document.querySelector('.directory-empty')&&document.querySelector('[aria-label="Trang trước"]').disabled&&document.querySelector('[aria-label="Trang sau"]').disabled`),'department empty state disables page navigation');
  check(runtimeErrors.length===0,`no browser runtime exceptions: ${runtimeErrors.join(',')}`);
} finally {if(socket)socket.close();chrome.kill()}
