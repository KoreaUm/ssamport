const crypto = require('crypto');
const admin = require('firebase-admin');
const functions = require('firebase-functions');

admin.initializeApp();

const db = admin.firestore();
const DEFAULT_PASSWORD = 'cndwntkdrh1234';
const SESSION_MINUTES = 15;
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

async function assertSignedIn(data, context) {
  if (context.auth && context.auth.uid) return context.auth.uid;

  const payload = data && data.data && typeof data.data === 'object' ? data.data : data;
  const idToken = String(
    (payload && payload.idToken) ||
    (payload && payload.authToken) ||
    (payload && payload.token) ||
    (data && data.idToken) ||
    ''
  ).trim();

  if (idToken) {
    try {
      const decoded = await admin.auth().verifyIdToken(idToken);
      if (decoded && decoded.uid) return decoded.uid;
    } catch (error) {
      throw new functions.https.HttpsError('unauthenticated', '로그인 인증이 만료되었습니다. 로그아웃 후 다시 로그인해 주세요.');
    }
  }

  const keys = payload && typeof payload === 'object' ? Object.keys(payload).join(',') : 'none';
  throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다. 인증 토큰이 함수에 전달되지 않았습니다. 받은 항목: ' + keys);
}

async function getUser(uid) {
  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists) {
    throw new functions.https.HttpsError('permission-denied', '사용자 정보가 없습니다.');
  }
  const user = snap.data() || {};
  if (user.active === false || user.deleted === true) {
    throw new functions.https.HttpsError('permission-denied', '사용할 수 없는 계정입니다.');
  }
  return user;
}

function isAdmin(user) {
  return String(user.role || 'user') === 'admin';
}

function canUseGrades(user) {
  return isAdmin(user) || user.gradeAccess === true;
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), salt, 210000, 32, 'sha256').toString('hex');
}

async function getSecret() {
  const ref = db.collection('appSecrets').doc('grades');
  const snap = await ref.get();
  return { ref, data: snap.exists ? snap.data() || {} : {} };
}

async function verifyPassword(password) {
  const { data } = await getSecret();
  if (!data.passwordHash || !data.passwordSalt) {
    return String(password) === DEFAULT_PASSWORD;
  }
  return hashPassword(password, data.passwordSalt) === data.passwordHash;
}

exports.verifyGradesPassword = functions.https.onCall(async (data, context) => {
  const payload = data && data.data && typeof data.data === 'object' ? data.data : data;
  const uid = await assertSignedIn(data, context);
  const user = await getUser(uid);
  if (!canUseGrades(user)) {
    throw new functions.https.HttpsError('permission-denied', '성적관리 권한이 없습니다.');
  }

  const password = String((payload && payload.password) || '').trim();
  const deviceId = String((payload && payload.deviceId) || '').trim();
  if (!password || !deviceId) {
    throw new functions.https.HttpsError('invalid-argument', '비밀번호 정보가 올바르지 않습니다.');
  }

  const ok = await verifyPassword(password);
  if (!ok) {
    throw new functions.https.HttpsError('permission-denied', '비밀번호가 맞지 않습니다.');
  }

  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + SESSION_MINUTES * 60 * 1000);
  await db.collection('gradeBooks').doc('default').collection('sessions').doc(uid).set({
    active: true,
    deviceId,
    email: String(user.email || ''),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt
  }, { merge: true });

  return { ok: true, expiresAt: expiresAt.toMillis() };
});

