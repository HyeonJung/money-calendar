package com.example.calendar.holiday;

import com.example.calendar.calendar.CalendarBootstrapService;
import com.example.calendar.calendar.CalendarPermissionService;
import com.example.calendar.common.ApiException;
import com.example.calendar.security.PrincipalUser;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Date;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class HolidaySyncService {
    private final JdbcTemplate jdbcTemplate;
    private final HolidayProvider holidayProvider;
    private final CalendarBootstrapService calendarBootstrapService;
    private final CalendarPermissionService permissions;
    private final String providerMode;
    private final String apiKey;

    public HolidaySyncService(JdbcTemplate jdbcTemplate, HolidayProvider holidayProvider,
                              CalendarBootstrapService calendarBootstrapService,
                              CalendarPermissionService permissions,
                              @Value("${app.holiday.provider-mode}") String providerMode,
                              @Value("${app.holiday.api-key}") String apiKey) {
        this.jdbcTemplate = jdbcTemplate;
        this.holidayProvider = holidayProvider;
        this.calendarBootstrapService = calendarBootstrapService;
        this.permissions = permissions;
        this.providerMode = providerMode;
        this.apiKey = apiKey;
    }

    @Scheduled(cron = "0 0 3 * * *", zone = "Asia/Seoul")
    public void scheduledSync() {
        int year = LocalDate.now(ZoneId.of("Asia/Seoul")).getYear();
        runSync("KR", year, "SCHEDULED");
        runSync("KR", year + 1, "SCHEDULED");
    }

    public Map<String, Object> runManual(PrincipalUser user, String countryCode, int year) {
        permissions.requireAdmin(user);
        return runSync(countryCode == null ? "KR" : countryCode, year, "MANUAL");
    }

    @Transactional
    public Map<String, Object> runSync(String countryCode, int year, String triggerType) {
        if (!"KR".equals(countryCode)) {
            throw ApiException.validation("MVP는 KR 공휴일만 지원합니다.");
        }
        UUID runId = jdbcTemplate.queryForObject("""
                insert into holiday_sync_runs (target_country_code, target_year, status, trigger_type)
                values (?, ?, 'RUNNING', ?)
                returning id
                """, UUID.class, countryCode, year, triggerType);
        int created = 0;
        int updated = 0;
        int failed = 0;
        try {
            if ("real".equalsIgnoreCase(providerMode) && (apiKey == null || apiKey.isBlank())) {
                String message = "production profile에서 공휴일 API 설정 필요";
                addFailure(runId, "FETCH", "HOLIDAY_API_KEY_REQUIRED", message, null, null, null, false);
                finish(runId, "FAILED", 0, 0, 0, 0, 1, message);
                return detailInternal(runId);
            }
            List<HolidayProvider.HolidayRecord> records = holidayProvider.fetch(countryCode, year);
            UUID holidayCalendarId = calendarBootstrapService.ensureHolidayCalendar();
            for (HolidayProvider.HolidayRecord record : records) {
                try {
                    int sourceCount = upsertHolidaySource(countryCode, record);
                    int eventCount = upsertHolidayEvent(holidayCalendarId, record);
                    if (sourceCount == 1 && eventCount == 1) {
                        updated++;
                    } else {
                        created++;
                    }
                } catch (Exception itemError) {
                    failed++;
                    addFailure(runId, "UPSERT_EVENT", "UPSERT_FAILED", itemError.getMessage(), null, null, record.rawPayload(), true);
                }
            }
            String status = failed == 0 ? "SUCCESS" : "PARTIAL_SUCCESS";
            finish(runId, status, records.size(), created, updated, 0, failed, failed == 0 ? null : "일부 공휴일 저장에 실패했습니다.");
            return detailInternal(runId);
        } catch (Exception error) {
            addFailure(runId, "UNKNOWN", "HOLIDAY_SYNC_FAILED", error.getMessage(), null, null, null, true);
            finish(runId, "FAILED", 0, created, updated, 0, Math.max(1, failed), error.getMessage());
            return detailInternal(runId);
        }
    }

    public List<Map<String, Object>> list(PrincipalUser user, String countryCode, int year, String status) {
        permissions.requireAdmin(user);
        if (status == null || status.isBlank() || "ALL".equals(status)) {
            return jdbcTemplate.queryForList("""
                    select id, target_country_code as "targetCountryCode", target_year as "targetYear", status,
                           trigger_type as "triggerType", started_at as "startedAt", finished_at as "finishedAt",
                           requested_count as "requestedCount", created_count as "createdCount",
                           updated_count as "updatedCount", skipped_count as "skippedCount", failed_count as "failedCount",
                           error_summary as "errorSummary", created_at as "createdAt"
                    from holiday_sync_runs
                    where target_country_code = ? and target_year = ?
                    order by started_at desc
                    limit 50
                    """, countryCode, year);
        }
        return jdbcTemplate.queryForList("""
                select id, target_country_code as "targetCountryCode", target_year as "targetYear", status,
                       trigger_type as "triggerType", started_at as "startedAt", finished_at as "finishedAt",
                       requested_count as "requestedCount", created_count as "createdCount",
                       updated_count as "updatedCount", skipped_count as "skippedCount", failed_count as "failedCount",
                       error_summary as "errorSummary", created_at as "createdAt"
                from holiday_sync_runs
                where target_country_code = ? and target_year = ? and status = ?
                order by started_at desc
                limit 50
                """, countryCode, year, status);
    }

    public Map<String, Object> detail(PrincipalUser user, UUID runId) {
        permissions.requireAdmin(user);
        return detailInternal(runId);
    }

    private Map<String, Object> detailInternal(UUID runId) {
        Map<String, Object> run = jdbcTemplate.queryForMap("""
                select id, target_country_code as "targetCountryCode", target_year as "targetYear", status,
                       trigger_type as "triggerType", started_at as "startedAt", finished_at as "finishedAt",
                       requested_count as "requestedCount", created_count as "createdCount",
                       updated_count as "updatedCount", skipped_count as "skippedCount", failed_count as "failedCount",
                       error_summary as "errorSummary", created_at as "createdAt"
                from holiday_sync_runs
                where id = ?
                """, runId);
        List<Map<String, Object>> failures = jdbcTemplate.queryForList("""
                select id, stage, error_code as "errorCode", error_message as "errorMessage",
                       external_status as "externalStatus", external_response_summary as "externalResponseSummary",
                       is_retryable as "isRetryable", created_at as "createdAt"
                from holiday_sync_failures
                where run_id = ?
                order by created_at
                """, runId);
        run.put("failures", failures);
        return run;
    }

    private int upsertHolidaySource(String countryCode, HolidayProvider.HolidayRecord record) {
        return jdbcTemplate.update("""
                insert into holiday_sources (country_code, holiday_date, name, local_name, is_public_holiday,
                                             source_provider, source_key, raw_payload, last_synced_at)
                values (?, ?, ?, ?, true, ?, ?, ?::jsonb, now())
                on conflict (country_code, holiday_date, source_key)
                do update set name = excluded.name, local_name = excluded.local_name,
                              raw_payload = excluded.raw_payload, last_synced_at = now(), updated_at = now()
                """, countryCode, Date.valueOf(record.date()), record.name(), record.name(),
                holidayProvider.providerName(), record.sourceKey(), sanitizeRaw(record.rawPayload()));
    }

    private int upsertHolidayEvent(UUID holidayCalendarId, HolidayProvider.HolidayRecord record) {
        ZoneId zone = ZoneId.of("Asia/Seoul");
        OffsetDateTime start = record.date().atStartOfDay(zone).toOffsetDateTime();
        OffsetDateTime end = record.date().plusDays(1).atStartOfDay(zone).toOffsetDateTime();
        return jdbcTemplate.update("""
                insert into events (calendar_id, source, source_key, title, starts_at, ends_at, timezone, is_all_day, status)
                values (?, 'SYSTEM_HOLIDAY', ?, ?, ?, ?, 'Asia/Seoul', true, 'CONFIRMED')
                on conflict (calendar_id, source, source_key)
                where source_key is not null and deleted_at is null
                do update set title = excluded.title, starts_at = excluded.starts_at,
                              ends_at = excluded.ends_at, updated_at = now()
                """, holidayCalendarId, record.sourceKey(), record.name(),
                Timestamp.from(start.toInstant()), Timestamp.from(end.toInstant()));
    }

    private void finish(UUID runId, String status, int requested, int created, int updated, int skipped, int failed, String errorSummary) {
        jdbcTemplate.update("""
                update holiday_sync_runs
                set status = ?, finished_at = now(), requested_count = ?, created_count = ?, updated_count = ?,
                    skipped_count = ?, failed_count = ?, error_summary = ?
                where id = ?
                """, status, requested, created, updated, skipped, failed, errorSummary, runId);
    }

    private void addFailure(UUID runId, String stage, String code, String message, Integer externalStatus,
                            String responseSummary, String rawPayload, boolean retryable) {
        jdbcTemplate.update("""
                insert into holiday_sync_failures
                (run_id, stage, error_code, error_message, external_status, external_response_summary, raw_payload, is_retryable)
                values (?, ?, ?, ?, ?, ?, ?::jsonb, ?)
                """, runId, stage, code, message, externalStatus, responseSummary, sanitizeRaw(rawPayload), retryable);
    }

    private String sanitizeRaw(String rawPayload) {
        if (rawPayload == null || rawPayload.isBlank()) {
            return "{}";
        }
        return rawPayload
                .replaceAll("(?i)authorization", "[redacted]")
                .replaceAll("(?i)api[_-]?key", "[redacted]")
                .replaceAll("(?i)token", "[redacted]");
    }
}
