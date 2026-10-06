const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const index = read('src/index.html');
const section = (source, start, end) => {
  const a = source.indexOf(start), b = source.indexOf(end, a + start.length);
  assert(a >= 0 && b > a, 'test source boundaries must exist');
  return source.slice(a, b);
};
const context = globals => vm.createContext({ console, setTimeout, clearTimeout, ...globals });
const turn = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => {resolve=a;reject=b;}); return {promise,resolve,reject}; };

function database() {
  const localRequire = createRequire(path.join(root, 'src/database.js'));
  const ctx = context({ module: {exports:{}}, require: name => name === 'electron'
    ? {app:{getPath:()=>require('node:os').tmpdir()}} : localRequire(name) });
  vm.runInContext(read('src/database.js'), ctx);
  return new ctx.module.exports({dbPath:':memory:'});
}

test('CSV updates preserve student IDs, attendance, scores, submissions and omitted contacts', () => {
  const db=database();
  try {
    const id=db.addStudent({number:1,name:'원래 이름',class_group:'3학년 2반',phone:'010-1111-2222',gender:'여',note:'기존 메모'});
    const absent=db.addStudent({number:2,name:'CSV에 없는 학생',class_group:'3학년 2반'});
    db.db.prepare("INSERT INTO attendance(student_id,date) VALUES(?,?)").run(id,'2026-10-04');
    db.db.exec("INSERT INTO assessments(id,name) VALUES(1,'평가'); INSERT INTO submissions(id,name) VALUES(1,'과제')");
    db.db.prepare('INSERT INTO assessment_scores(assessment_id,student_id,score) VALUES(1,?,90)').run(id);
    db.db.prepare('INSERT INTO submission_status(submission_id,student_id,submitted) VALUES(1,?,1)').run(id);
    const result=db.importStudentsCSV([{number:1,name:'수정 이름',class_group:'3학년 2반'},{number:3,name:'새 학생',class_group:'3학년 2반',phone:'010-3333-4444'}]);
    assert.equal(result.added,1);assert.equal(result.updated,1);
    const student=db.getStudents().find(s=>s.id===id);
    assert.equal(student.name,'수정 이름');assert.equal(student.phone,'010-1111-2222');assert.equal(student.gender,'여');assert.equal(student.note,'기존 메모');
    assert(db.getStudents().some(s=>s.id===absent));
    for(const table of ['attendance','assessment_scores','submission_status']) assert.equal(db.db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n,1);
    db.updateStudent(id,{name:'이름만 수정'});
    assert.equal(db.getStudents().find(s=>s.id===id).phone,'010-1111-2222');
  } finally {db.close();}
});

test('failed or duplicate CSV imports roll back the entire batch', () => {
  const db=database();
  try {
    db.addStudent({number:1,name:'기존',class_group:'1학년 1반'});
    const before=JSON.stringify(db.getStudents());
    assert.throws(()=>db.importStudentsCSV([{number:1,name:'갱신',class_group:'1학년 1반'},{number:2,name:'',class_group:'1학년 1반'}]));
    assert.equal(JSON.stringify(db.getStudents()),before);
    assert.throws(()=>db.importStudentsCSV([{number:2,name:'새 학생',class_group:'1학년 1반'},{number:2,name:'중복',class_group:'1학년 1반'}]));
    assert.equal(JSON.stringify(db.getStudents()),before);
  } finally {db.close();}
});

test('calendar dates advance one civil day in Seoul, including year/leap boundaries', () => {
  const ctx=context({});
  vm.runInContext(section(read('preload.js'),'function calendarNextDay','function buildTodoCalendarEvent'),ctx);
  vm.runInContext(section(index,'  function addOneDay','  function normalizeCalendarDate'),ctx);
  for(const [input,expected] of [['2026-10-04','2026-10-05'],['2026-12-31','2027-01-01'],['2028-02-28','2028-02-29'],['2028-02-29','2028-03-01']]) {
    assert.equal(ctx.calendarNextDay(input),expected);assert.equal(ctx.addOneDay(input),expected);
  }
});

