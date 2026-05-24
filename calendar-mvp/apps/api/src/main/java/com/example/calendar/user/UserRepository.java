package com.example.calendar.user;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public class UserRepository {
    private final JdbcTemplate jdbcTemplate;

    private final RowMapper<AppUser> mapper = (rs, rowNum) -> new AppUser(
            rs.getObject("id", UUID.class),
            rs.getString("email"),
            rs.getString("password_hash"),
            rs.getString("display_name"),
            rs.getString("timezone"),
            rs.getString("role"),
            rs.getObject("created_at", java.time.OffsetDateTime.class),
            rs.getObject("updated_at", java.time.OffsetDateTime.class)
    );

    public UserRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public Optional<AppUser> findByEmail(String email) {
        return jdbcTemplate.query("""
                select * from app_users
                where lower(email) = lower(?) and deleted_at is null
                """, mapper, email).stream().findFirst();
    }

    public Optional<AppUser> findById(UUID id) {
        return jdbcTemplate.query("""
                select * from app_users
                where id = ? and deleted_at is null
                """, mapper, id).stream().findFirst();
    }

    public AppUser create(String email, String passwordHash, String displayName, String role) {
        return jdbcTemplate.queryForObject("""
                insert into app_users (email, password_hash, display_name, role)
                values (?, ?, ?, ?)
                returning *
                """, mapper, email.toLowerCase(), passwordHash, displayName, role);
    }
}
