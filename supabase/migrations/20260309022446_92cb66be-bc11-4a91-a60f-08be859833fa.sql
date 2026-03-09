CREATE TABLE public.a2a_request_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL DEFAULT 'unknown',
  skill_id text,
  ip_address text,
  status text NOT NULL DEFAULT 'completed',
  error text,
  result_summary jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.a2a_request_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read a2a logs"
  ON public.a2a_request_logs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service can insert a2a logs"
  ON public.a2a_request_logs FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));