// 학교폭력 서식 엔진 — 가이드북 원본 XML을 화면용 모델로 바꾸고, 고친 글자만 원본에 되돌려 hwpx로 저장한다.
// 표 구조·글꼴·칸 크기는 원본 XML을 그대로 쓰므로 가이드북 서식과 어긋나지 않는다.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { DOMParser, XMLSerializer } = require('@xmldom/xmldom');
const { writeZip } = require('./zip');

const PACK_PATH = path.join(__dirname, '..', '..', 'assets', 'school-violence', 'pack.json.gz');
let packCache = null;
function loadPack() {
  if (!packCache) packCache = JSON.parse(zlib.gunzipSync(fs.readFileSync(PACK_PATH)).toString('utf8'));
  return packCache;
}
function findDoc(id) {
  const doc = loadPack().docs.find(d => d.id === id);
  if (!doc) throw new Error('없는 문서입니다: ' + id);
  return doc;
}

const local = n => (n.localName || n.nodeName.replace(/^.*:/, ''));
const kids = (n, name) => { const o = []; for (let c = n.firstChild; c; c = c.nextSibling) if (c.nodeType === 1 && (!name || local(c) === name)) o.push(c); return o; };
const kid = (n, name) => kids(n, name)[0] || null;
const num = v => Number(v || 0);

function parseDoc(id) {
  const pack = loadPack();
  const xml = pack.rootOpen + findDoc(id).xml + '</hs:sec>';
  return new DOMParser().parseFromString(xml, 'text/xml');
}

// ── 글자 ↔ <hp:t> ────────────────────────────────────────────────
function readT(t) {
  let s = '';
  for (let c = t.firstChild; c; c = c.nextSibling) {
    if (c.nodeType === 3 || c.nodeType === 4) s += c.data;
    else if (c.nodeType === 1) {
      const n = local(c);
      if (n === 'tab') s += '\t';
      else if (n === 'lineBreak') s += '\n';
      else if (n === 'fwSpace') s += ' ';
      else if (n === 'nbSpace') s += ' ';
      else if (n === 'hyphen') s += '-';
    }
  }
  return s;
}
function writeT(t, text) {
  while (t.firstChild) t.removeChild(t.firstChild);
  const doc = t.ownerDocument; const ns = t.namespaceURI;
  String(text).split(/([\t\n ])/).forEach(part => {
    if (!part) return;
    let el = null;
    if (part === '\t') { el = doc.createElementNS(ns, 'hp:tab'); el.setAttribute('width', '4000'); el.setAttribute('leader', '0'); el.setAttribute('type', '1'); }
    else if (part === '\n') el = doc.createElementNS(ns, 'hp:lineBreak');
    else if (part === ' ') el = doc.createElementNS(ns, 'hp:fwSpace');
    else el = doc.createTextNode(part.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ''));
    t.appendChild(el);
  });
}

// ── 모델 만들기 ────────────────────────────────────────────────
const OBJECTS = new Set(['tbl', 'pic', 'rect', 'container', 'line', 'ellipse', 'polygon', 'compose', 'equation']);

