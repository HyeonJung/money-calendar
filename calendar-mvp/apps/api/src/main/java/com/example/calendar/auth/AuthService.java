package com.example.calendar.auth;

import com.example.calendar.calendar.CalendarBootstrapService;
import com.example.calendar.common.ApiException;
import com.example.calendar.security.JwtService;
import com.example.calendar.security.PrincipalUser;
import com.example.calendar.user.AppUser;
import com.example.calendar.user.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

@Service
public class AuthService {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final CalendarBootstrapService calendarBootstrapService;

    public AuthService(UserRepository userRepository, PasswordEncoder passwordEncoder, JwtService jwtService,
                       CalendarBootstrapService calendarBootstrapService) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.calendarBootstrapService = calendarBootstrapService;
    }

    @Transactional
    public Map<String, Object> register(AuthController.RegisterRequest request) {
        userRepository.findByEmail(request.email()).ifPresent(user -> {
            throw ApiException.conflict("이미 가입된 이메일입니다.");
        });
        AppUser user = userRepository.create(
                request.email(),
                passwordEncoder.encode(request.password()),
                request.displayName(),
                "USER"
        );
        calendarBootstrapService.ensureUserCalendars(user.id());
        return tokenPayload(user);
    }

    @Transactional
    public Map<String, Object> login(AuthController.LoginRequest request) {
        AppUser user = userRepository.findByEmail(request.email())
                .orElseThrow(() -> ApiException.unauthorized("이메일 또는 비밀번호가 올바르지 않습니다."));
        if (!passwordEncoder.matches(request.password(), user.passwordHash())) {
            throw ApiException.unauthorized("이메일 또는 비밀번호가 올바르지 않습니다.");
        }
        calendarBootstrapService.ensureUserCalendars(user.id());
        return tokenPayload(user);
    }

    public Map<String, Object> me(PrincipalUser currentUser) {
        AppUser user = userRepository.findById(currentUser.id())
                .orElseThrow(() -> ApiException.unauthorized("현재 사용자를 찾을 수 없습니다."));
        return Map.of(
                "id", user.id(),
                "email", user.email(),
                "displayName", user.displayName(),
                "timezone", user.timezone(),
                "role", user.role()
        );
    }

    private Map<String, Object> tokenPayload(AppUser user) {
        return Map.of(
                "accessToken", jwtService.issue(user.id(), user.email(), user.role()),
                "tokenType", "Bearer",
                "user", Map.of(
                        "id", user.id(),
                        "email", user.email(),
                        "displayName", user.displayName(),
                        "timezone", user.timezone(),
                        "role", user.role()
                )
        );
    }
}
