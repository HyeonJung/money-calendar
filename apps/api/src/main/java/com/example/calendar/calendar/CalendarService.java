package com.example.calendar.calendar;

import com.example.calendar.common.ApiException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CalendarService {
    private final JdbcTemplate jdbcTemplate;
    private final CalendarPermissionService permissions;

    public CalendarService(JdbcTemplate jdbcTemplate, CalendarPermissionService permissions) {
        this.jdbcTemplate = jdbcTemplate;
        this.permissions = permissions;
    }

    public List<Map<String, Object>> list(UUID userId, boolean includeHidden) {
        String hiddenClause = includeHidden ? "" : "and m.subscription_status = 'SUBSCRIBED'";
        return jdbcTemplate.queryForList("""
                select c.id, c.owner_user_id as "ownerUserId", c.type, c.name, c.color, c.description,
                       c.visibility, c.is_readonly as "isReadonly", c.is_default as "isDefault",
                       c.system_key as "systemKey", m.role, m.subscription_status as "subscriptionStatus",
                       c.created_at as "createdAt", c.updated_at as "updatedAt"
                from calendar_members m
                join calendars c on c.id = m.calendar_id
                where m.user_id = ? and c.deleted_at is null %s
                order by case c.type when 'USER' then 1 else 3 end, coalesce(m.display_order, 1000), c.created_at
                """.formatted(hiddenClause), userId);
    }

    @Transactional
    public Map<String, Object> create(UUID userId, CalendarController.CalendarRequest request) {
        Integer count = jdbcTemplate.queryForObject("""
                select count(*) from calendars where owner_user_id = ? and type = 'USER' and deleted_at is null
                """, Integer.class, userId);
        if (count != null && count >= 50) {
            throw ApiException.conflict("한 사용자는 캘린더를 최대 50개까지 만들 수 있습니다.");
        }
        UUID id = jdbcTemplate.queryForObject("""
                insert into calendars (owner_user_id, type, name, color, description, visibility, is_readonly, is_default)
                values (?, 'USER', ?, ?, ?, ?, false, false)
                returning id
                """, UUID.class, userId, request.name().trim(), request.color(), request.description(), visibility(request.visibility()));
        jdbcTemplate.update("""
                insert into calendar_members (calendar_id, user_id, role, subscription_status, created_by)
                values (?, ?, 'OWNER', 'SUBSCRIBED', ?)
                """, id, userId, userId);
        return detail(userId, id);
    }

    public Map<String, Object> detail(UUID userId, UUID calendarId) {
        if (!permissions.canViewCalendar(calendarId, userId)) {
            throw ApiException.notFound("캘린더를 찾을 수 없습니다.");
        }
        return jdbcTemplate.queryForMap("""
                select c.id, c.owner_user_id as "ownerUserId", c.type, c.name, c.color, c.description,
                       c.visibility, c.is_readonly as "isReadonly", c.is_default as "isDefault",
                       c.system_key as "systemKey", m.role, m.subscription_status as "subscriptionStatus",
                       c.created_at as "createdAt", c.updated_at as "updatedAt"
                from calendars c
                join calendar_members m on m.calendar_id = c.id and m.user_id = ?
                where c.id = ? and c.deleted_at is null
                """, userId, calendarId);
    }

    @Transactional
    public Map<String, Object> update(UUID userId, UUID calendarId, CalendarController.CalendarRequest request) {
        permissions.assertNotSystemCalendarForUserMutation(calendarId);
        permissions.requireCalendarRole(calendarId, userId, "OWNER", "ADMIN");
        jdbcTemplate.update("""
                update calendars
                set name = ?, color = ?, description = ?, visibility = ?, updated_at = now()
                where id = ? and deleted_at is null
                """, request.name().trim(), request.color(), request.description(), visibility(request.visibility()), calendarId);
        return detail(userId, calendarId);
    }

    @Transactional
    public void delete(UUID userId, UUID calendarId) {
        permissions.assertNotSystemCalendarForUserMutation(calendarId);
        permissions.requireCalendarRole(calendarId, userId, "OWNER");
        jdbcTemplate.update("update calendars set deleted_at = now(), updated_at = now() where id = ?", calendarId);
        jdbcTemplate.update("update events set deleted_at = now(), updated_at = now() where calendar_id = ? and deleted_at is null", calendarId);
    }

    @Transactional
    public Map<String, Object> updateSubscription(UUID userId, UUID calendarId, String status) {
        if (!List.of("SUBSCRIBED", "HIDDEN").contains(status)) {
            throw ApiException.validation("표시 상태는 SUBSCRIBED 또는 HIDDEN만 사용할 수 있습니다.");
        }
        if (!permissions.canViewCalendar(calendarId, userId)) {
            throw ApiException.notFound("캘린더를 찾을 수 없습니다.");
        }
        jdbcTemplate.update("""
                update calendar_members
                set subscription_status = ?, updated_at = now()
                where calendar_id = ? and user_id = ?
                """, status, calendarId, userId);
        return detail(userId, calendarId);
    }

    private String visibility(String value) {
        return value == null || value.isBlank() ? "PRIVATE" : value;
    }
}
