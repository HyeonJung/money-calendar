package com.example.calendar.event;

import com.example.calendar.calendar.CalendarPermissionService;
import com.example.calendar.common.ApiException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class EventService {
    private final JdbcTemplate jdbcTemplate;
    private final CalendarPermissionService permissions;
    private final EventAttendeeService attendeeService;

    public EventService(JdbcTemplate jdbcTemplate, CalendarPermissionService permissions, EventAttendeeService attendeeService) {
        this.jdbcTemplate = jdbcTemplate;
        this.permissions = permissions;
        this.attendeeService = attendeeService;
    }

    public List<Map<String, Object>> list(UUID userId, OffsetDateTime from, OffsetDateTime to, String calendarIds, String view) {
        validateRange(from, to);
        List<UUID> ids = parseIds(calendarIds);
        List<Map<String, Object>> rows;
        if (ids.isEmpty()) {
            rows = jdbcTemplate.queryForList("""
                    select e.id, e.calendar_id as "calendarId", e.title, e.description, e.location,
                           e.starts_at as "startsAt", e.ends_at as "endsAt", e.timezone, e.is_all_day as "isAllDay",
                           e.source, e.status, c.name as "calendarName", c.color as "calendarColor",
                           c.is_readonly as "isReadonly", m.role
                    from events e
                    join calendars c on c.id = e.calendar_id
                    join calendar_members m on m.calendar_id = c.id and m.user_id = ?
                    where e.deleted_at is null and c.deleted_at is null
                      and e.ends_at > ? and e.starts_at < ?
                    order by e.starts_at, e.is_all_day desc
                    """, userId, Timestamp.from(from.toInstant()), Timestamp.from(to.toInstant()));
            return withAttendeePreview(rows);
        }
        String placeholders = ids.stream().map(id -> "?").collect(Collectors.joining(","));
        Object[] params = new Object[3 + ids.size()];
        params[0] = userId;
        params[1] = Timestamp.from(from.toInstant());
        params[2] = Timestamp.from(to.toInstant());
        for (int i = 0; i < ids.size(); i++) {
            params[i + 3] = ids.get(i);
        }
        rows = jdbcTemplate.queryForList("""
                select e.id, e.calendar_id as "calendarId", e.title, e.description, e.location,
                       e.starts_at as "startsAt", e.ends_at as "endsAt", e.timezone, e.is_all_day as "isAllDay",
                       e.source, e.status, c.name as "calendarName", c.color as "calendarColor",
                       c.is_readonly as "isReadonly", m.role
                from events e
                join calendars c on c.id = e.calendar_id
                join calendar_members m on m.calendar_id = c.id and m.user_id = ?
                where e.deleted_at is null and c.deleted_at is null
                  and e.ends_at > ? and e.starts_at < ?
                  and e.calendar_id in (%s)
                order by e.starts_at, e.is_all_day desc
                """.formatted(placeholders), params);
        return withAttendeePreview(rows);
    }

    @Transactional
    public Map<String, Object> create(UUID userId, EventController.EventRequest request) {
        permissions.assertCalendarNotReadonly(request.calendarId());
        permissions.canEditEvent(request.calendarId(), userId);
        NormalizedTime normalized = normalize(request);
        UUID id = jdbcTemplate.queryForObject("""
                insert into events (calendar_id, created_by, updated_by, source, title, description, location,
                                    starts_at, ends_at, timezone, is_all_day, status)
                values (?, ?, ?, 'USER', ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED')
                returning id
                """, UUID.class,
                request.calendarId(), userId, userId, request.title().trim(), request.description(), request.location(),
                Timestamp.from(normalized.startsAt().toInstant()), Timestamp.from(normalized.endsAt().toInstant()),
                normalized.timezone(), request.isAllDay());
        return detail(userId, id);
    }

    public Map<String, Object> detail(UUID userId, UUID eventId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                select e.id, e.calendar_id as "calendarId", e.created_by as "createdBy", e.updated_by as "updatedBy",
                       e.source, e.source_key as "sourceKey", e.title, e.description, e.location,
                       e.starts_at as "startsAt", e.ends_at as "endsAt", e.timezone, e.is_all_day as "isAllDay",
                       e.status, c.name as "calendarName", c.color as "calendarColor", c.is_readonly as "isReadonly",
                       m.role, u.display_name as "creatorName"
                from events e
                join calendars c on c.id = e.calendar_id
                join calendar_members m on m.calendar_id = c.id and m.user_id = ?
                left join app_users u on u.id = e.created_by
                where e.id = ? and e.deleted_at is null and c.deleted_at is null
                """, userId, eventId);
        if (rows.isEmpty()) {
            throw ApiException.notFound("일정을 찾을 수 없습니다.");
        }
        Map<String, Object> event = new LinkedHashMap<>(rows.get(0));
        attendeeService.attachFull(event);
        return event;
    }

    @Transactional
    public Map<String, Object> update(UUID userId, UUID eventId, EventController.EventRequest request) {
        Map<String, Object> existing = detail(userId, eventId);
        if ("SYSTEM_HOLIDAY".equals(existing.get("source")) || Boolean.TRUE.equals(existing.get("isReadonly"))) {
            throw ApiException.readonly("공휴일 일정은 수정할 수 없습니다.");
        }
        UUID calendarId = (UUID) existing.get("calendarId");
        if (!calendarId.equals(request.calendarId())) {
            throw ApiException.validation("MVP에서는 일정의 캘린더 이동을 지원하지 않습니다.");
        }
        permissions.canEditEvent(calendarId, userId);
        NormalizedTime normalized = normalize(request);
        jdbcTemplate.update("""
                update events
                set title = ?, description = ?, location = ?, starts_at = ?, ends_at = ?, timezone = ?,
                    is_all_day = ?, updated_by = ?, updated_at = now()
                where id = ? and deleted_at is null
                """, request.title().trim(), request.description(), request.location(),
                Timestamp.from(normalized.startsAt().toInstant()), Timestamp.from(normalized.endsAt().toInstant()),
                normalized.timezone(), request.isAllDay(), userId, eventId);
        return detail(userId, eventId);
    }

    @Transactional
    public void delete(UUID userId, UUID eventId) {
        Map<String, Object> existing = detail(userId, eventId);
        if ("SYSTEM_HOLIDAY".equals(existing.get("source")) || Boolean.TRUE.equals(existing.get("isReadonly"))) {
            throw ApiException.readonly("공휴일 일정은 삭제할 수 없습니다.");
        }
        permissions.canEditEvent((UUID) existing.get("calendarId"), userId);
        jdbcTemplate.update("update events set deleted_at = now(), updated_at = now(), updated_by = ? where id = ?", userId, eventId);
    }

    private NormalizedTime normalize(EventController.EventRequest request) {
        String timezone = request.timezone() == null || request.timezone().isBlank() ? "Asia/Seoul" : request.timezone();
        OffsetDateTime start = request.startsAt();
        OffsetDateTime end = request.endsAt();
        if (request.isAllDay()) {
            ZoneId zone = ZoneId.of(timezone);
            LocalDate startDate = start.atZoneSameInstant(zone).toLocalDate();
            LocalDate endDate = end.atZoneSameInstant(zone).toLocalDate();
            start = startDate.atStartOfDay(zone).toOffsetDateTime();
            end = endDate.plusDays(1).atStartOfDay(zone).toOffsetDateTime();
        }
        validateRange(start, end);
        return new NormalizedTime(start, end, timezone);
    }

    private void validateRange(OffsetDateTime from, OffsetDateTime to) {
        if (from == null || to == null || !to.isAfter(from)) {
            throw ApiException.validation("종료 시간은 시작 시간보다 이후여야 합니다.");
        }
        if (to.isAfter(from.plusDays(400))) {
            throw ApiException.validation("조회 또는 일정 기간은 400일 이하로 제한됩니다.");
        }
    }

    private List<UUID> parseIds(String calendarIds) {
        if (calendarIds == null || calendarIds.isBlank()) {
            return List.of();
        }
        return Arrays.stream(calendarIds.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(UUID::fromString)
                .collect(Collectors.toList());
    }

    private List<Map<String, Object>> withAttendeePreview(List<Map<String, Object>> rows) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            result.add(new LinkedHashMap<>(row));
        }
        attendeeService.attachPreview(result);
        return result;
    }

    private record NormalizedTime(OffsetDateTime startsAt, OffsetDateTime endsAt, String timezone) {
    }
}
