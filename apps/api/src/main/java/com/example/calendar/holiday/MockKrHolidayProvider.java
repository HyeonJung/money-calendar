package com.example.calendar.holiday;

import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

@Component
public class MockKrHolidayProvider implements HolidayProvider {
    @Override
    public List<HolidayRecord> fetch(String countryCode, int year) {
        if (!"KR".equals(countryCode)) {
            throw new IllegalArgumentException("MVP는 KR만 지원합니다.");
        }
        if (year != 2026) {
            return List.of(
                    new HolidayRecord(LocalDate.of(year, 1, 1), "신정", "KR-" + year + "-0101", "{\"mock\":true}"),
                    new HolidayRecord(LocalDate.of(year, 3, 1), "삼일절", "KR-" + year + "-0301", "{\"mock\":true}"),
                    new HolidayRecord(LocalDate.of(year, 5, 5), "어린이날", "KR-" + year + "-0505", "{\"mock\":true}"),
                    new HolidayRecord(LocalDate.of(year, 8, 15), "광복절", "KR-" + year + "-0815", "{\"mock\":true}"),
                    new HolidayRecord(LocalDate.of(year, 10, 3), "개천절", "KR-" + year + "-1003", "{\"mock\":true}"),
                    new HolidayRecord(LocalDate.of(year, 10, 9), "한글날", "KR-" + year + "-1009", "{\"mock\":true}"),
                    new HolidayRecord(LocalDate.of(year, 12, 25), "성탄절", "KR-" + year + "-1225", "{\"mock\":true}")
            );
        }
        return List.of(
                new HolidayRecord(LocalDate.of(2026, 1, 1), "신정", "KR-2026-0101", "{\"mock\":true,\"name\":\"신정\"}"),
                new HolidayRecord(LocalDate.of(2026, 2, 16), "설날 연휴", "KR-2026-0216", "{\"mock\":true,\"name\":\"설날 연휴\"}"),
                new HolidayRecord(LocalDate.of(2026, 2, 17), "설날", "KR-2026-0217", "{\"mock\":true,\"name\":\"설날\"}"),
                new HolidayRecord(LocalDate.of(2026, 2, 18), "설날 연휴", "KR-2026-0218", "{\"mock\":true,\"name\":\"설날 연휴\"}"),
                new HolidayRecord(LocalDate.of(2026, 3, 1), "삼일절", "KR-2026-0301", "{\"mock\":true,\"name\":\"삼일절\"}"),
                new HolidayRecord(LocalDate.of(2026, 3, 2), "삼일절 대체공휴일", "KR-2026-0302", "{\"mock\":true,\"name\":\"삼일절 대체공휴일\"}"),
                new HolidayRecord(LocalDate.of(2026, 5, 5), "어린이날", "KR-2026-0505", "{\"mock\":true,\"name\":\"어린이날\"}"),
                new HolidayRecord(LocalDate.of(2026, 5, 24), "대한민국 공휴일", "KR-2026-0524", "{\"mock\":true,\"name\":\"대한민국 공휴일\"}"),
                new HolidayRecord(LocalDate.of(2026, 5, 25), "부처님오신날", "KR-2026-0525", "{\"mock\":true,\"name\":\"부처님오신날\"}"),
                new HolidayRecord(LocalDate.of(2026, 6, 6), "현충일", "KR-2026-0606", "{\"mock\":true,\"name\":\"현충일\"}"),
                new HolidayRecord(LocalDate.of(2026, 8, 15), "광복절", "KR-2026-0815", "{\"mock\":true,\"name\":\"광복절\"}"),
                new HolidayRecord(LocalDate.of(2026, 8, 17), "광복절 대체공휴일", "KR-2026-0817", "{\"mock\":true,\"name\":\"광복절 대체공휴일\"}"),
                new HolidayRecord(LocalDate.of(2026, 9, 24), "추석 연휴", "KR-2026-0924", "{\"mock\":true,\"name\":\"추석 연휴\"}"),
                new HolidayRecord(LocalDate.of(2026, 9, 25), "추석", "KR-2026-0925", "{\"mock\":true,\"name\":\"추석\"}"),
                new HolidayRecord(LocalDate.of(2026, 9, 26), "추석 연휴", "KR-2026-0926", "{\"mock\":true,\"name\":\"추석 연휴\"}"),
                new HolidayRecord(LocalDate.of(2026, 10, 3), "개천절", "KR-2026-1003", "{\"mock\":true,\"name\":\"개천절\"}"),
                new HolidayRecord(LocalDate.of(2026, 10, 9), "한글날", "KR-2026-1009", "{\"mock\":true,\"name\":\"한글날\"}"),
                new HolidayRecord(LocalDate.of(2026, 12, 25), "성탄절", "KR-2026-1225", "{\"mock\":true,\"name\":\"성탄절\"}")
        );
    }

    @Override
    public String providerName() {
        return "MOCK_KR_HOLIDAY";
    }
}