// 문단을 문서 순서대로 훑으며 번호(pid)를 매긴다. 화면과 저장이 같은 순서를 쓰므로 번호가 항상 맞는다.
function walk(root) {
  const paras = []; let tid = 0;
  const doPara = p => {
    const pid = paras.length; const rec = { p, atoms: [] }; paras.push(rec);
    const items = [];
    let lastRun = null;
    kids(p, 'run').forEach(run => {
      lastRun = run; const cs = run.getAttribute('charPrIDRef');
      kids(run).forEach(c => {
        const n = local(c);
        if (n === 't') { const a = { el: c, run, cs, a: rec.atoms.length }; rec.atoms.push(a); items.push({ k: 't', a: a.a, cs, s: readT(c) }); }
        else if (OBJECTS.has(n)) { const obj = doObj(c, n); if (obj) items.push(obj); }
      });
    });
    if (!rec.atoms.length && lastRun) {
      const a = { el: null, run: lastRun, cs: lastRun.getAttribute('charPrIDRef'), a: 0 };
      rec.atoms.push(a);
      items.push({ k: 't', a: a.a, cs: a.cs, s: '' });
    }
    return { k: 'p', pid, ps: p.getAttribute('paraPrIDRef'), items };
  };
  const doObj = (el, n) => {
    if (n === 'tbl') {
      const t = { k: 'tbl', tid: tid++, w: num((kid(el, 'sz') || el).getAttribute('width')), bf: el.getAttribute('borderFillIDRef'), inline: (kid(el, 'pos') || el).getAttribute('treatAsChar') === '1', rows: [] };
      kids(el, 'tr').forEach(tr => t.rows.push(kids(tr, 'tc').map(tc => {
        const ad = kid(tc, 'cellAddr'), sp = kid(tc, 'cellSpan'), sz = kid(tc, 'cellSz'), sub = kid(tc, 'subList'), mg = kid(tc, 'cellMargin');
        return { r: num(ad.getAttribute('rowAddr')), c: num(ad.getAttribute('colAddr')), rs: num(sp.getAttribute('rowSpan')), cs: num(sp.getAttribute('colSpan')),
          w: num(sz.getAttribute('width')), h: num(sz.getAttribute('height')), bf: tc.getAttribute('borderFillIDRef'), va: sub.getAttribute('vertAlign'),
          ml: num(mg && mg.getAttribute('left')), mr: num(mg && mg.getAttribute('right')), blocks: kids(sub, 'p').map(doPara) };
      })));
      return t;
    }
    if (n === 'pic') {
      const img = kid(el, 'img'); const sz = kid(el, 'sz') || kid(el, 'curSz');
      const z = kid(el, 'sz') || kid(el, 'curSz') || kid(el, 'orgSz');
      return { k: 'img', src: img && img.getAttribute('binaryItemIDRef'), w: num((sz || z).getAttribute('width')), h: num((sz || z).getAttribute('height')) };
    }
    if (n === 'line') return { k: 'line' };
    if (n === 'compose') return { k: 'fixed', s: el.getAttribute('composeText') || '' };
    if (n === 'equation') return null;
    // 도형: 안쪽 글상자를 모은다.
    const boxes = [];
    (function dig(node) {
      kids(node).forEach(c => {
        const cn = local(c);
        if (cn === 'drawText') { const sub = kid(c, 'subList'); if (sub) boxes.push(...kids(sub, 'p').map(doPara)); }
        else if (cn === 'pic') { const o = doObj(c, 'pic'); if (o) boxes.push({ k: 'p', pid: -1, ps: '0', items: [o] }); }
        else if (OBJECTS.has(cn)) dig(c);
      });
    })(el);
    return { k: 'draw', blocks: boxes, w: num((kid(el, 'sz') || kid(el, 'curSz') || el).getAttribute('width')) };
  };
  const blocks = kids(root, 'p').map(doPara);
  return { blocks, paras };
}

