import "server-only";

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
  const email = user?.email?.trim().toLowerCase();

  if (userError || !email) {
    return {
      state: "anonymous",
      message: "운영자 페이지를 보려면 Google 로그인이 필요합니다.",
      user: null,
      role: null,
      canRunSync: false,
    };
  }

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