test('mutable facade preserves native bridge and enables exactly one local/cloud setting write', async () => {
  const calls=[];const native=Object.freeze({setSetting:async()=>{calls.push('local');return true;}});
  const ctx=context({window:{nativeApi:native,dispatchEvent:()=>{}},CustomEvent:class {},pushCloudSettingNow:async()=>calls.push('cloud'),isApplyingRemoteData:()=>false});
  vm.runInContext(read('src/api.js'),ctx);
  ctx.api=ctx.window.api;ctx.originalSetSetting=ctx.api.setSetting.bind(ctx.api);
  vm.runInContext(section(index,'  api.setSetting = function','  // *Raw'),ctx);
  await ctx.api.setSetting('class_year','3');
  assert.deepEqual(calls,['local','cloud']);assert.notEqual(ctx.api.setSetting,native.setSetting);
});

function navigationContext(loadPage) {
  const ctx=context({navigationVersion:0,navigationQueue:Promise.resolve(),activePage:'original',currentPage:'original',pageCache:{},window:{},flushActivePage:async()=>{},loadPage,menuGroups:[],_usageOnLeave:()=>{},syncActiveTabs:()=>{},findMenuPage:()=>null,text:()=>{},setDashboardControls:()=>{},document:{getElementById:()=>({innerHTML:'',style:{}})},toast:()=>{}});
  vm.runInContext(section(index,'  function navigateTo(key)','  function updateClassInfo()'),ctx);
  return ctx;
}

test('navigation ignores stale loads and does not overlap render/init', async () => {
  const first=deferred(), init=deferred(), events=[];
  const ctx=navigationContext(key => key==='first'?first.promise:Promise.resolve({render:()=>events.push(key)}));
  const a=ctx.navigateTo('first');await turn();
  const b=ctx.navigateTo('second');first.resolve({render:()=>events.push('stale')});await Promise.all([a,b]);
  assert.deepEqual(events,['second']);assert.equal(ctx.currentPage,'second');
  ctx.loadPage=async key=>({render:()=>events.push(key),init:()=>key==='slow'?init.promise:undefined});
  const c=ctx.navigateTo('slow');await turn();const d=ctx.navigateTo('last');await turn();
  assert.equal(events.at(-1),'slow');init.resolve();await Promise.all([c,d]);
  assert.equal(events.at(-1),'last');assert.equal(ctx.currentPage,'last');
});

test('navigation retains editor if saving fails', async () => {
  const ctx=navigationContext(async()=>({render:()=>assert.fail('must not render')}));
  ctx.flushActivePage=async()=>{throw new Error('disk full');};
  await ctx.navigateTo('other');assert.equal(ctx.currentPage,'original');
});

test('time table captures values before DOM removal and retries failed writes', async () => {
  const source=read('src/pages/timetable.js');const cells={};let writes=[],fail=false;
  for(let d=0;d<5;d++)for(let p=1;p<=7;p++)cells[`ts-${d}-${p}`]={value:d===0&&p===1?'수학':''};
  const ctx=context({MAX_PERIOD:7,pendingCells:null,autosaveTimer:null,saveQueue:Promise.resolve(),timetableData:{},document:{getElementById:id=>cells[id]||null},api:{replaceTimetable:async data=>{if(fail)throw new Error('disk full');writes.push(JSON.parse(JSON.stringify(data)));}},renderTable:()=>{},setStatus:()=>{},toast:()=>{}});
  vm.runInContext(section(source,'function readTableData()','async function onImageSelected'),ctx);
  ctx.scheduleAutosave();for(const key of Object.keys(cells))delete cells[key];
  await ctx.flushAutosave();assert.equal(writes[0][0].subject,'수학');
  ctx.pendingCells=[{subject:'영어'}];fail=true;await assert.rejects(ctx.flushAutosave());
  fail=false;await ctx.flushAutosave();assert.equal(writes.at(-1)[0].subject,'영어');
});

