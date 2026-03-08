
-- Agent Objectives: persistent goals the agent works toward
CREATE TABLE public.agent_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  progress jsonb DEFAULT '{}'::jsonb,
  auto_execute boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own objectives" ON public.agent_objectives FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own objectives" ON public.agent_objectives FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own objectives" ON public.agent_objectives FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own objectives" ON public.agent_objectives FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all objectives" ON public.agent_objectives FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Agent Skills: learned patterns/recipes the agent discovers
CREATE TABLE public.agent_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'generation',
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  use_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own skills" ON public.agent_skills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own skills" ON public.agent_skills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own skills" ON public.agent_skills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own skills" ON public.agent_skills FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all skills" ON public.agent_skills FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- Agent Memories: cross-session context and preferences
CREATE TABLE public.agent_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'preference',
  content text NOT NULL,
  importance integer NOT NULL DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own memories" ON public.agent_memories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own memories" ON public.agent_memories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own memories" ON public.agent_memories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own memories" ON public.agent_memories FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all memories" ON public.agent_memories FOR SELECT USING (has_role(auth.uid(), 'admin'));
