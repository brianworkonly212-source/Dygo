import { AdminPanel } from "@/components/admin/admin-panel";
import { getExplorerData } from "@/lib/data/repository-server";
import { hasSupabaseAdminEnv, hasSupabasePublicEnv } from "@/lib/supabase/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  saveExplorerDataAction,
  signInAdminAction,
  signOutAdminAction,
} from "@/app/admin/actions";

export const dynamic = "force-dynamic";

async function canAccessAdmin() {
  if (!hasSupabasePublicEnv()) {
    return {
      allowed: process.env.NODE_ENV !== "production",
      reason: process.env.NODE_ENV === "production" ? "missing-env" : null,
      userEmail: null,
    } as const;
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return { allowed: false, reason: "missing-env", userEmail: null } as const;
  }

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return { allowed: false, reason: "signed-out", userEmail: null } as const;
  }

  const role = data.user?.app_metadata?.role ?? data.user?.user_metadata?.role;
  return {
    allowed: role === "admin",
    reason: role === "admin" ? null : "not-admin",
    userEmail: data.user.email ?? null,
  } as const;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const access = await canAccessAdmin();
  if (!access.allowed) {
    const params = await searchParams;
    return (
      <AdminAuthGate
        error={params?.error}
        reason={access.reason}
        userEmail={access.userEmail}
      />
    );
  }

  const data = await getExplorerData();

  return (
    <div className="relative min-h-screen">
      {hasSupabasePublicEnv() ? (
        <form action={signOutAdminAction} className="fixed right-4 top-4 z-50">
          <button
            type="submit"
            className="rounded-[6px] border border-[#c8beb5] bg-white px-3 py-2 text-sm font-semibold text-[#2f2c29] shadow-sm hover:bg-[#f4f1ec]"
          >
            Đăng xuất
          </button>
        </form>
      ) : null}
      <AdminPanel
        data={data}
        onPersist={hasSupabaseAdminEnv() ? saveExplorerDataAction : undefined}
      />
    </div>
  );
}

function AdminAuthGate({
  error,
  reason,
  userEmail,
}: {
  error?: string;
  reason: "missing-env" | "signed-out" | "not-admin" | null;
  userEmail: string | null;
}) {
  const message = getAdminAuthMessage(error, reason, userEmail);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f8f9fb] px-6 text-[#2f2c29]">
      <section className="w-full max-w-md rounded-[8px] border border-[#d7dce3] bg-white p-6 shadow-xl">
        <h1 className="font-display text-3xl font-bold">Đăng nhập admin</h1>
        <p className="mt-3 text-sm leading-6">{message}</p>
        {hasSupabasePublicEnv() ? (
          <form action={signInAdminAction} className="mt-6 grid gap-4">
            <label className="grid gap-2 text-sm font-semibold">
              Email
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                className="h-11 rounded-[4px] border border-[#2f2c29] px-3 text-base font-medium outline-none focus:ring-2 focus:ring-[#3923C3]"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Password
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="h-11 rounded-[4px] border border-[#2f2c29] px-3 text-base font-medium outline-none focus:ring-2 focus:ring-[#3923C3]"
              />
            </label>
            <button
              type="submit"
              className="mt-2 h-12 rounded-[6px] bg-[#FDDD51] font-semibold text-[#2f2c29] hover:bg-[#FDDD51]/90"
            >
              Đăng nhập
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}

function getAdminAuthMessage(
  error: string | undefined,
  reason: "missing-env" | "signed-out" | "not-admin" | null,
  userEmail: string | null,
) {
  if (error === "invalid-login") return "Email hoặc password không đúng.";
  if (error === "missing-supabase") return "Chưa cấu hình Supabase env cho admin.";
  if (reason === "missing-env") return "Production cần Supabase env trước khi mở admin.";
  if (reason === "not-admin") {
    return `${userEmail ?? "User này"} đã đăng nhập nhưng chưa có role admin.`;
  }
  return "Trang admin yêu cầu Supabase Auth user có role admin.";
}
