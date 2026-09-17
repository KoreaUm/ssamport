(function(){

async function copyText(text, label){
  if(!text){toast('등록된 번호가 없습니다','error');return;}
  try{
    await navigator.clipboard.writeText(text);
    toast(`${label} 복사됨: ${text}`,'success');
  }catch(_){
    toast('복사에 실패했습니다','error');
  }
}
window.__ctCopy=(text,label)=>copyText(text,label);

async function render(c){
  c.innerHTML=`<div class="page-wrap">
  <div class="page-header"><h1 class="page-header-title">📞 연락처 검색</h1>
    <div class="page-header-actions">
      <input type="text" id="ct-search" class="input" placeholder="이름/번호/학급 검색..." style="width:200px" autofocus>
    </div>
  </div>
  <div id="ct-list" style="display:flex;flex-direction:column;gap:6px"></div>
  </div>`;
}

async function init(){
  await refresh();
  document.getElementById('ct-search').oninput=e=>refresh(e.target.value);
}

async function refresh(q=''){
  const list=document.getElementById('ct-list');
  if(!list)return;
  let students=await api.getStudents();
  students=[...students].sort((a,b)=>(a.class_group||'').localeCompare(b.class_group||'')||a.number-b.number);
  if(q){
    const qq=q.trim();
    students=students.filter(s=>s.name.includes(qq)||String(s.number).includes(qq)||(s.class_group||'').includes(qq));
  }
  if(!students.length){list.innerHTML='<div class="empty-state"><div class="icon">📞</div><p>검색 결과가 없습니다.</p></div>';return;}
  list.innerHTML=students.map(s=>`
    <div class="card" style="padding:10px 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <div style="min-width:120px">
        ${s.class_group?`<div style="font-size:11px;color:var(--accent);font-weight:600">${s.class_group} ${s.number}번</div>`:`<div style="font-size:11px;color:var(--text3)">${s.number}번</div>`}
        <div style="font-weight:700">${s.name}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;font-size:12px">
        <span style="color:var(--text3)">본인</span>
        <span style="color:var(--text2)">${s.phone||'-'}</span>
        ${s.phone?`<button class="btn btn-xs btn-secondary" onclick="window.__ctCopy('${s.phone}','${s.name} 본인 번호')">복사</button>`:''}
      </div>
      <div style="display:flex;align-items:center;gap:6px;font-size:12px">
        <span style="color:var(--text3)">보호자</span>
        <span style="color:var(--text2)">${s.parent_phone||'-'}</span>
        ${s.parent_phone?`<button class="btn btn-xs btn-secondary" onclick="window.__ctCopy('${s.parent_phone}','${s.name} 보호자 번호')">복사</button>`:''}
      </div>
    </div>`).join('');
}

window.registerPage('contacts',{render,init});
})();
