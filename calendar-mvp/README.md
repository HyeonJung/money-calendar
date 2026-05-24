# 캘린더 MVP

한국형 SaaS 캘린더 서비스 MVP입니다. 여러 캘린더, 캘린더별 일정 CRUD, 공유 권한, 대한민국 공휴일 시스템 캘린더, 공휴일 배치 이력/실패 로그를 포함합니다.

## 구조

```text
calendar-mvp/
  apps/web   Next.js App Router 웹앱
  apps/api   Spring Boot API
  infra      Docker Compose, nginx, postgres 문서
  docs       기획/계약/배포/이미지 참고 문서
```

## 로컬 실행

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml --env-file .env up --build
```

접속:

- Web: http://localhost
- API health: http://localhost/api/v1/openapi
- Spring health: http://localhost/actuator/health

개발용 계정:

- owner@example.com / password
- viewer@example.com / password
- editor@example.com / password
- adminuser@example.com / password
- admin@example.com / password

## 직접 실행

Web:

```bash
cd apps/web
npm install
npm run dev
```

API:

```bash
cd apps/api
./gradlew bootRun
```

API는 Java 26 기준입니다. 로컬에 Java 26이 없으면 Docker 빌드를 사용하세요.

## 주요 기능

- 이메일/비밀번호 회원가입과 로그인
- JWT access token 인증
- 사용자 기본 캘린더 자동 생성
- 대한민국 공휴일 시스템 캘린더 자동 생성/구독
- 캘린더 생성/조회/수정/삭제
- 캘린더별 표시 상태 변경
- 일정 생성/조회/수정/삭제
- 캘린더 공유와 권한 변경
- 관리자 공휴일 배치 수동 실행, 이력 조회, 실패 로그 조회
- PC 월간/주간/일간 캘린더 화면
- 모바일 월간/선택 날짜 목록/상세/생성/필터/공유 설정 화면

## 제외 범위

반복 일정, 참석자 RSVP, 푸시 알림, 외부 캘린더 연동, 드래그 앤 드롭 일정 이동, 모바일 네이티브 앱은 MVP에서 제외했습니다.
