const fs = require('fs');

function parseDesktopClient(value, expectedClientId) {
  const client = value && value.installed;
  if (!client || !client.client_id || !String(client.client_secret || '').trim()) {
    throw new Error('Google Cloud에서 내려받은 데스크톱 앱 OAuth 클라이언트 JSON을 선택해 주세요.');
  }
  if (client.client_id !== expectedClientId) {
    throw new Error('이 파일은 쌤포트에 등록된 OAuth 클라이언트와 다릅니다. 해당 앱의 클라이언트 JSON을 선택해 주세요.');
  }
  return { clientId: client.client_id, clientSecret: String(client.client_secret).trim() };
}

function resolveGoogleOAuthConfig({ clientId, bundledSecret = '', savedClientId = '', savedClientSecret = '', env = process.env, paths = [] }) {
  // Refresh tokens belong to a client ID. Preserve the user's saved pair together;
  // never combine a saved secret with the app's built-in client ID.
  const existingId = String(savedClientId || '').trim();
  const existingSecret = String(savedClientSecret || '').trim();
  if (existingId && existingSecret) return { clientId: existingId, clientSecret: existingSecret };
  const environmentSecret = String(env.GOOGLE_CALENDAR_CLIENT_SECRET || env.GCAL_CLIENT_SECRET || '').trim();
  if (environmentSecret) return { clientId, clientSecret: environmentSecret };
  for (const file of paths) {
    if (!fs.existsSync(file)) continue;
    let value;
    try { value = JSON.parse(fs.readFileSync(file, 'utf8')); }
    catch (_) { throw new Error('로컬 Google 연결 설정 파일을 읽을 수 없습니다. OAuth JSON을 다시 가져와 주세요.'); }
    return parseDesktopClient(value, clientId);
  }
  return { clientId, clientSecret: String(bundledSecret || '').trim() };
}

module.exports = { parseDesktopClient, resolveGoogleOAuthConfig };
