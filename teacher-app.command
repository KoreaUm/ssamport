#!/bin/zsh

export PATH="/opt/homebrew/opt/node@20/bin:/usr/local/opt/node@20/bin:$PATH"

cd "/Users/jake/Desktop/폴더/teacher-app" || {
  echo "teacher-app 폴더로 이동하지 못했습니다: /Users/jake/Desktop/폴더/teacher-app"
  echo
  read -r "REPLY?엔터 키를 누르면 종료합니다... "
  exit 1
}

echo "teacher-app 개발 앱을 실행합니다..."
echo "작업 폴더: $(pwd)"
echo

npm start
status=$?

echo
if [ "$status" -ne 0 ]; then
  echo "앱이 오류와 함께 종료되었습니다 (code: $status)."
  read -r "REPLY?엔터 키를 누르면 종료합니다... "
fi
