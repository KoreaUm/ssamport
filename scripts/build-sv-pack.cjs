// 학교폭력 공문·서식 묶음 생성기 (개발자용)
//
// 충청북도교육청 「학교폭력 사안처리 세부설명 A to Z」 hwpx 원본을 공문/서식/설명 단위로 잘라
// assets/school-violence/pack.json.gz 하나로 묶는다. 앱은 이 묶음의 원본 XML 위에 값만 채워
// hwpx를 만들기 때문에, 서식의 표·문구가 가이드북과 달라질 수 없다.
//
// 새 학년도 책자가 나오면:  node scripts/build-sv-pack.cjs "<책자.hwpx 경로>" 로 다시 만든다.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { readZip } = require('../src/sv/zip');

const src = process.argv[2];
if (!src) { console.error('사용법: node scripts/build-sv-pack.cjs <가이드북.hwpx>'); process.exit(1); }
const zip = readZip(fs.readFileSync(src));
const text = name => zip[name].toString('utf8');

// 최상위 문단만 잘라낸다. (<hp:pic, <hp:pos 등과 헷갈리지 않도록 <hp:p 뒤 공백만 인정)
function splitParagraphs(xml) {
  const out = []; let depth = 0, from = -1;
  const re = /<hp:p(?: [^>]*?)?(\/?)>|<\/hp:p>/g; let m;
  while ((m = re.exec(xml))) {
    if (m[0] === '</hp:p>') { depth--; if (depth === 0) out.push(xml.slice(from, re.lastIndex)); }
    else if (m[1] !== '/') { if (depth === 0) from = m.index; depth++; }
  }
  return out;
}

const plain = xml => (xml.match(/<hp:t[ >].*?<\/hp:t>/gs) || []).join('').replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim();

// 책 제본용 정보(쪽번호·꼬리말·구역 설정·줄 배치 캐시)는 개별 문서에 필요 없다.
function clean(xml) {
  return xml
    .replace(/<hp:linesegarray>.*?<\/hp:linesegarray>/gs, '')
    .replace(/<hp:secPr .*?<\/hp:secPr>/gs, '')
    .replace(/<hp:ctrl><hp:colPr [^>]*?(?:\/>|>.*?<\/hp:colPr>)<\/hp:ctrl>/gs, '')
    .replace(/<hp:ctrl><hp:(newNum|pageHiding|pageNum)\b[^>]*\/><\/hp:ctrl>/g, '')
    .replace(/<hp:ctrl><hp:(footer|header)\b.*?<\/hp:\1><\/hp:ctrl>/gs, '')
    .replace(/<hp:titleMark [^>]*\/>/g, '');
}

const sections = [0, 1, 2].map(n => splitParagraphs(text(`Contents/section${n}.xml`)));

