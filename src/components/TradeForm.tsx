import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TradeFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const TradeForm: React.FC<TradeFormProps> = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    pair: "",
    trade_date: new Date().toISOString().split("T")[0],
    trade_time: "",
    strategy: "",
    position_type: "buy" as "buy" | "sell",
    entry_price: "",
    stop_loss: "",
    take_profit: "",
    exit_price: "",
    position_size: "1.0",
    outcome: "",
    notes: "",
    session: "london",
    emotion: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!form.pair || !form.entry_price || !form.trade_time) {
      toast.error("Please fill in required fields");
      return;
    }

    setLoading(true);

    const entry = parseFloat(form.entry_price) || 0;
    const sl = parseFloat(form.stop_loss) || 0;
    const tp = parseFloat(form.take_profit) || 0;
    
    let rr = "";
    if (sl && tp && entry) {
      const risk = Math.abs(entry - sl);
      const reward = Math.abs(tp - entry);
      if (risk > 0) {
        rr = `1:${(reward / risk).toFixed(1)}`;
      }
    }

    const { error } = await supabase.from("trades").insert({
      user_id: user.id,
      pair: form.pair.toUpperCase(),
      trade_date: form.trade_date,
      trade_time: form.trade_time,
      strategy: form.strategy || null,
      position_type: form.position_type,
      entry_price: parseFloat(form.entry_price) || 0,
      stop_loss: parseFloat(form.stop_loss) || null,
      take_profit: parseFloat(form.take_profit) || null,
      exit_price: parseFloat(form.exit_price) || null,
      position_size: parseFloat(form.position_size) || 1,
      risk_reward: rr || null,
      outcome: parseFloat(form.outcome) || 0,
      notes: form.notes || null,
      session: form.session || null,
      emotion: form.emotion || null,
    });

    setLoading(false);

    if (error) {
      toast.error("Failed to add trade");
    } else {
      toast.success("Trade added successfully");
      onSuccess();
    }
  };

  const handleReset = () => {
    setForm({
      pair: "",
      trade_date: new Date().toISOString().split("T")[0],
      trade_time: "",
      strategy: "",
      position_type: "buy",
      entry_price: "",
      stop_loss: "",
      take_profit: "",
      exit_price: "",
      position_size: "1.0",
      outcome: "",
      notes: "",
      session: "london",
      emotion: "",
    });
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="sticky top-0 bg-card border-b border-border p-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-foreground">Add Trade</h2>
          <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="text-foreground">Pair *</Label>
                <Input
                  placeholder="eg-XAU/USD"
                  value={form.pair}
                  onChange={(e) => setForm({ ...form, pair: e.target.value })}
                  className="bg-secondary border-border"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Time *</Label>
                  <Input
                    type="time"
                    value={form.trade_time}
                    onChange={(e) => setForm({ ...form, trade_time: e.target.value })}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Date</Label>
                  <Input
                    type="date"
                    value={form.trade_date}
                    onChange={(e) => setForm({ ...form, trade_date: e.target.value })}
                    className="bg-secondary border-border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Strategy</Label>
                  <Input
                    placeholder="TJL1"
                    value={form.strategy}
                    onChange={(e) => setForm({ ...form, strategy: e.target.value })}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Entry Price *</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={form.entry_price}
                    onChange={(e) => setForm({ ...form, entry_price: e.target.value })}
                    className="bg-secondary border-border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Stop Loss</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={form.stop_loss}
                    onChange={(e) => setForm({ ...form, stop_loss: e.target.value })}
                    className="bg-secondary border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Take Profit</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={form.take_profit}
                    onChange={(e) => setForm({ ...form, take_profit: e.target.value })}
                    className="bg-secondary border-border"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Exit Price</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={form.exit_price}
                    onChange={(e) => setForm({ ...form, exit_price: e.target.value })}
                    className="bg-secondary border-border"
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
                    className="bg-secondary border-border"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Outcome (P/L)</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="e.g. 150 or -50"
                  value={form.outcome}
                  onChange={(e) => setForm({ ...form, outcome: e.target.value })}
                  className="bg-secondary border-border"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Position Type</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, position_type: "buy" })}
                    className={cn(
                      "px-6 py-2 rounded-lg font-medium transition-all",
                      form.position_type === "buy"
                        ? "bg-foreground text-background"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Buy
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, position_type: "sell" })}
                    className={cn(
                      "px-6 py-2 rounded-lg font-medium transition-all",
                      form.position_type === "sell"
                        ? "bg-foreground text-background"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Sell
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column - Notes */}
            <div className="space-y-4">
              <div className="space-y-2 h-full flex flex-col">
                <Label className="text-foreground">Notes</Label>
                <Textarea
                  placeholder="Add a short description here..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="bg-secondary border-border flex-1 min-h-[300px] resize-none"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              className="border-border text-foreground hover:bg-secondary"
            >
              Reset
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-foreground text-background hover:bg-foreground/90 font-medium px-8"
            >
              {loading ? "Adding..." : "Add Trade"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TradeForm;
