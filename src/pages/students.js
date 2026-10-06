(function(){

function esc(value){ return String(value??'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// class_group 형식: "N학년 N반"
function toClassGroup(grade, cls){ return (grade&&cls)?`${Number(grade)}학년 ${Number(cls)}반`:'';}
function parseClassGroup(cg){
  const m=String(cg||'').match(/^(\d+)학년\s*(\d+)반$/);
  return m?{grade:m[1],cls:m[2]}:{grade:'',cls:''};
}

async function render(c){
  c.innerHTML=`<div class="page-wrap">
  <div class="page-header"><h1 class="page-header-title">👥 학생 명단</h1>
    <div class="page-header-actions">
      <input type="text" id="st-search" class="input" placeholder="이름/번호 검색..." style="width:160px">
      <button class="btn btn-secondary" id="st-csv-btn">📥 CSV 가져오기</button>
      <input type="file" id="st-csv-input" accept=".csv" style="display:none">
      <button class="btn btn-secondary" id="st-template-btn">양식 다운로드</button>
      <button class="btn btn-primary" id="st-add-btn">+ 학생 추가</button>
    </div>
  </div>
  <div id="st-class-tabs" class="flex flex-wrap mb-3" style="gap:6px"></div>
  <div id="student-grid" class="student-grid"></div>
  </div>`;
}

let currentClassFilter='';

async function init(){
  await refresh();
  document.getElementById('st-search').oninput=e=>refresh(e.target.value);
  document.getElementById('st-add-btn').onclick=()=>showStudentModal(null);
  document.getElementById('st-template-btn').onclick=downloadStudentTemplate;
  document.getElementById('st-csv-btn').onclick=()=>document.getElementById('st-csv-input').click();
  document.getElementById('st-csv-input').onchange=e=>importCSV(e.target.files[0]);
}

async function refresh(q=''){
  let students=await api.getStudents();

  // 반 탭
  const tabs=document.getElementById('st-class-tabs');
  if(tabs){
    const classes=window.schoolProfile?await schoolProfile.classes(students):[...new Set(students.map(s=>s.class_group||'').filter(Boolean))].sort();
    tabs.innerHTML=classes.length?[
      `<button class="btn btn-xs ${!currentClassFilter?'btn-primary':'btn-secondary'}" onclick="window.__stSetClass('')">전체</button>`,
      ...classes.map(c=>`<button class="btn btn-xs ${currentClassFilter===c?'btn-primary':'btn-secondary'}" data-class-filter="${esc(c)}">${esc(c)}</button>`)
    ].join(''):'';
    tabs.querySelectorAll('[data-class-filter]').forEach(el=>el.onclick=()=>window.__stSetClass(el.dataset.classFilter));
  }

  if(currentClassFilter) students=students.filter(s=>s.class_group===currentClassFilter);
  if(q) students=students.filter(s=>s.name.includes(q)||String(s.number).includes(q));

  const grid=document.getElementById('student-grid');
  if(!grid)return;
  if(!students.length){grid.innerHTML='<div class="empty-state"><div class="icon">👥</div><p>등록된 학생이 없습니다.</p></div>';return;}
  grid.innerHTML=students.map(s=>`
    <div class="student-card" onclick="window.__stEdit(${s.id})">
      ${s.class_group?`<div style="font-size:10px;color:var(--accent);font-weight:600;margin-bottom:2px">${esc(s.class_group)}</div>`:''}
      <div class="num">${s.number}번</div>
      <div class="name">${esc(s.name)}</div>
    </div>`).join('');
}

window.__stSetClass=function(cls){currentClassFilter=cls;refresh();};
window.__stEdit=async(id)=>{
  const students=await api.getStudents();
  await showStudentModal(students.find(x=>x.id===id));
};

async function showStudentModal(s){
  const profile=window.schoolProfile?await schoolProfile.load():{};
  const maxGrade=profile.type?schoolProfile.gradeCount(profile.type):6;
  const groups=window.schoolProfile?await schoolProfile.classes(s?[s]:[]):[];
  const isEdit=!!s;
  const {grade,cls}=parseClassGroup(s?.class_group||currentClassFilter||profile.homeroom||groups[0]);
  showModal(`<div class="modal-header"><span class="modal-title">${isEdit?'학생 정보 수정':'학생 추가'}</span><button class="modal-close" data-close>✕</button></div>
  <div class="modal-body">
    ${groups.length?`<div class="form-row"><label>담당 학급 선택</label><select class="input" id="s-group"><option value="">학년·반 직접 입력</option>${groups.map(g=>`<option value="${esc(g)}" ${g===toClassGroup(grade,cls)?'selected':''}>${esc(g)}</option>`).join('')}</select></div>`:''}
    <div class="form-row row-2">
      <div><label>학년 *</label><input class="input" id="s-grade" type="number" min="1" max="${maxGrade}" value="${grade}" placeholder="예) 3"></div>
      <div><label>반 *</label><input class="input" id="s-cls" type="number" min="1" value="${cls}" placeholder="예) 2"></div>
    </div>
    <div class="form-row row-2">
      <div><label>번호 *</label><input class="input" id="s-num" type="number" min="1" value="${s?s.number:''}"></div>
      <div><label>이름 *</label><input class="input" id="s-name" value="${esc(s?s.name:'')}"></div>
    </div>
    <div class="form-row row-2">
      <div><label>학생 연락처</label><input class="input" id="s-phone" type="tel" value="${esc(s?.phone)}"></div>
      <div><label>보호자 연락처</label><input class="input" id="s-parent-phone" type="tel" value="${esc(s?.parent_phone)}"></div>
    </div>
    <div><label>주소</label><input class="input" id="s-address" value="${esc(s?.address)}"></div>
    <div><label>메모</label><textarea class="input" id="s-note">${esc(s?.note)}</textarea></div>
  </div>
  <div class="modal-footer">
    ${isEdit?`<button class="btn btn-danger" id="s-del">삭제</button>`:''}
    <button class="btn btn-secondary" data-close>취소</button>
    <button class="btn btn-primary" id="s-save">${isEdit?'저장':'추가'}</button>
  </div>`);

  const groupSelect=document.getElementById('s-group');
  if(groupSelect)groupSelect.onchange=()=>{const v=parseClassGroup(groupSelect.value);document.getElementById('s-grade').value=v.grade;document.getElementById('s-cls').value=v.cls;};
  if(isEdit) document.getElementById('s-del').onclick=async()=>{
    if(confirm(`${s.name} 학생을 삭제하시겠습니까?\n이 학생의 출결·수행평가 점수·제출 상태도 삭제됩니다.`)){await api.deleteStudent(s.id);closeModal();refresh();}
  };
  document.getElementById('s-save').onclick=async()=>{
    const grade=document.getElementById('s-grade').value.trim();
    const cls=document.getElementById('s-cls').value.trim();
    const num=Number(document.getElementById('s-num').value);
    const name=document.getElementById('s-name').value.trim();
    if(!Number.isInteger(Number(grade))||Number(grade)<1||Number(grade)>maxGrade||!Number.isInteger(Number(cls))||Number(cls)<1||!Number.isInteger(num)||num<1||!name){toast('학년·반·번호는 올바른 양의 정수로, 이름은 필수로 입력하세요','error');return;}
    const data={number:num, name, class_group:toClassGroup(grade,cls), phone:document.getElementById('s-phone').value.trim(), parent_phone:document.getElementById('s-parent-phone').value.trim(), address:document.getElementById('s-address').value.trim(), note:document.getElementById('s-note').value};
    const button=document.getElementById('s-save');button.disabled=true;
    try {
      if(isEdit) await api.updateStudent(s.id,data); else await api.addStudent(data);
      toast(isEdit?'수정되었습니다':'추가되었습니다','success');closeModal();await refresh();
    } catch(error){toast('학생 저장 실패: '+error.message,'error');}
    finally {button.disabled=false;}
  };
}

async function importCSV(file){
  if(!file)return;
  const profile=window.schoolProfile?await schoolProfile.load():{};
  const maxGrade=profile.type?schoolProfile.gradeCount(profile.type):6;
  const input=document.getElementById('st-csv-input');
  const text=await file.text();
  const lines=parseCSV(text).filter(row=>row.some(cell=>String(cell||'').trim()));
  const rows=[];
  const headers=(lines[0]||[]).map(v=>String(v).replace(/^\uFEFF/,'').trim());
  for(let i=1;i<lines.length;i++){
    const cols=lines[i].map(c=>String(c||'').trim());
    const grade=cols[0], cls=cols[1], num=Number(cols[2]), name=cols[3];
    if(!/^\d+$/.test(grade)||!/^\d+$/.test(cls)||Number(grade)<1||Number(grade)>maxGrade||Number(cls)<1||!Number.isInteger(num)||num<1||!name){
      toast(`${i+1}행의 학년·반·번호·이름을 확인하세요. 가져오기를 취소했습니다.`,'error');return;
    }
    const row={number:num, name, class_group:toClassGroup(grade,cls)};
    [['학생 연락처','phone'],['보호자 연락처','parent_phone'],['주소','address'],['메모','note']].forEach(([label,key])=>{
      const index=headers.indexOf(label);
      if(index>=0 && cols[index]) row[key]=cols[index];
    });
    rows.push(row);
  }
  if(input) input.value='';
  if(!rows.length){toast('CSV 파일을 확인하세요','error');return;}
  if(confirm(`학생 ${rows.length}명을 가져오시겠습니까?\n같은 학급·번호는 갱신하고 새 학생은 추가합니다.\nCSV에 없는 학생과 기존 출결·평가·제출 기록은 유지됩니다. 빈 연락처도 기존 값을 유지합니다.`)){
    try {
      const result=await api.importStudentsCSV(rows);
      toast(`추가 ${result.added}명 · 갱신 ${result.updated}명 완료`,'success');
      await refresh();
    } catch(error) { toast(error.message || '가져오기에 실패했습니다.','error'); }
  }
}

function downloadStudentTemplate(){
  downloadCSV('학생명단_양식.csv',[
    ['학년','반','번호','이름','학생 연락처','보호자 연락처','주소','메모'],
    ['3','2','1','홍길동'],
    ['3','2','2','김하늘'],
    ['2','1','1','이민준'],
  ]);
}

function downloadCSV(filename,rows){
  const csv=rows.map(row=>row.map(cell=>`"${String(cell??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text){
  const rows=[];let row=[];let cell='';let quoted=false;
  for(let i=0;i<String(text||'').length;i++){
    const ch=text[i],next=text[i+1];
    if(ch==='"'){if(quoted&&next==='"'){cell+='"';i++;}else quoted=!quoted;}
    else if(ch===','&&!quoted){row.push(cell);cell='';}
    else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&next==='\n')i++;row.push(cell);rows.push(row);row=[];cell='';}
    else cell+=ch;
  }
  if(cell||row.length){row.push(cell);rows.push(row);}
  return rows;
}

window.registerPage('students',{render,init,refresh:()=>refresh()});
})();
