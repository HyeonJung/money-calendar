package com.example.calendar.common;

import java.util.Collections;
import java.util.List;
import java.util.Map;

public final class ApiResponse {
    private ApiResponse() {
    }

    public static Map<String, Object> ok(Object data) {
        return Map.of("data", data, "meta", Map.of());
    }

    public static Map<String, Object> ok(Object data, Map<String, Object> meta) {
        return Map.of("data", data, "meta", meta == null ? Map.of() : meta);
    }

    public static Map<String, Object> error(String code, String message) {
        return error(code, message, Collections.emptyList());
    }

    public static Map<String, Object> error(String code, String message, List<?> details) {
        return Map.of("error", Map.of(
                "code", code,
                "message", message,
                "details", details == null ? Collections.emptyList() : details
        ));
    }
}
