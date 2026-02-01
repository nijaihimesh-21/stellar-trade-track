-- Add SL in pips and TP in pips columns to strategy_trades
ALTER TABLE public.strategy_trades 
ADD COLUMN sl_pips numeric DEFAULT NULL,
ADD COLUMN tp_pips numeric DEFAULT NULL;