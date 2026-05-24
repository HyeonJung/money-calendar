package com.example.calendar.holiday;

import java.time.LocalDate;
import java.util.List;

public interface HolidayProvider {
    List<HolidayRecord> fetch(String countryCode, int year);

    String providerName();

    record HolidayRecord(LocalDate date, String name, String sourceKey, String rawPayload) {
    }
}
