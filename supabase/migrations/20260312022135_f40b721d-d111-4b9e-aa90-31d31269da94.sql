
-- Create a security definer function to update the pg_cron schedule
CREATE OR REPLACE FUNCTION public.update_agent_cron_schedule(new_schedule text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron, net
AS $$
DECLARE
  existing_jobid bigint;
  anon_key text;
  project_url text;
BEGIN
  -- Find existing agent-cron job
  SELECT jobid INTO existing_jobid FROM cron.job WHERE jobname = 'agent-objectives-nightly';
  
  -- Unschedule if exists
  IF existing_jobid IS NOT NULL THEN
    PERFORM cron.unschedule(existing_jobid);
  END IF;

  -- Get project URL from existing config or use known URL
  project_url := current_setting('app.settings.supabase_url', true);
  IF project_url IS NULL OR project_url = '' THEN
    project_url := 'https://labyxrmiqjinatvpqoto.supabase.co';
  END IF;

  -- Re-schedule with new cron expression
  PERFORM cron.schedule(
    'agent-objectives-nightly',
    new_schedule,
    format(
      $cron$
      SELECT net.http_post(
        url:='%s/functions/v1/agent-cron',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhYnl4cm1pcWppbmF0dnBxb3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1ODA5MzAsImV4cCI6MjA4NjE1NjkzMH0.xNRe_eru9hszvCtAjzGN2MCwX8UVnRHG7_m646vwTLg"}'::jsonb,
        body:='{"time": "nightly"}'::jsonb
      ) AS request_id;
      $cron$,
      project_url
    )
  );
END;
$$;