test('memo autosaves on input and flushes before changing dates or leaving', async () => {
  const els={};for(const id of ['mp','mn','ms','mt','ml','mc','md'])els[id]={value:'',textContent:'',innerHTML:'',disabled:false};
  const saved=new Map(),writes=[];let page;
  const ctx=context({document:{getElementById:id=>els[id]},today:()=> '2026-10-04',api:{getDailyMemos:async()=>[],getDailyMemo:async date=>saved.get(date)||'',setDailyMemo:async(date,text)=>{saved.set(date,text);writes.push([date,text]);}},toast:()=>{},window:{registerPage:(_,mod)=>page=mod}});
  vm.runInContext(read('src/pages/daily_memo.js'),ctx);
  await page.render({innerHTML:'',style:{}});await page.init();
  els.mt.value='작성한 내용';els.mt.oninput();await ctx.window.__msel('2026-10-05');
  assert.equal(saved.get('2026-10-04'),'작성한 내용');assert.equal(els.mt.value,'');
  els.mt.value='다음 날 메모';els.mt.oninput();await page.beforeLeave();
  assert.equal(saved.get('2026-10-05'),'다음 날 메모');assert.equal(writes.length,2);
});

test('cloud updates preserve current editor and never initialize detached pages', async () => {
  const calls=[];
  const ctx=context({window:{updateClassInfo:async()=>calls.push('header'),reloadTopNavigation:async()=>calls.push('nav'),__pages:{dashboard:{refresh:()=>assert.fail('no redraw')},timetable:{init:()=>assert.fail('no detached init')}}},buildCloudSettingsPayload:data=>data,withRemoteApply:fn=>Promise.resolve().then(fn),originalSetSetting:async()=>{},localStorage:{setItem:()=>{}},api:{replaceTimetable:async()=>calls.push('database')}});
  vm.runInContext(section(index,'  function refreshSharedPages()','  window.syncCloudSharedNow'),ctx);
  vm.runInContext(section(index,'  function applyCloudSettingsPayload','  function sanitizeTodoForCloud'),ctx);
  vm.runInContext(section(index,'  function applyCloudSharedItems','  window.syncCloudSettingsNow'),ctx);
  await ctx.applyCloudSettingsPayload({teacher_name:'교사'});await ctx.applyCloudSharedItems(null,[]);
  assert(calls.includes('database'));assert(calls.includes('header'));
});

test('all edited renderer scripts and inline HTML scripts parse', () => {
  for(const file of ['main.js','preload.js','src/api.js','src/database.js','src/pages/students.js','src/pages/timetable.js','src/pages/daily_memo.js'])new vm.Script(read(file),{filename:file});
  for(const file of ['src/index.html','src/widget.html'])for(const match of read(file).matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(match[1].trim())new vm.Script(match[1],{filename:file});
});

test('Google OAuth configuration loads local credentials and rejects mismatched client IDs', () => {
  const {resolveGoogleOAuthConfig,parseDesktopClient}=require('../src/google_oauth_config');
  const temp=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'oauth-config-test-'));
  const file=path.join(temp,'client.json');
  const clientId='test-client.apps.googleusercontent.com';
  try {
    assert.equal(resolveGoogleOAuthConfig({clientId,env:{}}).clientSecret,'');
    fs.writeFileSync(file,JSON.stringify({installed:{client_id:clientId,client_secret:'test-only-local-value'}}));
    const options={clientId,env:{},paths:[file],bundledSecret:'test-only-bundled-value'};
    assert.equal(resolveGoogleOAuthConfig(options).clientSecret,'test-only-local-value');
    assert.equal(resolveGoogleOAuthConfig({...options,env:{GOOGLE_CALENDAR_CLIENT_SECRET:'test-only-env-value'}}).clientSecret,'test-only-env-value');
    assert.throws(()=>parseDesktopClient({web:{client_id:clientId,client_secret:'test'}},clientId));
    assert.throws(()=>parseDesktopClient({installed:{client_id:'wrong',client_secret:'test'}},clientId));
    fs.writeFileSync(file,'invalid json');
    assert.throws(()=>resolveGoogleOAuthConfig(options));
  } finally {fs.rmSync(temp,{recursive:true,force:true});}
});

