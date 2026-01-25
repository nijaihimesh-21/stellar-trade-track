-- Add lots and pips columns to strategy_trades table
ALTER TABLE public.strategy_trades
ADD COLUMN lots numeric DEFAULT NULL,
ADD COLUMN pips numeric DEFAULT NULL;