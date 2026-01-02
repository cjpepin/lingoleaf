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
    // Parse request
    const { source_lang, target_lang, text }: TranslationRequest = await req.json();

    // Validate input
    if (!source_lang || !target_lang || !text) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
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

    // Initialize Supabase client with service role
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Check cache
    const { data: cached, error: cacheError } = await supabase
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
    await supabase.from('translation_cache').insert({
      source_lang: detectedLang,
      target_lang,
      term_normalized,
      translation,
    });

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

