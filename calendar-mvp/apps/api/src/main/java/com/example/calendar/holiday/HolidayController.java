package com.example.calendar.holiday;

import com.example.calendar.common.ApiResponse;
import com.example.calendar.security.PrincipalUser;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/holiday-sync-runs")
public class HolidayController {
    private final HolidaySyncService holidaySyncService;

    public HolidayController(HolidaySyncService holidaySyncService) {
        this.holidaySyncService = holidaySyncService;
    }

    @PostMapping
    public Map<String, Object> run(@AuthenticationPrincipal PrincipalUser user, @RequestBody HolidayRunRequest request) {
        return ApiResponse.ok(holidaySyncService.runManual(user, request.countryCode(), request.year()));
    }

    @GetMapping
    public Map<String, Object> list(@AuthenticationPrincipal PrincipalUser user,
                                    @RequestParam(defaultValue = "KR") String countryCode,
                                    @RequestParam(defaultValue = "2026") int year,
                                    @RequestParam(required = false) String status) {
        return ApiResponse.ok(holidaySyncService.list(user, countryCode, year, status));
    }

    @GetMapping("/{runId}")
    public Map<String, Object> detail(@AuthenticationPrincipal PrincipalUser user, @PathVariable UUID runId) {
        return ApiResponse.ok(holidaySyncService.detail(user, runId));
    }

    public record HolidayRunRequest(
            @Pattern(regexp = "KR") String countryCode,
            @Min(1970) @Max(2100) int year
    ) {
    }
}