test('Google token refresh includes resolved secret and reports configuration read failures', async () => {
  const handlers={};let config={clientId:'test-client',clientSecret:'test-only-value'},payload,requests=0;
  const ctx=context({ipcMain:{handle:(name,fn)=>handlers[name]=fn},getGoogleCalendarOAuthConfig:()=>config,URLSearchParams,Buffer,https:{request:(_,onResponse)=>{
    requests++;const events={};
    onResponse({on:(name,fn)=>events[name]=fn});
    return {on:()=>{},write:body=>{payload=new URLSearchParams(body);},end:()=>{events.data('{"access_token":"test-token"}');events.end();}};
  }}});
  vm.runInContext(section(read('main.js'),"ipcMain.handle('gcal-refresh-token'",'function googleCalendarRequest'),ctx);
  const result=await handlers['gcal-refresh-token']({},'test-refresh-token');
  assert.equal(result.access_token,'test-token');assert.equal(payload.get('client_secret'),'test-only-value');
  config={error:'configuration read failed'};
  assert((await handlers['gcal-refresh-token']({},'test-refresh-token')).error);assert.equal(requests,1);
});


test('existing Google client credentials remain paired even when the built-in client differs', () => {
  const {resolveGoogleOAuthConfig}=require('../src/google_oauth_config');
  const result=resolveGoogleOAuthConfig({clientId:'built-in-client',bundledSecret:'bundled-test-secret',
    savedClientId:'existing-client',savedClientSecret:'existing-test-secret',
    env:{GOOGLE_CALENDAR_CLIENT_SECRET:'environment-test-secret'}});
  assert.deepEqual(result,{clientId:'existing-client',clientSecret:'existing-test-secret'});
  const partial=resolveGoogleOAuthConfig({clientId:'built-in-client',bundledSecret:'bundled-test-secret',savedClientSecret:'unpaired-test-secret',env:{}});
  assert.deepEqual(partial,{clientId:'built-in-client',clientSecret:'bundled-test-secret'});
});

test('Google reconnect uses saved credentials without requesting a JSON file', async () => {
  const handlers={};let callback,authUrl,tokenBody,browserMessage;
  const {resolveGoogleOAuthConfig}=require('../src/google_oauth_config');
  const server={listen:(_port,_host,ready)=>ready(),address:()=>({port:12345}),on:(_name,fn)=>{callback=fn;},close:()=>{}};
  const ctx=context({ipcMain:{handle:(name,fn)=>handlers[name]=fn},resolveGoogleOAuthConfig,
    GOOGLE_CALENDAR_CLIENT_ID:'built-in-client',GOOGLE_CALENDAR_CLIENT_SECRET:'',
    db:{getSetting:key=>({gcal_client_id:'existing-client',gcal_client_secret:'existing-test-secret'}[key]||'')},
    app:{getPath:()=>'/unused',isPackaged:true},path,__dirname:root,
    GOOGLE_OAUTH_SCOPES:['test-scope'],http:{createServer:()=>server},shell:{openExternal:url=>{authUrl=new URL(url);}},
    createPkcePair:()=>({verifier:'test-verifier',challenge:'test-challenge'}),URL,URLSearchParams,Buffer,
    setTimeout:()=>1,clearTimeout:()=>{},dialog:{showMessageBox:()=>assert.fail('must not require a new JSON file')},
    https:{request:(_,onResponse)=>{const events={};onResponse({on:(name,fn)=>events[name]=fn});return {
      setTimeout:()=>{},on:()=>{},write:body=>{tokenBody=new URLSearchParams(body);},
      end:()=>{events.data('{"refresh_token":"test-refresh"}');events.end();}
    };}}
  });
  const main=read('main.js');
  vm.runInContext(section(main,'function getGoogleCalendarOAuthConfig','function buildManualPdfHtml'),ctx);
  vm.runInContext(section(main,"ipcMain.handle('gcal-oauth-start'","ipcMain.handle('gcal-refresh-token'"),ctx);
  const result=handlers['gcal-oauth-start']({});
  await callback({url:'/?code=test-code'},{writeHead:()=>{},end:value=>{browserMessage=value;}});
  assert.equal((await result).refresh_token,'test-refresh');
  assert.equal(authUrl.searchParams.get('client_id'),'existing-client');
  assert.equal(tokenBody.get('client_id'),'existing-client');
  assert.equal(tokenBody.get('client_secret'),'existing-test-secret');
  assert(browserMessage.includes('연동 완료'));
});

