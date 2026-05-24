package com.example.calendar.config;

import com.example.calendar.calendar.CalendarBootstrapService;
import com.example.calendar.holiday.HolidaySyncService;
import org.flywaydb.core.Flyway;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class SeedDataInitializer implements CommandLineRunner {
    private final JdbcTemplate jdbcTemplate;
    private final PasswordEncoder passwordEncoder;
    private final CalendarBootstrapService calendarBootstrapService;
    private final HolidaySyncService holidaySyncService;
    private final Flyway flyway;

    public SeedDataInitializer(JdbcTemplate jdbcTemplate, PasswordEncoder passwordEncoder,
                               CalendarBootstrapService calendarBootstrapService,
                               HolidaySyncService holidaySyncService,
                               Flyway flyway) {
        this.jdbcTemplate = jdbcTemplate;
        this.passwordEncoder = passwordEncoder;
        this.calendarBootstrapService = calendarBootstrapService;
        this.holidaySyncService = holidaySyncService;
        this.flyway = flyway;
    }

    @Override
    public void run(String... args) {
        flyway.migrate();
        seedUsers();
        List<UUID> userIds = jdbcTemplate.queryForList("select id from app_users where deleted_at is null", UUID.class);
        for (UUID userId : userIds) {
            calendarBootstrapService.ensureUserCalendars(userId);
        }
        seedExtraCalendarsAndEvents();
        holidaySyncService.runSync("KR", 2026, "SCHEDULED");
    }

    private void seedUsers() {
        List<Map<String, String>> users = List.of(
                Map.of("email", "owner@example.com", "name", "김민수", "role", "USER"),
                Map.of("email", "viewer@example.com", "name", "이지혜", "role", "USER"),
                Map.of("email", "editor@example.com", "name", "박서준", "role", "USER"),
                Map.of("email", "adminuser@example.com", "name", "최유리", "role", "USER"),
                Map.of("email", "admin@example.com", "name", "관리자", "role", "ADMIN")
        );
        for (Map<String, String> user : users) {
            Integer count = jdbcTemplate.queryForObject("select count(*) from app_users where email = ?", Integer.class, user.get("email"));
            if (count != null && count == 0) {
                jdbcTemplate.update("""
                        insert into app_users (email, password_hash, display_name, role)
                        values (?, ?, ?, ?)
                        """, user.get("email"), passwordEncoder.encode("password"), user.get("name"), user.get("role"));
            }
        }
    }

    private void seedExtraCalendarsAndEvents() {
        UUID ownerId = jdbcTemplate.queryForObject("select id from app_users where email = 'owner@example.com'", UUID.class);
        UUID viewerId = jdbcTemplate.queryForObject("select id from app_users where email = 'viewer@example.com'", UUID.class);
        UUID editorId = jdbcTemplate.queryForObject("select id from app_users where email = 'editor@example.com'", UUID.class);
        UUID adminUserId = jdbcTemplate.queryForObject("select id from app_users where email = 'adminuser@example.com'", UUID.class);
        UUID work = ensureCalendar(ownerId, "업무", "#22C55E", "업무 일정");
        UUID family = ensureCalendar(ownerId, "가족", "#8B5CF6", "가족 일정");
        UUID project = ensureCalendar(ownerId, "프로젝트 일정", "#F59E0B", "공유 프로젝트 일정");
        UUID sharedFamily = ensureCalendar(ownerId, "가족 공유 일정", "#F43F5E", "가족 공유 일정");
        ensureMember(project, viewerId, "VIEWER", ownerId);
        ensureMember(project, editorId, "EDITOR", ownerId);
        ensureMember(sharedFamily, adminUserId, "ADMIN", ownerId);
        seedEvent(work, ownerId, "팀 회의", "2026-05-24T10:00:00+09:00", "2026-05-24T11:00:00+09:00", "회의실 A");
        seedEvent(family, ownerId, "가족 일정", "2026-05-24T14:00:00+09:00", "2026-05-24T16:00:00+09:00", "강남구 논현동");
        seedEvent(project, ownerId, "프로젝트 마감", "2026-05-24T00:00:00+09:00", "2026-05-25T00:00:00+09:00", "");
        seedEvent(work, ownerId, "고객 미팅", "2026-05-20T13:00:00+09:00", "2026-05-20T14:00:00+09:00", "온라인");
        seedEvent(work, ownerId, "디자인 리뷰", "2026-05-13T15:00:00+09:00", "2026-05-13T16:00:00+09:00", "회의실 B");
    }

    private UUID ensureCalendar(UUID ownerId, String name, String color, String description) {
        List<UUID> existing = jdbcTemplate.queryForList("""
                select id from calendars where owner_user_id = ? and name = ? and deleted_at is null
                """, UUID.class, ownerId, name);
        if (!existing.isEmpty()) {
            return existing.get(0);
        }
        UUID id = jdbcTemplate.queryForObject("""
                insert into calendars (owner_user_id, type, name, color, description, visibility, is_readonly, is_default)
                values (?, 'USER', ?, ?, ?, 'PRIVATE', false, false)
                returning id
                """, UUID.class, ownerId, name, color, description);
        ensureMember(id, ownerId, "OWNER", ownerId);
        return id;
    }

    private void ensureMember(UUID calendarId, UUID userId, String role, UUID createdBy) {
        jdbcTemplate.update("""
                insert into calendar_members (calendar_id, user_id, role, subscription_status, created_by)
                values (?, ?, ?, 'SUBSCRIBED', ?)
                on conflict (calendar_id, user_id)
                do update set role = excluded.role, subscription_status = 'SUBSCRIBED', updated_at = now()
                """, calendarId, userId, role, createdBy);
    }

    private void seedEvent(UUID calendarId, UUID ownerId, String title, String start, String end, String location) {
        Integer count = jdbcTemplate.queryForObject("""
                select count(*) from events where calendar_id = ? and title = ? and starts_at = ?::timestamptz and deleted_at is null
                """, Integer.class, calendarId, title, start);
        if (count != null && count == 0) {
            jdbcTemplate.update("""
                    insert into events (calendar_id, created_by, updated_by, source, title, starts_at, ends_at, timezone, is_all_day, location, description)
                    values (?, ?, ?, 'USER', ?, ?::timestamptz, ?::timestamptz, 'Asia/Seoul', ?::timestamptz::date <> ?::timestamptz::date, ?, ?)
                    """, calendarId, ownerId, ownerId, title, start, end, start, end, location, title + " 일정입니다.");
        }
    }
}