// 문서 시작점: <공문N>/<서식N> 머리띠 + 설명 상자/간지/Q&A
const starts = [];
[1, 2].forEach(sec => sections[sec].forEach((xml, i) => {
  const t = plain(xml);
  const top = xml.replace(/<hp:tc .*/s, '');
  const m = t.match(/^<(공문|서식)\s*([0-9]+(?:-[0-9]+)?)>\s*(.*)$/s);
  if (m && /<hp:tbl [^>]*rowCnt="1" colCnt="[34]"/.test(top)) {
    starts.push({ sec, i, kind: m[1] === '공문' ? 'doc' : 'form', no: m[2], title: plain(xml).replace(/^<[^>]+>\s*/, '') });
  } else if (/<hp:tbl [^>]*rowCnt="3" colCnt="3"/.test(top) && !t.startsWith('조언') && t.length > 250) {
    starts.push({ sec, i, kind: 'guide' });
  }
}));
// 머리띠가 설명 상자와 같은 문단에 들어 있는 공문32는 다음 문단부터 시작한다.
const s2 = sections[2];
const i32 = s2.findIndex(x => /관계회복 숙려제도 운영\(○○초/.test(plain(x)));
starts.push({ sec: 2, i: i32, kind: 'doc', no: '32', title: '관계회복 숙려제도 운영 공문(모든 학교급 공통)' });
const at = (sec, needle) => { const i = sections[sec].findIndex(x => plain(x).includes(needle)); if (i < 0) throw new Error('못 찾음: ' + needle); return i; };
starts.push({ sec: 0, i: 0, kind: 'guide', id: 'G-cover', title: '표지·들어가며·목차' });
starts.push({ sec: 1, i: 0, kind: 'guide', id: 'G-submit', title: '공문 제출 안내' });
starts.push({ sec: 1, i: at(1, '체크리스트(학교자체활용)'), kind: 'form', no: '체크리스트', title: '학교폭력 사안처리 체크리스트(학교자체활용)' });
starts.push({ sec: 1, i: at(1, '학교폭력 사안 처리 흐름도'), kind: 'guide', id: 'G-flow', title: '사안처리 흐름도' });
starts.push({ sec: 1, i: at(1, '1. 학교폭력제로센터 컨설팅 요청'), kind: 'guide', id: 'G-toc0', title: '교육지원청 지원 요청 — 차례' });
starts.push({ sec: 1, i: at(1, '1. 학교폭력 신고접수 대장 작성2. 학교장 보고') - 4, kind: 'guide', id: 'G-toc1', title: 'Ⅰ. 초기 대응 및 접수 — 차례' });
starts.push({ sec: 1, i: at(1, '[별표] 학교폭력 가해학생 조치별 적용 세부 기준'), kind: 'guide', id: 'G-criteria', title: '[별표] 가해학생 조치별 적용 세부 기준' });
[['사안 조사Ⅱ', 'G-toc2', 'Ⅱ. 사안조사 — 차례'], ['전담기구 심의Ⅲ', 'G-toc3', 'Ⅲ. 전담기구 심의 — 차례'], ['조치결과 이행Ⅳ', 'G-toc4', 'Ⅳ. 조치결과 이행 — 차례']]
  .forEach(([n, id, title]) => starts.push({ sec: 1, i: at(1, n) - 1, kind: 'guide', id, title }));
starts.push({ sec: 2, i: at(2, '후속 조치Ⅴ') - 1, kind: 'guide', id: 'G-toc5', title: 'Ⅴ. 후속조치 — 차례' });
starts.push({ sec: 2, i: sections[2].findIndex(x => plain(x).replace(/\s+/g, '').includes('전담기구유예및프로그램운영')) + 1, kind: 'guide', id: 'G-qna', title: '학교폭력 사안처리 Q&A' });
starts.push({ sec: 2, i: sections[2].findIndex(x => /검토위원/.test(plain(x))), kind: 'guide', id: 'G-colophon', title: '발행 정보' });

const guideTitles = {
  '1. 『학교폭력사안처리컨설팅단』 요청': ['G-zero', '제로센터 지원 요청 안내'],
  '1. 학교폭력 신고접수 대장 작성': ['G-1-1', '신고접수 대장 · 학교장 보고 및 학부모 통보'],
  '3. 최초 학생 작성 확인서 작성': ['G-1-3', '최초 학생 작성 확인서 · 성 사안 대응'],
  '4. 즉시분리': ['G-1-4', '즉시분리'],
  '5. 긴급조치': ['G-1-5', '긴급조치'],
  '6. 통보': ['G-1-6', '통보(학생·학부모·관련학교)'],
  '7. 학교폭력 접수보고서': ['G-1-7', '접수보고서 작성 및 보고 · 아동학대'],
  '1. 사안접수 보고서 확인': ['G-2-1', '전담조사관 배정 · 조사'],
  '5. 자체 사안조사': ['G-2-5', '자체 사안조사 참고자료'],
  '다. 보호자 면담': ['G-2-5b', '보호자 면담 · 기타 참고사항'],
  '6. 타지역 학교 간': ['G-2-6', '타지역 학교 간 공동 학폭 절차도'],
  '1. 학교폭력 전담기구 개최 연기': ['G-3-1', '전담기구 연기 · 개최 · 심의 · 결과 보고'],
  '3. 학교폭력대책심의위원회 개최요청': ['G-3-3', '심의위원회 개최 요청'],
  '학교폭력 조치사항 및 조건부 기재유보': ['G-4-1', '조치사항 관리대장 · 생활기록부 기재'],
  '3. 조치 결과별 이행 절차': ['G-4-3', '조치 결과별 이행 절차'],
  '4. 5호 조치로서의 특별교육': ['G-4-4', '특별교육 · 부가된 특별교육 · Wee센터'],
  '5. 가해 학생 조치 미이행': ['G-4-5', '조치 미이행 처리 방법'],
  '1. 생활기록부 삭제 요령': ['G-5-1', '생활기록부 삭제 요령'],
  '2. 관계 회복': ['G-5-2', '관계회복 숙려제도']
};

const ord = starts.filter(s => s.kind !== 'skip').sort((a, b) => a.sec - b.sec || a.i - b.i);
const docs = []; let order = 0;
ord.forEach((s, k) => {
  const next = ord[k + 1];
  const end = next && next.sec === s.sec ? next.i : sections[s.sec].length;
  const paras = sections[s.sec].slice(s.i, end);
  const xml = clean(paras.join(''));
  let id = s.id, title = s.title;
  if (s.kind !== 'guide') id = (s.kind === 'doc' ? 'D' : 'F') + s.no;
  if (!id) {
    const t = plain(paras[0]).replace(/\s+/g, '');
    const hit = Object.entries(guideTitles).find(([key]) => { const k = key.replace(/\s+/g, ''); return t.includes(k) && t.indexOf(k) < 60; });
    if (!hit) throw new Error('설명 상자 제목 매칭 실패: ' + t.slice(0, 80));
    [id, title] = hit[1];
  }
  docs.push({ id, kind: s.kind, no: s.no || '', title: title.replace(/\s+/g, ' ').trim(), sec: s.sec, from: s.i, to: end - 1, order: order++, xml });
});

const secPr = text('Contents/section1.xml').match(/<hp:secPr .*?<\/hp:secPr>/s)[0]
  .replace(/<hp:startNum [^>]*\/>/, '<hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/>');
const colPr = (text('Contents/section1.xml').match(/<hp:ctrl><hp:colPr [^>]*?(?:\/>|>.*?<\/hp:colPr>)<\/hp:ctrl>/s) || [''])[0];
const rootOpen = text('Contents/section1.xml').match(/<hs:sec [^>]*>/)[0];
const manifest = text('Contents/content.hpf');
const images = {};
const usedImages = new Set(docs.flatMap(d => [...d.xml.matchAll(/binaryItemIDRef="([^"]+)"/g)].map(m => m[1])));
usedImages.forEach(id => {
  const m = manifest.match(new RegExp(`<opf:item id="${id}" href="([^"]+)" media-type="([^"]+)"`));
  if (!m) return;
  images[id] = { href: m[1], type: m[2], data: zip[m[1]].toString('base64') };
});
const header = text('Contents/header.xml');
// 글꼴 배경 등에 쓰인 그림도 header가 참조하면 함께 담는다.
[...header.matchAll(/binaryItemIDRef="([^"]+)"/g)].forEach(([, id]) => {
  if (images[id]) return;
  const m = manifest.match(new RegExp(`<opf:item id="${id}" href="([^"]+)" media-type="([^"]+)"`));
  if (m) images[id] = { href: m[1], type: m[2], data: zip[m[1]].toString('base64'), header: true };
});
const pack = {
  source: '충청북도교육청 인성시민과, 2026. 학교폭력 사안처리 세부설명 A to Z (2026.3.)',
  rootOpen, secPr, colPr, header, version: text('version.xml'), settings: text('settings.xml'),
  container: text('META-INF/container.xml'), odfManifest: text('META-INF/manifest.xml'),
  opfOpen: manifest.match(/<opf:package [^>]*>/)[0], images, docs
};
const out = path.join(__dirname, '..', 'assets', 'school-violence', 'pack.json.gz');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, zlib.gzipSync(Buffer.from(JSON.stringify(pack)), { level: 9 }));
docs.forEach(d => console.log(d.id.padEnd(12), d.kind.padEnd(6), `s${d.sec} ${d.from}-${d.to}`.padEnd(14), d.title));
console.log('문서', docs.length, '· 이미지', Object.keys(images).length, '·', (fs.statSync(out).size / 1024 | 0) + 'KB');