test('backup restore reopens the connection for the same account', async () => {
  const db=database(); const temp=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'restore-test-'));
  try {
    const backup=path.join(temp,'backup.db');const target=path.join(temp,'target.db');
    db.addStudent({number:1,name:'백업 학생'});await db.backupTo(backup);
    await db.backupTo(target);
    const D=db.constructor;const active=new D({dbPath:target});active.addStudent({number:2,name:'복원 전 학생'});
    const ctx=context({db:active,activeDbUserId:'same',AppDatabase:class extends D {
      constructor(){super({dbPath:target});}
      static getPathForUser(){return target;}
      static getDefaultPath(){return target;}
    },path,fs,removeSqliteSidecars:file=>{for(const suffix of ['-wal','-shm'])if(fs.existsSync(file+suffix))fs.rmSync(file+suffix);}});
    vm.runInContext(section(read('main.js'),'function openDatabaseForUser','function clearLocalGradeDataEverywhere'),ctx);
    active.close();fs.copyFileSync(backup,target);
    const result=ctx.openDatabaseForUser('same');
    assert.equal(result.migrated,false);assert.equal(result.skippedExistingAccount,false);
    const opened=result.db;
    assert.equal(opened.getStudents().length,1);assert.notEqual(opened,active);opened.close();
  } finally {db.close();fs.rmSync(temp,{recursive:true,force:true});}
});

test('SQLite snapshot includes committed WAL data while the source is open', () => {
  const helper=database();const D=helper.constructor;helper.close();
  const temp=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'wal-snapshot-'));
  const source=new D({dbPath:path.join(temp,'source.db')});
  try {
    source.addStudent({number:1,name:'최신 학생'});
    D.snapshotFile(source.getPath(),path.join(temp,'copy.db'));
    const copy=new D({dbPath:path.join(temp,'copy.db')});
    assert.equal(copy.getStudents()[0].name,'최신 학생');copy.close();
  } finally {source.close();fs.rmSync(temp,{recursive:true,force:true});}
});

test('score batches clear blanks, reject invalid ranges and roll back partial writes', () => {
  const db=database();try{
    const id=db.addStudent({number:1,name:'학생'}),assessment=db.addAssessment({name:'평가',max_score:20});
    const item={student_id:id,assessment_id:assessment};
    db.setAssessmentScore({...item,score:10});
    assert.throws(()=>db.setAssessmentScores([{...item,score:15},{...item,score:21}]));
    assert.equal(db.getAssessmentScores(assessment)[0].score,10);
    for(const score of [-1,NaN,Infinity,21])assert.throws(()=>db.setAssessmentScore({...item,score}));
    db.setAssessmentScores([{...item,score:''}]);assert.equal(db.getAssessmentScores(assessment).length,0);
    db.setAssessmentScore({...item,score:0});assert.equal(db.getAssessmentScores(assessment)[0].score,0);
  }finally{db.close();}
});

test('deleted tasks stay deleted until both external deletions are acknowledged', () => {
  const db=database();try{
    const id=db.addTodo({title:'삭제할 일'});db.setTodoGoogleTaskId(id,'task-1');db.setTodoGcalId(id,'calendar-1');
    db.deleteTodo(id);assert.equal(db.getTodos(true).length,0);assert.equal(db.getGoogleDeletions().length,2);
    db.applyGoogleTask({id:'task-1',title:'서버에 남음'});assert.equal(db.getTodos(true).length,0);
    db.acknowledgeGoogleDeletion('task','task-1');assert.equal(db.getGoogleDeletions().length,1);
    db.acknowledgeGoogleDeletion('calendar','calendar-1');assert.equal(db.getGoogleDeletions().length,0);
    db.setTodoGoogleTaskId(id,'late-response');assert.equal(db.getGoogleDeletions()[0].remote_id,'late-response');
  }finally{db.close();}
});

