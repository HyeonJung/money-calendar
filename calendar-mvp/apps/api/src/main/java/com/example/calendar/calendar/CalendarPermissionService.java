package com.example.calendar.calendar;

import com.example.calendar.common.ApiException;
import com.example.calendar.security.PrincipalUser;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CalendarPermissionService {
    private final JdbcTemplate jdbcTemplate;

    public CalendarPermissionService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public String role(UUID calendarId, UUID userId) {
        return jdbcTemplate.queryForList("""
                select role from calendar_members
                where calendar_id = ? and user_id = ?
                """, String.class, calendarId, userId).stream().findFirst()
                .orElseThrow(() -> ApiException.notFound("캘린더를 찾을 수 없습니다."));
    }

    public void requireCalendarRole(UUID calendarId, UUID userId, String... allowedRoles) {
        String role = role(calendarId, userId);
        if (!Arrays.asList(allowedRoles).contains(role)) {
            throw ApiException.forbidden("이 작업을 수행할 권한이 없습니다.");
        }
    }

    public boolean canViewCalendar(UUID calendarId, UUID userId) {
        Integer count = jdbcTemplate.queryForObject("""
                select count(*) from calendar_members m
                join calendars c on c.id = m.calendar_id
                where m.calendar_id = ? and m.user_id = ? and c.deleted_at is null
                """, Integer.class, calendarId, userId);
        return count != null && count > 0;
    }

    public void canEditEvent(UUID calendarId, UUID userId) {
        requireCalendarRole(calendarId, userId, "OWNER", "ADMIN", "EDITOR");
    }

    public void assertCalendarNotReadonly(UUID calendarId) {
        Boolean readonly = jdbcTemplate.queryForObject("""
                select is_readonly from calendars where id = ? and deleted_at is null
                """, Boolean.class, calendarId);
        if (Boolean.TRUE.equals(readonly)) {
            throw ApiException.readonly("읽기 전용 캘린더는 변경할 수 없습니다.");
        }
    }

    public void assertNotSystemCalendarForUserMutation(UUID calendarId) {
        String type = jdbcTemplate.queryForObject("""
                select type from calendars where id = ? and deleted_at is null
                """, String.class, calendarId);
        if ("SYSTEM_HOLIDAY".equals(type)) {
            throw ApiException.readonly("시스템 공휴일 캘린더는 사용자 API로 변경할 수 없습니다.");
        }
    }

    public void assertOwnerNotModified(UUID calendarId, UUID targetUserId) {
        String role = jdbcTemplate.queryForList("""
                select role from calendar_members where calendar_id = ? and user_id = ?
                """, String.class, calendarId, targetUserId).stream().findFirst()
                .orElseThrow(() -> ApiException.notFound("공유 사용자를 찾을 수 없습니다."));
        if ("OWNER".equals(role)) {
            throw ApiException.conflict("소유자는 제거하거나 권한을 변경할 수 없습니다.");
        }
    }

    public void requireAdmin(PrincipalUser user) {
        if (user == null || !user.isAdmin()) {
            throw ApiException.forbidden("관리자만 접근할 수 있습니다.");
        }
    }

    public Map<String, Object> calendarSummary(UUID calendarId) {
        List<Map<String, Object>> rows = jdbcTemplate.queryForList("""
                select id, name, color, type, is_readonly from calendars where id = ? and deleted_at is null
                """, calendarId);
        if (rows.isEmpty()) {
            throw ApiException.notFound("캘린더를 찾을 수 없습니다.");
        }
        return rows.get(0);
    }
}
