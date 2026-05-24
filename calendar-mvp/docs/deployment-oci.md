# OCI 배포 가이드

## 1차 구성

- OCI Compute VM 1대
- Docker Engine + Docker Compose
- nginx reverse proxy
- web 컨테이너: Next.js
- api 컨테이너: Spring Boot
- database: PostgreSQL

## 배포 절차

```bash
cp .env.example .env
docker compose -f infra/docker-compose.yml --env-file .env up --build -d
```

## nginx 라우팅

- `/` -> `web:3000`
- `/api/v1/*` -> `api:8080`
- `/actuator/*` -> `api:8080`

## HTTPS TODO

- 도메인 연결
- Let's Encrypt 또는 OCI Load Balancer 인증서 적용
- 80 -> 443 redirect
- HSTS 설정 검토

## DB 백업 TODO

- 운영 DB는 가능하면 OCI 관리형 PostgreSQL 사용
- VM 내부 PostgreSQL 사용 시 volume 백업과 logical dump를 모두 준비
- 배포 전 `pg_dump` 실행
- 복구 리허설 기록

## 운영 전 체크리스트

- JWT_SECRET 교체
- POSTGRES_PASSWORD 교체
- HOLIDAY_API_KEY 설정
- HOLIDAY_PROVIDER_MODE를 운영 정책에 맞게 설정
- CORS_ALLOWED_ORIGINS를 실제 도메인으로 제한
- API healthcheck 확인
- 배치 실패 로그 확인
- nginx access/error log 보관
