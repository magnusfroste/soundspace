-- Säkerhetssvep 2026-10-17 (redan tillämpad och testad).
-- site_settings var läsbar för alla, även nycklarna openclaw_api_token (ger rätt att ladda upp
-- låtar via upload-song), mcp_api_token och module:api_tokens. Nu ser bara admin de raderna;
-- övriga inställningar är publika som förut. Edge-funktionerna läser via service role.
drop policy if exists "Anyone can read site settings" on public.site_settings;
create policy "Anyone can read site settings" on public.site_settings for select
  using (key not in ('openclaw_api_token', 'mcp_api_token', 'module:api_tokens')
         or public.has_role(auth.uid(), 'admin'::app_role));
