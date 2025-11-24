#!/usr/bin/env bash
set -euo pipefail

# 로그 파일 초기화
> verify.log

# 실패 시 메시지 출력
trap 'echo -e "\e[1;31m[verify]: 실패\e[0m"' ERR

echo -e "\e[1;33m[verify]: 코드 포맷팅 실행\e[0m"
npm run format >> verify.log 2>&1
echo -e "\e[1;32m[verify]: 코드 포맷팅 성공\e[0m"

echo -e "\e[1;33m[verify]: 린트 실행\e[0m"
npm run lint -- --fix >> verify.log 2>&1
echo -e "\e[1;32m[verify]: 린트 성공\e[0m"

echo -e "\e[1;33m[verify]: 빌드 실행\e[0m"
npm run build >> verify.log 2>&1
echo -e "\e[1;32m[verify]: 빌드 성공\e[0m"

echo -e "\e[1;33m[verify]: 테스트 실행\e[0m"
npm run test >> verify.log 2>&1
echo -e "\e[1;32m[verify]: 테스트 성공\e[0m"