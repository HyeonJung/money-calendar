package com.example.calendar.event;

import com.example.calendar.common.ApiResponse;
import com.example.calendar.security.PrincipalUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/events/{eventId}/attendees")
public class EventAttendeeController {
    private final EventAttendeeService attendeeService;

    public EventAttendeeController(EventAttendeeService attendeeService) {
        this.attendeeService = attendeeService;
    }

    @GetMapping
    public Map<String, Object> list(@AuthenticationPrincipal PrincipalUser user, @PathVariable UUID eventId) {
        return ApiResponse.ok(attendeeService.list(user.id(), eventId));
    }

    @PostMapping
    public Map<String, Object> add(@AuthenticationPrincipal PrincipalUser user,
                                   @PathVariable UUID eventId,
                                   @Valid @RequestBody AddAttendeeRequest request) {
        return ApiResponse.ok(attendeeService.add(user.id(), eventId, request.email()));
    }

    @DeleteMapping("/{attendeeId}")
    public Map<String, Object> remove(@AuthenticationPrincipal PrincipalUser user,
                                      @PathVariable UUID eventId,
                                      @PathVariable UUID attendeeId) {
        attendeeService.remove(user.id(), eventId, attendeeId);
        return ApiResponse.ok(Map.of("removed", true));
    }

    @PatchMapping("/me/response")
    public Map<String, Object> updateMyResponse(@AuthenticationPrincipal PrincipalUser user,
                                                @PathVariable UUID eventId,
                                                @Valid @RequestBody RsvpRequest request) {
        return ApiResponse.ok(attendeeService.updateMyResponse(user.id(), eventId, request.responseStatus()));
    }

    public record AddAttendeeRequest(@Email @NotBlank String email) {
    }

    public record RsvpRequest(@NotBlank String responseStatus) {
    }
}
