
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.5"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders })
  }

  let body
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: corsHeaders })
  }

  const { text, from_lang = "en", to_lang = "es" } = body
  if (!text || typeof text !== "string" || !to_lang) {
    return new Response(JSON.stringify({ error: "Missing or invalid parameters: 'text' and 'to_lang' required." }), {
      status: 400, headers: corsHeaders
    })
  }

  // Get API key and Supabase env vars
  const GOOGLE_TRANSLATE_KEY = Deno.env.get("GOOGLE_TRANSLATE_API_KEY")
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  if (!GOOGLE_TRANSLATE_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: "Missing environment variables." }), { status: 500, headers: corsHeaders })
  }

  // Create Supabase Admin client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Get invoking user's id
  const authHeader = req.headers.get("Authorization")
  let user_id: string | undefined = undefined
  if (authHeader && authHeader.startsWith("Bearer ")) {
    // verify JWT using Supabase
    try {
      const { data } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""))
      if (data?.user?.id) user_id = data.user.id
    } catch {
      // no user
    }
  }
  if (!user_id) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), { status: 401, headers: corsHeaders });
  }

  // 1. Check cache for translation
  const { data: cache, error: cacheError } = await supabase
    .from("translations_cache")
    .select()
    .eq("original_text", text)
    .eq("from_lang", from_lang)
    .eq("to_lang", to_lang)
    .eq("user_id", user_id)
    .maybeSingle()
  if (cache) {
    return new Response(JSON.stringify({
      translation: cache.translated_text,
      source: "cache"
    }), { status: 200, headers: corsHeaders });
  }

  // 2. If not found, call Google Translate API
  let translated: string | undefined

  try {
    const resp = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: text,
          source: from_lang,
          target: to_lang,
          format: "text",
        }),
      }
    )
    const result = await resp.json()
    if (result?.data?.translations?.length > 0) {
      translated = result.data.translations[0].translatedText
    }
  } catch (err) {
    // fallback error handling below
  }

  if (!translated) {
    return new Response(JSON.stringify({ error: "Translation failed" }), { status: 500, headers: corsHeaders })
  }

  // 3. Save to cache
  await supabase.from("translations_cache").insert({
    original_text: text,
    translated_text: translated,
    from_lang,
    to_lang,
    user_id,
    translation_source: "api"
  })

  return new Response(JSON.stringify({
    translation: translated,
    source: "api"
  }), { status: 200, headers: corsHeaders })
})
