import React from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { FolderOpen, TrendingUp, Percent, Target, Activity, ChevronRight } from "lucide-react";

interface Strategy {
  id: string;
  name: string;
  trades_count: number;
  win_rate: number;
  expectancy: number;
}

const BacktesterAnalytics: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Fetch all strategies with aggregated metrics
  const { data: strategies = [], isLoading } = useQuery({
    queryKey: ["backtester_analytics", user?.id],
    queryFn: async () => {
      const { data: strategiesData, error: strategiesError } = await supabase
        .from("strategies")
        .select("*")
        .eq("user_id", user?.id);

      if (strategiesError) throw strategiesError;

      const strategiesWithMetrics = await Promise.all(
        (strategiesData || []).map(async (strategy) => {
          const { data: trades } = await supabase
            .from("strategy_trades")
            .select("*")
            .eq("strategy_id", strategy.id);

          const tradesCount = trades?.length || 0;
          const wins = trades?.filter((t) => t.result === "Win").length || 0;
          const winRate = tradesCount > 0 ? (wins / tradesCount) * 100 : 0;

          const avgWin = wins > 0
            ? trades!.filter((t) => t.result === "Win").reduce((acc, t) => acc + (Number(t.pnl) || 0), 0) / wins
            : 0;
          const losses = trades?.filter((t) => t.result === "Loss").length || 0;
          const avgLoss = losses > 0
            ? Math.abs(trades!.filter((t) => t.result === "Loss").reduce((acc, t) => acc + (Number(t.pnl) || 0), 0) / losses)
            : 0;
          const expectancy = tradesCount > 0
            ? ((winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss) / 100
            : 0;

          return {
            ...strategy,
            trades_count: tradesCount,
            win_rate: winRate,
            expectancy: isNaN(expectancy) ? 0 : expectancy,
          };
        })
      );

      return strategiesWithMetrics.sort((a, b) => b.expectancy - a.expectancy) as Strategy[];
    },
    enabled: !!user?.id,
  });

  // Aggregate totals
  const totalStrategies = strategies.length;
  const totalTrades = strategies.reduce((acc, s) => acc + s.trades_count, 0);
  const totalWins = strategies.reduce((acc, s) => acc + Math.round(s.trades_count * (s.win_rate / 100)), 0);
  const totalLosses = totalTrades - totalWins;
  const overallWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

  // Fetch all trades for P&L
  const { data: allTrades = [] } = useQuery({
    queryKey: ["all_strategy_trades", user?.id],
    queryFn: async () => {
      const strategyIds = strategies.map((s) => s.id);
      if (strategyIds.length === 0) return [];

      const { data, error } = await supabase
        .from("strategy_trades")
        .select("*")
        .in("strategy_id", strategyIds);

      if (error) throw error;
      return data;
    },
    enabled: strategies.length > 0,
  });

  const totalPnL = allTrades.reduce((acc, t) => acc + (Number(t.pnl) || 0), 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Portfolio Analytics</h1>
        <p className="text-muted-foreground mt-1">Aggregate performance across all strategy folders</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Strategies</span>
            <FolderOpen className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold text-foreground">{totalStrategies}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Trades</span>
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold text-foreground">{totalTrades}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Overall Win Rate</span>
            <Percent className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold text-primary">{overallWinRate.toFixed(1)}%</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Wins / Losses</span>
            <Target className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className="text-3xl font-bold text-foreground">
            {totalWins} <span className="text-muted-foreground">/</span> {totalLosses}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground uppercase tracking-wider">Total P&L</span>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </div>
          <p className={`text-3xl font-bold ${totalPnL >= 0 ? "text-primary" : "text-destructive"}`}>
            {totalPnL >= 0 ? "+" : ""}${totalPnL.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Strategy Performance Ranking */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-foreground">Strategy Performance Ranking</h2>
          <p className="text-sm text-muted-foreground">Sorted by expectancy</p>
        </div>

        {strategies.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No strategies created yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {strategies.map((strategy, index) => (
              <div
                key={strategy.id}
                onClick={() => navigate(`/backtester/strategy/${strategy.id}`)}
                className="flex items-center justify-between p-4 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-foreground">
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                      {strategy.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {strategy.trades_count} trades · {strategy.win_rate.toFixed(1)}% win rate
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`text-lg font-bold ${strategy.expectancy >= 0 ? "text-primary" : "text-destructive"}`}>
                      {strategy.expectancy >= 0 ? "+" : ""}{strategy.expectancy.toFixed(2)}R
                    </p>
                    <p className="text-xs text-muted-foreground">Expectancy</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BacktesterAnalytics;