// ── 표의 행 추가·삭제 ─────────────────────────────────────────────
// 관련 학생이 원본 서식의 줄 수보다 많을 때 같은 모양의 행을 복제한다. 세로로 합쳐진 칸은 함께 늘린다.
function applyOps(root, ops) {
  (ops || []).forEach(op => {
    const tables = []; (function dig(n) { kids(n).forEach(c => { if (local(c) === 'tbl') tables.push(c); dig(c); }); })(root);
    const tbl = tables[op.tid]; if (!tbl) return;
    const trs = kids(tbl, 'tr');
    const tr = trs[op.row]; if (!tr) return;
    const set = (tc, name, attr, v) => kid(tc, name).setAttribute(attr, String(v));
    const get = (tc, name, attr) => num(kid(tc, name).getAttribute(attr));
    const all = trs.flatMap(t => kids(t, 'tc'));
    const height = Math.max(0, ...kids(tr, 'tc').filter(tc => get(tc, 'cellSpan', 'rowSpan') === 1).map(tc => get(tc, 'cellSz', 'height')));
    const sz = kid(tbl, 'sz');
    if (op.del) {
      if (trs.length < 2) return;
      // 세로로 합쳐진 칸이 이 행에서 시작하면 다음 행으로 내려 보내고 한 줄 줄인다.
      const spans = kids(tr, 'tc').filter(tc => get(tc, 'cellSpan', 'rowSpan') > 1);
      if (spans.length && !trs[op.row + 1]) return;
      spans.forEach(tc => {
        set(tc, 'cellSpan', 'rowSpan', get(tc, 'cellSpan', 'rowSpan') - 1);
        const nextTr = trs[op.row + 1], col = get(tc, 'cellAddr', 'colAddr');
        const before = kids(nextTr, 'tc').find(o => get(o, 'cellAddr', 'colAddr') > col) || null;
        set(tc, 'cellAddr', 'rowAddr', op.row + 1); nextTr.insertBefore(tc, before);
      });
      all.forEach(tc => {
        const r = get(tc, 'cellAddr', 'rowAddr'), rs = get(tc, 'cellSpan', 'rowSpan');
        if (r < op.row && r + rs > op.row) set(tc, 'cellSpan', 'rowSpan', rs - 1);
        if (r > op.row) set(tc, 'cellAddr', 'rowAddr', r - 1);
      });
      tbl.removeChild(tr);
      tbl.setAttribute('rowCnt', String(num(tbl.getAttribute('rowCnt')) - 1));
      if (sz) sz.setAttribute('height', String(Math.max(0, num(sz.getAttribute('height')) - height)));
      return;
    }
    if (Array.from(tr.getElementsByTagName('hp:tbl')).length) return;
    const clone = tr.cloneNode(true);
    kids(clone, 'tc').forEach(tc => { if (get(tc, 'cellSpan', 'rowSpan') > 1) clone.removeChild(tc); else set(tc, 'cellAddr', 'rowAddr', op.row + 1); });
    all.forEach(tc => {
      const r = get(tc, 'cellAddr', 'rowAddr'), rs = get(tc, 'cellSpan', 'rowSpan');
      if (r <= op.row && r + rs > op.row && rs > 1) set(tc, 'cellSpan', 'rowSpan', rs + 1);
      if (r > op.row) set(tc, 'cellAddr', 'rowAddr', r + 1);
    });
    // 복제한 행의 글자는 비운다.
    Array.from(clone.getElementsByTagName('hp:t')).forEach(t => { const keep = /[□■]/.test(readT(t)); if (!keep) writeT(t, ''); });
    tbl.insertBefore(clone, tr.nextSibling);
    tbl.setAttribute('rowCnt', String(num(tbl.getAttribute('rowCnt')) + 1));
    if (sz) sz.setAttribute('height', String(num(sz.getAttribute('height')) + height));
  });
}

