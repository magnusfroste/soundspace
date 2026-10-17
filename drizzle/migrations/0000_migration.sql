-- Protect secret tokens in site_settings
DROP POLICY IF EXISTS "Anyone can read site settings" ON public.site_settings;
CREATE POLICY "Anyone can read non-secret site settings" ON public.site_settings
  FOR SELECT USING (key NOT IN ('openclaw_api_token','mcp_api_token','module:api_tokens','a2a_bearer_token'));
CREATE POLICY "Admins can read all site settings" ON public.site_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Private secrets table for scheduled jobs
CREATE TABLE IF NOT EXISTS public.internal_secrets (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.internal_secrets FROM anon, authenticated;
GRANT ALL ON public.internal_secrets TO service_role;
ALTER TABLE public.internal_secrets ENABLE ROW LEVEL SECURITY;

INSERT INTO public.internal_secrets (key, value)
VALUES ('cron_secret', encode(extensions.gen_random_bytes(32), 'hex'))
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.update_agent_cron_schedule(new_schedule text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'cron', 'net'
AS $function$
DECLARE
  existing_jobid bigint;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT jobid INTO existing_jobid FROM cron.job WHERE jobname = 'agent-objectives-nightly';
  IF existing_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(existing_jobid);
  END IF;

  PERFORM cron.schedule(
    'agent-objectives-nightly',
    new_schedule,
    $cron$
    SELECT net.http_post(
      url:='https://labyxrmiqjinatvpqoto.supabase.co/functions/v1/agent-cron',
      headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',(SELECT value FROM public.internal_secrets WHERE key='cron_secret')),
      body:='{"time": "nightly"}'::jsonb
    ) AS request_id;
    $cron$
  );
END;
$function$;

DO $$
DECLARE s text;
BEGIN
  SELECT schedule INTO s FROM cron.job WHERE jobname='agent-objectives-nightly';
  PERFORM cron.unschedule('agent-objectives-nightly') WHERE s IS NOT NULL;
  PERFORM cron.schedule('agent-objectives-nightly', coalesce(s,'0 3 * * *'), $c$
    SELECT net.http_post(
      url:='https://labyxrmiqjinatvpqoto.supabase.co/functions/v1/agent-cron',
      headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',(SELECT value FROM public.internal_secrets WHERE key='cron_secret')),
      body:='{"time": "nightly"}'::jsonb
    ) AS request_id;
  $c$);

  SELECT schedule INTO s FROM cron.job WHERE jobname='cleanup-trash-daily';
  PERFORM cron.unschedule('cleanup-trash-daily') WHERE s IS NOT NULL;
  PERFORM cron.schedule('cleanup-trash-daily', coalesce(s,'0 3 * * *'), $c$
    SELECT net.http_post(
      url:='https://labyxrmiqjinatvpqoto.supabase.co/functions/v1/cleanup-trash',
      headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',(SELECT value FROM public.internal_secrets WHERE key='cron_secret')),
      body:='{}'::jsonb
    ) AS request_id;
  $c$);
END $$;