(function(){

// class_group 형식: "N학년 N반"
function toClassGroup(grade, cls){ return (grade&&cls)?`${grade}학년 ${cls}반`:'';}
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
  <div id="st-class-tabs" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px"></div>
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
    const classes=[...new Set(students.map(s=>s.class_group||'').filter(Boolean))].sort();
    tabs.innerHTML=classes.length?[
      `<button class="btn btn-xs ${!currentClassFilter?'btn-primary':'btn-secondary'}" onclick="window.__stSetClass('')">전체</button>`,
      ...classes.map(c=>`<button class="btn btn-xs ${currentClassFilter===c?'btn-primary':'btn-secondary'}" onclick="window.__stSetClass('${c}')">${c}</button>`)
    ].join(''):'';
  }

  if(currentClassFilter) students=students.filter(s=>s.class_group===currentClassFilter);
  if(q) students=students.filter(s=>s.name.includes(q)||String(s.number).includes(q));

  const grid=document.getElementById('student-grid');
  if(!grid)return;
  if(!students.length){grid.innerHTML='<div class="empty-state"><div class="icon">👥</div><p>등록된 학생이 없습니다.</p></div>';return;}
  grid.innerHTML=students.map(s=>`
    <div class="student-card" onclick="window.__stEdit(${s.id})">
      ${s.class_group?`<div style="font-size:10px;color:var(--accent);font-weight:600;margin-bottom:2px">${s.class_group}</div>`:''}
      <div class="num">${s.number}번</div>
      <div class="name">${s.name}</div>
    </div>`).join('');
}

window.__stSetClass=function(cls){currentClassFilter=cls;refresh();};
window.__stEdit=async(id)=>{
  const students=await api.getStudents();
  showStudentModal(students.find(x=>x.id===id));
};

function showStudentModal(s){
  const isEdit=!!s;
  const {grade,cls}=parseClassGroup(s?.class_group);
  showModal(`<div class="modal-header"><span class="modal-title">${isEdit?'학생 정보 수정':'학생 추가'}</span><button class="modal-close" data-close>✕</button></div>
  <div class="modal-body">
    <div class="form-row row-2">
      <div><label>학년 *</label><input class="input" id="s-grade" type="number" min="1" max="6" value="${grade}" placeholder="예) 3"></div>
      <div><label>반 *</label><input class="input" id="s-cls" type="number" min="1" value="${cls}" placeholder="예) 2"></div>
    </div>
    <div class="form-row row-2">
      <div><label>번호 *</label><input class="input" id="s-num" type="number" min="1" value="${s?s.number:''}"></div>
      <div><label>이름 *</label><input class="input" id="s-name" value="${s?s.name:''}"></div>
    </div>
  </div>
  <div class="modal-footer">
    ${isEdit?`<button class="btn btn-danger" id="s-del">삭제</button>`:''}
    <button class="btn btn-secondary" data-close>취소</button>
    <button class="btn btn-primary" id="s-save">${isEdit?'저장':'추가'}</button>
  </div>`);

  if(isEdit) document.getElementById('s-del').onclick=async()=>{
    if(confirm(`${s.name} 학생을 삭제하시겠습니까?`)){await api.deleteStudent(s.id);closeModal();refresh();}
  };
  document.getElementById('s-save').onclick=async()=>{
    const grade=document.getElementById('s-grade').value.trim();
    const cls=document.getElementById('s-cls').value.trim();
    const num=parseInt(document.getElementById('s-num').value);
    const name=document.getElementById('s-name').value.trim();
    if(!grade||!cls||!num||!name){toast('모든 항목을 입력하세요','error');return;}
    const data={number:num, name, class_group:toClassGroup(grade,cls), gender:'', birth_date:'', phone:'', parent_phone:'', address:'', note:''};
    if(isEdit) await api.updateStudent(s.id,data); else await api.addStudent(data);
    toast(isEdit?'수정되었습니다':'추가되었습니다','success');closeModal();refresh();
  };
}

async function importCSV(file){
  if(!file)return;
  const input=document.getElementById('st-csv-input');
  const text=await file.text();
  const lines=parseCSV(text).filter(row=>row.some(cell=>String(cell||'').trim()));
  const rows=[];
  for(let i=1;i<lines.length;i++){
    const cols=lines[i].map(c=>String(c||'').trim());
    if(cols.length<4)continue;
    const grade=cols[0], cls=cols[1], num=parseInt(cols[2]), name=cols[3];
    if(!grade||!cls||!num||!name)continue;
    rows.push({number:num, name, class_group:toClassGroup(grade,cls), gender:'', birth_date:'', phone:'', parent_phone:'', address:'', note:''});
  }
  if(input) input.value='';
  if(!rows.length){toast('CSV 파일을 확인하세요','error');return;}
  if(confirm(`학생 ${rows.length}명을 가져오시겠습니까?\n기존 명단은 모두 삭제됩니다.`)){
    await api.importStudentsCSV(rows);
    toast(`${rows.length}명 완료`,'success');
    refresh();
  }
}

function downloadStudentTemplate(){
  downloadCSV('학생명단_양식.csv',[
    ['학년','반','번호','이름'],
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
