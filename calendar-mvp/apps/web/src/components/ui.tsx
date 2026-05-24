"use client";

import type { Calendar, EventAttendee, Role } from "@/types/calendar";
import { CalendarDays, CheckCircle2, Clock, Eye, Shield, UserCog } from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

export const palette = [
  { name: "navy", value: "#0B3B91" },
  { name: "emerald", value: "#22C55E" },
  { name: "blue", value: "#2563EB" },
  { name: "purple", value: "#8B5CF6" },
  { name: "amber", value: "#F59E0B" },
  { name: "rose", value: "#F43F5E" },
  { name: "gray", value: "#64748B" },
];

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-[#0B3B91] text-white shadow-sm hover:bg-[#08317A]",
    secondary: "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "border border-rose-200 bg-white text-rose-600 hover:bg-rose-50",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#0B3B91] focus:ring-4 focus:ring-blue-100 ${props.className || ""}`}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0B3B91] focus:ring-4 focus:ring-blue-100 ${props.className || ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none transition focus:border-[#0B3B91] focus:ring-4 focus:ring-blue-100 ${props.className || ""}`}
    />
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>;
}

export function Badge({ children, color = "slate" }: { children: ReactNode; color?: "slate" | "blue" | "green" | "purple" | "amber" | "rose" }) {
  const styles = {
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    purple: "bg-purple-50 text-purple-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  }[color];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}>{children}</span>;
}

export function RoleBadge({ role, system }: { role?: Role; system?: boolean }) {
  if (system) return <Badge color="rose">시스템</Badge>;
  const label = role === "OWNER" ? "소유자" : role === "ADMIN" ? "관리자" : role === "EDITOR" ? "편집" : "보기";
  const color = role === "OWNER" ? "blue" : role === "ADMIN" ? "purple" : role === "EDITOR" ? "green" : "slate";
  return <Badge color={color}>{label}</Badge>;
}

export function StatusBadge({ status }: { status: string }) {
  const color = status === "SUCCESS" ? "green" : status === "PARTIAL_SUCCESS" ? "amber" : status === "FAILED" ? "rose" : "blue";
  const label = status === "SUCCESS" ? "성공" : status === "PARTIAL_SUCCESS" ? "일부 성공" : status === "FAILED" ? "실패" : "실행 중";
  return <Badge color={color}>{label}</Badge>;
}

export function ColorDot({ color, className = "" }: { color: string; className?: string }) {
  return <span className={`inline-block h-3 w-3 shrink-0 rounded-full ${className}`} style={{ backgroundColor: color }} />;
}

export function Avatar({ attendee, size = "md" }: { attendee: Pick<EventAttendee, "displayName" | "email" | "profileImageUrl" | "avatarColor">; size?: "sm" | "md" | "lg" }) {
  const dimension = size === "sm" ? "h-5 w-5 text-[10px]" : size === "lg" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";
  const label = attendee.displayName || attendee.email;
  const initial = (label || "?").trim().slice(0, 1).toUpperCase();
  if (attendee.profileImageUrl) {
    return (
      <span
        aria-label={`${label} 프로필`}
        className={`${dimension} inline-block shrink-0 rounded-full border border-white bg-cover bg-center`}
        style={{ backgroundImage: `url(${attendee.profileImageUrl})` }}
      />
    );
  }
  return (
    <span
      aria-label={`${label} 프로필`}
      className={`${dimension} inline-grid shrink-0 place-items-center rounded-full border border-white font-extrabold text-white`}
      style={{ backgroundColor: attendee.avatarColor || "#64748B" }}
    >
      {initial}
    </span>
  );
}

export function AvatarGroup({ attendees = [], count, size = "sm", max = 3 }: { attendees?: EventAttendee[]; count?: number; size?: "sm" | "md" | "lg"; max?: number }) {
  const visible = attendees.slice(0, max);
  const total = count ?? attendees.length;
  const hidden = Math.max(0, total - visible.length);
  if (total === 0) return null;
  return (
    <span className="inline-flex shrink-0 items-center -space-x-1.5">
      {visible.map((attendee) => <Avatar key={attendee.id || attendee.email} attendee={attendee} size={size} />)}
      {hidden > 0 ? <span className="inline-grid h-5 min-w-5 place-items-center rounded-full border border-white bg-slate-200 px-1 text-[10px] font-extrabold text-slate-600">+{hidden}</span> : null}
    </span>
  );
}

export function AppSidebar({ active = "calendar" }: { active?: string }) {
  const items = [
    { key: "calendar", label: "캘린더", href: "/calendar", icon: CalendarDays },
    { key: "settings", label: "캘린더 설정", href: "/calendar/settings", icon: UserCog },
    { key: "share", label: "공유 관리", href: "/calendar/settings?tab=share", icon: Shield },
    { key: "holiday", label: "공휴일 배치 이력", href: "/admin/holiday-sync-runs", icon: Clock },
  ];
  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white px-4 py-5 lg:block">
      <a href="/calendar" className="mb-8 flex items-center gap-3 rounded-2xl px-2 text-lg font-extrabold text-slate-900">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#0B3B91] text-white">
          <CalendarDays size={20} />
        </span>
        캘린더 관리자
      </a>
      <nav className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <a
              key={item.key}
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold ${
                active === item.key ? "bg-blue-50 text-[#0B3B91]" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}

export function CalendarRow({
  calendar,
  onToggle,
}: {
  calendar: Calendar;
  onToggle: (calendar: Calendar) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-2xl px-1 py-2">
      <button
        aria-label={`${calendar.name} 표시 전환`}
        onClick={() => onToggle(calendar)}
        className={`grid h-5 w-5 place-items-center rounded-md border ${
          calendar.subscriptionStatus === "SUBSCRIBED" ? "border-transparent text-white" : "border-slate-300 text-transparent"
        }`}
        style={{ backgroundColor: calendar.subscriptionStatus === "SUBSCRIBED" ? calendar.color : "white" }}
      >
        <CheckCircle2 size={14} />
      </button>
      <ColorDot color={calendar.color} />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{calendar.name}</span>
      <RoleBadge role={calendar.role} system={calendar.type === "SYSTEM_HOLIDAY"} />
    </div>
  );
}

export function PermissionHint({ calendar }: { calendar?: Calendar }) {
  if (!calendar) return null;
  if (calendar.isReadonly) {
    return <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">읽기 전용 시스템 캘린더입니다.</div>;
  }
  if (calendar.role === "VIEWER") {
    return <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">보기 권한만 있어 수정할 수 없습니다.</div>;
  }
  return <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">편집 권한이 있는 캘린더에서 저장할 수 있습니다.</div>;
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white/70 px-5 py-8 text-center">
      <Eye className="mx-auto mb-3 text-slate-300" />
      <p className="font-bold text-slate-800">{title}</p>
      {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
    </div>
  );
}
