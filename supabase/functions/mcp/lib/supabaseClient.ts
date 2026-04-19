import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const url = Deno.env.get("SUPABASE_URL")
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")

if (!url || !anonKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables")
}

export function createUserClient(authHeader: string) {
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
}
