package com.example.calendar.calendar;

import com.example.calendar.common.ApiException;
import com.example.calendar.user.AppUser;
import com.example.calendar.user.UserRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class CalendarMemberService {
    private final JdbcTemplate jdbcTemplate;
    private final UserRepository userRepository;
    private final CalendarPermissionService permissions;

    public CalendarMemberService(JdbcTemplate jdbcTemplate, UserRepository userRepository,
                                 CalendarPermissionService permissions) {
        this.jdbcTemplate = jdbcTemplate;
        this.userRepository = userRepository;
        this.permissions = permissions;
    }

    public List<Map<String, Object>> members(UUID requesterId, UUID calendarId) {
        permissions.assertNotSystemCalendarForUserMutation(calendarId);
        permissions.requireCalendarRole(calendarId, requesterId, "OWNER", "ADMIN");
        return jdbcTemplate.queryForList("""
                select u.id as "userId", u.email, u.display_name as "displayName", m.role,
                       m.subscription_status as "subscriptionStatus", m.created_at as "createdAt"
                from calendar_members m
                join app_users u on u.id = m.user_id
                where m.calendar_id = ? and u.deleted_at is null
                order by case m.role when 'OWNER' then 1 when 'ADMIN' then 2 when 'EDITOR' then 3 else 4 end, u.email
                """, calendarId);
    }

    @Transactional
    public List<Map<String, Object>> share(UUID requesterId, UUID calendarId, CalendarMemberController.ShareRequest request) {
        permissions.assertNotSystemCalendarForUserMutation(calendarId);
        permissions.requireCalendarRole(calendarId, requesterId, "OWNER", "ADMIN");
        AppUser target = userRepository.findByEmail(request.email().trim())
                .orElseThrow(() -> ApiException.notFound("이미 가입된 사용자만 공유할 수 있습니다."));
        if (target.id().equals(requesterId)) {
            throw ApiException.validation("자기 자신에게 공유할 수 없습니다.");
        }
        if ("OWNER".equals(request.role())) {
            throw ApiException.validation("OWNER 권한은 공유 API로 부여할 수 없습니다.");
        }
        Integer sharedCount = jdbcTemplate.queryForObject("""
                select count(*) from calendar_members where calendar_id = ? and role <> 'OWNER'
                """, Integer.class, calendarId);
        if (sharedCount != null && sharedCount >= 100) {
            throw ApiException.conflict("한 캘린더는 최대 100명에게 공유할 수 있습니다.");
        }
        jdbcTemplate.update("""
                insert into calendar_members (calendar_id, user_id, role, subscription_status, created_by)
                values (?, ?, ?, 'SUBSCRIBED', ?)
                on conflict (calendar_id, user_id)
                do update set role = case when calendar_members.role = 'OWNER' then calendar_members.role else excluded.role end,
                              subscription_status = 'SUBSCRIBED',
                              updated_at = now()
                """, calendarId, target.id(), request.role(), requesterId);
        return members(requesterId, calendarId);
    }

    @Transactional
    public List<Map<String, Object>> updateRole(UUID requesterId, UUID calendarId, UUID targetUserId, String role) {
        permissions.assertNotSystemCalendarForUserMutation(calendarId);
        permissions.requireCalendarRole(calendarId, requesterId, "OWNER", "ADMIN");
        permissions.assertOwnerNotModified(calendarId, targetUserId);
        jdbcTemplate.update("""
                update calendar_members set role = ?, updated_at = now()
                where calendar_id = ? and user_id = ?
                """, role, calendarId, targetUserId);
        return members(requesterId, calendarId);
    }

    @Transactional
    public void remove(UUID requesterId, UUID calendarId, UUID targetUserId) {
        permissions.assertNotSystemCalendarForUserMutation(calendarId);
        permissions.requireCalendarRole(calendarId, requesterId, "OWNER", "ADMIN");
        permissions.assertOwnerNotModified(calendarId, targetUserId);
        int updated = jdbcTemplate.update("""
                delete from calendar_members where calendar_id = ? and user_id = ?
                """, calendarId, targetUserId);
        if (updated == 0) {
            throw ApiException.notFound("공유 사용자를 찾을 수 없습니다.");
        }
        jdbcTemplate.update("""
                update event_attendees a
                set deleted_at = now(), updated_at = now()
                from events e
                where a.event_id = e.id
                  and e.calendar_id = ?
                  and a.user_id = ?
                  and a.deleted_at is null
                """, calendarId, targetUserId);
    }
}
