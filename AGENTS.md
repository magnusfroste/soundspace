# Agent rules

- Genre/mood normalization lives in `supabase/functions/_shared/metadata.ts` (edge functions) mirrored by `src/lib/metadata.ts` (app + MCP); keep both identical — edge functions cannot import from `src/`.
- Edge-function auth goes through `supabase/functions/_shared/auth.ts` (`authorize`); scheduled jobs authenticate with the `x-cron-secret` header from the private `internal_secrets` table — one gate for user, admin, internal and cron callers.
