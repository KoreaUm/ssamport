(function(){
let expr='',result='0';
async function render(c){
  c.innerHTML=`<div id="calculator-wrap">
  <div class="card calc-card">
    <div id="calc-display">
      <div id="calc-expr"></div>
      <div id="calc-result">0</div>
    </div>
    <div class="calc-grid">
      <button class="calc-btn clear span2" onclick="window.__cAC()">AC</button>
      <button class="calc-btn op" onclick="window.__cIn('%')">%</button>
      <button class="calc-btn op" onclick="window.__cIn('÷')">÷</button>
      <button class="calc-btn" onclick="window.__cIn('7')">7</button>
      <button class="calc-btn" onclick="window.__cIn('8')">8</button>
      <button class="calc-btn" onclick="window.__cIn('9')">9</button>
      <button class="calc-btn op" onclick="window.__cIn('×')">×</button>
      <button class="calc-btn" onclick="window.__cIn('4')">4</button>
      <button class="calc-btn" onclick="window.__cIn('5')">5</button>
      <button class="calc-btn" onclick="window.__cIn('6')">6</button>
      <button class="calc-btn op" onclick="window.__cIn('-')">−</button>
      <button class="calc-btn" onclick="window.__cIn('1')">1</button>
      <button class="calc-btn" onclick="window.__cIn('2')">2</button>
      <button class="calc-btn" onclick="window.__cIn('3')">3</button>
      <button class="calc-btn op" onclick="window.__cIn('+')">+</button>
      <button class="calc-btn" onclick="window.__cPM()">±</button>
      <button class="calc-btn" onclick="window.__cIn('0')">0</button>
      <button class="calc-btn" onclick="window.__cIn('.')">.</button>
      <button class="calc-btn eq" onclick="window.__cEq()">=</button>
    </div>
  </div>
  </div>`;
}
function init(){
  expr='';result='0';upd();
  document.addEventListener('keydown',kh);
}
function kh(e){
  if('0123456789.'.includes(e.key))window.__cIn(e.key);
  else if(e.key==='+'||e.key==='-')window.__cIn(e.key);
  else if(e.key==='*')window.__cIn('×');
  else if(e.key==='/')window.__cIn('÷');
  else if(e.key==='%')window.__cIn('%');
  else if(e.key==='Enter'||e.key==='=')window.__cEq();
  else if(e.key==='Backspace'){result=result.length>1?result.slice(0,-1):'0';upd();}
  else if(e.key==='Escape')window.__cAC();
}
function upd(){
  const r=document.getElementById('calc-result'),ex=document.getElementById('calc-expr');
  if(r)r.textContent=result;if(ex)ex.textContent=expr;
}
window.__cIn=v=>{
  const ops=['+','-','×','÷','%'];
  if(ops.includes(v)){expr+=result+v;result='0';}
  else{if(result==='0'&&v!=='.')result=v;else if(v==='.'&&result.includes('.'))return;else result+=v;}
  upd();
};
window.__cAC=()=>{expr='';result='0';upd();};
window.__cPM=()=>{result=String(-parseFloat(result));upd();};
window.__cEq=()=>{
  try{
    const calc=(expr+result).replace(/×/g,'*').replace(/÷/g,'/').replace(/(\d+)%/g,'($1/100)');
    const r=Function('"use strict";return ('+calc+')')();
    result=String(Number.isFinite(r)?parseFloat(r.toFixed(10)):r);expr='';
  }catch{result='오류';expr='';}
  upd();
};
window.registerPage('calculator',{render,init});
})();