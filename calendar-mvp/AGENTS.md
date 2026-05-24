# AGENTS.md

## 언어

- 사용자 응답은 한국어로 작성한다.
- 코드, 명령어, API 이름, 패키지명은 영어를 유지할 수 있다.

## 작업 원칙

- Web은 `apps/web`, API는 `apps/api`, 인프라는 `infra`, 문서는 `docs` 아래에서 작업한다.
- 핵심 비즈니스 로직은 Spring Boot API에 둔다.
- Next.js의 Server Actions에 캘린더 권한/일정 검증 로직을 넣지 않는다.
- 모바일 네이티브 앱은 이번 범위에서 제외한다.
- 공휴일 시스템 캘린더와 공휴일 일정은 사용자 API로 수정/삭제할 수 없어야 한다.

## 검증

- Web: `npm run lint`, `npm run build`
- API: `./gradlew test`, `./gradlew build`
- Infra: `docker compose -f infra/docker-compose.yml config`
