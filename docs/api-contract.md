# API Contract

Base URL: `/api/v1`

## 공통 응답

성공:

```json
{
  "data": {},
  "meta": {}
}
```

실패:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력값을 확인해 주세요.",
    "details": []
  }
}
```

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /me`

JWT access token은 `Authorization: Bearer <token>` 헤더로 전달합니다. Refresh token은 MVP TODO입니다.

## Calendars

- `GET /calendars?includeHidden=true`
- `POST /calendars`
- `GET /calendars/{calendarId}`
- `PATCH /calendars/{calendarId}`
- `DELETE /calendars/{calendarId}`
- `PATCH /calendars/{calendarId}/subscription`

`SYSTEM_HOLIDAY` 캘린더는 수정/삭제할 수 없습니다.

## Calendar Members

- `GET /calendars/{calendarId}/members`
- `POST /calendars/{calendarId}/members`
- `PATCH /calendars/{calendarId}/members/{userId}`
- `DELETE /calendars/{calendarId}/members/{userId}`

공유 대상은 이미 가입된 이메일만 허용합니다. `OWNER`는 공유 API로 부여할 수 없습니다.

## Events

- `GET /events?from=&to=&calendarIds=&view=MONTH`
- `POST /events`
- `GET /events/{eventId}`
- `PATCH /events/{eventId}`
- `DELETE /events/{eventId}`

일정 권한은 항상 소속 캘린더의 `calendar_members` 기준으로 판단합니다.

## Holiday Sync Admin

- `POST /admin/holiday-sync-runs`
- `GET /admin/holiday-sync-runs`
- `GET /admin/holiday-sync-runs/{runId}`

`ADMIN` 사용자만 접근할 수 있습니다. API 키, 인증 토큰, Authorization 헤더는 실패 로그에 저장하지 않습니다.
