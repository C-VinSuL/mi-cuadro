import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();
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
