(function(){
function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch];});}

// 현재 전역 AI 설정을 보고 로컬/클라우드 라우팅 정보를 만든다.
function resolveAiEngine(s){
  s=s||{};
  var eng=s.ai_engine||'local_lite';
  var localEngine=(eng==='local_lite'||eng==='local_basic'||eng==='local_pro')?eng:'';
  var externalProvider=eng==='gemini'?'gemini':((eng==='claude'||eng==='cloud')?'claude':'');
  var apiKey=s.ai_api_key||'';
  var canCloud=!!(externalProvider&&apiKey);
  return {localEngine:localEngine,externalProvider:externalProvider,apiKey:apiKey,model:s.ai_model||'',canCloud:canCloud};
}

// 선택된 항목으로 실제 AI 호출. 클라우드면 sensitive:true로 메인 프로세스가 가명화 후 전송한다.
async function runAi(question,context){
  var s=await api.getAllSettings();
  var e=resolveAiEngine(s);
  if(e.canCloud){
    return api.aiAssistantChat({provider:e.externalProvider,model:e.model,apiKey:e.apiKey,page:'AI 분석',question:question,context:context,sensitive:true});
  }
  return api.aiLocalChat({engine:e.localEngine||'local_lite',page:'AI 분석',question:question,context:context});
}

async function render(c){
  c.innerHTML=`<div class="page-wrap">
  <div class="page-header"><h1 class="page-header-title">🤖 AI 분석</h1></div>
  <div id="ai-engine-badge" style="margin-bottom:12px;font-size:12px;color:var(--text2)"></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <div class="card" style="padding:20px">
      <div class="card-title" style="margin-bottom:12px">📝 학생 종합 분석</div>
      <div class="form-row"><label>학생 선택</label><select class="input" id="ai-stu"></select></div>
      <button class="btn btn-primary" id="ai-ab" style="width:100%;margin-bottom:12px">🔒 전송 항목 선택 후 분석</button>
      <div id="ai-ar" style="font-size:13px;line-height:1.7;color:var(--text);white-space:pre-wrap;background:var(--bg);padding:12px;border-radius:8px;min-height:120px"></div>
    </div>
    <div class="card" style="padding:20px;display:flex;flex-direction:column">
      <div class="card-title" style="margin-bottom:12px">💬 AI 대화</div>
      <div id="ai-log" style="flex:1;overflow-y:auto;background:var(--bg);border-radius:8px;padding:12px;margin-bottom:8px;font-size:13px;min-height:200px"></div>
      <div style="display:flex;gap:8px">
        <input class="input" id="ai-ci" placeholder="질문을 입력하세요...">
        <button class="btn btn-primary" id="ai-cs">전송</button>
      </div>
    </div>
  </div>
  </div>`;
}
async function init(){
  const students=await api.getStudents();
  const sel=document.getElementById('ai-stu');
  sel.innerHTML=students.map(s=>`<option value="${s.id}">${esc(s.number)}번 ${esc(s.name)}</option>`).join('');
  document.getElementById('ai-ab').onclick=openPicker;
  document.getElementById('ai-cs').onclick=chat;
  document.getElementById('ai-ci').onkeydown=e=>{if(e.key==='Enter')chat();};
  refreshEngineBadge();
}
async function refreshEngineBadge(){
  const badge=document.getElementById('ai-engine-badge');if(!badge)return;
  const e=resolveAiEngine(await api.getAllSettings());
  if(e.canCloud){
    badge.innerHTML=`☁️ 현재 <strong>클라우드 AI(${esc(e.externalProvider)})</strong> 사용 중 · 선택한 항목만 전송되며 이름·연락처·주소는 자동 가명화됩니다.`;
  }else{
    badge.innerHTML=`💻 현재 <strong>로컬 AI</strong> 사용 중 · 모든 분석이 이 기기 안에서 처리되어 외부로 전송되지 않습니다.`;
  }
}

