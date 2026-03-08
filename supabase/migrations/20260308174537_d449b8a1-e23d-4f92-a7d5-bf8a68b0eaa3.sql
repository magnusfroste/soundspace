
CREATE TABLE public.agent_cron_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  objective_id uuid REFERENCES public.agent_objectives(id) ON DELETE SET NULL,
  objective_title text,
  status text NOT NULL DEFAULT 'completed',
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_cron_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read cron logs" ON public.agent_cron_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert cron logs" ON public.agent_cron_logs
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
