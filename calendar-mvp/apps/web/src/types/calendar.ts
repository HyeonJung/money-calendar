export type Role = "OWNER" | "VIEWER" | "EDITOR" | "ADMIN";
export type CalendarType = "USER" | "SYSTEM_HOLIDAY";
export type Visibility = "PRIVATE" | "LINK" | "PUBLIC";
export type SubscriptionStatus = "SUBSCRIBED" | "HIDDEN" | "UNSUBSCRIBED";

export type User = {
  id: string;
  email: string;
  displayName: string;
  timezone: string;
  role: "USER" | "ADMIN";
  profileImageUrl?: string;
  avatarColor?: string;
};

export type Calendar = {
  id: string;
  ownerUserId?: string;
  type: CalendarType;
  name: string;
  color: string;
  description?: string;
  visibility: Visibility;
  isReadonly: boolean;
  isDefault: boolean;
  systemKey?: string;
  role: Role;
  subscriptionStatus: SubscriptionStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type CalendarMember = {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  subscriptionStatus: SubscriptionStatus;
  createdAt: string;
};

export type AttendeeResponseStatus = "NEEDS_ACTION" | "ACCEPTED" | "DECLINED" | "TENTATIVE";

export type EventAttendee = {
  id: string;
  eventId: string;
  userId: string;
  email: string;
  displayName: string;
  responseStatus: AttendeeResponseStatus;
  invitedBy?: string;
  invitedAt?: string;
  respondedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  profileImageUrl?: string;
  avatarColor?: string;
  pending?: boolean;
};

export type CalendarEvent = {
  id: string;
  calendarId: string;
  createdBy?: string;
  updatedBy?: string;
  source: "USER" | "SYSTEM_HOLIDAY";
  sourceKey?: string;
  title: string;
  description?: string;
  location?: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  isAllDay: boolean;
  status: "CONFIRMED" | "CANCELED";
  calendarName: string;
  calendarColor: string;
  isReadonly: boolean;
  role: Role;
  creatorName?: string;
  attendeeCount?: number;
  attendeePreview?: EventAttendee[];
  attendees?: EventAttendee[];
};

export type HolidayRun = {
  id: string;
  targetCountryCode: string;
  targetYear: number;
  status: "RUNNING" | "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";
  triggerType: "SCHEDULED" | "MANUAL" | "RETRY";
  startedAt: string;
  finishedAt?: string;
  requestedCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  errorSummary?: string;
  failures?: HolidayFailure[];
};

export type HolidayFailure = {
  id: string;
  stage: string;
  errorCode: string;
  errorMessage: string;
  externalStatus?: number;
  externalResponseSummary?: string;
  isRetryable: boolean;
  createdAt: string;
};
