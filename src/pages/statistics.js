(function(){
async function render(c){
  const now=new Date();
  c.innerHTML=`<div class="page-wrap">
  <div class="page-header"><h1 class="page-header-title">📈 통계·출력</h1></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <div class="card" style="padding:20px">
      <div class="card-title" style="margin-bottom:12px">📅 출결 통계</div>
      <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center">
        <input type="number" id="sy" class="input" value="${now.getFullYear()}" style="width:90px">년
        <select id="sm" class="input" style="width:90px">
          ${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===now.getMonth()+1?'selected':''}>${i+1}월</option>`).join('')}
        </select>
        <button class="btn btn-primary btn-sm" id="sl">조회</button>
      </div>
      <div class="tbl-wrap"><table>
        <thead><tr><th>번호</th><th>이름</th><th>결석</th><th>지각</th><th>조퇴</th></tr></thead>
        <tbody id="sb"></tbody>
      </table></div>
    </div>
    <div class="card" style="padding:20px">
      <div class="card-title" style="margin-bottom:12px">📋 수행평가 현황</div>
      <div id="astat"></div>
    </div>
  </div>
  </div>`;
}
async function init(){
  document.getElementById('sl').onclick=loadStats;
  await loadStats();await loadAStat();
}
async function loadStats(){
  const y=parseInt(document.getElementById('sy').value),m=parseInt(document.getElementById('sm').value);
  const stats=await api.getAttendanceStats(y,m);
  document.getElementById('sb').innerHTML=stats.map(s=>`<tr><td>${s.number}</td><td>${s.name}</td>
  <td><span class="badge badge-danger">${s.absent||0}</span></td>
  <td><span class="badge badge-warning">${s.late||0}</span></td>
  <td><span class="badge badge-accent">${s.early||0}</span></td></tr>`).join('');
}
async function loadAStat(){
  const items=await api.getAssessments();const students=await api.getStudents();
  const el=document.getElementById('astat');
  if(!items.length){el.innerHTML='<p style="color:var(--text3);font-size:13px">수행평가가 없습니다.</p>';return;}
  let html='';
  for(const a of items.slice(0,5)){
    const scores=await api.getAssessmentScores(a.id);
    const avg=scores.length?scores.reduce((s,r)=>s+r.score,0)/scores.length:0;
    html+=`<div style="margin-bottom:12px">
      <div style="font-size:13px;font-weight:600;margin-bottom:4px">${a.name} <span class="badge badge-accent">${a.subject}</span></div>
      <div style="font-size:12px;color:var(--text2)">입력: ${scores.length}/${students.length}명 · 평균: ${avg.toFixed(1)}점</div>
      <div style="background:var(--bg);border-radius:4px;height:6px;margin-top:6px">
        <div style="background:var(--accent);height:6px;border-radius:4px;width:${Math.min(100,avg/a.max_score*100).toFixed(1)}%"></div>
      </div>
    </div>`;
  }
  el.innerHTML=html;
}
window.registerPage('statistics',{render,init});
})();