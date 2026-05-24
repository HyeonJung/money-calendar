package com.example.calendar.security;

import java.util.UUID;

public record PrincipalUser(UUID id, String email, String role) {
    public boolean isAdmin() {
        return "ADMIN".equals(role);
    }
}
