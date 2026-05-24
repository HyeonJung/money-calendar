package com.example.calendar.common;

import jakarta.validation.ConstraintViolationException;
import org.springframework.dao.DataAccessException;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(ApiException.class)
    ResponseEntity<?> handleApiException(ApiException exception) {
        return ResponseEntity.status(exception.getStatus())
                .body(ApiResponse.error(exception.getCode().name(), exception.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<?> handleValidation(MethodArgumentNotValidException exception) {
        List<String> details = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .collect(Collectors.toList());
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(ErrorCode.VALIDATION_ERROR.name(), "입력값을 확인해 주세요.", details));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<?> handleConstraint(ConstraintViolationException exception) {
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(ErrorCode.VALIDATION_ERROR.name(), "입력값을 확인해 주세요."));
    }

    @ExceptionHandler({AuthenticationException.class, BadCredentialsException.class})
    ResponseEntity<?> handleAuth(Exception exception) {
        return ResponseEntity.status(401)
                .body(ApiResponse.error(ErrorCode.UNAUTHORIZED.name(), "인증 정보가 올바르지 않습니다."));
    }

    @ExceptionHandler(DataAccessException.class)
    ResponseEntity<?> handleData(DataAccessException exception) {
        return ResponseEntity.internalServerError()
                .body(ApiResponse.error(ErrorCode.INTERNAL_ERROR.name(), "데이터 처리 중 오류가 발생했습니다."));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<?> handleUnknown(Exception exception) {
        return ResponseEntity.internalServerError()
                .body(ApiResponse.error(ErrorCode.INTERNAL_ERROR.name(), "알 수 없는 오류가 발생했습니다."));
    }
}
