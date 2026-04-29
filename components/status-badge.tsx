import type { IpoStatus } from "@/lib/ipos";

type StatusBadgeProps = {
  status: IpoStatus | string;
  className?: string;
};

const STATUS_META: Record<
  string,
  {
    label: string;
    className: string;
  }
> = {
  active: {
    label: "진행중",
    className:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  imminent: {
    label: "임박",
    className:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/60 dark:text-amber-300",
  },
  upcoming: {
    label: "임박",
    className:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/60 dark:text-sky-300",
  },
  listed: {
    label: "상장완료",
    className:
      "border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300",
  },
  closed: {
    label: "마감",
    className:
      "border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const meta = STATUS_META[status] ?? STATUS_META.upcoming;

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
