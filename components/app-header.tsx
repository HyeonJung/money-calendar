"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, CalendarDays, Home, Landmark, LineChart } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

const navItems = [
  { href: "/", label: "홈", icon: Home },
  { href: "/ipos", label: "공모주", icon: Landmark },
  { href: "/calendar", label: "캘린더", icon: CalendarDays },
  // 핫딜 메뉴는 운영 재정비 전까지 노출하지 않습니다.
  // { href: "/hotdeals", label: "핫딜", icon: BadgePercent },
] as const;

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
      <div className="relative mx-auto grid h-16 max-w-7xl grid-cols-[auto_1fr] items-center gap-3 px-4 pr-16 sm:grid-cols-[auto_1fr_auto] sm:px-6 lg:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold dark:text-white">
          <span className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm shadow-emerald-600/20">
            <LineChart size={18} aria-hidden="true" />
          </span>
          <span className="hidden text-base sm:inline">머니캘린더</span>
        </Link>

        <nav className="flex min-w-0 justify-center gap-1 overflow-x-auto text-sm font-semibold text-neutral-600 dark:text-neutral-300">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "inline-flex h-16 shrink-0 items-center gap-1.5 border-b-2 px-2 transition sm:px-4",
                  isActive
                    ? "border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-300"
                    : "border-transparent hover:text-neutral-950 dark:hover:text-white",
                ].join(" ")}
              >
                <Icon size={16} aria-hidden="true" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="absolute right-4 top-1/2 z-10 flex shrink-0 -translate-y-1/2 items-center gap-2 sm:static sm:translate-y-0">
          <button
            type="button"
            aria-label="알림"
            className="hidden size-9 items-center justify-center rounded-md border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 hover:text-neutral-950 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-white sm:inline-flex"
          >
            <Bell size={16} aria-hidden="true" />
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
