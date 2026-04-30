import type { IpoStatus } from "@/lib/ipos";

type StatusBadgeProps = {
  status: IpoStatus | string;
  className?: string;
  subscriptionStart?: Date | string | null;
  subscriptionEnd?: Date | string | null;
  listingDate?: Date | string | null;
};

const STATUS_META: Record<
  string,
  {
    label: string;
    className: string;
  }
> = {
  active: {
    label: "청약중",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  subscriptionUpcoming: {
    label: "청약 임박",
    className:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/60 dark:text-sky-300",
  },
  listingUpcoming: {
    label: "상장 임박",
    className:
      "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/70 dark:bg-violet-950/60 dark:text-violet-300",
  },
  imminent: {
    label: "청약 임박",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/60 dark:text-amber-300",
  },
  upcoming: {
    label: "청약 임박",
    className:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/60 dark:text-sky-300",
  },
  listed: {
    label: "상장완료",
    className:
      "border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300",
  },
  closed: {
    label: "청약 마감",
    className:
      "border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400",
  },
};

export function StatusBadge({
  status,
  className,
  subscriptionStart,
  subscriptionEnd,
  listingDate,
}: StatusBadgeProps) {
  const resolvedStatus = resolveScheduleStatus({
    status,
    subscriptionStart,
    subscriptionEnd,
    listingDate,
  });
  const meta = STATUS_META[resolvedStatus] ?? STATUS_META.upcoming;

  return (
    <span
      className={[
        "inline-flex h-7 items-center rounded-md border px-2.5 text-xs font-semibold tracking-tight",
        meta.className,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {meta.label}
    </span>
  );
}

function resolveScheduleStatus({
  status,
  subscriptionStart,
  subscriptionEnd,
  listingDate,
}: Required<Pick<StatusBadgeProps, "status">> &
  Pick<StatusBadgeProps, "subscriptionStart" | "subscriptionEnd" | "listingDate">) {
  const todayIso = getTodayIsoInSeoul();
  const startIso = toIsoDate(subscriptionStart);
  const endIso = toIsoDate(subscriptionEnd);
  const listingIso = toIsoDate(listingDate);

  if (listingIso && listingIso <= todayIso) {
    return "listed";
  }

  if (startIso && endIso && startIso <= todayIso && todayIso <= endIso) {
    return "active";
  }

  if (startIso && todayIso < startIso) {
    return "subscriptionUpcoming";
  }

  if (listingIso && todayIso < listingIso) {
    return "listingUpcoming";
  }

  if (status === "active") {
    return "active";
  }

  if (status === "listed") {
    return "listed";
  }

  return status;
}

function toIsoDate(value: Date | string | null | undefined) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(value);
  }

  return value.slice(0, 10);
}

function getTodayIsoInSeoul() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
