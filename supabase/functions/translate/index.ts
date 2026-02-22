/**
 * Translation Edge Function
 * Translates text using Google Translate API with aggressive caching
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const GOOGLE_TRANSLATE_API_KEY = Deno.env.get('GOOGLE_TRANSLATE_API_KEY');
// Supabase automatically provides these environment variables in Edge Functions
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('SUPABASE_PROJECT_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_KEY');

interface TranslationRequest {
  source_lang: string;
  target_lang: string;
  text: string;
}

interface TranslationResponse {
  term: string;
  term_normalized: string;
  translation: string;
  from_cache: boolean;
  detected_lang?: string;
  same_language?: boolean;
}

const VALID_LANGS = new Set([
  'af','am','ar','az','be','bg','bn','bs','ca','ceb','co','cs','cy','da','de',
  'el','en','eo','es','et','eu','fa','fi','fil','fr','fy','ga','gd','gl','gu',
  'ha','haw','he','hi','hmn','hr','ht','hu','hy','id','ig','is','it','ja','jv',
  'ka','kk','km','kn','ko','ku','ky','la','lb','lo','lt','lv','mg','mi','mk',
  'ml','mn','mr','ms','mt','my','ne','nl','no','ny','or','pa','pl','ps','pt',
  'ro','ru','rw','sd','si','sk','sl','sm','sn','so','sq','sr','st','su','sv',
  'sw','ta','te','tg','th','tk','tl','tr','tt','ug','uk','ur','uz','vi','xh',
  'yi','yo','zh','zh-CN','zh-TW','zu',
]);

serve(async (req) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  try {
    // ── Auth check: require a valid Supabase JWT ──
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !userData?.user?.id) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired session' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Rate limit: max 200 non-cached translations per user per hour ──
    const userId = userData.user.id;
    const RATE_LIMIT = 200;
    const WINDOW_MS = 60 * 60 * 1000; // 1 hour
    const now = Date.now();
    const { data: rl } = await supabaseAdmin
      .from('user_settings')
      .select('translate_count, translate_window_start')
      .eq('user_id', userId)
      .single();
    const windowStart = rl?.translate_window_start ? Date.parse(rl.translate_window_start) : 0;
    const count = (rl?.translate_count as number) ?? 0;
    const inWindow = now - windowStart < WINDOW_MS;
    if (inWindow && count >= RATE_LIMIT) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Try again later.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request
    const { source_lang, target_lang, text }: TranslationRequest = await req.json();

    // Validate input
    if (!source_lang || !target_lang || !text) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate language codes against allowlist
    if (!VALID_LANGS.has(source_lang) || !VALID_LANGS.has(target_lang)) {
      return new Response(
        JSON.stringify({ error: 'Invalid language code' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate length
    const term = text.trim();
    if (term.length > 100) {
      return new Response(
        JSON.stringify({ error: 'Text too long (max 100 characters)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Normalize for cache key
    const term_normalized = term.toLowerCase();

    // Check cache
    const { data: cached, error: cacheError } = await supabaseAdmin
      .from('translation_cache')
      .select('translation')
      .eq('source_lang', source_lang)
      .eq('target_lang', target_lang)
      .eq('term_normalized', term_normalized)
      .single();

    if (cached && !cacheError) {
      const response: TranslationResponse = {
        term,
        term_normalized,
        translation: cached.translation,
        from_cache: true,
      };

      return new Response(JSON.stringify(response), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Cache miss - call Google Translate API
    if (!GOOGLE_TRANSLATE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Translation API not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Detect the actual language of the text
    const detectUrl = `https://translation.googleapis.com/language/translate/v2/detect?key=${GOOGLE_TRANSLATE_API_KEY}`;
    const detectResponse = await fetch(detectUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: term }),
    });

    let detectedLang = source_lang;
    if (detectResponse.ok) {
      const detectData = await detectResponse.json();
      detectedLang = detectData.data.detections[0][0].language;
      console.log(`Detected language: ${detectedLang} (book says: ${source_lang})`);
    }

    // Step 2: Handle same-language case gracefully
    let translation: string;
    if (detectedLang === target_lang) {
      // Same language - return the original text with a note
      translation = `${term} (same language - no translation needed)`;
      console.log(`Same language detected: ${detectedLang}`);
    } else {
      // Different language - translate
      const googleUrl = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`;
      const googleResponse = await fetch(googleUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: term,
          source: detectedLang, // Use detected language, not book's source_lang
          target: target_lang,
          format: 'text',
        }),
      });

      if (!googleResponse.ok) {
        const errorText = await googleResponse.text();
        console.error('Google Translate API error:', errorText);
        return new Response(
          JSON.stringify({ error: 'Translation failed' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const googleData = await googleResponse.json();
      translation = googleData.data.translations[0].translatedText;
    }

    // Store in cache (use detected language for cache key)
    await supabaseAdmin.from('translation_cache').insert({
      source_lang: detectedLang,
      target_lang,
      term_normalized,
      translation,
    });

    // Increment rate-limit counter (only for cache misses that hit Google API)
    const newCount = inWindow ? count + 1 : 1;
    const newWindow = inWindow ? new Date(windowStart).toISOString() : new Date(now).toISOString();
    await supabaseAdmin
      .from('user_settings')
      .update({ translate_count: newCount, translate_window_start: newWindow })
      .eq('user_id', userId);

    const response: TranslationResponse = {
      term,
      term_normalized,
      translation,
      from_cache: false,
      detected_lang: detectedLang,
      same_language: detectedLang === target_lang,
    };

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Translation error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