// ── 모양(글자·문단·테두리) ───────────────────────────────────────
let headCache = null;
function headStyles() {
  if (headCache) return headCache;
  const root = new DOMParser().parseFromString(loadPack().header, 'text/xml').documentElement;
  const all = name => Array.from(root.getElementsByTagName('hh:' + name));
  const fonts = {};
  all('fontface').forEach(f => { if (f.getAttribute('lang') === 'HANGUL') kids(f, 'font').forEach(x => { fonts[x.getAttribute('id')] = x.getAttribute('face'); }); });
  const cs = {}, ps = {}, bf = {}, bullets = {}, numberings = {};
  all('charPr').forEach(c => {
    const g = n => kid(c, n);
    const o = { h: num(c.getAttribute('height')) / 100, f: fonts[(g('fontRef') || c).getAttribute('hangul')] || '' };
    const col = c.getAttribute('textColor'); if (col && col !== '#000000' && col !== 'none') o.c = col;
    const sh = c.getAttribute('shadeColor'); if (sh && sh !== 'none' && sh !== '#FFFFFF') o.bg = sh;
    if (g('bold')) o.b = 1; if (g('italic')) o.i = 1;
    const ul = g('underline'); if (ul && ul.getAttribute('type') === 'BOTTOM') o.u = 1;
    const st = g('strikeout'); if (st && !['NONE', '3D'].includes(st.getAttribute('shape'))) o.s = 1;
    const sp = g('spacing'); if (sp && num(sp.getAttribute('hangul'))) o.sp = num(sp.getAttribute('hangul'));
    cs[c.getAttribute('id')] = o;
  });
  all('paraPr').forEach(p => {
    const o = { al: (kid(p, 'align') || p).getAttribute('horizontal') };
    const hd = kid(p, 'heading');
    if (hd && (hd.getAttribute('type') === 'BULLET' || hd.getAttribute('type') === 'NUMBER')) o.hd = { t: hd.getAttribute('type'), id: hd.getAttribute('idRef'), lv: num(hd.getAttribute('level')) };
    const sw = kid(p, 'switch'); const box = sw ? (kid(sw, 'default') || sw) : p; const m = kid(box, 'margin'), ls = kid(box, 'lineSpacing');
    if (m) { const v = n => num((kid(m, n) || m).getAttribute('value')); o.ti = v('intent') / 2; o.ml = v('left') / 2; o.mr = v('right') / 2; o.mt = v('prev') / 2; o.mb = v('next') / 2; }
    if (ls && ls.getAttribute('type') === 'PERCENT') o.ls = num(ls.getAttribute('value'));
    ps[p.getAttribute('id')] = o;
  });
  all('borderFill').forEach(b => {
    const side = n => { const e = kid(b, n); if (!e || e.getAttribute('type') === 'NONE') return 0; return [e.getAttribute('type'), parseFloat(e.getAttribute('width')) || 0.12, e.getAttribute('color')]; };
    const o = { l: side('leftBorder'), r: side('rightBorder'), t: side('topBorder'), b: side('bottomBorder') };
    const fb = kid(b, 'fillBrush'); const wb = fb && kid(fb, 'winBrush');
    if (wb) { const f = wb.getAttribute('faceColor'); if (f && f !== 'none' && f.toUpperCase() !== '#FFFFFF') o.f = f; }
    const gr = fb && kid(fb, 'gradation'); if (gr) { const c0 = kid(gr, 'color'); if (c0) o.f = c0.getAttribute('value'); }
    bf[b.getAttribute('id')] = o;
  });
  all('bullet').forEach(b => { const ch = b.getAttribute('char') || ''; bullets[b.getAttribute('id')] = /[-]/.test(ch) ? '■' : ch; });
  all('numbering').forEach(n => { numberings[n.getAttribute('id')] = kids(n, 'paraHead').map(h => ({ lv: num(h.getAttribute('level')), fmt: h.textContent || '', kind: h.getAttribute('numFormat'), start: num(h.getAttribute('start')) || 1 })); });
  headCache = { cs, ps, bf, bullets, numberings };
  return headCache;
}

const HANGUL = '가나다라마바사아자차카타파하';
// 원본이 "문단 번호/글머리표" 기능으로 찍은 1. 가. - 같은 기호를 화면·복사용 글자로 되살린다.
function applyHeads(blocks, st) {
  const counters = {};
  (function dig(bs) {
    bs.forEach(b => {
      const hd = (st.ps[b.ps] || {}).hd;
      const txt = b.items.filter(i => i.k === 't').map(i => i.s).join('').trim();
      if (hd && (txt || b.items.some(i => i.k !== 't'))) {
        if (hd.t === 'BULLET') b.hd = (st.bullets[hd.id] || '-') + ' ';
        else {
          const def = (st.numberings[hd.id] || []).find(x => x.lv === hd.lv + 1);
          const key = hd.id; counters[key] = counters[key] || [];
          counters[key][hd.lv] = (counters[key][hd.lv] || 0) + 1; counters[key].length = hd.lv + 1;
          if (def) b.hd = def.fmt.replace(/\^(\d)/g, (_, d) => { const v = counters[key][d - 1] || 1; return def.kind === 'HANGUL_SYLLABLE' && Number(d) === hd.lv + 1 ? HANGUL[v - 1] || v : v; }) + ' ';
        }
      }
      b.items.forEach(i => { if (i.k === 'tbl') i.rows.forEach(r => r.forEach(c => dig(c.blocks))); if (i.k === 'draw') dig(i.blocks); });
    });
  })(blocks);
}

function textOf(blocks) {
  return blocks.map(b => b.items.map(i => i.k === 't' ? i.s : i.k === 'tbl' ? i.rows.map(r => r.map(c => textOf(c.blocks)).join(' ')).join('\n') : i.k === 'draw' ? textOf(i.blocks) : '').join('')).join('\n');
}

