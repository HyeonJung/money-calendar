package com.example.calendar.calendar;

import com.example.calendar.common.ApiResponse;
import com.example.calendar.security.PrincipalUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/calendars/{calendarId}/members")
public class CalendarMemberController {
    private final CalendarMemberService memberService;

    public CalendarMemberController(CalendarMemberService memberService) {
        this.memberService = memberService;
    }

    @GetMapping
    public Map<String, Object> members(@AuthenticationPrincipal PrincipalUser user, @PathVariable UUID calendarId) {
        return ApiResponse.ok(memberService.members(user.id(), calendarId));
    }

    @PostMapping
    public Map<String, Object> share(@AuthenticationPrincipal PrincipalUser user,
                                     @PathVariable UUID calendarId,
                                     @Valid @RequestBody ShareRequest request) {
        return ApiResponse.ok(memberService.share(user.id(), calendarId, request));
    }

    @PatchMapping("/{userId}")
    public Map<String, Object> updateRole(@AuthenticationPrincipal PrincipalUser user,
                                          @PathVariable UUID calendarId,
                                          @PathVariable UUID userId,
                                          @Valid @RequestBody RoleRequest request) {
        return ApiResponse.ok(memberService.updateRole(user.id(), calendarId, userId, request.role()));
    }

    @DeleteMapping("/{userId}")
    public Map<String, Object> remove(@AuthenticationPrincipal PrincipalUser user,
                                      @PathVariable UUID calendarId,
                                      @PathVariable UUID userId) {
        memberService.remove(user.id(), calendarId, userId);
        return ApiResponse.ok(Map.of("removed", true));
    }

    public record ShareRequest(@Email @NotBlank String email, @Pattern(regexp = "VIEWER|EDITOR|ADMIN") String role) {
    }

    public record RoleRequest(@Pattern(regexp = "VIEWER|EDITOR|ADMIN") String role) {
    }
}
