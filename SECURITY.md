# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| `main`  | Yes       |

## Reporting a vulnerability

Please **do not** open public GitHub issues for security vulnerabilities.

Use one of these channels:

1. **GitHub private vulnerability reporting** (preferred): Repository → Security → Report a vulnerability
2. **Email**: Open a private security advisory via GitHub if email is not listed in the repo profile

Include steps to reproduce, impact, and affected components (client, Edge Functions, Supabase RLS).

We aim to acknowledge reports within 72 hours.

## Pre-public / post-incident credential rotation

If this repository was ever private, or if you suspect a leak, rotate **all** credentials before publishing or continuing operation.

### Supabase (demo project)

1. Dashboard → **Settings → API** → rotate **JWT secret** (invalidates all existing keys)
2. Regenerate **anon key** (safe to embed in mobile clients when RLS is enforced)
3. Regenerate **service role key** (server-only; never commit)
4. Regenerate database password if it was ever copied into chat, logs, or git
5. Re-set Edge Function secrets:
   - `GOOGLE_TRANSLATE_API_KEY`
   - `OPENAI_API_KEY` (optional)
   - `REVENUECAT_SECRET_API_KEY`
   - `REVENUECAT_WEBHOOK_AUTH_HEADER`
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
6. Update local `.env`, EAS project environment variables, and CI secrets

### Legacy Supabase project (early development)

If an old Supabase project from initial prototyping still exists, **pause or delete** it. An anon key from that era may appear in pre-squash git history.

### Third-party services

| Service | Action |
| ------- | ------ |
| Google Cloud (Translate + OAuth) | Rotate API key; restrict OAuth clients by bundle ID / SHA-1 |
| RevenueCat | Rotate iOS SDK key, secret API key, and webhook auth header |
| Resend (SMTP) | Rotate API key |
| OpenAI | Rotate key if used by `study-pack-metadata` |
| EAS | Re-upload client env vars from a fresh `.env` (use local `setup-eas-secrets.sh`, not committed) |

After rotation, update the **Demo credentials** section in [README.md](./README.md) with the new anon URL/key only.

## Safe to publish in client code / README

- `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_KEY` (anon) when RLS is verified
- Google OAuth **client IDs** (already embedded in mobile builds)
- AdMob **test** app IDs (defaults in `app.config.ts`)

## Never publish

- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_TRANSLATE_API_KEY`, `OPENAI_API_KEY`, Resend/SMTP passwords
- `REVENUECAT_SECRET_API_KEY` or webhook authorization header
- Apple signing assets (`.p8`, `.p12`, `.mobileprovision`, `credentials.json`)

## Demo backend hardening

The shared demo backend is rate-limited and RLS-protected:

- Translation Edge Function requires a valid user JWT and enforces per-user hourly limits
- `user_settings.admin`, premium fields, and rate-limit counters are server-managed ([migration 043](./supabase/migrations/043_user_settings_privileged_write_guard.sql))
- Admin book uploads require `admin = true` in the database (not client-settable)

Monitor Supabase auth logs, Edge Function invocations, and Google Translate quotas after going public.

## Local secret scanning

Before pushing:

```bash
npm run security:check
```

Optional: install [gitleaks](https://github.com/gitleaks/gitleaks) and run `gitleaks detect --source .`.
