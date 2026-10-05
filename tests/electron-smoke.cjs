const {app,BrowserWindow,ipcMain}=require('electron');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'teacher-app-smoke-'));
app.setPath('userData',temp);
let win;
const students=[{id:1,number:1,name:'테스트',class_group:'3학년 2반',phone:'010-1234-5678',parent_phone:'010-9876-5432',address:'기존 주소',note:'기존 메모'}];
const memos=new Map();let timetable=[];
for(const [channel,handler] of Object.entries({
 'get-students':()=>students,'update-student':(_,id,data)=>Object.assign(students.find(s=>s.id===id),data),
 'get-daily-memos':()=>[],'get-daily-memo':(_,d)=>memos.get(d)||'',
 'set-daily-memo':(_,d,v)=>{memos.set(d,v);return true;},
 'get-timetable':()=>timetable,'replace-timetable':(_,data)=>{timetable=data;return true;},
 'get-setting':(_,key,def)=>def,'set-setting':()=>true
}))ipcMain.handle(channel,handler);
app.whenReady().then(async()=>{
 win=new BrowserWindow({show:false,webPreferences:{preload:path.join(root,'preload.js'),contextIsolation:true,nodeIntegration:false}});
 win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_,done)=>done({cancel:true}));
 await win.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><html lang="ko"><body><main id="page-content"></main><div id="modal"></div></body></html>'));
 await win.webContents.executeJavaScript(fs.readFileSync(path.join(root,'src/api.js'),'utf8')+';void 0');
 assert.equal(await win.webContents.executeJavaScript('Object.isFrozen(window.nativeApi) && !Object.isFrozen(window.api)'),true);
 await win.webContents.executeJavaScript(`window.__pages={};window.registerPage=(key,mod)=>window.__pages[key]=mod;window.toast=()=>{};window.today=()=> '2026-10-04';window.showModal=html=>document.getElementById('modal').innerHTML=html;window.closeModal=()=>document.getElementById('modal').innerHTML='';void 0;`);
 for(const name of ['students','daily_memo','timetable'])await win.webContents.executeJavaScript(fs.readFileSync(path.join(root,'src/pages',name+'.js'),'utf8')+';void 0');
 await win.webContents.executeJavaScript(`(async()=>{await __pages.students.render(document.getElementById('page-content'));await __pages.students.init();await __stEdit(1);if(document.getElementById('s-phone').value!=='010-1234-5678')throw Error('contact field not populated');document.getElementById('s-name').value='수정한 이름';await document.getElementById('s-save').onclick();})()`);
 assert.equal(students[0].phone,'010-1234-5678');assert.equal(students[0].name,'수정한 이름');
 await win.webContents.executeJavaScript(`(async()=>{await __pages.daily_memo.render(document.getElementById('page-content'));await __pages.daily_memo.init();const input=document.getElementById('mt');input.value='실제 DOM 메모';input.dispatchEvent(new Event('input'));await __pages.daily_memo.beforeLeave();})()`);
 assert.equal(memos.get('2026-10-04'),'실제 DOM 메모');
 await win.webContents.executeJavaScript(`(async()=>{await __pages.timetable.render(document.getElementById('page-content'));await __pages.timetable.init();const input=document.getElementById('ts-0-1');input.value='수학';input.dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('page-content').innerHTML='다른 화면';await __pages.timetable.beforeLeave();})()`);
 assert.equal(timetable[0].subject,'수학');
 console.log('Electron smoke passed: isolated bridge, contacts form, memo autosave, timetable navigation save');
 win.destroy();app.quit();
}).catch(error=>{console.error(error);if(win)win.destroy();app.exit(1);});
app.on('will-quit',()=>{try{fs.rmSync(temp,{recursive:true,force:true});}catch{}});
