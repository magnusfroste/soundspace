-- Seed MCP API token row in site_settings if missing.
-- The actual token value will be generated/rotated from the admin UI.
INSERT INTO public.site_settings (key, value)
VALUES ('mcp_api_token', '{"token": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;