package com.example.calendar.common;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {
    private final ErrorCode code;
    private final HttpStatus status;

    public ApiException(ErrorCode code, HttpStatus status, String message) {
        super(message);
        this.code = code;
        this.status = status;
    }

    public ErrorCode getCode() {
        return code;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public static ApiException unauthorized(String message) {
        return new ApiException(ErrorCode.UNAUTHORIZED, HttpStatus.UNAUTHORIZED, message);
    }

    public static ApiException forbidden(String message) {
        return new ApiException(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN, message);
    }

    public static ApiException notFound(String message) {
        return new ApiException(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, message);
    }

    public static ApiException validation(String message) {
        return new ApiException(ErrorCode.VALIDATION_ERROR, HttpStatus.BAD_REQUEST, message);
    }

    public static ApiException conflict(String message) {
        return new ApiException(ErrorCode.CONFLICT, HttpStatus.CONFLICT, message);
    }

    public static ApiException readonly(String message) {
        return new ApiException(ErrorCode.READONLY_CALENDAR, HttpStatus.FORBIDDEN, message);
    }

    public static ApiException attendeeNotFound(String message) {
        return new ApiException(ErrorCode.ATTENDEE_NOT_FOUND, HttpStatus.NOT_FOUND, message);
    }

    public static ApiException attendeeLimit(String message) {
        return new ApiException(ErrorCode.ATTENDEE_LIMIT_EXCEEDED, HttpStatus.CONFLICT, message);
    }
}
