import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// NOTE: Lovable does not support VITE_* env vars. Keep these constants in-sync with src/integrations/supabase/client.ts
const SUPABASE_URL = "https://otfbgtdtzlfvjmohpacm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90ZmJndGR0emxmdmptb2hwYWNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MTk0MDYsImV4cCI6MjA3MDQ5NTQwNn0.2HLrQxMeYrwF34nu2ZUFWbqyDhW4afIK4dOOOmomwA4";

/**
 * Creates a Supabase client that sends the custom app user id on every request.
 * This allows RLS policies that rely on public.current_user_id() to work per HTTP request.
 */
export function getSupabaseForAppUser(appUserId?: string | null) {
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
    global: {
      headers: appUserId ? { "x-app-user-id": appUserId } : {},
    },
  });
}
