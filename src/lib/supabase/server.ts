import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabasePublicKey,
  hasSupabaseAdminEnv,
  hasSupabasePublicEnv,
} from "@/lib/supabase/env";

let adminServerClient: SupabaseClient | null = null;

export async function getSupabaseServerClient() {
  if (!hasSupabasePublicEnv()) return null;

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    getSupabasePublicKey()!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot mutate cookies; Server Actions can.
          }
        },
      },
    },
  );
}

export function getSupabaseAdminClient() {
  if (!hasSupabaseAdminEnv()) return null;

  adminServerClient ??= createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return adminServerClient;
}
