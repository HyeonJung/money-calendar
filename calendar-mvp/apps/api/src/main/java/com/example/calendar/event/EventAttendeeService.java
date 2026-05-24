package com.example.calendar.event;

import com.example.calendar.calendar.CalendarPermissionService;
import com.example.calendar.common.ApiException;
import com.example.calendar.user.AppUser;
import com.example.calendar.user.UserRepository;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class EventAttendeeService {
    private static final int MAX_ATTENDEES = 20;
    private static final List<String> RESPONSE_STATUSES = List.of("NEEDS_ACTION", "ACCEPTED", "DECLINED", "TENTATIVE");

    private final JdbcTemplate jdbcTemplate;
    private final CalendarPermissionService permissions;
    private final UserRepository userRepository;

    public EventAttendeeService(JdbcTemplate jdbcTemplate, CalendarPermissionService permissions, UserRepository userRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.permissions = permissions;
        this.userRepository = userRepository;
    }

    public List<Map<String, Object>> list(UUID requesterId, UUID eventId) {
        eventContext(requesterId, eventId);
        return attendees(eventId, null);
    }

    @Transactional
    public List<Map<String, Object>> add(UUID requesterId, UUID eventId, String email) {
        Map<String, Object> context = eventContext(requesterId, eventId);
        requireWritable(context, requesterId);
        String normalizedEmail = normalizeEmail(email);
        AppUser target = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(() -> ApiException.validation("가입된 캘린더 멤버 이메일만 참석자로 추가할 수 있습니다."));
        UUID calendarId = (UUID) context.get("calendarId");
        if (!isCalendarMember(calendarId, target.id())) {
            throw ApiException.validation("참석자는 이 캘린더에 공유된 사용자만 추가할 수 있습니다.");
        }
        lockEvent(eventId);
        Integer count = jdbcTemplate.queryForObject("""
                select count(*) from event_attendees where event_id = ? and deleted_at is null
                """, Integer.class, eventId);
        if (count != null && count >= MAX_ATTENDEES) {
            throw ApiException.attendeeLimit("참석자는 최대 20명까지 추가할 수 있습니다.");
        }
        Integer duplicate = jdbcTemplate.queryForObject("""
                select count(*) from event_attendees where event_id = ? and lower(email) = lower(?) and deleted_at is null
                """, Integer.class, eventId, normalizedEmail);
        if (duplicate != null && duplicate > 0) {
            throw ApiException.conflict("이미 추가된 참석자입니다.");
        }
        try {
            jdbcTemplate.update("""
                    insert into event_attendees (event_id, user_id, email, display_name, response_status, invited_by)
                    values (?, ?, ?, ?, 'NEEDS_ACTION', ?)
                    """, eventId, target.id(), target.email(), target.displayName(), requesterId);
        } catch (DuplicateKeyException exception) {
            throw ApiException.conflict("이미 추가된 참석자입니다.");
        }
        return attendees(eventId, null);
    }

    @Transactional
    public void remove(UUID requesterId, UUID eventId, UUID attendeeId) {
        Map<String, Object> context = eventContext(requesterId, eventId);
        requireWritable(context, requesterId);
        int updated = jdbcTemplate.update("""
                update event_attendees
                set deleted_at = now(), updated_at = now()
                where id = ? and event_id = ? and deleted_at is null
                """, attendeeId, eventId);
        if (updated == 0) {
            throw ApiException.attendeeNotFound("참석자를 찾을 수 없습니다.");
        }
    }

    @Transactional
    public Map<String, Object> updateMyResponse(UUID requesterId, UUID eventId, String responseStatus) {
        Map<String, Object> context = eventContext(requesterId, eventId);
        requireRsvpAllowed(context);
        String status = responseStatus == null ? "" : responseStatus.trim().toUpperCase();
        if (!RESPONSE_STATUSES.contains(status)) {
            throw ApiException.validation("응답 상태를 확인해 주세요.");
        }
        int updated = jdbcTemplate.update("""
                update event_attendees
                set response_status = ?, responded_at = now(), updated_at = now()
                where event_id = ? and user_id = ? and deleted_at is null
                """, status, eventId, requesterId);
        if (updated == 0) {
            throw ApiException.attendeeNotFound("참석자로 등록된 사용자만 RSVP 상태를 변경할 수 있습니다.");
        }
        return attendees(eventId, null).stream()
                .filter(row -> requesterId.equals(row.get("userId")))
                .findFirst()
                .orElseThrow(() -> ApiException.attendeeNotFound("참석자를 찾을 수 없습니다."));
    }

    public void attachPreview(List<Map<String, Object>> eventRows) {
        for (Map<String, Object> row : eventRows) {
            UUID eventId = (UUID) row.get("id");
            row.put("attendeeCount", attendeeCount(eventId));
            row.put("attendeePreview", attendees(eventId, 5));
        }
    }

    public void attachFull(Map<String, Object> event) {
        UUID eventId = (UUID) event.get("id");
        List<Map<String, Object>> attendees = attendees(eventId, null);
        event.put("attendeeCount", attendees.size());
        event.put("attendeePreview", attendees.stream().limit(5).toList());
        event.put("attendees", attendees);
    }

    private Map<String, Object> eventContext(UUID requesterId, UUID eventId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                select e.id, e.calendar_id as "calendarId", e.source, c.type as "calendarType",
                       c.is_readonly as "isReadonly", m.role as "requesterRole"
                from events e
                join calendars c on c.id = e.calendar_id
                join calendar_members m on m.calendar_id = c.id and m.user_id = ?
                where e.id = ? and e.deleted_at is null and c.deleted_at is null
                """, requesterId, eventId);
        if (rows.isEmpty()) {
            throw ApiException.notFound("일정을 찾을 수 없습니다.");
        }
        return rows.get(0);
    }

    private void requireWritable(Map<String, Object> context, UUID requesterId) {
        requireRsvpAllowed(context);
        permissions.canEditEvent((UUID) context.get("calendarId"), requesterId);
    }

    private void requireRsvpAllowed(Map<String, Object> context) {
        if ("SYSTEM_HOLIDAY".equals(context.get("source"))
                || "SYSTEM_HOLIDAY".equals(context.get("calendarType"))
                || Boolean.TRUE.equals(context.get("isReadonly"))) {
            throw ApiException.readonly("공휴일 또는 읽기 전용 일정에는 참석자를 변경할 수 없습니다.");
        }
    }

    private boolean isCalendarMember(UUID calendarId, UUID userId) {
        Integer count = jdbcTemplate.queryForObject("""
                select count(*) from calendar_members m
                join app_users u on u.id = m.user_id
                where m.calendar_id = ? and m.user_id = ? and u.deleted_at is null
                """, Integer.class, calendarId, userId);
        return count != null && count > 0;
    }

    private int attendeeCount(UUID eventId) {
        Integer count = jdbcTemplate.queryForObject("""
                select count(*) from event_attendees where event_id = ? and deleted_at is null
                """, Integer.class, eventId);
        return count == null ? 0 : count;
    }

    private void lockEvent(UUID eventId) {
        jdbcTemplate.queryForObject("""
                select id from events where id = ? and deleted_at is null for update
                """, UUID.class, eventId);
    }

    private List<Map<String, Object>> attendees(UUID eventId, Integer limit) {
        String limitClause = limit == null ? "" : " limit " + limit;
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                select a.id, a.event_id as "eventId", a.user_id as "userId", a.email,
                       coalesce(u.display_name, a.display_name, a.email) as "displayName",
                       a.response_status as "responseStatus", a.invited_by as "invitedBy",
                       a.invited_at as "invitedAt", a.responded_at as "respondedAt",
                       a.created_at as "createdAt", a.updated_at as "updatedAt",
                       u.profile_image_url as "profileImageUrl", u.avatar_color as "avatarColor"
                from event_attendees a
                left join app_users u on u.id = a.user_id
                where a.event_id = ? and a.deleted_at is null
                order by a.created_at, a.email
                """ + limitClause, eventId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            result.add(new LinkedHashMap<>(row));
        }
        return result;
    }

    private String normalizeEmail(String email) {
        if (email == null || email.trim().isBlank()) {
            throw ApiException.validation("참석자 이메일을 입력해 주세요.");
        }
        return email.trim().toLowerCase();
    }
}