function getModel(id, ops) {
  const doc = findDoc(id);
  const root = parseDoc(id).documentElement; applyOps(root, ops);
  const { blocks } = walk(root);
  const st = headStyles();
  applyHeads(blocks, st);
  const used = { cs: {}, ps: {}, bf: {} }; const imgs = {};
  (function dig(bs) {
    bs.forEach(b => {
      if (st.ps[b.ps]) used.ps[b.ps] = st.ps[b.ps];
      b.items.forEach(i => {
        if (i.k === 't') used.cs[i.cs] = st.cs[i.cs];
        if (i.k === 'img' && i.src) { const im = loadPack().images[i.src]; if (im) imgs[i.src] = `data:${im.type.replace('image/jpg', 'image/jpeg')};base64,${im.data}`; }
        if (i.k === 'tbl') { used.bf[i.bf] = st.bf[i.bf]; i.rows.forEach(r => r.forEach(c => { used.bf[c.bf] = st.bf[c.bf]; dig(c.blocks); })); }
        if (i.k === 'draw') dig(i.blocks);
      });
    });
  })(blocks);
  return { id, kind: doc.kind, no: doc.no, title: doc.title, blocks, styles: used, images: imgs };
}

// 행을 더하거나 뺀 뒤, 예전 문단 번호가 새 번호로 어떻게 바뀌었는지 알려 준다(손으로 고친 내용을 옮기기 위해).
function rowOp(id, ops, op) {
  const root = parseDoc(id).documentElement; applyOps(root, ops);
  const before = walk(root).paras.map(r => r.p);
  applyOps(root, [op]);
  const after = new Map(walk(root).paras.map((r, i) => [r.p, i]));
  const map = {}; before.forEach((p, i) => { if (after.has(p)) map[i] = after.get(p); });
  return map;
}

function list() {
  return loadPack().docs.map(({ id, kind, no, title, order }) => ({ id, kind, no, title, order }));
}

// 가이드북 전체 검색용 글자
let searchCache = null;
function searchIndex() {
  if (!searchCache) searchCache = loadPack().docs.map(d => ({ id: d.id, title: d.title, text: [...d.xml.matchAll(/<hp:t[ >](.*?)<\/hp:t>/gs)].map(m => m[1].replace(/<[^>]+>/g, ' ')).join(' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ') }));
  return searchCache;
}

