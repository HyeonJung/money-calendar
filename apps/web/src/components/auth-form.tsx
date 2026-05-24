"use client";

import { api, setToken } from "@/lib/api";
import { Button, Card, Input } from "@/components/ui";
import { CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useState } from "react";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const [email, setEmail] = useState(mode === "login" ? "owner@example.com" : "");
  const [password, setPassword] = useState("password");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result =
        mode === "login"
          ? await api.login({ email, password })
          : await api.register({ email, password, displayName });
      setToken(result.accessToken);
      router.push("/calendar");
    } catch (err) {
      setError(err instanceof Error ? err.message : "요청 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#dbeafe,transparent_34%),#f6f8fb] px-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#0B3B91] text-white">
            <CalendarDays />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-950">캘린더 SaaS</h1>
            <p className="text-sm text-slate-500">한국형 캘린더 MVP</p>
          </div>
        </div>
        <form className="space-y-4" onSubmit={submit}>
          {mode === "register" ? (
            <label className="block space-y-2">
              <span className="text-sm font-semibold text-slate-700">표시 이름</span>
              <Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required placeholder="예: 김민수" />
            </label>
          ) : null}
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-700">이메일</span>
            <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="owner@example.com" />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-700">비밀번호</span>
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="password" />
          </label>
          {error ? <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{error}</div> : null}
          <Button className="w-full" disabled={loading}>
            {loading ? "처리 중..." : mode === "login" ? "로그인" : "회원가입"}
          </Button>
        </form>
        <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-bold text-slate-800">개발용 계정</p>
          <p>owner@example.com / password</p>
          <p>admin@example.com / password</p>
        </div>
        <a className="mt-5 block text-center text-sm font-semibold text-[#0B3B91]" href={mode === "login" ? "/register" : "/login"}>
          {mode === "login" ? "계정이 없나요? 회원가입" : "이미 계정이 있나요? 로그인"}
        </a>
      </Card>
    </main>
  );
}
