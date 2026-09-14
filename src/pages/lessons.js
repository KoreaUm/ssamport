(function(){
async function render(c){
  c.innerHTML=`<div class="page-wrap">
  <div class="page-header"><h1 class="page-header-title">📚 수업 진도</h1>
    <button class="btn btn-primary" id="ls-add">+ 진도 추가</button></div>
  <div class="tbl-wrap"><table>
    <thead><tr><th>날짜</th><th>교과</th><th>교시</th><th>주제</th><th>내용</th><th>과제</th><th></th></tr></thead>
    <tbody id="ls-body"></tbody>
  </table></div></div>`;
}
async function init(){await refresh();document.getElementById('ls-add').onclick=()=>showM(null);}
async function refresh(){
  const b=document.getElementById('ls-body');if(!b)return;
  const rows=await api.getLessons({});
  if(!rows.length){b.innerHTML='<tr><td colspan="7" style="text-align:center;padding:32px;color:var(--text3)">수업 기록이 없습니다.</td></tr>';return;}
  b.innerHTML=rows.map(r=>`<tr><td>${r.date}</td><td>${r.subject}</td><td>${r.period}교시</td>
  <td>${r.topic}</td><td class="truncate" style="max-width:180px">${r.content}</td>
  <td class="truncate" style="max-width:120px">${r.homework}</td>
  <td><button class="btn btn-secondary btn-xs" onclick="window.__lsE(${r.id})">수정</button></td></tr>`).join('');
}
window.__lsE=async(id)=>{const rows=await api.getLessons({});showM(rows.find(r=>r.id===id));};
function showM(r){
  const isEdit=!!r;
  showModal(`<div class="modal-header"><span class="modal-title">${isEdit?'진도 수정':'진도 추가'}</span><button class="modal-close" data-close>✕</button></div>
  <div class="modal-body">
    <div class="form-row row-2">
      <div><label>날짜</label><input class="input" type="date" id="ls-d" value="${r?r.date:today()}"></div>
      <div><label>교과</label><input class="input" id="ls-s" value="${r?r.subject:''}" placeholder="예: 수학"></div>
    </div>
    <div class="form-row row-2">
      <div><label>교시</label><input class="input" type="number" id="ls-p" value="${r?r.period:1}" min="1" max="9"></div>
      <div><label>주제</label><input class="input" id="ls-t" value="${r?r.topic:''}"></div>
    </div>
    <div class="form-row"><label>수업 내용</label><textarea class="input" id="ls-c" style="height:100px">${r?r.content:''}</textarea></div>
    <div class="form-row"><label>과제</label><input class="input" id="ls-h" value="${r?r.homework:''}"></div>
  </div>
  <div class="modal-footer">
    ${isEdit?`<button class="btn btn-danger" id="ls-del">삭제</button>`:''}
    <button class="btn btn-secondary" data-close>취소</button>
    <button class="btn btn-primary" id="ls-sv">${isEdit?'저장':'추가'}</button>
  </div>`);
  if(isEdit)document.getElementById('ls-del').onclick=async()=>{await api.deleteLesson(r.id);closeModal();refresh();};
  document.getElementById('ls-sv').onclick=async()=>{
    const data={date:document.getElementById('ls-d').value,subject:document.getElementById('ls-s').value,period:parseInt(document.getElementById('ls-p').value)||1,topic:document.getElementById('ls-t').value,content:document.getElementById('ls-c').value,homework:document.getElementById('ls-h').value};
    if(isEdit)await api.updateLesson(r.id,data);else await api.addLesson(data);
    toast('저장되었습니다','success');closeModal();refresh();
  };
}
window.registerPage('lessons',{render,init,refresh});
})();