// ── 저장 ──────────────────────────────────────────────────────
// edits: { [pid]: { atoms: {aid: text}, lines?: [...] } | { del: true } }
// drop:  제출용에서 뺄 최상위 문단 번호(pid) 목록
// checks는 atoms 안에서 □/■ 글자로 처리된다.
function applyEdits(root, edits, drop, dropTbl, plainCs, bodyCs) {
  const { paras } = walk(root);
  const tables = []; (function dig(n) { kids(n).forEach(c => { if (local(c) === 'tbl') tables.push(c); dig(c); }); })(root);
  // 예시용 파란·회색·기울임 글자에 실제 값을 쓰면 검정 바른 글자로 바꾼다.
  const splitRun = (a, cs) => {
    const run = a.run;
    if (run.getAttribute('charPrIDRef') === cs) return;
    const others = kids(run).filter(c => c !== a.el);
    if (!others.length) { run.setAttribute('charPrIDRef', cs); return; }
    const before = run.cloneNode(false), mid = run.cloneNode(false);
    let c = run.firstChild; while (c && c !== a.el) { const n = c.nextSibling; before.appendChild(c); c = n; }
    run.parentNode.insertBefore(before, run); run.parentNode.insertBefore(mid, run);
    mid.appendChild(a.el); mid.setAttribute('charPrIDRef', cs); a.run = mid;
    if (!before.firstChild) before.parentNode.removeChild(before);
    if (!run.firstChild) run.parentNode.removeChild(run);
  };
  // 이름처럼 짧은 값이 좁은 칸에서 두 줄로 꺾이면 그 칸의 안쪽 여백만 없앤다(칸 크기는 그대로).
  const fitCell = (p, text, cs) => {
    if (!text || text.length > 6) return;
    const sub = p.parentNode, tc = sub && sub.parentNode; if (!tc || local(tc) !== 'tc') return;
    const st = headStyles().cs[cs] || { h: 10 }; const w = num(kid(tc, 'cellSz').getAttribute('width'));
    const need = [...text].reduce((n, ch) => n + (ch.charCodeAt(0) > 0x1100 ? 1 : 0.5), 0) * st.h * 100 * (1 + (st.sp || 0) / 100);
    const mg = kid(tc, 'cellMargin'); const tbl = tc.parentNode.parentNode, im = tc.getAttribute('hasMargin') === '1' ? mg : kid(tbl, 'inMargin') || mg;
    if (!mg || need * 1.12 <= w - num(im.getAttribute('left')) - num(im.getAttribute('right')) || need > w) return;
    tc.setAttribute('hasMargin', '1'); mg.setAttribute('left', '0'); mg.setAttribute('right', '0');
  };
  Object.keys(edits || {}).forEach(key => {
    const rec = paras[Number(key)]; const ed = edits[key];
    if (!rec || !ed) return;
    if (ed.del) { const parent = rec.p.parentNode; if (parent && kids(parent, 'p').length > 1) { parent.removeChild(rec.p); return; } }
    let firstCs = null;
    rec.atoms.forEach(a => {
      const top = bodyCs && rec.p.parentNode === root;
      if (!ed.atoms || !(a.a in ed.atoms)) { if (firstCs === null && a.el && readT(a.el)) firstCs = a.cs; return; }
      const value = String(ed.atoms[a.a]);
      if (!a.el) {
        if (!value) return;
        a.el = a.run.ownerDocument.createElementNS(rec.p.namespaceURI, 'hp:t');
        a.run.appendChild(a.el);
      }
      const cs = value ? plainCs(top ? bodyCs : a.cs) : a.cs;
      if (firstCs === null && value) firstCs = cs;
      writeT(a.el, value);
      if (value && cs !== a.cs) splitRun(a, cs);
    });
    if (firstCs === null && rec.atoms[0]) firstCs = bodyCs && rec.p.parentNode === root ? bodyCs : rec.atoms[0].cs;
    fitCell(rec.p, rec.atoms.map(a => a.el ? readT(a.el) : '').join(''), firstCs);
    // 여러 줄로 쓴 값은 한글에서도 문단이 나뉘도록 같은 모양의 문단을 뒤에 이어 붙인다.
    let after = rec.p;
    (ed.extra || []).forEach(line => {
      const clone = rec.p.cloneNode(false);
      const run = rec.p.ownerDocument.createElementNS(rec.p.namespaceURI, 'hp:run');
      run.setAttribute('charPrIDRef', firstCs || '0');
      const t = rec.p.ownerDocument.createElementNS(rec.p.namespaceURI, 'hp:t'); writeT(t, line);
      run.appendChild(t); clone.appendChild(run); clone.setAttribute('pageBreak', '0');
      after.parentNode.insertBefore(clone, after.nextSibling); after = clone;
    });
  });
  (dropTbl || []).forEach(tid => { const t = tables[tid]; if (t && t.parentNode) t.parentNode.removeChild(t); });
  (drop || []).forEach(pid => { const rec = paras[pid]; if (rec && rec.p.parentNode === root) root.removeChild(rec.p); });
}

