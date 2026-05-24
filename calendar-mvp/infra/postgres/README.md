# PostgreSQL

MVP는 PostgreSQL을 기본 데이터베이스로 사용합니다.

로컬 Docker Compose에서는 `postgres:18-alpine` 컨테이너를 사용합니다. 운영 환경에서는 `OCI Database with PostgreSQL` 같은 관리형 서비스를 우선 검토합니다.

## 백업 TODO

- 일 1회 이상 logical dump
- 배포 전 schema migration 백업
- 장애 복구 리허설
- 공휴일 배치 실행 전후 데이터 검증
