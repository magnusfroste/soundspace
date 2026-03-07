
CREATE TABLE public.agent_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL DEFAULT 'New conversation',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own conversations" ON public.agent_conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own conversations" ON public.agent_conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON public.agent_conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON public.agent_conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all conversations" ON public.agent_conversations FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE TABLE public.agent_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.agent_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL DEFAULT '',
  tool_calls jsonb,
  audio_urls text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own messages" ON public.agent_messages FOR SELECT TO authenticated
  USING (conversation_id IN (SELECT id FROM public.agent_conversations WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own messages" ON public.agent_messages FOR INSERT TO authenticated
  WITH CHECK (conversation_id IN (SELECT id FROM public.agent_conversations WHERE user_id = auth.uid()));
CREATE POLICY "Users can delete own messages" ON public.agent_messages FOR DELETE TO authenticated
  USING (conversation_id IN (SELECT id FROM public.agent_conversations WHERE user_id = auth.uid()));
CREATE POLICY "Admins can read all messages" ON public.agent_messages FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'));
