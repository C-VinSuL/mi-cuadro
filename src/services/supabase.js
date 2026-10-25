import { createClient } from "@supabase/supabase-js";

const runtimeEnv =
  typeof import.meta !== "undefined" && import.meta.env
    ? import.meta.env
    : process.env;

const supabaseUrl = (runtimeEnv?.VITE_SUPABASE_URL ?? "").trim();
const supabaseKey = (runtimeEnv?.VITE_SUPABASE_ANON_KEY ?? "").trim();
const browserUserAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";

export const supabase = createClient(
  supabaseUrl,
  supabaseKey,
  {
    global: {
      headers: browserUserAgent ? { "x-browser-user-agent": browserUserAgent } : {}
    },
    auth: {
      flowType: "pkce",
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true
    }
  }
);
