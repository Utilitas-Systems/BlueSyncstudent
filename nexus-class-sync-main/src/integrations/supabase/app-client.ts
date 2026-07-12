import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = "https://otfbgtdtzlfvjmohpacm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im90ZmJndGR0emxmdmptb2hwYWNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5MTk0MDYsImV4cCI6MjA3MDQ5NTQwNn0.2HLrQxMeYrwF34nu2ZUFWbqyDhW4afIK4dOOOmomwA4";

/** @deprecated Student app uses session tokens on RPCs — not x-app-user-id headers. */
export function getSupabaseForAppUser(_appUserId?: string | null) {
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
}
