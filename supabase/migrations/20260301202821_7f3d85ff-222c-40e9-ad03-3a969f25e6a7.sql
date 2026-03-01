
ALTER TABLE public.trades
ADD COLUMN sl_pips numeric DEFAULT NULL,
ADD COLUMN tp_pips numeric DEFAULT NULL;