test('Google task conflict handling compares instants and keeps unsent local edits', () => {
  const db=database();try{
    db.applyGoogleTask({id:'remote',title:'첫 내용',updated:'2026-10-05T01:00:00Z'});
    db.applyGoogleTask({id:'remote',title:'500ms 후',updated:'2026-10-05T01:00:00.500Z'});
    assert.equal(db.getTodos(true)[0].title,'500ms 후');
    const todo=db.getTodos(true)[0];db.updateTodo(todo.id,{title:'로컬 변경'});
    db.applyGoogleTask({id:'remote',title:'덮어쓰기',updated:'2099-01-01T00:00:00Z'});
    assert.equal(db.getTodos(true)[0].title,'로컬 변경');
    db.markTodoGoogleSynced(todo.id,'wrong-timestamp');assert.equal(db.getTodos(true)[0].google_dirty,1);
    const latest=db.getTodos(true)[0];db.markTodoGoogleSynced(latest.id,latest.updated_at);assert.equal(db.getTodos(true)[0].google_dirty,0);
  }finally{db.close();}
});

test('cloud save failure propagates to logout and close instead of claiming success', async () => {
  const ctx=context({authUser:{uid:'user'},window:{syncCloudNow:async()=>{throw Error('network failure');}},getLocalDeviceId:()=> 'device',getSessionDoc:()=>assert.fail('must not release session on failed sync')});
  vm.runInContext(section(index,'  function releaseCurrentSession()','  function ensureAuthOverlay()'),ctx);
  await assert.rejects(ctx.releaseCurrentSession(),/network failure/);
});

test('class-specific assessment statistics count only matching students and scores', async () => {
  let output;const ctx=context({window:{registerPage:()=>{}},document:{getElementById:()=>({set innerHTML(value){output=value;}})},api:{getAssessments:async()=>[{id:1,name:'평가',class_group:'1반',max_score:100}],getStudents:async()=>[{id:1,class_group:'1반'},{id:2,class_group:'2반'}],getAssessmentScores:async()=>[{student_id:1,score:90},{student_id:2,score:10}]}});
  vm.runInContext(section(read('src/pages/statistics.js'),'async function loadAStat()','window.registerPage'),ctx);
  await ctx.loadAStat();assert(output.includes('1/1명'));assert(output.includes('90.0점'));
});

test('official document navigation can be cancelled without losing edits', async () => {
  const ctx=context({documentDirty:true,confirm:()=>false});
  vm.runInContext(section(read('src/pages/official_document.js'),'  function beforeLeave()','  function init()'),ctx);
  assert.equal(ctx.beforeLeave(),false);assert.equal(ctx.documentDirty,true);
  ctx.confirm=()=>true;assert.equal(ctx.beforeLeave(),true);assert.equal(ctx.documentDirty,false);
  const nav=navigationContext(()=>assert.fail('cancelled editor must remain mounted'));
  nav.flushActivePage=async()=>false;await nav.navigateTo('other');assert.equal(nav.currentPage,'original');
});

