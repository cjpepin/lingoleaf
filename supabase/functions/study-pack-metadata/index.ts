/**
 * Study Pack Metadata Edge Function
 *
 * Generates lightweight pack framing copy with optional OpenAI metadata.
 * If OpenAI is not configured, callers should fall back client-side.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_MODEL = Deno.env.get('OPENAI_MODEL') || 'gpt-5.2';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('SUPABASE_PROJECT_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_KEY');

interface StudyPackMetadataWordInput {
  term: string;
  translation: string;
  context_snippet: string | null;
  source_lang: string;
  target_lang: string;
  list_name?: string | null;
}

interface StudyPackMetadataRequest {
  words: StudyPackMetadataWordInput[];
  review_count: number;
  new_count: number;
}

interface StudyPackMetadataResponse {
  title: string;
  coachLine: string;
  groups?: string[];
  source: 'ai' | 'fallback';
  fallbackReason?: string;
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function buildFallbackMetadata(
  reviewCount: number,
  newCount: number,
  reason: string,
): StudyPackMetadataResponse {
  return {
    title: "Today's Focus Pack",
    coachLine: `${reviewCount} ${pluralize(reviewCount, 'review card', 'review cards')}, ${newCount} ${pluralize(newCount, 'new card', 'new cards')}.`,
    groups: [],
    source: 'fallback',
    fallbackReason: reason,
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });
}

function extractOutputText(data: any): string | null {
  if (typeof data?.output_text === 'string' && data.output_text.length > 0) {
    return data.output_text;
  }

  const outputs = Array.isArray(data?.output) ? data.output : [];
  for (const output of outputs) {
    const contents = Array.isArray(output?.content) ? output.content : [];
    for (const content of contents) {
      if (typeof content?.text === 'string' && content.text.length > 0) {
        return content.text;
      }
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return json(200, { ok: true });
  }

  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) {
      return json(401, { error: 'Missing Authorization header' });
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !userData?.user?.id) {
      return json(401, { error: 'Invalid or expired session' });
    }

    const body = (await req.json()) as StudyPackMetadataRequest;
    const words = Array.isArray(body.words) ? body.words.slice(0, 15) : [];
    if (words.length === 0) {
      return json(400, { error: 'Missing words' });
    }
    const fallbackFor = (reason: string) => buildFallbackMetadata(body.review_count, body.new_count, reason);

    if (!OPENAI_API_KEY) {
      console.warn('study-pack-metadata: OPENAI_API_KEY not configured, using fallback metadata');
      return json(200, fallbackFor('missing_openai_api_key'));
    }

    const input = [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text:
              'You generate short, warm study-pack metadata for a language-learning app. Return JSON only. Keep title under 8 words. Keep coachLine under 18 words. Be calm, encouraging, and specific. Never mention AI.',
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: JSON.stringify({
              review_count: body.review_count,
              new_count: body.new_count,
              words,
            }),
          },
        ],
      },
    ];

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        input,
        max_output_tokens: 200,
        text: {
          format: {
            type: 'json_schema',
            name: 'study_pack_metadata',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                title: { type: 'string' },
                coachLine: { type: 'string' },
                groups: {
                  type: 'array',
                  items: { type: 'string' },
                },
              },
              required: ['title', 'coachLine', 'groups'],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn('study-pack-metadata: OpenAI request failed, using fallback metadata', errorText);
      return json(200, fallbackFor('openai_request_failed'));
    }

    const data = await response.json();
    const outputText = extractOutputText(data);
    if (!outputText) {
      console.warn('study-pack-metadata: OpenAI response missing output text, using fallback metadata');
      return json(200, fallbackFor('openai_output_missing'));
    }

    let parsed: StudyPackMetadataResponse;
    try {
      parsed = JSON.parse(outputText) as StudyPackMetadataResponse;
    } catch (error) {
      console.warn('study-pack-metadata: Failed parsing OpenAI response JSON, using fallback metadata', error);
      return json(200, fallbackFor('openai_parse_failed'));
    }

    if (!parsed?.title || !parsed?.coachLine) {
      console.warn('study-pack-metadata: OpenAI response missing required fields, using fallback metadata');
      return json(200, fallbackFor('openai_missing_fields'));
    }

    return json(200, {
      title: parsed.title,
      coachLine: parsed.coachLine,
      groups: Array.isArray(parsed.groups) ? parsed.groups.slice(0, 3) : [],
      source: 'ai',
    } satisfies StudyPackMetadataResponse);
  } catch (error) {
    return json(500, { error: String((error as Error)?.message ?? error) });
  }
});
