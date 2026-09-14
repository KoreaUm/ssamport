(function(){
async function render(c){
  c.innerHTML=`<div class="page-wrap">
  <div class="page-header"><h1 class="page-header-title">📋 제출물 관리</h1>
    <button class="btn btn-primary" id="sb-add">+ 제출물 추가</button></div>
  <div id="sb-list" style="display:flex;flex-direction:column;gap:12px"></div>
  </div>`;
}
async function init(){await refresh();document.getElementById('sb-add').onclick=()=>showM(null);}
async function refresh(){
  const list=document.getElementById('sb-list');if(!list)return;
  const items=await api.getSubmissions({});
  if(!items.length){list.innerHTML='<div class="empty-state"><div class="icon">📋</div><p>제출물이 없습니다.</p></div>';return;}
  list.innerHTML=items.map(s=>`<div class="card" style="padding:16px">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <div><span style="font-size:15px;font-weight:700">${s.name}</span>
        <span class="badge badge-accent" style="margin-left:8px">${s.subject||'-'}</span>
        ${s.due_date?`<span class="badge badge-gray" style="margin-left:4px">마감: ${s.due_date}</span>`:''}
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-secondary btn-sm" onclick="window.__sbSt(${s.id})">제출 현황</button>
        <button class="btn btn-secondary btn-sm" onclick="window.__sbE(${s.id})">수정</button>
      </div>
    </div>
  </div>`).join('');
}
window.__sbE=async(id)=>{const items=await api.getSubmissions({});showM(items.find(s=>s.id===id));};
window.__sbSt=async(id)=>{
  const items=await api.getSubmissions({});const sub=items.find(s=>s.id===id);
  const students=await api.getStudents();const status=await api.getSubmissionStatus(id);
  const stMap={};for(const s of status)stMap[s.student_id]=s.submitted;
  const submitted=status.filter(s=>s.submitted).length;
  showModal(`<div class="modal-header"><span class="modal-title">제출 현황 - ${sub.name}</span><button class="modal-close" data-close>✕</button></div>
  <div class="modal-body" style="max-height:400px;overflow-y:auto">
    <div style="margin-bottom:8px;font-size:12px;color:var(--text2)">제출: ${submitted}명 / 미제출: ${students.length-submitted}명</div>
    <table style="width:100%"><thead><tr><th>번호</th><th>이름</th><th>제출여부</th></tr></thead>
    <tbody>${students.map(s=>`<tr><td>${s.number}</td><td>${s.name}</td>
    <td><input type="checkbox" ${stMap[s.id]?'checked':''} onchange="window.__sbTg(${id},${s.id},this.checked)"></td></tr>`).join('')}</tbody>
    </table>
  </div>
  <div class="modal-footer"><button class="btn btn-secondary" data-close>닫기</button></div>`);
};
window.__sbTg=async(subId,stuId,checked)=>api.setSubmissionStatus({submission_id:subId,student_id:stuId,submitted:checked});
function showM(s){
  const isEdit=!!s;
  showModal(`<div class="modal-header"><span class="modal-title">${isEdit?'제출물 수정':'제출물 추가'}</span><button class="modal-close" data-close>✕</button></div>
  <div class="modal-body">
    <div class="form-row"><label>이름 *</label><input class="input" id="sb-n" value="${s?s.name:''}"></div>
    <div class="form-row row-2">
      <div><label>교과</label><input class="input" id="sb-s" value="${s?s.subject:''}"></div>
      <div><label>마감일</label><input class="input" type="date" id="sb-d" value="${s?s.due_date:today()}"></div>
    </div>
    <div class="form-row"><label>비고</label><input class="input" id="sb-nt" value="${s?s.note:''}"></div>
  </div>
  <div class="modal-footer">
    ${isEdit?`<button class="btn btn-danger" id="sb-del">삭제</button>`:''}
    <button class="btn btn-secondary" data-close>취소</button>
    <button class="btn btn-primary" id="sb-sv">${isEdit?'저장':'추가'}</button>
  </div>`);
  if(isEdit)document.getElementById('sb-del').onclick=async()=>{await api.deleteSubmission(s.id);closeModal();refresh();};
  document.getElementById('sb-sv').onclick=async()=>{
    const name=document.getElementById('sb-n').value.trim();if(!name){toast('이름을 입력하세요','error');return;}
    const data={name,subject:document.getElementById('sb-s').value,due_date:document.getElementById('sb-d').value,note:document.getElementById('sb-nt').value};
    if(isEdit)await api.updateSubmission(s.id,data);else await api.addSubmission(data);
    toast('저장되었습니다','success');closeModal();refresh();
  };
}
window.registerPage('submissions',{render,init,refresh});
})();