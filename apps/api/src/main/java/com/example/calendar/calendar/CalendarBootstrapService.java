package com.example.calendar.calendar;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class CalendarBootstrapService {
    private final JdbcTemplate jdbcTemplate;

    public CalendarBootstrapService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public void ensureUserCalendars(UUID userId) {
        ensureDefaultCalendar(userId);
        UUID holidayCalendarId = ensureHolidayCalendar();
        jdbcTemplate.update("""
                insert into calendar_members (calendar_id, user_id, role, subscription_status)
                values (?, ?, 'VIEWER', 'SUBSCRIBED')
                on conflict (calendar_id, user_id)
                do update set subscription_status = case
                    when calendar_members.subscription_status = 'UNSUBSCRIBED' then 'SUBSCRIBED'
                    else calendar_members.subscription_status
                end, updated_at = now()
                """, holidayCalendarId, userId);
    }

    public UUID ensureHolidayCalendar() {
        List<UUID> existing = jdbcTemplate.queryForList("""
                select id from calendars where system_key = 'KR_HOLIDAYS' and deleted_at is null
                """, UUID.class);
        if (!existing.isEmpty()) {
            return existing.get(0);
        }
        return jdbcTemplate.queryForObject("""
                insert into calendars (owner_user_id, type, name, color, description, visibility, is_readonly, is_default, system_key)
                values (null, 'SYSTEM_HOLIDAY', '대한민국 공휴일', '#F43F5E', '배치로 자동 수집되는 대한민국 공휴일입니다.', 'PRIVATE', true, true, 'KR_HOLIDAYS')
                returning id
                """, UUID.class);
    }

    private void ensureDefaultCalendar(UUID userId) {
        Integer count = jdbcTemplate.queryForObject("""
                select count(*) from calendars
                where owner_user_id = ? and is_default = true and deleted_at is null
                """, Integer.class, userId);
        if (count != null && count > 0) {
            return;
        }
        UUID calendarId = jdbcTemplate.queryForObject("""
                insert into calendars (owner_user_id, type, name, color, description, visibility, is_readonly, is_default)
                values (?, 'USER', '내 캘린더', '#2563EB', '기본 개인 캘린더', 'PRIVATE', false, true)
                returning id
                """, UUID.class, userId);
        jdbcTemplate.update("""
                insert into calendar_members (calendar_id, user_id, role, subscription_status, created_by)
                values (?, ?, 'OWNER', 'SUBSCRIBED', ?)
                on conflict (calendar_id, user_id) do nothing
                """, calendarId, userId, userId);
    }
}
