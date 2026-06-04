"use server";

import { redirect } from "next/navigation";
import type { ExplorerData } from "@/lib/domain/types";
import { persistExplorerData } from "@/lib/data/repository-server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function saveExplorerDataAction(data: ExplorerData) {
  await persistExplorerData(data);
}

export async function signInAdminAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = await getSupabaseServerClient();

  if (!supabase) {
    redirect("/admin?error=missing-supabase");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect("/admin?error=invalid-login");
  }

  redirect("/admin");
}

export async function signOutAdminAction() {
  const supabase = await getSupabaseServerClient();
  await supabase?.auth.signOut();
  redirect("/admin");
}