// "분석 시작" → 학생의 항목들을 모아 체크 선택 팝업을 띄운다.
async function openPicker(){
  const sid=parseInt(document.getElementById('ai-stu').value);
  if(isNaN(sid)){return;}
  const students=await api.getStudents();const s=students.find(x=>x.id===sid);
  if(!s)return;
  const co=await api.getCounseling({student_id:sid});
  const ob=await api.getObservations({student_id:sid});
  const att=await api.getAttendanceStats(new Date().getFullYear(),0);
  const as=att.find(a=>a.id===sid);
  const e=resolveAiEngine(await api.getAllSettings());

  const notice=e.canCloud
    ? `<div style="background:var(--bg);border-left:3px solid var(--accent);padding:10px 12px;border-radius:6px;font-size:12px;color:var(--text2);margin-bottom:14px">☁️ 체크한 항목만 <strong>클라우드 AI</strong>로 전송됩니다. 이름·연락처·주소·생년월일은 자동 가명화되지만, <strong>상담/관찰 내용 본문은 그대로 전송</strong>됩니다. 민감한 항목은 체크를 해제하세요.</div>`
    : `<div style="background:var(--bg);border-left:3px solid var(--accent);padding:10px 12px;border-radius:6px;font-size:12px;color:var(--text2);margin-bottom:14px">💻 <strong>로컬 AI</strong> 사용 중이라 선택한 항목은 기기 밖으로 나가지 않습니다. 분석에 포함할 항목만 골라 주세요.</div>`;

  function row(k,i,checked,title,preview){
    return `<label style="display:flex;gap:8px;align-items:flex-start;padding:7px 4px;font-size:13px;cursor:pointer;border-bottom:1px solid var(--border)">
      <input type="checkbox" data-k="${k}"${i==null?'':` data-i="${i}"`}${checked?' checked':''} style="margin-top:3px">
      <span><strong>${esc(title)}</strong>${preview?`<br><span style="color:var(--text2)">${esc(preview)}</span>`:''}</span></label>`;
  }
  function preview(t){t=String(t||'').replace(/\s+/g,' ').trim();return t.length>60?t.slice(0,60)+'…':t;}

  let html=`<div class="modal-header"><span class="modal-title">🔒 AI로 전송할 항목 선택 · ${esc(s.name)}</span><button class="modal-close" data-close>✕</button></div>
  <div class="modal-body" style="max-height:62vh;overflow-y:auto">
    ${notice}
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:6px">
      <button class="btn btn-secondary" id="ai-pick-all" style="padding:4px 10px;font-size:12px">전체 선택</button>
      <button class="btn btn-secondary" id="ai-pick-none" style="padding:4px 10px;font-size:12px">전체 해제</button>
    </div>
    ${row('basic',null,true,'기본 정보',`이름·번호 (이름은 가명 처리됨)`)}
    ${row('att',null,true,'출결',`결석 ${as?as.absent:0}회 · 지각 ${as?as.late:0}회`)}`;

  if(co.length){
    html+=`<div style="margin:12px 0 4px;font-size:12px;font-weight:600;color:var(--text2)">상담 기록 ${co.length}건</div>`;
    co.forEach((c,i)=>{html+=row('co',i,true,c.date||'날짜 미상',preview(c.content));});
  }
  if(ob.length){
    html+=`<div style="margin:12px 0 4px;font-size:12px;font-weight:600;color:var(--text2)">관찰 기록 ${ob.length}건</div>`;
    ob.forEach((o,i)=>{html+=row('ob',i,true,`${o.date||'날짜 미상'} ${o.subject?`[${o.subject}]`:''}`,preview(o.content));});
  }
  html+=`</div>
  <div class="modal-footer">
    <button class="btn btn-secondary" data-close>취소</button>
    <button class="btn btn-primary" id="ai-run">선택 항목으로 분석</button>
  </div>`;

  showModal(html);
  const allBtn=document.getElementById('ai-pick-all');
  const noneBtn=document.getElementById('ai-pick-none');
  const boxes=()=>Array.prototype.slice.call(document.querySelectorAll('.modal-body input[type=checkbox][data-k]'));
  if(allBtn)allBtn.onclick=()=>boxes().forEach(b=>b.checked=true);
  if(noneBtn)noneBtn.onclick=()=>boxes().forEach(b=>b.checked=false);
  document.getElementById('ai-run').onclick=()=>{
    const picked={basic:false,att:false,co:[],ob:[]};
    boxes().forEach(b=>{
      if(!b.checked)return;
      const k=b.getAttribute('data-k');
      if(k==='basic')picked.basic=true;
      else if(k==='att')picked.att=true;
      else if(k==='co')picked.co.push(parseInt(b.getAttribute('data-i')));
      else if(k==='ob')picked.ob.push(parseInt(b.getAttribute('data-i')));
    });
    closeModal();
    analyze(s,as,co,ob,picked);
  };
}

async function analyze(s,as,co,ob,picked){
  const parts=[];
  if(picked.basic)parts.push(`학생: ${s.name} (${s.number}번)`);
  if(picked.att)parts.push(`결석: ${as?as.absent:0}회, 지각: ${as?as.late:0}회`);
  if(picked.co.length){
    parts.push(`상담 ${picked.co.length}건:\n`+picked.co.map(i=>`- ${co[i].date}: ${String(co[i].content||'').slice(0,200)}`).join('\n'));
  }
  if(picked.ob.length){
    parts.push(`관찰 ${picked.ob.length}건:\n`+picked.ob.map(i=>`- ${ob[i].date}[${ob[i].subject||''}]: ${String(ob[i].content||'').slice(0,200)}`).join('\n'));
  }
  const text=parts.join('\n');
  const btn=document.getElementById('ai-ab'),ar=document.getElementById('ai-ar');
  if(!text.trim()){ar.textContent='전송할 항목을 1개 이상 선택해 주세요.';return;}
  btn.disabled=true;btn.textContent='분석 중...';ar.textContent='AI가 분석 중입니다...';
  try{
    const result=await runAi('이 학생 정보를 바탕으로 담임교사가 참고할 상담/관찰 포인트와 후속 조치를 정리해 주세요.',text);
    ar.textContent=result.error?`오류: ${result.error}`:result.result||'분석 결과 없음';
  }catch(err){
    ar.textContent=`오류: ${err&&err.message||err}`;
  }
  btn.disabled=false;btn.textContent='🔒 전송 항목 선택 후 분석';
}

async function chat(){
  const input=document.getElementById('ai-ci'),msg=input.value.trim();if(!msg)return;
  const log=document.getElementById('ai-log');
  log.innerHTML+=`<div style="margin-bottom:8px"><strong style="color:var(--accent)">나: </strong>${esc(msg)}</div>`;
  input.value='';
  try{
    const result=await runAi(msg,'');
    const resp=result.error?`오류: ${result.error}`:result.result||'';
    log.innerHTML+=`<div style="margin-bottom:8px;padding:8px;background:var(--hover);border-radius:6px"><strong style="color:var(--text2)">AI: </strong>${esc(resp)}</div>`;
  }catch(err){
    log.innerHTML+=`<div style="margin-bottom:8px;color:var(--danger)">오류: ${esc(err&&err.message||err)}</div>`;
  }
  log.scrollTop=log.scrollHeight;
}
window.registerPage('ai_analysis',{render,init});
})();
