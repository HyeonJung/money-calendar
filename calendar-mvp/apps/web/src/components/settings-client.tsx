"use client";

import { api } from "@/lib/api";
import type { Calendar, CalendarMember, Role, Visibility } from "@/types/calendar";
import { AppSidebar, Badge, Button, Card, ColorDot, Input, RoleBadge, Select, Textarea, palette } from "@/components/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Tab = "basic" | "share" | "display" | "delete";

export function SettingsClient({ calendarId, initialTab = "basic", mobile = false }: { calendarId?: string; initialTab?: Tab; mobile?: boolean }) {
  const router = useRouter();
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [selectedId, setSelectedId] = useState(calendarId || "");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [members, setMembers] = useState<CalendarMember[]>([]);
  const [error, setError] = useState("");
  const [memberError, setMemberError] = useState("");
  const selected = calendars.find((calendar) => calendar.id === selectedId) || calendars[0];

  async function load() {
    try {
      setError("");
      const next = await api.calendars(true);
      setCalendars(next);
      const id = selectedId || calendarId || next[0]?.id || "";
      setSelectedId(id);
      if (id) {
        try {
          setMemberError("");
          setMembers(await api.members(id));
        } catch (err) {
          setMembers([]);
          setMemberError(err instanceof Error ? err.message : "공유 사용자 목록을 불러오지 못했습니다.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "설정을 불러오지 못했습니다.");
      router.push("/login");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const queryTab = new URLSearchParams(window.location.search).get("tab");
    if (queryTab === "share" || queryTab === "basic" || queryTab === "display" || queryTab === "delete") {
      setTab(queryTab);
    }
  }, []);

  if (mobile) {
    return (
      <main className="min-h-screen bg-[#f6f8fb] px-4 py-5">
        <button className="mb-4 text-sm font-bold text-[#0B3B91]" onClick={() => router.back()}>← 뒤로</button>
        <SettingsContent
          calendars={calendars}
          selected={selected}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          tab={tab}
          setTab={setTab}
          members={members}
          memberError={memberError}
          reload={load}
          error={error}
          mobile
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen bg-[#f6f8fb]">
      <AppSidebar active={tab === "share" ? "share" : "settings"} />
      <section className="flex-1 overflow-auto p-6">
        <SettingsContent
          calendars={calendars}
          selected={selected}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          tab={tab}
          setTab={setTab}
          members={members}
          memberError={memberError}
          reload={load}
          error={error}
        />
      </section>
    </main>
  );
}

function SettingsContent({
  calendars,
  selected,
  selectedId,
  setSelectedId,
  tab,
  setTab,
  members,
  memberError,
  reload,
  error,
  mobile,
}: {
  calendars: Calendar[];
  selected?: Calendar;
  selectedId: string;
  setSelectedId: (id: string) => void;
  tab: Tab;
  setTab: (tab: Tab) => void;
  members: CalendarMember[];
  memberError: string;
  reload: () => Promise<void>;
  error: string;
  mobile?: boolean;
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-slate-950">{tab === "share" ? "캘린더 공유 관리" : "캘린더 설정"}</h1>
        <p className="mt-2 text-slate-500">캘린더 기본 정보, 공유 권한, 표시 상태를 관리합니다.</p>
      </div>
      {error ? <div className="mb-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div> : null}
      <Card className="mb-5 p-5">
        <label className="block max-w-sm space-y-2">
          <span className="text-sm font-bold">캘린더 선택</span>
          <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {calendars.map((calendar) => <option key={calendar.id} value={calendar.id}>{calendar.name}</option>)}
          </Select>
        </label>
      </Card>
      {selected ? (
        <div className={mobile ? "space-y-5" : "grid gap-5 lg:grid-cols-[1fr_320px]"}>
          <Card className="p-5">
            <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-100 pb-4">
              {(["basic", "share", "display", "delete"] as Tab[]).map((item) => (
                <button
                  key={item}
                  onClick={() => {
                    setTab(item);
                    const path = item === "share" && selectedId ? `/calendar/settings/${selectedId}/share` : selectedId ? `/calendar/settings/${selectedId}` : "/calendar/settings";
                    window.history.replaceState(null, "", item === "basic" ? path : `${path}?tab=${item}`);
                  }}
                  className={`rounded-2xl px-4 py-2 text-sm font-bold ${tab === item ? "bg-[#0B3B91] text-white" : "bg-slate-100 text-slate-600"}`}
                >
                  {item === "basic" ? "기본 정보" : item === "share" ? "공유" : item === "display" ? "표시 설정" : "삭제"}
                </button>
              ))}
            </div>
            {tab === "basic" ? <BasicForm calendar={selected} reload={reload} /> : null}
            {tab === "share" ? <SharePanel calendar={selected} members={members} memberError={memberError} reload={reload} mobile={mobile} /> : null}
            {tab === "display" ? <DisplayPanel calendar={selected} reload={reload} /> : null}
            {tab === "delete" ? <DangerPanel calendar={selected} reload={reload} /> : null}
          </Card>
          <Card className="h-fit p-5">
            <p className="mb-3 text-sm font-bold text-slate-500">미리보기</p>
            <div className="flex items-center gap-3">
              <ColorDot color={selected.color} className="h-4 w-4" />
              <div className="min-w-0">
                <h3 className="truncate text-lg font-extrabold">{selected.name}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge color="blue">{selected.visibility === "PRIVATE" ? "비공개" : selected.visibility}</Badge>
                  <RoleBadge role={selected.role} system={selected.type === "SYSTEM_HOLIDAY"} />
                </div>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-500">{selected.description || "설명이 없습니다."}</p>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function BasicForm({ calendar, reload }: { calendar: Calendar; reload: () => Promise<void> }) {
  const [name, setName] = useState(calendar.name);
  const [color, setColor] = useState(calendar.color);
  const [description, setDescription] = useState(calendar.description || "");
  const [visibility, setVisibility] = useState<Visibility>(calendar.visibility);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const readonly = calendar.type === "SYSTEM_HOLIDAY" || !["OWNER", "ADMIN"].includes(calendar.role);

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      await api.updateCalendar(calendar.id, { name, color, description, visibility });
      setMessage("변경사항을 저장했습니다.");
      await reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {readonly ? <div className="rounded-2xl bg-blue-50 p-4 text-sm font-bold text-blue-700">시스템 캘린더 또는 권한이 부족한 캘린더는 기본 정보 수정이 제한됩니다.</div> : null}
      <label className="block space-y-2"><span className="text-sm font-bold">캘린더 이름</span><Input disabled={readonly} value={name} onChange={(e) => setName(e.target.value)} /></label>
      <div className="space-y-2"><span className="text-sm font-bold">색상</span><div className="flex flex-wrap gap-2">{palette.map((item) => <button key={item.value} disabled={readonly} onClick={() => setColor(item.value)} className={`h-9 w-9 rounded-full border-4 ${color === item.value ? "border-slate-900" : "border-white"}`} style={{ backgroundColor: item.value }} />)}</div></div>
      <label className="block space-y-2"><span className="text-sm font-bold">설명</span><Textarea disabled={readonly} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <label className="block space-y-2"><span className="text-sm font-bold">공개상태</span><Select disabled={readonly} value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}><option value="PRIVATE">비공개</option><option value="LINK">링크 접근 가능</option><option value="PUBLIC">공개</option></Select></label>
      {message ? <div className="rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{message}</div> : null}
      <div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => reload()}>취소</Button><Button disabled={saving || readonly || !name.trim()} onClick={save}>{saving ? "저장 중..." : "변경사항 저장"}</Button></div>
    </div>
  );
}

function SharePanel({ calendar, members, memberError, reload, mobile }: { calendar: Calendar; members: CalendarMember[]; memberError: string; reload: () => Promise<void>; mobile?: boolean }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Exclude<Role, "OWNER">>("VIEWER");
  const [saving, setSaving] = useState(false);
  const [savingMemberId, setSavingMemberId] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<"blue" | "rose">("blue");
  const canManage = calendar.type !== "SYSTEM_HOLIDAY" && ["OWNER", "ADMIN"].includes(calendar.role);

  async function add() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!canManage) {
      setMessageTone("rose");
      setMessage("공유 관리는 소유자 또는 관리자만 할 수 있습니다.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setMessageTone("rose");
      setMessage("올바른 이메일 주소를 입력해 주세요.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      await api.share(calendar.id, { email: normalizedEmail, role });
      setEmail("");
      setMessageTone("blue");
      setMessage("공유 사용자를 저장했습니다.");
      await reload();
    } catch (err) {
      setMessageTone("rose");
      setMessage(err instanceof Error ? err.message : "공유하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function update(userId: string, nextRole: Exclude<Role, "OWNER">) {
    setSavingMemberId(userId);
    setMessage("");
    try {
      await api.updateMember(calendar.id, userId, nextRole);
      setMessageTone("blue");
      setMessage("공유 권한을 변경했습니다.");
      await reload();
    } catch (err) {
      setMessageTone("rose");
      setMessage(err instanceof Error ? err.message : "권한을 변경하지 못했습니다.");
    } finally {
      setSavingMemberId("");
    }
  }

  async function remove(userId: string) {
    if (!confirm("공유 사용자를 제거할까요?")) return;
    setSavingMemberId(userId);
    setMessage("");
    try {
      await api.removeMember(calendar.id, userId);
      setMessageTone("blue");
      setMessage("공유 사용자를 제거했습니다.");
      await reload();
    } catch (err) {
      setMessageTone("rose");
      setMessage(err instanceof Error ? err.message : "공유 사용자를 제거하지 못했습니다.");
    } finally {
      setSavingMemberId("");
    }
  }

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <h3 className="mb-3 font-extrabold">사용자 초대</h3>
        {!canManage ? <div className="mb-3 rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">공유 관리는 소유자 또는 관리자만 사용할 수 있습니다.</div> : null}
        <div className={mobile ? "space-y-3" : "grid grid-cols-[1fr_160px_auto] gap-3"}>
          <Input disabled={!canManage} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="이메일 주소" />
          <Select disabled={!canManage} value={role} onChange={(e) => setRole(e.target.value as Exclude<Role, "OWNER">)}><option value="VIEWER">보기</option><option value="EDITOR">편집</option><option value="ADMIN">관리자</option></Select>
          <Button disabled={!canManage || saving || !email.trim()} onClick={add}>{saving ? "추가 중..." : "공유 추가"}</Button>
        </div>
        <p className="mt-3 text-sm text-slate-500">이미 가입된 사용자에게만 캘린더를 공유할 수 있습니다.</p>
      </Card>
      {memberError ? <div className="rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{memberError}</div> : null}
      {message ? <div className={`rounded-2xl p-3 text-sm font-bold ${messageTone === "rose" ? "bg-rose-50 text-rose-700" : "bg-blue-50 text-blue-700"}`}>{message}</div> : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        {members.map((member) => (
          <div key={member.userId} className={mobile ? "space-y-3 border-b border-slate-100 bg-white p-4" : "grid grid-cols-[1fr_1fr_140px_160px] items-center gap-3 border-b border-slate-100 bg-white p-4"}>
            <div><p className="font-bold">{member.displayName}</p><p className="text-sm text-slate-500">{member.email}</p></div>
            {!mobile ? <span className="text-sm text-slate-500">{new Date(member.createdAt).toLocaleString("ko-KR")}</span> : null}
            <RoleBadge role={member.role} />
            <div className="flex gap-2">
              {member.role === "OWNER" ? <Badge color="slate">소유자 변경 불가</Badge> : (
                <>
                  <Select disabled={!canManage || savingMemberId === member.userId} value={member.role} onChange={(e) => update(member.userId, e.target.value as Exclude<Role, "OWNER">)}>
                    <option value="VIEWER">보기</option><option value="EDITOR">편집</option><option value="ADMIN">관리자</option>
                  </Select>
                  <Button variant="danger" disabled={!canManage || savingMemberId === member.userId} onClick={() => remove(member.userId)}>{savingMemberId === member.userId ? "처리 중..." : "제거"}</Button>
                </>
              )}
            </div>
          </div>
        ))}
        {members.length === 0 ? <div className="bg-white p-5 text-sm font-semibold text-slate-500">표시할 공유 사용자가 없습니다.</div> : null}
      </div>
      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">관리자도 소유자를 제거하거나 권한 변경할 수 없습니다.</div>
    </div>
  );
}

function DisplayPanel({ calendar, reload }: { calendar: Calendar; reload: () => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  async function toggle() {
    setSaving(true);
    await api.updateSubscription(calendar.id, calendar.subscriptionStatus === "SUBSCRIBED" ? "HIDDEN" : "SUBSCRIBED");
    await reload();
    setSaving(false);
  }
  return (
    <div className="space-y-4">
      <p className="text-slate-600">내 화면에서 이 캘린더를 표시할지 설정합니다.</p>
      <Button disabled={saving} onClick={toggle}>{calendar.subscriptionStatus === "SUBSCRIBED" ? "숨기기" : "표시하기"}</Button>
    </div>
  );
}

function DangerPanel({ calendar, reload }: { calendar: Calendar; reload: () => Promise<void> }) {
  const canDelete = calendar.role === "OWNER" && calendar.type !== "SYSTEM_HOLIDAY";
  async function remove() {
    if (!confirm("캘린더를 삭제할까요? 관련 일정도 숨김 처리됩니다.")) return;
    await api.deleteCalendar(calendar.id);
    await reload();
  }
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-rose-50 p-4 text-sm font-bold text-rose-700">{canDelete ? "삭제하면 캘린더와 일정이 soft delete 처리됩니다." : "소유자만 삭제할 수 있으며 시스템 캘린더는 삭제할 수 없습니다."}</div>
      <Button variant="danger" disabled={!canDelete} onClick={remove}>캘린더 삭제</Button>
    </div>
  );
}
