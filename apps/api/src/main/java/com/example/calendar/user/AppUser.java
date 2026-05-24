package com.example.calendar.user;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AppUser(
        UUID id,
        String email,
        String passwordHash,
        String displayName,
        String timezone,
        String role,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
