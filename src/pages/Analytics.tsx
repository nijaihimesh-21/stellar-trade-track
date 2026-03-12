import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, TrendingDown } from "lucide-react";
import TradeForm from "@/components/TradeForm";
import { cn } from "@/lib/utils";
import { useTimeWindow } from "@/hooks/useTimeWindow";

interface Trade {
  id: string;
  pair: string;
  outcome: number;
  session: string | null;
  trade_date: string;
}

const Analytics = () => {
  const { user } = useAuth();
  const { period, type, dates } = useTimeWindow();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchTrades = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", user.id)
      .gte("trade_date", dates.start)
      .lte("trade_date", dates.end);

    if (!error && data) {
      setTrades(data as Trade[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTrades();
  }, [user, period, type]);

  const totalPnL = trades.reduce((sum, t) => sum + Number(t.outcome), 0);
  const wins = trades.filter((t) => Number(t.outcome) > 0).length;
  const winRate = trades.length > 0 ? ((wins / trades.length) * 100).toFixed(1) : "0.0";
  
  const sessionPnL = {
    asia: trades.filter((t) => t.session === "asia").reduce((s, t) => s + Number(t.outcome), 0),
    london: trades.filter((t) => t.session === "london").reduce((s, t) => s + Number(t.outcome), 0),
    newyork: trades.filter((t) => t.session === "newyork").reduce((s, t) => s + Number(t.outcome), 0),
  };
  
  const maxSessionPnL = Math.max(
    Math.abs(sessionPnL.asia),
    Math.abs(sessionPnL.london),
    Math.abs(sessionPnL.newyork),
    1
  );

  const pairStats = trades.reduce((acc, t) => {
    if (!acc[t.pair]) acc[t.pair] = { pnl: 0, trades: 0 };
    acc[t.pair].pnl += Number(t.outcome);
    acc[t.pair].trades += 1;
    return acc;
  }, {} as Record<string, { pnl: number; trades: number }>);

  const sortedPairs = Object.entries(pairStats).sort((a, b) => b[1].pnl - a[1].pnl);
  const bestPairs = sortedPairs.filter(([, s]) => s.pnl > 0).slice(0, 3);
  const worstPairs = sortedPairs.filter(([, s]) => s.pnl < 0).slice(-3).reverse();

  const avgRR = trades.length > 0 ? "1:2.5" : "0:0";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div />
        <div className="flex items-center gap-3">
          <div className="flex bg-secondary rounded-lg p-1">
            {(["daily", "weekly", "monthly"] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-all capitalize",
                  filter === f
                    ? "bg-card text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>
          <Button
            onClick={() => setShowTradeForm(true)}
            className="bg-card border border-border hover:bg-secondary text-foreground"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-muted-foreground text-sm mb-2">Profit & Loss</p>
          <p className={cn("text-3xl font-bold", totalPnL >= 0 ? "text-profit" : "text-loss")}>
            {totalPnL >= 0 ? "+" : ""} ${Math.abs(totalPnL).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
          <div className="flex items-center gap-1 mt-2 text-sm">
            {totalPnL >= 0 ? (
              <TrendingUp className="w-4 h-4 text-profit" />
            ) : (
              <TrendingDown className="w-4 h-4 text-loss" />
            )}
            <span className={totalPnL >= 0 ? "text-profit" : "text-loss"}>
              {totalPnL >= 0 ? "12.5%" : "-8.2%"}
            </span>
          </div>
        </div>

        <div className="stat-card">
          <p className="text-muted-foreground text-sm mb-2">Risk Reward</p>
          <p className="text-3xl font-bold text-foreground">{avgRR}</p>
          <p className="text-muted-foreground text-sm mt-2">Average Rate</p>
        </div>

        <div className="stat-card">
          <p className="text-muted-foreground text-sm mb-2">Win Rate</p>
          <p className="text-3xl font-bold text-foreground">{winRate}%</p>
          <p className="text-muted-foreground text-sm mt-2">{trades.length} Total Trades</p>
        </div>
      </div>

      {/* Session P&L */}
      <div className="stat-card">
        <p className="text-muted-foreground text-sm mb-4">Profit & Loss</p>
        <div className="space-y-4">
          {[
            { name: "Asia", key: "asia", pnl: sessionPnL.asia },
            { name: "London", key: "london", pnl: sessionPnL.london },
            { name: "New York", key: "newyork", pnl: sessionPnL.newyork },
          ].map((session) => (
            <div key={session.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-foreground font-medium">{session.name}</span>
                <span className={cn("font-semibold", session.pnl >= 0 ? "text-profit" : "text-loss")}>
                  {session.pnl >= 0 ? "+" : ""}${Math.abs(session.pnl).toLocaleString()}
                </span>
              </div>
              <div className="h-1 bg-secondary rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full transition-all", session.pnl >= 0 ? "bg-profit" : "bg-loss")}
                  style={{ width: `${(Math.abs(session.pnl) / maxSessionPnL) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Best & Worst Pairs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="stat-card">
          <p className="text-muted-foreground text-sm mb-4">Best Pairs</p>
          <div className="grid grid-cols-3 gap-4">
            {bestPairs.length > 0 ? (
              bestPairs.map(([pair, stats]) => (
                <div key={pair} className="bg-secondary rounded-lg p-4">
                  <p className="text-muted-foreground text-xs mb-1">{pair}</p>
                  <p className="text-profit text-xl font-bold">+${stats.pnl.toLocaleString()}</p>
                  <p className="text-muted-foreground text-xs mt-1">{stats.trades} trades</p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground col-span-3">No profitable pairs yet</p>
            )}
          </div>
        </div>

        <div className="stat-card">
          <p className="text-muted-foreground text-sm mb-4">Worst Pairs</p>
          <div className="grid grid-cols-3 gap-4">
            {worstPairs.length > 0 ? (
              worstPairs.map(([pair, stats]) => (
                <div key={pair} className="bg-secondary rounded-lg p-4">
                  <p className="text-muted-foreground text-xs mb-1">{pair}</p>
                  <p className="text-loss text-xl font-bold">-${Math.abs(stats.pnl).toLocaleString()}</p>
                  <p className="text-muted-foreground text-xs mt-1">{stats.trades} trades</p>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground col-span-3">No losing pairs yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Trade Form Modal */}
      <TradeForm
        open={showTradeForm}
        onOpenChange={(open) => setShowTradeForm(open)}
        onSuccess={() => {
          setShowTradeForm(false);
          fetchTrades();
        }}
      />
    </div>
  );
};

export default Analytics;
