package com.example.calendar.event;

import com.example.calendar.common.ApiResponse;
import com.example.calendar.security.PrincipalUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/events")
public class EventController {
    private final EventService eventService;

    public EventController(EventService eventService) {
        this.eventService = eventService;
    }

    @GetMapping
    public Map<String, Object> list(@AuthenticationPrincipal PrincipalUser user,
                                    @RequestParam OffsetDateTime from,
                                    @RequestParam OffsetDateTime to,
                                    @RequestParam(required = false) String calendarIds,
                                    @RequestParam(defaultValue = "MONTH") String view) {
        return ApiResponse.ok(eventService.list(user.id(), from, to, calendarIds, view));
    }

    @PostMapping
    public Map<String, Object> create(@AuthenticationPrincipal PrincipalUser user,
                                      @Valid @RequestBody EventRequest request) {
        return ApiResponse.ok(eventService.create(user.id(), request));
    }

    @GetMapping("/{eventId}")
    public Map<String, Object> detail(@AuthenticationPrincipal PrincipalUser user, @PathVariable UUID eventId) {
        return ApiResponse.ok(eventService.detail(user.id(), eventId));
    }

    @PatchMapping("/{eventId}")
    public Map<String, Object> update(@AuthenticationPrincipal PrincipalUser user,
                                      @PathVariable UUID eventId,
                                      @Valid @RequestBody EventRequest request) {
        return ApiResponse.ok(eventService.update(user.id(), eventId, request));
    }

    @DeleteMapping("/{eventId}")
    public Map<String, Object> delete(@AuthenticationPrincipal PrincipalUser user, @PathVariable UUID eventId) {
        eventService.delete(user.id(), eventId);
        return ApiResponse.ok(Map.of("deleted", true));
    }

    public record EventRequest(
            @NotNull UUID calendarId,
            @NotBlank @Size(max = 120) String title,
            @Size(max = 5000) String description,
            @Size(max = 255) String location,
            @NotNull OffsetDateTime startsAt,
            @NotNull OffsetDateTime endsAt,
            String timezone,
            boolean isAllDay
    ) {
    }
}
