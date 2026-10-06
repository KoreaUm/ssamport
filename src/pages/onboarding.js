(function(){
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let settings, profile, selectedSchool, counts, selected;
async function render(c){
 settings=await api.getAllSettings(); profile=await schoolProfile.load(); counts={...(profile.counts||{})}; selected=new Set(profile.classes||[]);
 selectedSchool={schoolName:settings.school_name||'',eduCode:settings.edu_office_code||'',schoolCode:settings.school_code||''};
 c.innerHTML=`<div class="page-wrap" style="max-width:900px;margin:auto"><div class="page-header"><h1>학교와 담당 학급 설정</h1></div>
 <p>처음 한 번 설정하면 학생 명단과 수행평가에서 담당 반을 바로 선택할 수 있습니다. 설정 화면에서 언제든 변경할 수 있습니다.</p>
 <section class="card" style="padding:24px;margin:16px 0"><h2>1. 학교와 수업 정보</h2>
 <div class="form-row row-2"><div><label for="ob-type">학교급</label><select class="input" id="ob-type">${['초등학교','중학교','고등학교'].map(t=>`<option ${profile.type===t?'selected':''}>${t}</option>`).join('')}</select></div><div><label for="ob-name">교사명</label><input class="input" id="ob-name" value="${esc(settings.teacher_name)}"></div></div>
 <div class="form-row row-2"><div><label for="ob-role">역할</label><select class="input" id="ob-role">${['담임교사','교과교사','담임·교과교사'].map(r=>`<option ${profile.role===r?'selected':''}>${r}</option>`).join('')}</select></div><div><label for="ob-subject">담당 교과</label><input class="input" id="ob-subject" value="${esc(profile.subject)}" placeholder="예: 음악"></div></div>
 <label for="ob-periods">하루 교시 수</label><input class="input" id="ob-periods" type="number" min="1" max="12" value="${esc(settings.period_count||7)}">
 </section><section class="card" style="padding:24px;margin:16px 0"><h2>2. 학년별 학급 수와 담당 반</h2><p>각 학년의 전체 학급 수를 입력하고 실제 수업하는 반만 선택하세요. 예: 1학년 1~3반, 2학년 2~4반.</p><div id="ob-classes"></div>
 <label for="ob-homeroom">담임 학급 (선택)</label><select class="input" id="ob-homeroom"></select></section>
 <section class="card" style="padding:24px;margin:16px 0"><h2>3. 날씨 · 급식 · 학사 일정</h2><label for="ob-region">날씨 지역</label><input class="input" id="ob-region" list="ob-regions" value="${esc(settings.weather_region||'서울')}" placeholder="시·군·구 입력"><datalist id="ob-regions">${['서울','부산','대구','인천','광주','대전','울산','세종','수원','청주','전주','목포','춘천','창원','제주'].map(r=>`<option value="${r}">`).join('')}</datalist>
 <p>급식과 학사 일정을 연동할 학교를 검색하세요. 나중에 설정해도 됩니다.</p><div style="display:flex;gap:8px"><input class="input" id="ob-query" aria-label="학교명" placeholder="학교 이름"><button class="btn btn-secondary" id="ob-search">학교 검색</button></div><div id="ob-results" aria-live="polite"></div><p id="ob-school"></p></section>
 <p id="ob-error" role="alert" style="color:var(--danger,#c33)"></p><div style="display:flex;gap:12px"><button class="btn btn-primary" id="ob-save">설정 저장하고 시작</button><button class="btn btn-secondary" id="ob-later">나중에 설정</button></div></div>`;
}
function drawClasses(){
 const max=schoolProfile.gradeCount(document.getElementById('ob-type').value);
 document.getElementById('ob-classes').innerHTML=Array.from({length:max},(_,i)=>{const g=i+1;return `<div style="margin:16px 0"><label>${g}학년 전체 학급 수 <input class="input" style="width:90px" type="number" min="0" max="50" data-grade="${g}" value="${counts[g]||0}"></label><div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:10px">${Array.from({length:counts[g]||0},(_,j)=>{const label=`${g}학년 ${j+1}반`;return `<label><input type="checkbox" data-class="${label}" ${selected.has(label)?'checked':''}> ${j+1}반</label>`;}).join('')}</div></div>`;}).join('');
 document.querySelectorAll('[data-grade]').forEach(el=>el.onchange=()=>{const n=Number(el.value);if(!Number.isInteger(n)||n<0||n>50){el.value=counts[el.dataset.grade]||0;return;}counts[el.dataset.grade]=n;drawClasses();});
 document.querySelectorAll('[data-class]').forEach(el=>el.onchange=()=>{if(el.checked)selected.add(el.dataset.class);else selected.delete(el.dataset.class);drawHomeroom();});
 drawHomeroom();
}
function activeClasses(){const max=schoolProfile.gradeCount(document.getElementById('ob-type').value);return [...selected].filter(c=>{const m=c.match(/^(\d+)학년 (\d+)반$/);return m&&+m[1]<=max&&+m[2]<=(counts[m[1]]||0);}).sort((a,b)=>a.localeCompare(b,'ko',{numeric:true}));}
function drawHomeroom(){const el=document.getElementById('ob-homeroom');const old=el.value||profile.homeroom|| (settings.class_year&&settings.class_num?`${settings.class_year}학년 ${settings.class_num}반`:'');el.innerHTML='<option value="">담임 학급 없음</option>'+activeClasses().map(c=>`<option ${c===old?'selected':''}>${c}</option>`).join('');}
async function init(){
 // Existing class assignments remain available; never rewrite students or scores.
 const records=await api.getStudents();
 if(!settings.school_profile){records.forEach(s=>{const m=(s.class_group||'').match(/^(\d+)학년 (\d+)반$/);if(m){counts[m[1]]=Math.max(counts[m[1]]||0,+m[2]);selected.add(s.class_group);}});}
 drawClasses();document.getElementById('ob-type').onchange=drawClasses;
 const schoolLabel=()=>document.getElementById('ob-school').textContent=selectedSchool.schoolName?`선택한 학교: ${selectedSchool.schoolName}`:'선택한 학교 없음';schoolLabel();
 document.getElementById('ob-later').onclick=()=>navigateTo('dashboard');
 document.getElementById('ob-search').onclick=async()=>{
  const q=document.getElementById('ob-query').value.trim();if(!q)return;
  const button=document.getElementById('ob-search'),results=document.getElementById('ob-results');button.disabled=true;results.textContent='검색 중…';
  try{const schools=await api.neisSearchSchools(q);results.innerHTML='';if(!schools.length)results.textContent='검색 결과가 없습니다. 학교명을 확인해 주세요.';schools.forEach(s=>{const b=document.createElement('button');b.className='btn btn-secondary';b.style.margin='8px 4px';b.textContent=`${s.schoolName} · ${s.officeName} · ${s.address||''}`;b.onclick=()=>{selectedSchool=s;schoolLabel();if(['초등학교','중학교','고등학교'].includes(s.schoolType)){document.getElementById('ob-type').value=s.schoolType;drawClasses();}};results.appendChild(b);});}catch(e){results.textContent='학교 검색 실패: '+e.message;}finally{button.disabled=false;}
 };
 document.getElementById('ob-save').onclick=async()=>{
 const button=document.getElementById('ob-save'),error=document.getElementById('ob-error');error.textContent='';
 const classes=activeClasses(),periods=Number(document.getElementById('ob-periods').value),region=document.getElementById('ob-region').value.trim();
 if(!classes.length){error.textContent='담당하는 반을 한 개 이상 선택하세요.';return;}if(!Number.isInteger(periods)||periods<1||periods>12||!region){error.textContent='교시 수(1~12)와 날씨 지역을 확인하세요.';return;}
 const homeroom=document.getElementById('ob-homeroom').value,m=homeroom.match(/^(\d+)학년 (\d+)반$/);
 const next={type:document.getElementById('ob-type').value,role:document.getElementById('ob-role').value,subject:document.getElementById('ob-subject').value.trim(),counts,classes,homeroom};
 button.disabled=true;
 try{for(const [key,value] of Object.entries({teacher_name:document.getElementById('ob-name').value.trim(),period_count:periods,weather_region:region,school_name:selectedSchool.schoolName,school_code:selectedSchool.schoolCode,edu_office_code:selectedSchool.eduCode,class_year:m?m[1]:'',class_num:m?m[2]:'',school_profile:JSON.stringify(next)}))await api.setSetting(key,value);await api.setSetting('onboarding_complete','1');await window.updateClassInfo?.();toast('학교와 담당 학급 설정을 저장했습니다.','success');await navigateTo('students');}catch(e){error.textContent='저장하지 못했습니다. 다시 시도해 주세요. '+e.message;}finally{button.disabled=false;}
 };
}
window.registerPage('onboarding',{render,init});
})();
