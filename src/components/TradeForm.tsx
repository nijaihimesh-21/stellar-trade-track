import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Trade {
  id: string;
  pair: string;
  trade_date: string;
  trade_time: string;
  position_type: string;
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  exit_price: number | null;
  position_size: number;
  risk_reward: string | null;
  outcome: number;
  strategy: string | null;
  emotion: string | null;
  session: string | null;
  notes: string | null;
  sl_pips: number | null;
  tp_pips: number | null;
}

interface TradeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editTrade?: Trade | null;
}

const PAIRS = [
  "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD", "NZDUSD",
  "EURGBP", "EURJPY", "GBPJPY", "XAUUSD", "BTCUSD", "ETHUSD",
];

const TradeForm: React.FC<TradeFormProps> = ({ open, onOpenChange, onSuccess, editTrade }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const getInitialForm = () => ({
    pair: "EURUSD",
    trade_date: new Date().toISOString().split("T")[0],
    trade_time: "09:00",
    strategy: "",
    position_type: "buy",
    entry_price: "",
    stop_loss: "",
    take_profit: "",
    exit_price: "",
    position_size: "1.0",
    outcome: "",
    notes: "",
    session: "London",
    emotion: "",
    sl_pips: "",
    tp_pips: "",
  });

  const [form, setForm] = useState(getInitialForm());

  useEffect(() => {
    if (editTrade) {
      setForm({
        pair: editTrade.pair,
        trade_date: editTrade.trade_date,
        trade_time: editTrade.trade_time?.substring(0, 5) || "09:00",
        strategy: editTrade.strategy || "",
        position_type: editTrade.position_type,
        entry_price: editTrade.entry_price.toString(),
        stop_loss: editTrade.stop_loss?.toString() || "",
        take_profit: editTrade.take_profit?.toString() || "",
        exit_price: editTrade.exit_price?.toString() || "",
        position_size: editTrade.position_size?.toString() || "1.0",
        outcome: editTrade.outcome?.toString() || "",
        notes: editTrade.notes || "",
        session: editTrade.session || "London",
        emotion: editTrade.emotion || "",
        sl_pips: editTrade.sl_pips?.toString() || "",
        tp_pips: editTrade.tp_pips?.toString() || "",
      });
    } else {
      setForm(getInitialForm());
    }
  }, [editTrade, open]);

  const handleSubmit = async () => {
    if (!user) return;

    if (!form.pair || !form.entry_price) {
      toast.error("Please fill in required fields");
      return;
    }

    setLoading(true);

    const entry = parseFloat(form.entry_price) || 0;
    const sl = parseFloat(form.stop_loss) || null;
    const tp = parseFloat(form.take_profit) || null;

    let rr: string | null = null;
    if (sl && tp && entry) {
      const risk = Math.abs(entry - sl);
      const reward = Math.abs(tp - entry);
      if (risk > 0) {
        rr = `1:${(reward / risk).toFixed(1)}`;
      }
    }

    const tradeData = {
      user_id: user.id,
      pair: form.pair.toUpperCase(),
      trade_date: form.trade_date,
      trade_time: form.trade_time,
      strategy: form.strategy || null,
      position_type: form.position_type,
      entry_price: entry,
      stop_loss: sl,
      take_profit: tp,
      exit_price: parseFloat(form.exit_price) || null,
      position_size: parseFloat(form.position_size) || 1,
      risk_reward: rr,
      outcome: parseFloat(form.outcome) || 0,
      notes: form.notes || null,
      session: form.session || null,
      emotion: form.emotion || null,
      sl_pips: form.sl_pips ? parseFloat(form.sl_pips) : null,
      tp_pips: form.tp_pips ? parseFloat(form.tp_pips) : null,
    };

    let error;
    if (editTrade) {
      ({ error } = await supabase.from("trades").update(tradeData).eq("id", editTrade.id));
    } else {
      ({ error } = await supabase.from("trades").insert(tradeData));
    }

    setLoading(false);

    if (error) {
      toast.error(editTrade ? "Failed to update trade" : "Failed to add trade");
    } else {
      toast.success(editTrade ? "Trade updated successfully" : "Trade added successfully");
      onOpenChange(false);
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            {editTrade ? "Edit Trade" : "Add Trade"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Pair & Direction */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Pair</Label>
              <Select
                value={form.pair}
                onValueChange={(value) => setForm({ ...form, pair: value })}
              >
                <SelectTrigger className="bg-background border-border focus:ring-primary/20">
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
                value={form.position_type}
                onValueChange={(value) => setForm({ ...form, position_type: value })}
              >
                <SelectTrigger className="bg-background border-border focus:ring-primary/20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="buy">Buy / Long</SelectItem>
                  <SelectItem value="sell">Sell / Short</SelectItem>
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
                value={form.trade_date}
                onChange={(e) => setForm({ ...form, trade_date: e.target.value })}
                className="bg-background border-border focus:border-primary focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Time</Label>
              <Input
                type="time"
                value={form.trade_time}
                onChange={(e) => setForm({ ...form, trade_time: e.target.value })}
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
                  variant={form.session === session ? "default" : "outline"}
                  onClick={() => setForm({ ...form, session })}
                  className={
                    form.session === session
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border-border text-foreground hover:bg-muted"
                  }
                >
                  {session}
                </Button>
              ))}
            </div>
          </div>

          {/* Strategy & Entry Price */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Strategy <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                placeholder="TJL1"
                value={form.strategy}
                onChange={(e) => setForm({ ...form, strategy: e.target.value })}
                className="bg-background border-border focus:border-primary focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Entry Price</Label>
              <Input
                type="number"
                step="0.00001"
                placeholder="1.0850"
                value={form.entry_price}
                onChange={(e) => setForm({ ...form, entry_price: e.target.value })}
                className="bg-background border-border focus:border-primary focus:ring-primary/20"
              />
            </div>
          </div>

          {/* SL Price & SL Pips */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Stop Loss Price</Label>
              <Input
                type="number"
                step="0.00001"
                placeholder="1.0820"
                value={form.stop_loss}
                onChange={(e) => setForm({ ...form, stop_loss: e.target.value })}
                className="bg-background border-border focus:border-primary focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">SL in Pips <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                type="number"
                step="0.1"
                placeholder="30"
                value={form.sl_pips}
                onChange={(e) => setForm({ ...form, sl_pips: e.target.value })}
                className="bg-background border-border focus:border-primary focus:ring-primary/20"
              />
            </div>
          </div>

          {/* TP Price & TP Pips */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Take Profit Price</Label>
              <Input
                type="number"
                step="0.00001"
                placeholder="1.0920"
                value={form.take_profit}
                onChange={(e) => setForm({ ...form, take_profit: e.target.value })}
                className="bg-background border-border focus:border-primary focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">TP in Pips <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                type="number"
                step="0.1"
                placeholder="60"
                value={form.tp_pips}
                onChange={(e) => setForm({ ...form, tp_pips: e.target.value })}
                className="bg-background border-border focus:border-primary focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Exit Price & Position Size */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Exit Price <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                type="number"
                step="0.00001"
                placeholder="1.0900"
                value={form.exit_price}
                onChange={(e) => setForm({ ...form, exit_price: e.target.value })}
                className="bg-background border-border focus:border-primary focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Position Size (Lot)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="1.0"
                value={form.position_size}
                onChange={(e) => setForm({ ...form, position_size: e.target.value })}
                className="bg-background border-border focus:border-primary focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Outcome & Emotion */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Outcome (P/L)</Label>
              <Input
                type="number"
                step="any"
                placeholder="e.g. 150 or -50"
                value={form.outcome}
                onChange={(e) => setForm({ ...form, outcome: e.target.value })}
                className="bg-background border-border focus:border-primary focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Emotion <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                placeholder="Confident, anxious..."
                value={form.emotion}
                onChange={(e) => setForm({ ...form, emotion: e.target.value })}
                className="bg-background border-border focus:border-primary focus:ring-primary/20"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-foreground">Notes <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              placeholder="Add any notes about this trade..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="bg-background border-border focus:border-primary focus:ring-primary/20 min-h-[80px]"
            />
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
            disabled={loading}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {loading ? "Saving..." : editTrade ? "Save Changes" : "Add Trade"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TradeForm;
