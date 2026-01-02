import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface LogTradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategyId: string;
}

const PAIRS = [
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD",
  "EURGBP", "EURJPY", "GBPJPY", "XAUUSD", "BTCUSD", "ETHUSD"
];

const LogTradeModal: React.FC<LogTradeModalProps> = ({
  open,
  onOpenChange,
  strategyId,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    pair: "EURUSD",
    direction: "Buy",
    trade_date: new Date().toISOString().split("T")[0],
    trade_time: "09:00",
    session: "London",
    entry_price: "",
    stop_loss: "",
    take_profit: "",
    result: "Win",
    pnl: "",
  });

  const createTrade = useMutation({
    mutationFn: async () => {
      const entry = parseFloat(formData.entry_price);
      const sl = formData.stop_loss ? parseFloat(formData.stop_loss) : null;
      const tp = formData.take_profit ? parseFloat(formData.take_profit) : null;
      
      // Calculate R:R
      let riskReward = null;
      if (sl && tp && entry) {
        const risk = Math.abs(entry - sl);
        const reward = Math.abs(tp - entry);
        riskReward = risk > 0 ? reward / risk : null;
      }

      const { error } = await supabase.from("strategy_trades").insert({
        user_id: user?.id,
        strategy_id: strategyId,
        pair: formData.pair,
        direction: formData.direction,
        trade_date: formData.trade_date,
        trade_time: formData.trade_time,
        session: formData.session,
        entry_price: entry,
        stop_loss: sl,
        take_profit: tp,
        result: formData.result,
        pnl: formData.pnl ? parseFloat(formData.pnl) : 0,
        risk_reward: riskReward,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategy_trades", strategyId] });
      queryClient.invalidateQueries({ queryKey: ["strategy", strategyId] });
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      onOpenChange(false);
      toast.success("Trade logged successfully");
      setFormData({
        pair: "EURUSD",
        direction: "Buy",
        trade_date: new Date().toISOString().split("T")[0],
        trade_time: "09:00",
        session: "London",
        entry_price: "",
        stop_loss: "",
        take_profit: "",
        result: "Win",
        pnl: "",
      });
    },
    onError: () => {
      toast.error("Failed to log trade");
    },
  });

  const handleSubmit = () => {
    if (!formData.entry_price) {
      toast.error("Entry price is required");
      return;
    }
    createTrade.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">Log Trade</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Pair & Direction */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Pair</Label>
              <Select
                value={formData.pair}
                onValueChange={(value) => setFormData({ ...formData, pair: value })}
              >
                <SelectTrigger className="bg-background border-primary focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {PAIRS.map((pair) => (
                    <SelectItem key={pair} value={pair}>
                      {pair}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Direction</Label>
              <Select
                value={formData.direction}
                onValueChange={(value) => setFormData({ ...formData, direction: value })}
              >
                <SelectTrigger className="bg-background border-border focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="Buy">Buy / Long</SelectItem>
                  <SelectItem value="Sell">Sell / Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Date</Label>
              <Input
                type="date"
                value={formData.trade_date}
                onChange={(e) => setFormData({ ...formData, trade_date: e.target.value })}
                className="bg-background border-border focus:border-primary focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Time</Label>
              <Input
                type="time"
                value={formData.trade_time}
                onChange={(e) => setFormData({ ...formData, trade_time: e.target.value })}
                className="bg-background border-border focus:border-primary focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Session */}
          <div className="space-y-2">
            <Label className="text-foreground">Session</Label>
            <div className="flex gap-2">
              {["Asia", "London", "New York"].map((session) => (
                <Button
                  key={session}
                  type="button"
                  variant={formData.session === session ? "default" : "outline"}
                  onClick={() => setFormData({ ...formData, session })}
                  className={
                    formData.session === session
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border-border text-foreground hover:bg-muted"
                  }
                >
                  {session}
                </Button>
              ))}
            </div>
          </div>

          {/* Entry, SL, TP */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Entry</Label>
              <Input
                type="number"
                step="0.00001"
                placeholder="1.0850"
                value={formData.entry_price}
                onChange={(e) => setFormData({ ...formData, entry_price: e.target.value })}
                className="bg-background border-border focus:border-primary focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Stop Loss</Label>
              <Input
                type="number"
                step="0.00001"
                placeholder="1.0820"
                value={formData.stop_loss}
                onChange={(e) => setFormData({ ...formData, stop_loss: e.target.value })}
                className="bg-background border-border focus:border-primary focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Take Profit</Label>
              <Input
                type="number"
                step="0.00001"
                placeholder="1.0920"
                value={formData.take_profit}
                onChange={(e) => setFormData({ ...formData, take_profit: e.target.value })}
                className="bg-background border-border focus:border-primary focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Result & P&L */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Result</Label>
              <Select
                value={formData.result}
                onValueChange={(value) => setFormData({ ...formData, result: value })}
              >
                <SelectTrigger className="bg-background border-border focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="Win">Win</SelectItem>
                  <SelectItem value="Loss">Loss</SelectItem>
                  <SelectItem value="Breakeven">Breakeven</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">
                P&L <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="$250"
                value={formData.pnl}
                onChange={(e) => setFormData({ ...formData, pnl: e.target.value })}
                className="bg-background border-border focus:border-primary focus:ring-primary/20"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-foreground hover:bg-muted"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createTrade.isPending}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Log Trade
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LogTradeModal;
