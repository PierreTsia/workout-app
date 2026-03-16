import { corsHeaders } from "../_shared/cors.ts"
import { createServiceClient } from "../_shared/supabase.ts"
import { callGemini } from "./gemini.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabase = createServiceClient()

    // --- Two-layer auth: extract and verify JWT ---
    const authHeader = req.headers.get("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    // --- Parse request body ---
    const body = await req.json()
    const { duration, equipmentCategory, muscleGroups } = body

    if (!duration || !equipmentCategory || !muscleGroups) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: duration, equipmentCategory, muscleGroups" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    // --- Placeholder prompt (T31 will replace with real prompt construction) ---
    const placeholderPrompt = [
      "Return a JSON array of 5 random workout exercise names as strings.",
      `Context: ${duration} minute workout, ${equipmentCategory} equipment, focus: ${muscleGroups.join(", ")}.`,
      `User ID (for reference): ${user.id}`,
    ].join("\n")

    const exerciseIds = await callGemini(placeholderPrompt)

    return new Response(
      JSON.stringify({ exerciseIds }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error"
    const isTimeout = message.includes("abort")

    return new Response(
      JSON.stringify({ error: isTimeout ? "timeout" : message }),
      {
        status: isTimeout ? 504 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    )
  }
})
