const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'teacher-app-smoke-'));
app.setPath('userData',temp);
let win;
const students=[{id:1,number:1,name:'테스트',class_group:'3학년 2반',phone:'010-1234-5678',parent_phone:'010-9876-5432',address:'기존 주소',note:'기존 메모'}];
const memos=new Map();let timetable=[];const settings={};
for(const [channel,handler] of Object.entries({
 'get-students':()=>students,'update-student':(_,id,data)=>Object.assign(students.find(s=>s.id===id),data),
 'get-daily-memos':()=>[],'get-daily-memo':(_,d)=>memos.get(d)||'',
 'set-daily-memo':(_,d,v)=>{memos.set(d,v);return true;},
 'get-timetable':()=>timetable,'replace-timetable':(_,data)=>{timetable=data;return true;},
 'get-setting':(_,key,def)=>settings[key]??def,'get-all-settings':()=>settings,'set-setting':(_,key,value)=>{settings[key]=String(value);return true;},'get-assessments':()=>[]
}))ipcMain.handle(channel,handler);
app.whenReady().then(async()=>{
 win=new BrowserWindow({show:false,webPreferences:{preload:path.join(root,'preload.js'),contextIsolation:true,nodeIntegration:false}});
 win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_,done)=>done({cancel:true}));
 await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><html lang="ko"><body><main id="page-content"></main><div id="modal"></div></body></html>'));
 await win.webContents.executeJavaScript(fs.readFileSync(path.join(root,'src/api.js'),'utf8')+';void 0');
 assert.equal(await win.webContents.executeJavaScript('Object.isFrozen(window.nativeApi) && !Object.isFrozen(window.api)'),true);
 await win.webContents.executeJavaScript(`window.__pages={};window.registerPage=(key,mod)=>window.__pages[key]=mod;window.toast=()=>{};window.today=()=> '2026-10-04';window.showModal=html=>document.getElementById('modal').innerHTML=html;window.closeModal=()=>document.getElementById('modal').innerHTML='';void 0;`);
 await win.webContents.executeJavaScript(fs.readFileSync(path.join(root,'src/school_profile.js'),'utf8')+';void 0');
 for(const name of ['students','daily_memo','timetable','onboarding','assessments'])await win.webContents.executeJavaScript(fs.readFileSync(path.join(root,'src/pages',name+'.js'),'utf8')+';void 0');
 await win.webContents.executeJavaScript(`(async()=>{await __pages.students.render(document.getElementById('page-content'));await __pages.students.init();await __stEdit(1);if(document.getElementById('s-phone').value!=='010-1234-5678')throw Error('contact field not populated');document.getElementById('s-name').value='수정한 이름';await document.getElementById('s-save').onclick();})()`);
 assert.equal(students[0].phone,'010-1234-5678');assert.equal(students[0].name,'수정한 이름');
 await win.webContents.executeJavaScript(`(async()=>{await __pages.daily_memo.render(document.getElementById('page-content'));await __pages.daily_memo.init();const input=document.getElementById('mt');input.value='실제 DOM 메모';input.dispatchEvent(new Event('input'));await __pages.daily_memo.beforeLeave();})()`);
 assert.equal(memos.get('2026-10-04'),'실제 DOM 메모');
 await win.webContents.executeJavaScript(`(async()=>{await __pages.timetable.render(document.getElementById('page-content'));await __pages.timetable.init();const input=document.getElementById('ts-0-1');input.value='수학';input.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('page-content').innerHTML='다른 화면';await __pages.timetable.beforeLeave();})()`);
 assert.equal(timetable[0].subject,'수학');
 await win.webContents.executeJavaScript(`(async()=>{
 window.navigateTo=async()=>{};
 await __pages.onboarding.render(document.getElementById('page-content'));await __pages.onboarding.init();
 const type=document.getElementById('ob-type');type.value='중학교';type.onchange();
 if(document.querySelectorAll('[data-grade]').length!==3)throw Error('middle school grade count');
 const count=document.querySelector('[data-grade="1"]');count.value='6';count.onchange();
 for(const label of ['1학년 1반','1학년 2반','1학년 3반']){const el=document.querySelector('[data-class="'+label+'"]');el.checked=true;el.onchange();}
 document.getElementById('ob-subject').value='음악';await document.getElementById('ob-save').onclick();
 await __pages.students.render(document.getElementById('page-content'));await __pages.students.init();
 if(!document.getElementById('st-class-tabs').textContent.includes('1학년 3반'))throw Error('empty configured class missing');
 await __pages.assessments.render(document.getElementById('page-content'));await __pages.assessments.init();await document.getElementById('as-add').onclick();
 if(document.getElementById('as-s').value!=='음악')throw Error('subject default');
 if(!document.getElementById('as-cls').textContent.includes('1학년 2반'))throw Error('assessment class options');
 })()`);
 const indexSource=fs.readFileSync(path.join(root,'src/index.html'),'utf8');
 const authSource=indexSource.slice(indexSource.indexOf('  function escapeAuthHtml('),indexSource.indexOf('  function createOrUpdateUserProfile('));
 await win.webContents.executeJavaScript(`window.authScreenMode='login';window.ensureAuthOverlay=()=>{let el=document.getElementById('auth-overlay');if(!el){el=document.createElement('div');el.id='auth-overlay';document.body.appendChild(el);}return el;};window.getAuthState=()=>({});window.setAuthLocked=()=>{};window.ensureFirebase=()=>{};window.normalizeEmail=v=>v.trim().toLowerCase();window.parseFirebaseError=()=> '연결 오류';window.firebaseAuth={sendPasswordResetEmail:async email=>{window.resetRequestedEmail=email;}};void 0;`);
 await win.webContents.executeJavaScript(authSource+';void 0');
 await win.webContents.executeJavaScript(`(async()=>{
 renderAuthOverlay('form','','teacher@example.com');document.getElementById('auth-forgot-btn').click();
 if(document.getElementById('auth-password'))throw Error('reset view still requests password');
 if(document.getElementById('auth-reset-email').value!=='teacher@example.com')throw Error('email not preserved');
 await document.getElementById('auth-reset-form').onsubmit({preventDefault(){}});
 if(window.resetRequestedEmail!=='teacher@example.com')throw Error('reset request failed');
 if(!document.getElementById('auth-reset-status').textContent.includes('스팸함'))throw Error('missing reset guidance');
 document.getElementById('auth-reset-back').click();if(!document.getElementById('auth-password'))throw Error('cannot return to login');
 })()`);
 assert.equal(settings.onboarding_complete,'1');assert.equal(JSON.parse(settings.school_profile).counts['1'],6);
 assert.equal(students.length,1);assert.equal(students[0].class_group,'3학년 2반');
 console.log('Electron smoke passed: isolated bridge, contacts form, memo autosave, timetable navigation save');
 win.destroy();app.quit();
}).catch(error=>{console.error(error);if(win)win.destroy();app.exit(1);});
app.on('will-quit',()=>{try{fs.rmSync(temp,{recursive:true,force:true});}catch{}});
