
import { supabase } from "@/integrations/supabase/client";

/**
 * Calls Supabase edge function to get translation, using user auth.
 */
export async function translateText(
  text: string,
  fromLang = "en",
  toLang = "es"
): Promise<string> {
  if (!text) return "";

  // Get the current auth session for Bearer token
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return "(Please log in to translate)";
  }

  try {
    const res = await fetch(
      `https://txiqsanfzgohobqoqrjr.functions.supabase.co/translate_and_cache`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          from_lang: fromLang,
          to_lang: toLang,
        }),
      }
    );
    const data = await res.json();
    if (!res.ok || data?.error) {
      return `(Translation failed: ${data.error || res.status})`;
    }
    return data.translation || "";
  } catch (err) {
    return "(Translation error)";
  }
}
