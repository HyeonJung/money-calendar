package com.example.calendar.common;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class HealthController {
    @GetMapping("/health")
    Map<String, Object> health() {
        return Map.of("status", "UP");
    }

    @GetMapping("/api/v1/openapi")
    Map<String, Object> openApiHint() {
        return Map.of(
                "title", "Calendar MVP API",
                "version", "0.1.0",
                "docs", "docs/api-contract.md",
                "note", "Swagger UI는 추후 springdoc 호환 버전 확정 후 연결합니다."
        );
    }
}
