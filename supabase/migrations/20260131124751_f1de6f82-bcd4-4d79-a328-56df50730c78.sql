-- Add notes column to strategy_trades table
ALTER TABLE public.strategy_trades
ADD COLUMN notes text;