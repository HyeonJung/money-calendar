package com.example.calendar.calendar;

import com.example.calendar.common.ApiResponse;
import com.example.calendar.security.PrincipalUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/calendars")
public class CalendarController {
    private final CalendarService calendarService;

    public CalendarController(CalendarService calendarService) {
        this.calendarService = calendarService;
    }

    @GetMapping
    public Map<String, Object> list(@AuthenticationPrincipal PrincipalUser user,
                                    @RequestParam(defaultValue = "false") boolean includeHidden) {
        return ApiResponse.ok(calendarService.list(user.id(), includeHidden));
    }

    @PostMapping
    public Map<String, Object> create(@AuthenticationPrincipal PrincipalUser user,
                                      @Valid @RequestBody CalendarRequest request) {
        return ApiResponse.ok(calendarService.create(user.id(), request));
    }

    @GetMapping("/{calendarId}")
    public Map<String, Object> detail(@AuthenticationPrincipal PrincipalUser user, @PathVariable UUID calendarId) {
        return ApiResponse.ok(calendarService.detail(user.id(), calendarId));
    }

    @PatchMapping("/{calendarId}")
    public Map<String, Object> update(@AuthenticationPrincipal PrincipalUser user,
                                      @PathVariable UUID calendarId,
                                      @Valid @RequestBody CalendarRequest request) {
        return ApiResponse.ok(calendarService.update(user.id(), calendarId, request));
    }

    @DeleteMapping("/{calendarId}")
    public Map<String, Object> delete(@AuthenticationPrincipal PrincipalUser user, @PathVariable UUID calendarId) {
        calendarService.delete(user.id(), calendarId);
        return ApiResponse.ok(Map.of("deleted", true));
    }

    @PatchMapping("/{calendarId}/subscription")
    public Map<String, Object> subscription(@AuthenticationPrincipal PrincipalUser user,
                                            @PathVariable UUID calendarId,
                                            @RequestBody SubscriptionRequest request) {
        return ApiResponse.ok(calendarService.updateSubscription(user.id(), calendarId, request.subscriptionStatus()));
    }

    public record CalendarRequest(
            @NotBlank @Size(max = 80) String name,
            @Pattern(regexp = "^#[0-9A-Fa-f]{6}$") String color,
            @Size(max = 500) String description,
            @Pattern(regexp = "PRIVATE|LINK|PUBLIC") String visibility
    ) {
    }

    public record SubscriptionRequest(String subscriptionStatus) {
    }
}
