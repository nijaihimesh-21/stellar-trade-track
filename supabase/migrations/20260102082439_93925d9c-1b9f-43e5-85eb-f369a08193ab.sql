-- Create strategies table
CREATE TABLE public.strategies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  market TEXT NOT NULL DEFAULT 'Forex',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for strategies
CREATE POLICY "Users can view their own strategies"
ON public.strategies
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own strategies"
ON public.strategies
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own strategies"
ON public.strategies
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own strategies"
ON public.strategies
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates on strategies
CREATE TRIGGER update_strategies_updated_at
BEFORE UPDATE ON public.strategies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create strategy_trades table
CREATE TABLE public.strategy_trades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  strategy_id UUID NOT NULL REFERENCES public.strategies(id) ON DELETE CASCADE,
  pair TEXT NOT NULL,
  direction TEXT NOT NULL,
  trade_date DATE NOT NULL,
  trade_time TIME NOT NULL,
  session TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  stop_loss NUMERIC,
  take_profit NUMERIC,
  result TEXT NOT NULL,
  pnl NUMERIC DEFAULT 0,
  risk_reward NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.strategy_trades ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for strategy_trades
CREATE POLICY "Users can view their own strategy trades"
ON public.strategy_trades
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own strategy trades"
ON public.strategy_trades
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own strategy trades"
ON public.strategy_trades
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own strategy trades"
ON public.strategy_trades
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates on strategy_trades
CREATE TRIGGER update_strategy_trades_updated_at
BEFORE UPDATE ON public.strategy_trades
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();