import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log("Supabase URL cargada:", supabaseUrl);
console.log("Supabase key cargada:", supabaseKey ? "SI" : "NO");

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);