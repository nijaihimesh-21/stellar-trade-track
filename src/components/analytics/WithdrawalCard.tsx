import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";

interface Withdrawal {
  id: string;
  amount: number;
  withdrawal_date: string;
  notes: string | null;
}

interface WithdrawalCardProps {
  dateRange: {start: string;end: string;};
  totalPnL: number;
}

const WithdrawalCard = ({ dateRange, totalPnL }: WithdrawalCardProps) => {
  const { user } = useAuth();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchWithdrawals = async () => {
    if (!user) return;
    const { data, error } = await supabase.
    from("withdrawals").
    select("*").
    eq("user_id", user.id).
    gte("withdrawal_date", dateRange.start).
    lte("withdrawal_date", dateRange.end).
    order("withdrawal_date", { ascending: false });

    if (!error && data) {
      setWithdrawals(data as Withdrawal[]);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, [user, dateRange.start, dateRange.end]);

  const totalWithdrawn = withdrawals.reduce((sum, w) => sum + Number(w.amount), 0);
  const netBalance = totalPnL - totalWithdrawn;

  const handleSubmit = async () => {
    if (!user || !date) return;
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) {
      toast.error("Enter a valid withdrawal amount");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("withdrawals").insert({
      user_id: user.id,
      amount: val,
      withdrawal_date: format(date, "yyyy-MM-dd"),
      notes: notes.trim() || null
    });

    if (error) {
      toast.error("Failed to save withdrawal");
    } else {
      toast.success("Withdrawal recorded");
      setAmount("");
      setNotes("");
      setDate(new Date());
      setShowForm(false);
      fetchWithdrawals();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("withdrawals").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete");
    } else {
      toast.success("Withdrawal deleted");
      fetchWithdrawals();
    }
  };

  return (
    <div className="stat-card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ArrowDownRight className="w-4 h-4 text-muted-foreground" />
          <p className="text-muted-foreground text-sm font-medium">Withdrawals</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={() => setShowForm(!showForm)}>
          
          <Plus className="w-3 h-3 mr-1" />
          Add
        </Button>
      </div>

      {/* Add Form */}
      {showForm &&
      <div className="bg-secondary rounded-lg p-3 mb-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input
            type="number"
            placeholder="Amount ($)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-9 bg-background" />
          
            <Popover>
              <PopoverTrigger asChild>
                <Button
                variant="outline"
                className={cn(
                  "h-9 justify-start text-left font-normal text-xs",
                  !date && "text-muted-foreground"
                )}>
                
                  <CalendarIcon className="w-3 h-3 mr-1" />
                  {date ? format(date, "MMM dd, yyyy") : "Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                mode="single"
                selected={date}
                onSelect={setDate}
                initialFocus
                className="p-3 pointer-events-auto" />
              
              </PopoverContent>
            </Popover>
          </div>
          <Input
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="h-9 bg-background" />
        
          <div className="flex gap-2">
            <Button size="sm" className="h-8 text-xs" onClick={handleSubmit} disabled={loading}>
              Save
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      }

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs text-muted-foreground">Total P&L</p>
          <p className={cn("text-lg font-bold", totalPnL >= 0 ? "text-profit" : "text-loss")}>
            {totalPnL >= 0 ? "+" : ""}${Math.abs(totalPnL).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Withdrawn</p>
          <p className="text-lg font-bold text-primary">
            ${totalWithdrawn.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          
          <p className={cn("text-lg font-bold", netBalance >= 0 ? "text-profit" : "text-loss")}>
            {netBalance >= 0 ? "+" : ""}${Math.abs(netBalance).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Withdrawal List */}
      {withdrawals.length > 0 &&
      <div className="space-y-2">
          {withdrawals.map((w) =>
        <div key={w.id} className="flex items-center justify-between bg-secondary rounded-lg px-3 py-2">
              <div>
                <span className="text-loss font-semibold text-sm">
                  ${Number(w.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-muted-foreground text-xs ml-2">
                  {format(new Date(w.withdrawal_date + "T00:00:00"), "MMM dd, yyyy")}
                </span>
                {w.notes &&
            <span className="text-muted-foreground text-xs ml-2">· {w.notes}</span>
            }
              </div>
              <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-muted-foreground hover:text-loss"
            onClick={() => handleDelete(w.id)}>
            
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
        )}
        </div>
      }

      {withdrawals.length === 0 && !showForm &&
      <p className="text-xs text-muted-foreground text-center py-2">No withdrawals in this period</p>
      }
    </div>);

};

export default WithdrawalCard;