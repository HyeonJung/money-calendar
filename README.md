# 머니캘린더

Vercel 배포와 Supabase 연동을 전제로 만든 돈 되는 일정 캘린더입니다. 현재는 한국 공모주 일정과 공개 소스 기반 최신 핫딜을 제공합니다.

## 주요 화면

- `/`: 진행 중, 임박, 최근 상장 공모주 요약
- `/ipos`: 공모주 검색, 필터, 정렬, 관심 공모주
- `/calendar`: 청약 시작/종료, 환불일, 상장일 월간 캘린더
- `/hotdeals`: 공개 소스에서 수집한 최신 핫딜 목록
- `/ipos/[slug]`: 공모가, 주관사, 수요예측 지표, 투자 포인트, 리스크 상세
- `/admin/sync`: Google 로그인과 DB 권한 테이블로 보호되는 운영자용 동기화 상태 페이지

## 실행

```bash
pnpm install
pnpm dev
```

로컬 주소는 [http://localhost:3000](http://localhost:3000)입니다.

## Supabase 설정

환경변수가 없으면 `lib/ipos.ts`의 샘플 데이터로 동작합니다. 실제 Supabase를 연결하려면 `.env.example`을 참고해 `.env.local`을 만들고 값을 채워 주세요.

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENDART_API_KEY=
CRON_SECRET=
```

테이블 생성과 샘플 insert 예시는 `supabase/schema.sql`에 있습니다.

`SUPABASE_SERVICE_ROLE_KEY`는 공모주 일정 동기화나 DART 근거 문서/분석 저장처럼 서버에서 쓰기 작업을 수행할 때만 사용해야 합니다. 이 키는 관리자 권한이 있으므로 브라우저 번들, `NEXT_PUBLIC_*`, 클라이언트 로그에 노출하면 안 됩니다.

`OPENDART_API_KEY`는 Open DART API 호출에 사용하는 서버 전용 키입니다. 공시 원문 메타데이터 수집과 회사정보/투자포인트 생성의 근거 확보 용도로만 사용하고, 클라이언트에 노출하지 않아야 합니다.

운영자 페이지는 Supabase Auth의 Google provider를 사용합니다. Supabase Dashboard에서 Google OAuth를 활성화하고, redirect URL에 로컬과 배포 도메인의 `/auth/callback`을 추가해 주세요.

## 데이터 구조

기존 `ipos` 테이블은 화면 렌더링 중심의 공모주 일정 데이터 저장소입니다. 특히 `ipos.description`, `ipos.highlights`, `ipos.risks`는 상세/카드 UI에서 바로 쓰는 요약 필드로 계속 유지합니다.

회사의 근거 문서와 분석 요약은 아래 보조 테이블로 분리합니다.

- `ipo_documents`: DART 등 외부 원문 근거 추적용 문서 메타데이터. `ipo_slug`, `source`, `rcept_no`, `title`, `url`, `fetched_at`를 저장합니다.
- `hot_deals`: 공개 핫딜 소스에서 수집한 최신 할인 정보. `external_id`, `title`, `deal_url`, `image_url`, `published_at`, `collected_at`, `like_count`, `comment_count`를 저장합니다.
- `ipo_analysis`: 회사 개요/비즈니스 모델/투자 포인트/리스크 포인트/근거 메모를 저장하는 요약 테이블. `investment_points`, `risk_points`, `source_notes`는 `text[]` 배열입니다.
- `admin_users`: 운영자 Google 이메일과 권한(`admin`, `viewer`)을 저장합니다.
- `sync_runs`: cron/수동 동기화 실행 이력, 경고, 오류, 수집 건수 요약을 저장합니다.

이 구조를 쓰면 앱은 기존 `ipos` 요약 필드를 그대로 사용하면서도, 서버 배치나 관리자 작업에서 DART 기반 근거와 분석 결과를 별도로 축적할 수 있습니다.

### RLS 정책

`ipos`, `ipo_documents`, `ipo_analysis`는 모두 공개 읽기(`anon`, `authenticated`)를 허용합니다. `hot_deals`는 `status = 'active'`인 항목만 공개 읽기를 허용합니다.

`admin_users`, `sync_runs`는 공개 읽기 정책을 열지 않습니다. 운영자 페이지와 cron/API 경로는 서버 환경의 `SUPABASE_SERVICE_ROLE_KEY`로만 조회/쓰기합니다.

초기 운영자 계정은 Supabase SQL Editor에서 직접 추가합니다.

```sql
insert into public.admin_users (email, role)
values ('your-google-email@example.com', 'admin')
on conflict (email) do update
set role = excluded.role, is_active = true, updated_at = now();
```

쓰기 정책은 별도로 열지 않습니다. Supabase에서는 `service role`이 RLS를 우회하므로, insert/update/delete는 서버 환경의 `SUPABASE_SERVICE_ROLE_KEY`를 사용하는 배치/cron/API 경로만 전제로 합니다.

## Vercel Cron 업데이트

`GET /api/cron/sync-ipos`는 Vercel Cron이 매일 자동 호출하는 동기화 엔드포인트입니다. `vercel.json`에는 UTC 기준 `30 23 * * *`가 설정되어 있으며, 한국 시간으로는 매일 오전 8시 30분(KST)입니다. 장 시작 전에 당일 공모주 일정을 반영하려는 목적의 스케줄입니다.

`GET /api/cron/sync-hotdeals`는 30분마다 공개 핫딜 데이터를 수집하는 엔드포인트입니다. 현재 MVP는 FM코리아 핫딜 게시판, 아카라이브 핫딜 채널 API, 어미새 쇼핑정보 위젯을 읽어 `hot_deals` 테이블에 `external_id` 기준으로 upsert합니다.

동기화 로직은 38커뮤니케이션 공개 공모주 청약일정 HTML을 수집하고, 상세 페이지에서 시장구분, 업종, 환불일, 상장일, 대표주관사 등을 보강한 뒤 `ipos` 테이블에 `slug` 기준으로 upsert합니다. 외부 페이지 구조 변경이나 네트워크 실패가 있으면 앱 화면을 깨지 않고 JSON 실패 응답으로 떨어집니다.

`CRON_SECRET`이 설정되어 있으면 다음 두 방식 중 하나로 인증해야 합니다.

- `Authorization: Bearer <secret>`
- `?secret=<secret>`

Vercel production 환경 변수에 `CRON_SECRET`을 넣어 두면 cron 호출은 bearer token 방식으로 보호할 수 있습니다.

### 수동 실행 예시

로컬 또는 수동 점검 시에는 `curl`로 동일한 route를 호출할 수 있습니다.

```bash
curl -X GET "http://localhost:3000/api/cron/sync-ipos?secret=$CRON_SECRET"
```

```bash
curl -X GET "http://localhost:3000/api/cron/sync-hotdeals?secret=$CRON_SECRET"
```

쓰기 없이 수집 결과만 확인하려면 `dryRun=1`을 붙입니다.

```bash
curl -X GET "http://localhost:3000/api/cron/sync-ipos?dryRun=1&secret=$CRON_SECRET"
```

```bash
curl -X GET "http://localhost:3000/api/cron/sync-hotdeals?dryRun=1&secret=$CRON_SECRET"
```

```bash
curl -X GET "https://your-production-domain.vercel.app/api/cron/sync-ipos" \
  -H "Authorization: Bearer $CRON_SECRET"
```

성공 시에는 `{"ok":true,"triggeredAt":"...","result":...}` 형태의 JSON을 반환합니다. 인증 실패 시에는 `401`, 수집 실패 시에는 `502`, 예외 발생 시에는 `500`과 함께 `{"ok":false,"triggeredAt":"...","error":{"code":"...","message":"..."}}` 형태로 응답합니다.

## 검증

```bash
pnpm lint
pnpm build
```
