import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronLeft, TrendingUp, BarChart2, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

interface Trade {
  id: string;
  pair: string;
  trade_date: string;
  trade_time: string;
  position_type: string;
  entry_price: number;
  exit_price: number | null;
  position_size: number;
  risk_reward: string | null;
  outcome: number;
  strategy: string | null;
  emotion: string | null;
}

type ViewLevel = "year" | "month" | "day";

const TradeLog = () => {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [viewLevel, setViewLevel] = useState<ViewLevel>("year");
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  useEffect(() => {
    const fetchTrades = async () => {
      if (!user) return;
      const { data } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", user.id)
        .order("trade_date", { ascending: false });
      if (data) setTrades(data as Trade[]);
    };
    fetchTrades();
  }, [user]);

  const years = [...new Set(trades.map((t) => new Date(t.trade_date).getFullYear()))].sort(
    (a, b) => b - a
  );

  const getYearStats = (year: number) => {
    const yearTrades = trades.filter((t) => new Date(t.trade_date).getFullYear() === year);
    const wins = yearTrades.filter((t) => t.outcome > 0).length;
    const pnl = yearTrades.reduce((sum, t) => sum + t.outcome, 0);
    return {
      trades: yearTrades.length,
      winRate: yearTrades.length > 0 ? Math.round((wins / yearTrades.length) * 100) : 0,
      pnl,
    };
  };

  const getMonthsForYear = (year: number) => {
    const yearTrades = trades.filter((t) => new Date(t.trade_date).getFullYear() === year);
    const months = [...new Set(yearTrades.map((t) => new Date(t.trade_date).getMonth()))].sort(
      (a, b) => b - a
    );
    return months.map((month) => {
      const monthTrades = yearTrades.filter((t) => new Date(t.trade_date).getMonth() === month);
      const uniqueDays = new Set(monthTrades.map((t) => t.trade_date)).size;
      const pnl = monthTrades.reduce((sum, t) => sum + t.outcome, 0);
      return { month, days: uniqueDays, pnl };
    });
  };

  const getDaysForMonth = (year: number, month: number) => {
    const monthTrades = trades.filter((t) => {
      const d = new Date(t.trade_date);
      return d.getFullYear() === year && d.getMonth() === month;
    });
    const days = [...new Set(monthTrades.map((t) => t.trade_date))].sort().reverse();
    return days.map((date) => {
      const dayTrades = monthTrades.filter((t) => t.trade_date === date);
      const pnl = dayTrades.reduce((sum, t) => sum + t.outcome, 0);
      return { date, trades: dayTrades, pnl };
    });
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const goBack = () => {
    if (viewLevel === "day") {
      setViewLevel("month");
      setSelectedMonth(null);
    } else if (viewLevel === "month") {
      setViewLevel("year");
      setSelectedYear(null);
    }
  };

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        {viewLevel !== "year" && (
          <button
            onClick={goBack}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        )}
        <h1 className="text-3xl font-bold text-foreground">
          {viewLevel === "year" && "Trade Log"}
          {viewLevel === "month" && selectedYear}
          {viewLevel === "day" && `${monthNames[selectedMonth!]} ${selectedYear}`}
        </h1>
        <p className="text-muted-foreground">
          {viewLevel === "year" && "Review your trading history by year"}
          {viewLevel === "month" && "Select a month to view trades"}
          {viewLevel === "day" &&
            `${getDaysForMonth(selectedYear!, selectedMonth!).length} trading days`}
        </p>
      </div>

      {/* Year View */}
      {viewLevel === "year" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {years.map((year) => {
            const stats = getYearStats(year);
            return (
              <button
                key={year}
                onClick={() => {
                  setSelectedYear(year);
                  setViewLevel("month");
                }}
                className="stat-card text-left hover:border-primary/50 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="text-4xl font-bold text-foreground">{year}</span>
                  <div className="p-2 bg-profit/10 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-profit" />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-3">
                  <BarChart2 className="w-4 h-4" />
                  <span>Total Trades</span>
                </div>
                <p className="text-2xl font-bold text-foreground mb-4">{stats.trades}</p>
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Win Rate</p>
                    <p className="text-lg font-semibold text-foreground">{stats.winRate}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground uppercase">Net P&L</p>
                    <p
                      className={cn(
                        "text-lg font-semibold",
                        stats.pnl >= 0 ? "text-profit" : "text-loss"
                      )}
                    >
                      {stats.pnl >= 0 ? "+" : ""}
                      {stats.pnl.toLocaleString()}$
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
          {years.length === 0 && (
            <p className="text-muted-foreground col-span-3">No trades yet</p>
          )}
        </div>
      )}

      {/* Month View */}
      {viewLevel === "month" && selectedYear && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {getMonthsForYear(selectedYear).map(({ month, days, pnl }) => (
            <button
              key={month}
              onClick={() => {
                setSelectedMonth(month);
                setViewLevel("day");
              }}
              className="stat-card text-left hover:border-primary/50 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl font-bold text-foreground">{monthNames[month]}</span>
                <TrendingUp className="w-5 h-5 text-profit" />
              </div>
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-4">
                <Calendar className="w-4 h-4" />
                <span>{days} days journaled</span>
              </div>
              <div className="pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground uppercase">Monthly P&L</p>
                <p
                  className={cn("text-xl font-bold", pnl >= 0 ? "text-profit" : "text-loss")}
                >
                  {pnl >= 0 ? "+" : ""}
                  {pnl.toLocaleString()}$
                </p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Day View */}
      {viewLevel === "day" && selectedYear !== null && selectedMonth !== null && (
        <div className="space-y-6">
          {getDaysForMonth(selectedYear, selectedMonth).map(({ date, trades: dayTrades, pnl }) => (
            <div key={date} className="stat-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center">
                    <span className="text-xl font-bold text-foreground">
                      {new Date(date).getDate()}
                    </span>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {format(parseISO(date), "dd MMM yyyy")}
                    </p>
                    <p className="text-sm text-muted-foreground">{dayTrades.length} trades</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground uppercase">Day P&L</p>
                  <p className={cn("text-xl font-bold", pnl >= 0 ? "text-profit" : "text-loss")}>
                    {pnl >= 0 ? "+" : ""}
                    {pnl.toLocaleString()}$
                  </p>
                </div>
              </div>

              {/* Trade Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs text-muted-foreground uppercase py-3 px-2">
                        Time
                      </th>
                      <th className="text-left text-xs text-muted-foreground uppercase py-3 px-2">
                        Pair
                      </th>
                      <th className="text-left text-xs text-muted-foreground uppercase py-3 px-2">
                        Side
                      </th>
                      <th className="text-left text-xs text-muted-foreground uppercase py-3 px-2">
                        Entry
                      </th>
                      <th className="text-left text-xs text-muted-foreground uppercase py-3 px-2">
                        Exit
                      </th>
                      <th className="text-left text-xs text-muted-foreground uppercase py-3 px-2">
                        Lot
                      </th>
                      <th className="text-left text-xs text-muted-foreground uppercase py-3 px-2">
                        R:R
                      </th>
                      <th className="text-left text-xs text-muted-foreground uppercase py-3 px-2">
                        P&L
                      </th>
                      <th className="text-left text-xs text-muted-foreground uppercase py-3 px-2">
                        Result
                      </th>
                      <th className="text-left text-xs text-muted-foreground uppercase py-3 px-2">
                        Strategy
                      </th>
                      <th className="text-left text-xs text-muted-foreground uppercase py-3 px-2">
                        Emotion
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayTrades.map((trade) => (
                      <tr key={trade.id} className="border-b border-border/50 last:border-0">
                        <td className="py-3 px-2 text-foreground">
                          {trade.trade_time.slice(0, 5)}
                        </td>
                        <td className="py-3 px-2 font-medium text-foreground">{trade.pair}</td>
                        <td className="py-3 px-2">
                          <span
                            className={cn(
                              "px-2 py-1 rounded text-xs font-medium uppercase",
                              trade.position_type === "buy"
                                ? "bg-profit/20 text-profit"
                                : "bg-loss/20 text-loss"
                            )}
                          >
                            {trade.position_type}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-foreground">{trade.entry_price}</td>
                        <td className="py-3 px-2 text-foreground">{trade.exit_price ?? "-"}</td>
                        <td className="py-3 px-2 text-foreground">{trade.position_size}</td>
                        <td className="py-3 px-2 text-foreground">{trade.risk_reward ?? "-"}</td>
                        <td
                          className={cn(
                            "py-3 px-2 font-medium",
                            trade.outcome >= 0 ? "text-profit" : "text-loss"
                          )}
                        >
                          {trade.outcome >= 0 ? "+" : ""}
                          {trade.outcome}$
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={cn(
                              "font-medium",
                              trade.outcome >= 0 ? "text-profit" : "text-loss"
                            )}
                          >
                            {trade.outcome >= 0 ? "WIN" : "LOSS"}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          {trade.strategy && (
                            <span className="px-2 py-1 bg-secondary rounded text-xs text-foreground">
                              {trade.strategy}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-2 text-muted-foreground">{trade.emotion ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TradeLog;
