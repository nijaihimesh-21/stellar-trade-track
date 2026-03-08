
CREATE TABLE public.monthly_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  starting_balance numeric NOT NULL DEFAULT 0,
  is_global boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, year, month)
);

ALTER TABLE public.monthly_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own balances" ON public.monthly_balances FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own balances" ON public.monthly_balances FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own balances" ON public.monthly_balances FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own balances" ON public.monthly_balances FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_monthly_balances_updated_at BEFORE UPDATE ON public.monthly_balances FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
