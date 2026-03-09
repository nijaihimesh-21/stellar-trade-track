
CREATE TABLE public.psychology_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  period_type TEXT NOT NULL DEFAULT 'weekly',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  title TEXT,
  mental_state TEXT,
  emotions TEXT,
  lessons_learned TEXT,
  improvements TEXT,
  notes TEXT,
  rating INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.psychology_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own entries" ON public.psychology_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own entries" ON public.psychology_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own entries" ON public.psychology_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own entries" ON public.psychology_entries FOR DELETE USING (auth.uid() = user_id);