// header에 "같은 글꼴·크기의 검정 바른 글자" 모양을 필요한 만큼 추가한다.
function makePlainCs(header) {
  const map = {}; const added = [];
  let next = Math.max(...[...header.matchAll(/<hh:charPr id="(\d+)"/g)].map(m => Number(m[1]))) + 1;
  const plain = id => {
    if (map[id]) return map[id];
    const st = headStyles().cs[id];
    if (!st || (!st.c && !st.i && !st.u && !st.bg)) { map[id] = id; return id; }
    const m = header.match(new RegExp(`<hh:charPr id="${id}".*?</hh:charPr>`, 's'));
    if (!m) { map[id] = id; return id; }
    const nid = String(next++);
    added.push(m[0].replace(/id="\d+"/, `id="${nid}"`).replace(/textColor="[^"]*"/, 'textColor="#000000"').replace(/shadeColor="[^"]*"/, 'shadeColor="none"').replace('<hh:italic/>', '').replace(/<hh:underline type="[^"]*"/, '<hh:underline type="NONE"'));
    map[id] = nid; return nid;
  };
  return { plain, finish: () => !added.length ? header : header
    .replace(/<hh:charProperties itemCnt="\d+"/, `<hh:charProperties itemCnt="${next}"`)
    .replace('</hh:charProperties>', added.join('') + '</hh:charProperties>') };
}

const isBlank = p => !kids(p, 'run').some(r => kids(r).some(c => OBJECTS.has(local(c)) || (local(c) === 't' && readT(c).trim())));

function buildHwpx({ id, edits, drop, dropTbl, ops, title, bodyCs }) {
  const pack = loadPack();
  const dom = parseDoc(id); const root = dom.documentElement;
  applyOps(root, ops);
  const styles = makePlainCs(pack.header);
  applyEdits(root, edits, drop, dropTbl, styles.plain, bodyCs);
  // 앞뒤 빈 줄(책 쪽 맞춤용) 정리
  let ps = kids(root, 'p');
  while (ps.length > 1 && isBlank(ps[0])) { root.removeChild(ps[0]); ps = kids(root, 'p'); }
  while (ps.length > 1 && isBlank(ps[ps.length - 1])) { root.removeChild(ps[ps.length - 1]); ps = kids(root, 'p'); }
  if (!ps.length) throw new Error('저장할 내용이 없습니다.');
  ps[0].setAttribute('pageBreak', '0');
  let xml = new XMLSerializer().serializeToString(dom).replace(/^<\?xml[^>]*\?>/, '');
  const firstRun = `<hp:run charPrIDRef="0">${pack.secPr}${pack.colPr}</hp:run>`;
  xml = xml.replace(/(<hp:p\b[^>]*>)/, `$1${firstRun}`);
  const section = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>' + xml;

  const wanted = new Set([...section.matchAll(/binaryItemIDRef="([^"]+)"/g)].map(m => m[1]));
  const imgs = Object.entries(pack.images).filter(([k, v]) => wanted.has(k) || v.header);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const now = new Date().toISOString().slice(0, 19) + 'Z';
  const hpf = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>' + pack.opfOpen +
    `<opf:metadata><opf:title>${esc(title || findDoc(id).title)}</opf:title><opf:language>ko</opf:language><opf:meta name="creator" content="text"/><opf:meta name="subject" content="text"/><opf:meta name="description" content="text"/><opf:meta name="lastsaveby" content="text"/><opf:meta name="CreatedDate" content="text">${now}</opf:meta><opf:meta name="ModifiedDate" content="text">${now}</opf:meta><opf:meta name="keyword" content="text"/></opf:metadata>` +
    '<opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml"/>' +
    imgs.map(([k, v]) => `<opf:item id="${k}" href="${v.href}" media-type="${v.type}" isEmbeded="1"/>`).join('') +
    '<opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/><opf:item id="settings" href="settings.xml" media-type="application/xml"/></opf:manifest>' +
    '<opf:spine><opf:itemref idref="header" linear="yes"/><opf:itemref idref="section0" linear="yes"/></opf:spine></opf:package>';
  const prv = textOf(walk(root).blocks).replace(/\n{2,}/g, '\r\n').slice(0, 2000);
  const container = '<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf"><ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/><ocf:rootfile full-path="Preview/PrvText.txt" media-type="text/plain"/></ocf:rootfiles></ocf:container>';
  return writeZip([
    { name: 'mimetype', data: 'application/hwp+zip', store: true },
    { name: 'version.xml', data: pack.version, store: true },
    { name: 'Contents/header.xml', data: styles.finish().replace(/secCnt="\d+"/, 'secCnt="1"') },
    { name: 'Contents/section0.xml', data: section },
    ...imgs.map(([, v]) => ({ name: v.href, data: Buffer.from(v.data, 'base64') })),
    { name: 'Preview/PrvText.txt', data: prv },
    { name: 'settings.xml', data: pack.settings.replace(/<ha:CaretPosition [^>]*\/>/, '<ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/>') },
    { name: 'META-INF/container.xml', data: container },
    { name: 'META-INF/manifest.xml', data: pack.odfManifest },
    { name: 'Contents/content.hpf', data: hpf }
  ]);
}

module.exports = { list, searchIndex, getModel, rowOp, buildHwpx, textOf, loadPack, walk, parseDoc };
