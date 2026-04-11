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
  const [isCarriedForward, setIsCarriedForward] = useState(false);
  const [loading, setLoading] = useState(true);
  const [brokerCharges, setBrokerCharges] = useState<number>(0);
  const [isEditingCharges, setIsEditingCharges] = useState(false);
  const [chargesInput, setChargesInput] = useState("");
  const [monthWithdrawals, setMonthWithdrawals] = useState<number>(0);
  const [totalPnl, setTotalPnl] = useState<number>(0);
  const [totalWithdrawals, setTotalWithdrawals] = useState<number>(0);
  const [totalBrokerCharges, setTotalBrokerCharges] = useState<number>(0);

  useEffect(() => {
    fetchBalance();
    fetchMonthWithdrawals();
    fetchTotalStats();
  }, [user, year, month]);

  const fetchBalance = async () => {
    if (!user) return;
    setLoading(true);
    setIsCarriedForward(false);

    // Check for a month-specific override
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
      setBrokerCharges(Number(monthData.broker_charges ?? 0));
      setIsGlobal(false);
      setLoading(false);
      return;
    }

    // No month-specific balance — try to carry forward from the previous month
    const carriedBalance = await computeCarriedForwardBalance(year, month);
    if (carriedBalance !== null) {
      setStartingBalance(carriedBalance);
      setIsGlobal(false);
      setIsCarriedForward(true);
      setBrokerCharges(0);
      setLoading(false);
      return;
    }

    // Fall back to global
    const { data: globalData } = await supabase
      .from("monthly_balances")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_global", true)
      .maybeSingle();

    if (globalData) {
      setStartingBalance(Number(globalData.starting_balance));
      setIsGlobal(true);
    } else {
      setStartingBalance(null);
    }
    setBrokerCharges(0);
    setLoading(false);
  };

  /**
   * Walk backwards from the given (year, month) to find the most recent month
   * with an explicit starting balance, then roll forward through each
   * intermediate month adding PnL and subtracting broker charges & withdrawals.
   */
  const computeCarriedForwardBalance = async (
    targetYear: number,
    targetMonth: number
  ): Promise<number | null> => {
    if (!user) return null;

    // Fetch all month-specific balances for this user
    const { data: allBalances } = await supabase
      .from("monthly_balances")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_global", false);

    // Fetch global balance as ultimate fallback
    const { data: globalData } = await supabase
      .from("monthly_balances")
      .select("starting_balance")
      .eq("user_id", user.id)
      .eq("is_global", true)
      .maybeSingle();

    // Build a map of (year*12+month) -> balance record
    const balanceMap = new Map<number, { starting_balance: number; broker_charges: number }>();
    (allBalances || []).forEach((b) => {
      const key = b.year * 12 + b.month;
      balanceMap.set(key, {
        starting_balance: Number(b.starting_balance),
        broker_charges: Number(b.broker_charges ?? 0),
      });
    });

    const targetKey = targetYear * 12 + targetMonth;

    // Find the most recent month before targetKey that has a balance
    let anchorKey: number | null = null;
    for (const key of Array.from(balanceMap.keys()).sort((a, b) => b - a)) {
      if (key < targetKey) {
        anchorKey = key;
        break;
      }
    }

    // If no previous month balance exists, check global
    let anchorBalance: number;
    let anchorCharges: number;
    let startKey: number;

    if (anchorKey !== null) {
      const anchor = balanceMap.get(anchorKey)!;
      anchorBalance = anchor.starting_balance;
      anchorCharges = anchor.broker_charges;
      startKey = anchorKey;
    } else if (globalData) {
      anchorBalance = Number(globalData.starting_balance);
      anchorCharges = 0;
      // We need to find the earliest month with trades to start rolling from
      // Use a reasonable starting point — the earliest month we have trades
      const { data: earliestTrade } = await supabase
        .from("trades")
        .select("trade_date")
        .eq("user_id", user.id)
        .order("trade_date", { ascending: true })
        .limit(1);

      if (!earliestTrade?.length) return null;

      const ed = new Date(earliestTrade[0].trade_date);
      startKey = ed.getFullYear() * 12 + ed.getMonth();

      if (startKey >= targetKey) return null;
    } else {
      return null;
    }

    // Now roll forward from startKey to targetKey-1, accumulating balance
    let runningBalance = anchorBalance;

    for (let k = startKey; k < targetKey; k++) {
      const y = Math.floor(k / 12);
      const m = k % 12;

      // Get broker charges for this month (from balance record if exists)
      const monthBalance = balanceMap.get(k);
      if (k === startKey && anchorKey !== null) {
        // Use the anchor's starting balance (already set as runningBalance)
      } else if (monthBalance && k !== startKey) {
        // This month has an explicit override — reset to it
        runningBalance = monthBalance.starting_balance;
      }

      const charges = monthBalance?.broker_charges ?? 0;

      // Get PnL for this month
      const monthNum = m + 1;
      const startDate = `${y}-${String(monthNum).padStart(2, "0")}-01`;
      const endDay = new Date(y, monthNum, 0).getDate();
      const endDate = `${y}-${String(monthNum).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

      const { data: monthTrades } = await supabase
        .from("trades")
        .select("outcome")
        .eq("user_id", user.id)
        .gte("trade_date", startDate)
        .lte("trade_date", endDate);

      const pnl = (monthTrades || []).reduce((s, t) => s + Number(t.outcome), 0);

      // Get withdrawals for this month
      const { data: wData } = await supabase
        .from("withdrawals")
        .select("amount")
        .eq("user_id", user.id)
        .gte("withdrawal_date", startDate)
        .lte("withdrawal_date", endDate);

      const withdrawals = (wData || []).reduce((s, w) => s + Number(w.amount), 0);

      runningBalance = runningBalance + pnl - charges - withdrawals;
    }

    return runningBalance;
  };

  const fetchMonthWithdrawals = async () => {
    if (!user) return;
    const m = month + 1;
    const startDate = `${year}-${String(m).padStart(2, "0")}-01`;
    const endDay = new Date(year, m, 0).getDate();
    const endDate = `${year}-${String(m).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

    const { data } = await supabase
      .from("withdrawals")
      .select("amount")
      .eq("user_id", user.id)
      .gte("withdrawal_date", startDate)
      .lte("withdrawal_date", endDate);

    const total = (data || []).reduce((sum, w) => sum + Number(w.amount), 0);
    setMonthWithdrawals(total);
  };

  const fetchTotalStats = async () => {
    if (!user) return;

    // Total PnL from all trades
    const { data: allTrades } = await supabase
      .from("trades")
      .select("outcome")
      .eq("user_id", user.id);
    setTotalPnl((allTrades || []).reduce((s, t) => s + Number(t.outcome), 0));

    // Total withdrawals
    const { data: allWithdrawals } = await supabase
      .from("withdrawals")
      .select("amount")
      .eq("user_id", user.id);
    setTotalWithdrawals((allWithdrawals || []).reduce((s, w) => s + Number(w.amount), 0));

    // Total broker charges from all monthly_balances
    const { data: allBalances } = await supabase
      .from("monthly_balances")
      .select("broker_charges")
      .eq("user_id", user.id)
      .eq("is_global", false);
    setTotalBrokerCharges((allBalances || []).reduce((s, b) => s + Number(b.broker_charges ?? 0), 0));
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
          broker_charges: brokerCharges,
        },
        { onConflict: "user_id,year,month" }
      );

    if (error) {
      toast.error("Failed to save balance");
    } else {
      setStartingBalance(value);
      setIsGlobal(false);
      setIsCarriedForward(false);
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
      setIsCarriedForward(false);
      setIsEditing(false);
      toast.success("Global starting balance saved");
    }
  };

  const saveBrokerCharges = async () => {
    if (!user) return;
    const value = parseFloat(chargesInput);
    if (isNaN(value) || value < 0) {
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
          starting_balance: startingBalance ?? 0,
          is_global: false,
          broker_charges: value,
        },
        { onConflict: "user_id,year,month" }
      );

    if (error) {
      toast.error("Failed to save broker charges");
    } else {
      setBrokerCharges(value);
      setIsEditingCharges(false);
      if (isGlobal && startingBalance !== null) {
        setIsGlobal(false);
      }
      toast.success("Broker charges saved");
    }
  };

  const currentBalance = startingBalance !== null ? startingBalance + monthPnl - brokerCharges - monthWithdrawals : null;

  if (loading) return null;

  return (
    <div className="space-y-4 mb-6">
      {/* Monthly Balance Card */}
      <div className="stat-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                {monthName} Starting Balance
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
                  {isCarriedForward && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                      Carried Forward
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

          {/* Broker Charges */}
          {startingBalance !== null && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Broker Charges</p>
              {isEditingCharges ? (
                <div className="flex items-center gap-1 mt-1">
                  <Input
                    type="number"
                    value={chargesInput}
                    onChange={(e) => setChargesInput(e.target.value)}
                    placeholder="0"
                    className="h-8 w-28 bg-background text-center"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveBrokerCharges();
                      if (e.key === "Escape") setIsEditingCharges(false);
                    }}
                  />
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-profit hover:text-profit" onClick={saveBrokerCharges}>
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground" onClick={() => setIsEditingCharges(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1 justify-center">
                  <span className={cn("text-lg font-bold", brokerCharges > 0 ? "text-loss" : "text-muted-foreground")}>
                    {brokerCharges > 0 ? `-$${brokerCharges.toLocaleString()}` : "$0"}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-primary"
                    onClick={() => {
                      setChargesInput(brokerCharges.toString());
                      setIsEditingCharges(true);
                    }}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Withdrawals */}
          {startingBalance !== null && monthWithdrawals > 0 && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Withdrawals</p>
              <span className="text-lg font-bold text-loss">
                ${monthWithdrawals.toLocaleString()}
              </span>
            </div>
          )}

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
                {monthPnl >= 0 ? "+" : ""}{monthPnl.toLocaleString()}$ P&L
                {monthWithdrawals > 0 && (
                  <span className="text-loss"> − ${monthWithdrawals.toLocaleString()} withdrawn</span>
                )}
                {brokerCharges > 0 && (
                  <span className="text-loss"> − ${brokerCharges.toLocaleString()} charges</span>
                )}
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

      {/* All-Time Summary Card */}
      <div className="stat-card">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">All-Time Summary</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Total P&L</p>
            <p className={cn("text-lg font-bold", totalPnl >= 0 ? "text-profit" : "text-loss")}>
              {totalPnl >= 0 ? "+" : ""}${totalPnl.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Withdrawn</p>
            <p className={cn("text-lg font-bold", totalWithdrawals > 0 ? "text-loss" : "text-muted-foreground")}>
              ${totalWithdrawals.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Broker Charges</p>
            <p className={cn("text-lg font-bold", totalBrokerCharges > 0 ? "text-loss" : "text-muted-foreground")}>
              ${totalBrokerCharges.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Net P&L</p>
            <p className={cn("text-lg font-bold", (totalPnl - totalWithdrawals - totalBrokerCharges) >= 0 ? "text-profit" : "text-loss")}>
              {(totalPnl - totalWithdrawals - totalBrokerCharges) >= 0 ? "+" : ""}${(totalPnl - totalWithdrawals - totalBrokerCharges).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BalanceHeader;