exports.setGradesPassword = functions.https.onCall(async (data, context) => {
  const payload = data && data.data && typeof data.data === 'object' ? data.data : data;
  const uid = await assertSignedIn(data, context);
  const user = await getUser(uid);
  if (!isAdmin(user)) {
    throw new functions.https.HttpsError('permission-denied', '관리자만 변경할 수 있습니다.');
  }

  const password = String((payload && payload.password) || '').trim();
  if (password.length < 4) {
    throw new functions.https.HttpsError('invalid-argument', '비밀번호는 4자 이상이어야 합니다.');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);
  const { ref } = await getSecret();
  await ref.set({
    passwordHash,
    passwordSalt: salt,
    updatedBy: String(user.email || uid),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  return { ok: true };
});

function readBearerToken(req, body) {
  const authHeader = String(req.get('authorization') || req.get('Authorization') || '');
  if (authHeader.toLowerCase().startsWith('bearer ')) return authHeader.slice(7).trim();
  return String((body && body.idToken) || '').trim();
}

async function uidFromRequest(req, body) {
  const idToken = readBearerToken(req, body);
  if (!idToken) {
    throw new functions.https.HttpsError('unauthenticated', '로그인 토큰이 전달되지 않았습니다.');
  }
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    if (decoded && decoded.uid) return decoded.uid;
  } catch (error) {
    throw new functions.https.HttpsError('unauthenticated', '로그인 인증이 만료되었습니다. 다시 로그인해 주세요.');
  }
  throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
}

function sendJson(res, status, payload) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => res.set(key, value));
  res.status(status).json(payload);
}

function sendError(res, error) {
  const code = error && error.code ? String(error.code) : 'internal';
  const status = code.includes('unauthenticated') ? 401 :
    code.includes('permission-denied') ? 403 :
    code.includes('invalid-argument') ? 400 : 500;
  sendJson(res, status, {
    ok: false,
    code,
    message: error && error.message ? error.message : '요청 처리에 실패했습니다.'
  });
}

exports.verifyGradesPasswordHttp = functions.https.onRequest(async (req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, message: 'POST만 지원합니다.' });
  try {
    const body = req.body || {};
    const uid = await uidFromRequest(req, body);
    const user = await getUser(uid);
    if (!canUseGrades(user)) {
      throw new functions.https.HttpsError('permission-denied', '성적관리 권한이 없습니다.');
    }

    const password = String(body.password || '').trim();
    const deviceId = String(body.deviceId || '').trim();
    if (!password || !deviceId) {
      throw new functions.https.HttpsError('invalid-argument', '비밀번호 정보가 올바르지 않습니다.');
    }

    const ok = await verifyPassword(password);
    if (!ok) {
      throw new functions.https.HttpsError('permission-denied', '비밀번호가 맞지 않습니다.');
    }

    const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + SESSION_MINUTES * 60 * 1000);
    await db.collection('gradeBooks').doc('default').collection('sessions').doc(uid).set({
      active: true,
      deviceId,
      email: String(user.email || ''),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt
    }, { merge: true });

    return sendJson(res, 200, { ok: true, expiresAt: expiresAt.toMillis() });
  } catch (error) {
    return sendError(res, error);
  }
});

exports.adminResetPasswordHttp = functions.https.onRequest(async (req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, message: 'POST만 지원합니다.' });
  try {
    const body = req.body || {};
    const uid = await uidFromRequest(req, body);
    const user = await getUser(uid);
    if (!isAdmin(user)) {
      throw new functions.https.HttpsError('permission-denied', '관리자만 사용할 수 있습니다.');
    }

    const targetUid = String(body.targetUid || '').trim();
    if (!targetUid) {
      throw new functions.https.HttpsError('invalid-argument', '대상 사용자 정보가 없습니다.');
    }
    if (targetUid === uid) {
      throw new functions.https.HttpsError('invalid-argument', '본인 비밀번호는 초기화할 수 없습니다.');
    }

    await admin.auth().updateUser(targetUid, { password: '000000' });
    await db.collection('users').doc(targetUid).set({ active: true }, { merge: true });
    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendError(res, error);
  }
});

exports.setGradesPasswordHttp = functions.https.onRequest(async (req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, message: 'POST만 지원합니다.' });
  try {
    const body = req.body || {};
    const uid = await uidFromRequest(req, body);
    const user = await getUser(uid);
    if (!isAdmin(user)) {
      throw new functions.https.HttpsError('permission-denied', '관리자만 변경할 수 있습니다.');
    }

    const password = String(body.password || '').trim();
    if (password.length < 4) {
      throw new functions.https.HttpsError('invalid-argument', '비밀번호는 4자 이상이어야 합니다.');
    }

    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword(password, salt);
    const { ref } = await getSecret();
    await ref.set({
      passwordHash,
      passwordSalt: salt,
      updatedBy: String(user.email || uid),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendError(res, error);
  }
});
