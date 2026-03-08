import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Wallet, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface BalanceHeaderProps {
  year: number;
  month: number;
  monthPnl: number;
  monthName: string;
}

const BalanceHeader = ({ year, month, monthPnl, monthName }: BalanceHeaderProps) => {
  const { user } = useAuth();
  const [startingBalance, setStartingBalance] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isGlobal, setIsGlobal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBalance();
  }, [user, year, month]);

  const fetchBalance = async () => {
    if (!user) return;
    setLoading(true);

    // First check for a specific month override
    const { data: monthData } = await supabase
      .from("monthly_balances")
      .select("*")
      .eq("user_id", user.id)
      .eq("year", year)
      .eq("month", month)
      .eq("is_global", false)
      .maybeSingle();

    if (monthData) {
      setStartingBalance(Number(monthData.starting_balance));
      setIsGlobal(false);
      setLoading(false);
      return;
    }

    // Fall back to global balance (year=0, month=0)
    const { data: globalData } = await supabase
      .from("monthly_balances")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_global", true)
      .maybeSingle();

    if (globalData) {
      // Calculate carry-forward: global balance + all P&L from months before this one
      setStartingBalance(Number(globalData.starting_balance));
      setIsGlobal(true);
    } else {
      setStartingBalance(null);
    }
    setLoading(false);
  };

  const saveBalance = async () => {
    if (!user) return;
    const value = parseFloat(inputValue);
    if (isNaN(value)) {
      toast.error("Please enter a valid number");
      return;
    }

    const { error } = await supabase
      .from("monthly_balances")
      .upsert(
        {
          user_id: user.id,
          year,
          month,
          starting_balance: value,
          is_global: false,
        },
        { onConflict: "user_id,year,month" }
      );

    if (error) {
      toast.error("Failed to save balance");
    } else {
      setStartingBalance(value);
      setIsGlobal(false);
      setIsEditing(false);
      toast.success("Starting balance saved");
    }
  };

  const saveGlobalBalance = async () => {
    if (!user) return;
    const value = parseFloat(inputValue);
    if (isNaN(value)) {
      toast.error("Please enter a valid number");
      return;
    }

    const { error } = await supabase
      .from("monthly_balances")
      .upsert(
        {
          user_id: user.id,
          year: 0,
          month: 0,
          starting_balance: value,
          is_global: true,
        },
        { onConflict: "user_id,year,month" }
      );

    if (error) {
      toast.error("Failed to save global balance");
    } else {
      setStartingBalance(value);
      setIsGlobal(true);
      setIsEditing(false);
      toast.success("Global starting balance saved");
    }
  };

  const currentBalance = startingBalance !== null ? startingBalance + monthPnl : null;

  if (loading) return null;

  return (
    <div className="stat-card mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Wallet className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {monthName} Balance
            </p>
            {isEditing ? (
              <div className="flex items-center gap-2 mt-1">
                <Input
                  type="number"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Starting balance"
                  className="h-8 w-40 bg-background"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveBalance();
                    if (e.key === "Escape") setIsEditing(false);
                  }}
                />
                <Button size="icon" variant="ghost" className="h-8 w-8 text-profit hover:text-profit" onClick={saveBalance}>
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => setIsEditing(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : startingBalance !== null ? (
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-foreground">
                  ${startingBalance.toLocaleString()}
                </span>
                {isGlobal && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                    Global
                  </span>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-muted-foreground hover:text-primary"
                  onClick={() => {
                    setInputValue(startingBalance.toString());
                    setIsEditing(true);
                  }}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="mt-1 text-xs"
                onClick={() => {
                  setInputValue("");
                  setIsEditing(true);
                }}
              >
                Set Starting Balance
              </Button>
            )}
          </div>
        </div>

        {startingBalance !== null && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Current Balance</p>
            <p className={cn(
              "text-2xl font-bold",
              currentBalance! >= startingBalance ? "text-profit" : "text-loss"
            )}>
              ${currentBalance!.toLocaleString()}
            </p>
            <p className={cn(
              "text-xs",
              monthPnl >= 0 ? "text-profit" : "text-loss"
            )}>
              {monthPnl >= 0 ? "+" : ""}{monthPnl.toLocaleString()}$ this month
            </p>
          </div>
        )}
      </div>

      {startingBalance === null && !isEditing && (
        <p className="text-xs text-muted-foreground mt-2">
          You can also set a global balance in any month — it will carry forward automatically.
        </p>
      )}
    </div>
  );
};

export default BalanceHeader;
