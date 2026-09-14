(function(){
async function render(c){
  c.innerHTML=`<div class="page-wrap">
  <div class="page-header"><h1 class="page-header-title">📝 관찰 기록</h1>
    <button class="btn btn-primary" id="ob-add">+ 관찰 추가</button></div>
  <div class="tbl-wrap"><table>
    <thead><tr><th>날짜</th><th>학생</th><th>교과</th><th>내용</th><th></th></tr></thead>
    <tbody id="ob-body"></tbody>
  </table></div></div>`;
}
async function init(){await refresh();document.getElementById('ob-add').onclick=()=>showM(null);}
async function refresh(){
  const b=document.getElementById('ob-body');if(!b)return;
  const rows=await api.getObservations({});
  if(!rows.length){b.innerHTML='<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--text3)">관찰 기록이 없습니다.</td></tr>';return;}
  b.innerHTML=rows.map(r=>`<tr><td>${r.date}</td><td>${r.name||'-'}</td><td>${r.subject||'-'}</td>
  <td class="truncate" style="max-width:300px">${r.content}</td>
  <td><button class="btn btn-secondary btn-xs" onclick="window.__obE(${r.id})">수정</button></td></tr>`).join('');
}
window.__obE=async(id)=>{const rows=await api.getObservations({});showM(rows.find(r=>r.id===id));};
async function showM(r){
  const students=await api.getStudents();const isEdit=!!r;
  showModal(`<div class="modal-header"><span class="modal-title">${isEdit?'관찰 수정':'관찰 추가'}</span><button class="modal-close" data-close>✕</button></div>
  <div class="modal-body">
    <div class="form-row row-2">
      <div><label>날짜</label><input class="input" type="date" id="ob-d" value="${r?r.date:today()}"></div>
      <div><label>교과</label><input class="input" id="ob-s" value="${r?r.subject:''}" placeholder="예: 수학"></div>
    </div>
    <div class="form-row"><label>학생</label><select class="input" id="ob-st">
      <option value="">미지정</option>
      ${students.map(s=>`<option value="${s.id}" ${r&&r.student_id===s.id?'selected':''}>${s.number}번 ${s.name}</option>`).join('')}
    </select></div>
    <div class="form-row"><label>관찰 내용</label><textarea class="input" id="ob-c" style="height:120px">${r?r.content:''}</textarea></div>
  </div>
  <div class="modal-footer">
    ${isEdit?`<button class="btn btn-danger" id="ob-del">삭제</button>`:''}
    <button class="btn btn-secondary" data-close>취소</button>
    <button class="btn btn-primary" id="ob-sv">${isEdit?'저장':'추가'}</button>
  </div>`);
  if(isEdit)document.getElementById('ob-del').onclick=async()=>{await api.deleteObservation(r.id);closeModal();refresh();};
  document.getElementById('ob-sv').onclick=async()=>{
    const data={date:document.getElementById('ob-d').value,subject:document.getElementById('ob-s').value,student_id:parseInt(document.getElementById('ob-st').value)||null,content:document.getElementById('ob-c').value};
    if(isEdit)await api.updateObservation(r.id,data);else await api.addObservation(data);
    toast('저장되었습니다','success');closeModal();refresh();
  };
}
window.registerPage('observations',{render,init,refresh});
})();