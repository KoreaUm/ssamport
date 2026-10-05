(function(){
let mY=new Date().getFullYear(),mM=new Date().getMonth()+1,selDate=null;
let dirty=false, saveQueue=Promise.resolve(), dateVersion=0;
async function render(c){
  selDate=today();
  c.innerHTML=`<div class="page-wrap">
  <div class="page-header"><h1 class="page-header-title">🗒️ 학급 메모</h1></div>
  <div style="display:grid;grid-template-columns:260px 1fr;gap:16px;height:calc(100vh - 180px)">
    <div class="card" style="overflow:hidden;display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid var(--border)">
        <button class="cal-nav-btn" id="mp">◀</button>
        <span id="ml" style="flex:1;text-align:center;font-weight:700;font-size:13px"></span>
        <button class="cal-nav-btn" id="mn">▶</button>
      </div>
      <div id="mc" class="scroll-area" style="padding:8px"></div>
    </div>
    <div class="card" style="overflow:hidden;display:flex;flex-direction:column">
      <div style="padding:14px 16px;border-bottom:1px solid var(--border);font-weight:600;font-size:13px" id="md"></div>
      <textarea id="mt" class="input" style="flex:1;border:none;border-radius:0;resize:none;font-size:14px;line-height:1.7;padding:16px" placeholder="이 날의 메모를 작성하세요..."></textarea>
      <div style="padding:10px 16px;border-top:1px solid var(--border);display:flex;justify-content:flex-end">
        <button class="btn btn-primary btn-sm" id="ms">저장</button>
      </div>
    </div>
  </div>
  </div>`;
}
async function init(){
  document.getElementById('mp').onclick=()=>{mM--;if(mM<1){mM=12;mY--;}renderCal();};
  document.getElementById('mn').onclick=()=>{mM++;if(mM>12){mM=1;mY++;}renderCal();};
  document.getElementById('ms').onclick=()=>save().catch(error=>toast('메모 저장 실패: '+error.message,'error'));
  document.getElementById('mt').oninput=()=>{
    dirty=true;
    save(false).catch(error=>toast('메모 저장 실패: '+error.message,'error'));
  };
  await renderCal();
  await selectDate(today());
}
async function renderCal(){
  if(!document.getElementById('ml'))return;
  document.getElementById('ml').textContent=`${mY}년 ${mM}월`;
  const memos=await api.getDailyMemos(mY,mM);
  const has=new Set(memos.filter(m=>m.content).map(m=>m.date));
  const first=new Date(mY,mM-1,1);const dim=new Date(mY,mM,0).getDate();
  const sd=first.getDay();const DAYS=['일','월','화','수','목','금','토'];
  let html=`<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px">
    ${DAYS.map((d,i)=>`<div style="text-align:center;font-size:10px;font-weight:600;color:${i===0?'var(--danger)':i===6?'var(--accent)':'var(--text3)'}">${d}</div>`).join('')}
  </div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">`;
  for(let i=0;i<sd;i++)html+='<div></div>';
  for(let d=1;d<=dim;d++){
    const ds=`${mY}-${String(mM).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isT=ds===today(),isSel=ds===selDate,hasMem=has.has(ds);
    const dow=new Date(mY,mM-1,d).getDay();
    const bg=isSel?'var(--accent)':isT?'var(--accent-l)':'transparent';
    const col=isSel?'white':isT?'var(--accent-d)':dow===0?'var(--danger)':dow===6?'var(--accent)':'var(--text)';
    html+=`<button onclick="window.__msel('${ds}')" style="background:${bg};color:${col};border:none;border-radius:6px;padding:4px 2px;font-size:11px;font-weight:600;cursor:pointer;position:relative">
      ${d}${hasMem?`<span style="position:absolute;bottom:2px;left:50%;transform:translateX(-50%);width:4px;height:4px;background:${isSel?'white':'var(--accent)'};border-radius:50%"></span>`:''}
    </button>`;
  }
  html+='</div>';
  const calendar=document.getElementById('mc');if(calendar)calendar.innerHTML=html;
}
window.__msel=d=>selectDate(d).catch(error=>toast('메모를 불러오지 못했습니다: '+error.message,'error'));
async function selectDate(ds){
  const version=++dateVersion;
  await save(false);
  if(version!==dateVersion)return;
  const ta=document.getElementById('mt');
  if(ta)ta.disabled=true;
  try {
    const content=await api.getDailyMemo(ds);
    if(version!==dateVersion)return;
    selDate=ds;
    dirty=false;
    const days=['일','월','화','수','목','금','토'];
    const dt=new Date(ds+'T00:00:00');
    const lbl=document.getElementById('md');
    if(lbl)lbl.textContent=`${dt.getFullYear()}년 ${dt.getMonth()+1}월 ${dt.getDate()}일 (${days[dt.getDay()]})`;
    if(ta)ta.value=content||'';
    await renderCal();
  } finally { if(version===dateVersion && ta)ta.disabled=false; }
}
async function save(notify=true){
  const ta=document.getElementById('mt');
  if(dirty && ta && selDate){
    const date=selDate, content=ta.value;
    dirty=false;
    const write=saveQueue.catch(()=>{}).then(()=>api.setDailyMemo(date,content));
    saveQueue=write;
    try { await write; }
    catch(error){ if(selDate===date)dirty=true;throw error; }
  }
  await saveQueue;
  if(notify){toast('저장되었습니다','success');await renderCal();}
}
async function beforeLeave(){
  ++dateVersion;
  try { await save(false); }
  finally {
    const input=document.getElementById('mt');
    if(input)input.disabled=false;
  }
}
window.registerPage('daily_memo',{render,init,beforeLeave});
})();
