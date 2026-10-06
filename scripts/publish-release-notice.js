#!/usr/bin/env node
// 릴리즈 시 release-notes/vX.Y.Z.md 내용을 Firestore app/notice 문서로 자동 배포한다.
// 관리자가 회원 관리 페이지에서 공지사항을 직접 작성/배포하던 수작업을 대신한다.
'use strict';

const fs = require('fs');
const path = require('path');

async function main() {
  const pkg = require('../package.json');
  const version = String(pkg.version || '').trim();
  if (!version) throw new Error('package.json version을 확인할 수 없습니다.');

  const notePath = path.join(__dirname, '..', 'release-notes', `v${version}.md`);
  if (!fs.existsSync(notePath)) {
    console.log(`[notice] release-notes/v${version}.md 가 없어 공지 배포를 건너뜁니다.`);
    return;
  }

  const body = fs.readFileSync(notePath, 'utf8').trim();
  if (!body) {
    console.log(`[notice] release-notes/v${version}.md 내용이 비어 있어 공지 배포를 건너뜁니다.`);
    return;
  }

  const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '';
  if (!rawKey.trim()) {
    console.log('[notice] FIREBASE_SERVICE_ACCOUNT_KEY 가 설정되어 있지 않아 공지 배포를 건너뜁니다.');
    return;
  }

  const admin = require('firebase-admin');
  const credentialJson = JSON.parse(rawKey);
  admin.initializeApp({ credential: admin.credential.cert(credentialJson) });

  const title = `쌤포트 v${version} 업데이트 안내`;
  const noticeId = `v${version}`;

  await admin.firestore().collection('app').doc('notice').set({
    noticeId,
    title,
    body,
    version,
    active: true,
    updatedBy: 'release-automation',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  console.log(`[notice] v${version} 공지사항을 배포했습니다.`);
}

main().catch((error) => {
  console.error('[notice] 공지 배포 중 오류:', error && error.message ? error.message : error);
  process.exitCode = 1;
});
