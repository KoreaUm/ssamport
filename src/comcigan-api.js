// 컴시간알리미 비공식 연동.
// 컴시간 웹페이지는 시간표를 "교사/과목 치환 코드"가 담긴 JSON으로 내려주고,
// 그 JSON을 HTML로 바꿔주는 전용 JS 코드를 페이지에 eval() 하는 방식으로 동작한다.
// 여기서는 그 원격 스크립트를 실행하지 않고, 같은 치환 규칙(숫자 코드 → 교사명/과목명)을
// 직접 계산만 해서 쓴다 (원격 코드 실행 없음).
const http = require('http');
const iconv = require('iconv-lite');

const HOST = 'http://컴시간학생.kr';

function fetchText(url, { binary } = {}) {
  return new Promise((resolve, reject) => {
    http.get(url, { timeout: 10000 }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(binary ? buffer : buffer.toString('utf8'));
      });
      res.on('error', reject);
    }).on('error', reject).on('timeout', () => reject(new Error('컴시간 서버 응답이 없습니다.')));
  });
}

function parseTrailingJson(text) {
  const end = text.lastIndexOf('}');
  if (end < 0) throw new Error('컴시간 응답을 해석하지 못했습니다.');
  return JSON.parse(text.substring(0, end + 1));
}

// splitData: 컴시간이 교사/과목 코드를 3자리씩 묶어 하나의 정수로 합쳐 보내는 값을 다시 분리한다.
// (원본 사이트 스크립트의 splitData 함수와 동일한 규칙 - 원격 실행 없이 로컬에서 재계산)
function splitData(value) {
  const matches = String(value).match(/\d{1,3}(?=(\d{3})+(?!\d))|\d{1,3}$/g);
  if (!matches) return [0];
  return matches.reverse().map(Number);
}

function decodeCell(rawValue, changeNotify) {
  if (rawValue === undefined || rawValue === null) return null;
  let value = rawValue;
  if (changeNotify === 1 && String(rawValue).startsWith('>')) {
    value = String(rawValue).substring(1);
  }
  const parts = splitData(value);
  const teacherIndex = parts[0] || 0;
  const subjectIndex = (parts[1] || 0) + (parts[2] || 0) * 1000;
  return { teacherIndex, subjectIndex };
}

function decodeTeacherName(name) {
  if (name === undefined || name === null) return '';
  const hasInnerAsterisk = name.includes('*') && !name.startsWith('*') && !name.endsWith('*');
  const isTwoCharWithTrailingAsterisk = name.length === 2 && name[1] === '*';
  if (hasInnerAsterisk || isTwoCharWithTrailingAsterisk) return name;
  return name.replace('*', '');
}

async function resolveEndpoint() {
  const homeHtml = await fetchText(HOST);
  const frameMatch = homeHtml
    .toLowerCase()
    .replace(/'/g, '"')
    .match(/<frame [^>]*src="[^"]*"[^>]*>/);
  if (!frameMatch) throw new Error('컴시간 접속 주소를 찾을 수 없습니다.');
  const uriMatch = frameMatch[0].match(/"[^"]*"/);
  if (!uriMatch) throw new Error('컴시간 접속 주소를 찾을 수 없습니다.');
  const frameHref = uriMatch[0].replace(/"/g, '');
  const baseUrl = new URL(frameHref).origin;

  const pageBuffer = await fetchText(frameHref, { binary: true });
  const source = iconv.decode(pageBuffer, 'EUC-KR');

  const searchIdx = source.indexOf('school_ra(sc)');
  const dataIdx = source.indexOf("sc_data('");
  if (searchIdx === -1 || dataIdx === -1) {
    throw new Error('컴시간 연동 정보를 찾을 수 없습니다. 컴시간 쪽 사이트가 변경되었을 수 있습니다.');
  }

  const searchUrlMatch = source.substr(searchIdx, 50).replace(' ', '').match(/url:'.(.*?)'/);
  if (!searchUrlMatch) throw new Error('컴시간 검색 주소를 찾을 수 없습니다.');
  const searchPath = searchUrlMatch[1];

  const dataArgsMatch = source.substr(dataIdx, 30).replace(' ', '').match(/\(.*?\)/);
  if (!dataArgsMatch) throw new Error('컴시간 조회 정보를 찾을 수 없습니다.');
  const dataArgs = dataArgsMatch[0].replace(/[()]/g, '').replace(/'/g, '').split(',');

  return { baseUrl, searchPath, dataPrefix: dataArgs[0], dayParam: dataArgs[2] };
}

async function searchSchools(keyword) {
  const { baseUrl, searchPath } = await resolveEndpoint();
  let hexString = '';
  for (const byte of iconv.encode(keyword, 'euc-kr')) {
    hexString += `%${byte.toString(16)}`;
  }
  const text = await fetchText(baseUrl + searchPath + hexString);
  const json = parseTrailingJson(text);
  const rows = json['학교검색'] || [];
  return rows.map((row) => ({ code: row[3], name: row[2], region: row[1] }));
}

async function fetchClassTimetable(schoolCode, grade, classNum) {
  const { baseUrl, searchPath, dataPrefix, dayParam } = await resolveEndpoint();
  const dataBasePath = searchPath.split('?')[0];
  const payload = `${dataPrefix}${schoolCode}_0_${dayParam}`;
  const dataPath = `${dataBasePath}?${Buffer.from(payload).toString('base64')}`;

  const text = await fetchText(baseUrl + dataPath);
  const data = parseTrailingJson(text);

  const classCount = data['학급수'] || {};
  if (!classCount[grade] || classNum > classCount[grade]) {
    throw new Error('해당 학년/반의 시간표를 찾을 수 없습니다.');
  }

  const changeNotify = data['변경알림'];
  const separator = data['분리'] === undefined ? 100 : data['분리'];
  const teacherNames = data['자료446'] || [];
  const subjectNames = data['자료492'] || [];
  const dailySchedule = data['자료147'];
  const classSchedule = dailySchedule?.[grade]?.[classNum];
  if (!classSchedule) throw new Error('해당 학년/반의 시간표를 찾을 수 없습니다.');

  const entries = [];
  for (let weekday = 1; weekday <= 5; weekday += 1) {
    const dayRow = classSchedule[weekday];
    if (!dayRow) continue;
    for (let period = 1; period < dayRow.length; period += 1) {
      const decoded = decodeCell(dayRow[period], changeNotify);
      if (!decoded || !decoded.teacherIndex) continue;
      const subjectIndex = decoded.subjectIndex % separator;
      const teacher = decodeTeacherName(teacherNames[decoded.teacherIndex] || '');
      const subject = subjectNames[subjectIndex] || '';
      if (!subject) continue;
      entries.push({
        day_of_week: weekday - 1,
        period,
        subject,
        teacher,
        is_my_class: false,
      });
    }
  }
  return entries;
}

module.exports = { searchSchools, fetchClassTimetable };
