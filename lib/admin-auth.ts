import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { createSupabaseAuthServerClient, createSupabaseServiceRoleClient } from "./supabase-server";

export type AdminRole = "admin" | "viewer";

export type AdminAccess =
  | {
      state: "missing-env";
      message: string;
      user: null;
      role: null;
      canRunSync: false;
    }
  | {
      state: "anonymous";
      message: string;
      user: null;
      role: null;
      canRunSync: false;
    }
  | {
      state: "setup-required";
      message: string;
      user: {
        email: string;
      } | null;
      role: null;
      canRunSync: false;
    }
  | {
      state: "forbidden";
      message: string;
      user: {
        email: string;
      };
      role: null;
      canRunSync: false;
    }
  | {
      state: "authorized";
      message: string;
      user: {
        email: string;
      };
      role: AdminRole;
      canRunSync: boolean;
    };

type AdminUserRow = {
  email: string;
  role: AdminRole;
  is_active: boolean;
};

const ADMIN_SESSION_COOKIE = "money_calendar_admin_session";
const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const ADMIN_ACTION_TOKEN_MAX_AGE_SECONDS = 60 * 10;

export async function getAdminAccess(): Promise<AdminAccess> {
  const authClient = await createSupabaseAuthServerClient();

  if (!authClient) {
    return {
      state: "missing-env",
      message: "Supabase URL 또는 anon key가 설정되어 있지 않습니다.",
      user: null,
      role: null,
      canRunSync: false,
    };
  }

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();
  const email =
    user?.email?.trim().toLowerCase() ?? (await readAdminSessionEmail());

  if ((userError && !email) || !email) {
    return {
      state: "anonymous",
      message: "운영자 페이지를 보려면 Google 로그인이 필요합니다.",
      user: null,
      role: null,
      canRunSync: false,
    };
  }

  if (user?.email) {
    await setAdminSessionCookie(email);
  }

  return getAdminAccessForEmail(email);
}

export async function getAdminAccessFromActionToken(token: string): Promise<AdminAccess> {
  const email = verifySignedEmailValue(token, "action");
  if (!email) {
    return {
      state: "anonymous",
      message: "운영자 페이지를 보려면 Google 로그인이 필요합니다.",
      user: null,
      role: null,
      canRunSync: false,
    };
  }

  return getAdminAccessForEmail(email);
}

export function createAdminActionToken(email: string) {
  return createSignedEmailValue(email, "action", ADMIN_ACTION_TOKEN_MAX_AGE_SECONDS) ?? "";
}

async function getAdminAccessForEmail(email: string): Promise<AdminAccess> {
  const serviceClient = createSupabaseServiceRoleClient();

  if (!serviceClient) {
    return {
      state: "setup-required",
      message: "SUPABASE_SERVICE_ROLE_KEY가 없어 관리자 권한을 확인할 수 없습니다.",
      user: { email },
      role: null,
      canRunSync: false,
    };
  }

  const { data, error } = await serviceClient
    .from("admin_users")
    .select("email, role, is_active")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    return {
      state: "setup-required",
      message:
        "admin_users 테이블을 조회하지 못했습니다. Supabase 스키마가 적용되어 있는지 확인해 주세요.",
      user: { email },
      role: null,
      canRunSync: false,
    };
  }

  const adminUser = data as AdminUserRow | null;

  if (!adminUser || !adminUser.is_active) {
    return {
      state: "forbidden",
      message: "이 Google 계정은 운영자 권한이 없습니다.",
      user: { email },
      role: null,
      canRunSync: false,
    };
  }

  return {
    state: "authorized",
    message: "운영자 권한이 확인되었습니다.",
    user: { email },
    role: adminUser.role,
    canRunSync: adminUser.role === "admin",
  };
}

export async function setAdminSessionCookie(email: string) {
  const signedValue = createSignedEmailValue(email, "session", ADMIN_SESSION_MAX_AGE_SECONDS);
  if (!signedValue) {
    return;
  }

  try {
    const cookieStore = await cookies();
    cookieStore.set(ADMIN_SESSION_COOKIE, signedValue, {
      httpOnly: true,
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  } catch {
    // Server Components cannot always write cookies. Auth route handlers and
    // Server Actions will refresh this cookie when they can.
  }
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
}

async function readAdminSessionEmail() {
  const cookieStore = await cookies();
  const value = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!value) {
    return null;
  }

  return verifyAdminSessionValue(value);
}

function createSignedEmailValue(
  email: string,
  kind: "session" | "action",
  maxAgeSeconds: number,
) {
  const secret = getAdminSessionSecret();
  const normalizedEmail = email.trim().toLowerCase();
  if (!secret || !normalizedEmail) {
    return null;
  }

  const payload = base64UrlEncode(
    JSON.stringify({
      email: normalizedEmail,
      exp: Date.now() + maxAgeSeconds * 1000,
      kind,
    }),
  );
  const signature = signPayload(payload, secret);

  return `${payload}.${signature}`;
}

function verifyAdminSessionValue(value: string) {
  return verifySignedEmailValue(value, "session");
}

function verifySignedEmailValue(value: string, expectedKind: "session" | "action") {
  const secret = getAdminSessionSecret();
  if (!secret) {
    return null;
  }

  const [payload, signature] = value.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expectedSignature = signPayload(payload, secret);
  if (!safeEqual(signature, expectedSignature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(base64UrlDecode(payload)) as {
      email?: string;
      exp?: number;
      kind?: string;
    };
    const email = parsed.email?.trim().toLowerCase();
    if (
      !email ||
      !parsed.exp ||
      parsed.exp < Date.now() ||
      parsed.kind !== expectedKind
    ) {
      return null;
    }

    return email;
  } catch {
    return null;
  }
}

function getAdminSessionSecret() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.CRON_SECRET?.trim() ??
    ""
  );
}

function signPayload(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}
