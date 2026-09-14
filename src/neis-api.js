const https = require('https');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve(null); }
      });
    }).on('error', reject);
  });
}

async function getMeal(eduCode, schoolCode, date) {
  const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&pIndex=1&pSize=10&ATPT_OFCDC_SC_CODE=${eduCode}&SD_SCHUL_CODE=${schoolCode}&MLSV_YMD=${date}`;
  const json = await fetchJson(url);
  if (!json?.mealServiceDietInfo) return {};
  const rows = json.mealServiceDietInfo[1]?.row || [];
  const result = {};
  for (const row of rows) {
    const type = row.MMEAL_SC_NM;
    const menu = (row.DDISH_NM || '').split('<br/>').map(s => s.replace(/\([^)]*\)/g,'').trim()).filter(Boolean);
    result[type] = { menu, cal: row.CAL_INFO || '' };
  }
  return result;
}

async function getCalendar(eduCode, schoolCode, yearMonth) {
  const url = `https://open.neis.go.kr/hub/SchoolSchedule?Type=json&pIndex=1&pSize=100&ATPT_OFCDC_SC_CODE=${eduCode}&SD_SCHUL_CODE=${schoolCode}&AA_YMD=${yearMonth}`;
  const json = await fetchJson(url);
  if (!json?.SchoolSchedule) return [];
  const rows = json.SchoolSchedule[1]?.row || [];
  return rows.map(r => ({
    date: r.AA_YMD,
    name: r.EVENT_NM,
    is_holiday: r.ONE_GRADE_EVENT_YN === '1'
  }));
}

async function searchSchools(keyword) {
  const query = encodeURIComponent(keyword.trim());
  if (!query) return [];
  const url = `https://open.neis.go.kr/hub/schoolInfo?Type=json&pIndex=1&pSize=30&SCHUL_NM=${query}`;
  const json = await fetchJson(url);
  if (!json?.schoolInfo) return [];
  const rows = json.schoolInfo[1]?.row || [];
  return rows.map((row) => ({
    eduCode: row.ATPT_OFCDC_SC_CODE,
    schoolCode: row.SD_SCHUL_CODE,
    schoolName: row.SCHUL_NM,
    officeName: row.ATPT_OFCDC_SC_NM,
    schoolType: row.SCHUL_KND_SC_NM || '',
    address: row.ORG_RDNMA || row.ORG_RDNDA || '',
  }));
}

async function getWeather(region) {
  // wttr.in API (무료, 키 불필요)
  const encoded = encodeURIComponent(region);
  const url = `https://wttr.in/${encoded}?format=j1`;
  try {
    const json = await fetchJson(url);
    if (!json?.current_condition?.[0]) return { error: '날씨 정보 없음' };
    const c = json.current_condition[0];
    const code = parseInt(c.weatherCode);
    const emoji = weatherEmoji(code);
    const result = {
      temp: c.temp_C,
      feels: c.FeelsLikeC,
      humidity: c.humidity,
      desc: c.weatherDesc?.[0]?.value || '',
      emoji
    };
    // 미세먼지: wttr.in의 위경도로 Open-Meteo 대기질 API 조회 (무료, 키 불필요)
    try {
      const area = json.nearest_area?.[0];
      const lat = area?.latitude, lon = area?.longitude;
      if (lat != null && lon != null) {
        const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=pm10,pm2_5`;
        const aq = await fetchJson(aqUrl);
        if (aq?.current) {
          if (aq.current.pm10 != null) result.pm10 = Math.round(aq.current.pm10);
          if (aq.current.pm2_5 != null) result.pm25 = Math.round(aq.current.pm2_5);
        }
      }
    } catch(_) { /* 대기질 실패는 무시 (온도는 그대로 표시) */ }
    return result;
  } catch(e) {
    return { error: e.message };
  }
}

function weatherEmoji(code) {
  if (code === 113) return '☀️';
  if ([116,119].includes(code)) return '⛅';
  if ([122,143].includes(code)) return '☁️';
  if ([176,185,200,227,230,248,260,263,266,281,284,293,296,299,302,305,308,311,314,317,320,323,326,329,332,335,338,350,353,356,359,362,365,368,371,374,377,386,389,392,395].includes(code)) {
    if (code >= 227 || code === 185 || code === 284) return '🌨️';
    if (code >= 386) return '⛈️';
    return '🌧️';
  }
  return '🌤️';
}

module.exports = { getMeal, getCalendar, getWeather, searchSchools };
