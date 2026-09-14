// 빌드 시 CI(release-windows.yml)가 GitHub Actions Secret으로 이 파일을 덮어쓴다.
// 저장소에는 항상 빈 값으로 커밋된다.
module.exports = {
  GOOGLE_CALENDAR_CLIENT_SECRET: ''
};
