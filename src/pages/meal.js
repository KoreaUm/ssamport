(function(){
async function render(c){
  c.innerHTML=`<div class="page-wrap">
  <div class="page-header"><h1 class="page-header-title">🍱 급식 메뉴</h1></div>
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
    <input type="date" class="input" id="meal-dt" value="${today()}" style="width:180px">
    <button class="btn btn-primary" id="meal-ld">조회</button>
  </div>
  <div id="meal-ct"></div>
  </div>`;
}
async function init(){document.getElementById('meal-ld').onclick=load;await load();}
async function load(){
  const edu=await api.getSetting('edu_office_code',''),sch=await api.getSetting('school_code','');
  const mc=document.getElementById('meal-ct');
  if(!edu||!sch){mc.innerHTML='<div class="empty-state"><div class="icon">🍱</div><p>설정에서 교육청 코드와 학교 코드를 입력하세요.</p></div>';return;}
  const ds=document.getElementById('meal-dt').value.replace(/-/g,'');
  mc.innerHTML='<div style="color:var(--text3);padding:20px">불러오는 중...</div>';
  const meal=await api.neisGetMeal(edu,sch,ds);
  if(!meal||meal.error||!Object.keys(meal).length){mc.innerHTML='<div class="empty-state"><div class="icon">🍽️</div><p>급식 정보가 없습니다.</p></div>';return;}
  const icons={'조식':'🌅','중식':'☀️','석식':'🌙'};
  mc.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
    ${['조식','중식','석식'].filter(t=>meal[t]).map(t=>{
      const{menu=[],cal=''}=meal[t];
      return `<div class="card" style="padding:20px">
        <div style="font-size:16px;font-weight:700;margin-bottom:12px">${icons[t]} ${t}</div>
        ${menu.map(m=>`<div style="padding:6px 0;border-bottom:1px solid var(--border);font-size:13px">${m}</div>`).join('')}
        ${cal?`<div style="margin-top:10px;font-size:12px;color:var(--text3)">🔥 ${cal}</div>`:''}
      </div>`;
    }).join('')}
  </div>`;
}
window.registerPage('meal',{render,init});
})();