test('Google sync stops on failed deletion and retries pending local changes without resurrection', async () => {
  const db=database();try{
    const removed=db.addTodo({title:'삭제'});db.setTodoGoogleTaskId(removed,'gone');db.deleteTodo(removed);
    let failDelete=true,remote=[{id:'gone',title:'삭제',updated:'2026-10-05T00:00:00Z'}];
    const ctx=context({window:{},console,getGoogleTasksToken:async()=> 'token',
      buildGoogleTaskFromLocal:(_,todo)=>todo,syncTodoCalendarAfterUpdate:async()=>true,
      originalDeleteTodo:async id=>db.deleteTodo(id),originalSetTodoGoogleTaskId:async(id,task)=>db.setTodoGoogleTaskId(id,task),
      api:{flushGoogleDeletions:async()=>{
        if(failDelete)return {error:'offline'};
        for(const item of db.getGoogleDeletions()){remote=remote.filter(t=>t.id!==item.remote_id);db.acknowledgeGoogleDeletion(item.kind,item.remote_id);}
        return {ok:true};
      },googleTasksListTasks:async()=>({items:remote}),getTodos:async()=>db.getTodos(true),applyGoogleTask:async task=>db.applyGoogleTask(task),
      googleTasksAddTask:async(_,todo)=>{remote.push({id:'new',title:todo.title});return {id:'new'};},
      googleTasksUpdateTask:async(_,id,todo)=>{Object.assign(remote.find(t=>t.id===id),{title:todo.title});return {id};},
      markTodoGoogleSynced:async(id,time)=>db.markTodoGoogleSynced(id,time)}});
    vm.runInContext(section(index,'  var _gtasksSyncing','  function syncWithGoogleTasks()'),ctx);
    assert((await ctx.performGoogleTaskSync()).error);assert.equal(db.getTodos(true).length,0);
    failDelete=false;assert((await ctx.performGoogleTaskSync()).ok);assert.equal(db.getTodos(true).length,0);
    const id=db.addTodo({title:'오프라인 작성'});assert((await ctx.performGoogleTaskSync()).ok);
    assert.equal(remote[0].title,'오프라인 작성');assert.equal(db.getTodos(true)[0].google_dirty,0);
    db.updateTodo(id,{title:'수정 재시도'});assert((await ctx.performGoogleTaskSync()).ok);
    assert.equal(remote[0].title,'수정 재시도');assert.equal(db.getTodos(true)[0].google_dirty,0);
  }finally{db.close();}
});


test('assessment score writes reject students in a different class even with the same number', () => {
  const db=database();
  try {
    const first=db.addStudent({number:1,name:'가',class_group:'1학년 1반'});
    const other=db.addStudent({number:1,name:'나',class_group:'1학년 2반'});
    const assessment=db.addAssessment({name:'음악',class_group:'1학년 1반',max_score:100});
    assert.throws(()=>db.setAssessmentScores([{assessment_id:assessment,student_id:first,score:80},{assessment_id:assessment,student_id:other,score:90}]),/대상 학급/);
    assert.equal(db.getAssessmentScores(assessment).length,0);
    db.setAssessmentScore({assessment_id:assessment,student_id:first,score:80});
    assert.equal(db.getAssessmentScores(assessment)[0].student_id,first);
  } finally { db.close(); }
});

test('password reset validates email, prevents duplicate requests and allows retry after failure', async () => {
  const pending=deferred();let requests=0;
  const input={value:' Teacher@Example.com ',checkValidity:()=>true,focus:()=>{}};
  const button={disabled:false,textContent:''},status={textContent:''};
  const ctx=context({document:{getElementById:id=>({'auth-reset-email':input,'auth-reset-send':button,'auth-reset-status':status}[id])},
    normalizeEmail:v=>v.trim().toLowerCase(),ensureFirebase:()=>{},
    firebaseAuth:{sendPasswordResetEmail:email=>{requests++;assert.equal(email,'teacher@example.com');return pending.promise;}},
    parseFirebaseError:()=> '네트워크 연결을 확인해 주세요.'});
  vm.runInContext(section(read('src/index.html'),'  async function sendAuthPasswordReset()', '  function renderAuthOverlay('),ctx);
  input.checkValidity=()=>false;await ctx.sendAuthPasswordReset();assert.equal(requests,0);
  input.checkValidity=()=>true;const first=ctx.sendAuthPasswordReset();await ctx.sendAuthPasswordReset();assert.equal(requests,1);assert.equal(button.disabled,true);
  pending.reject({code:'auth/network-request-failed'});await first;assert.equal(button.disabled,false);assert.match(status.textContent,/네트워크/);
  ctx.firebaseAuth.sendPasswordResetEmail=async()=>{};await ctx.sendAuthPasswordReset();assert.match(status.textContent,/스팸함/);assert.equal(ctx.firebaseAuth.languageCode,'ko');
  ctx.firebaseAuth.sendPasswordResetEmail=async()=>{throw {code:'auth/too-many-requests'};};await ctx.sendAuthPasswordReset();assert.match(status.textContent,/잠시 후/);
  ctx.firebaseAuth.sendPasswordResetEmail=async()=>{throw {code:'auth/user-not-found'};};await ctx.sendAuthPasswordReset();assert.match(status.textContent,/가입된 이메일이면/);
});
