import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft,
  Plus,
  Trash2,
  BarChart3,
  TrendingUp,
  Settings,
  Percent,
  Target,
  Activity,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

import LogTradeModal from "@/components/backtester/LogTradeModal";
import TradesTable from "@/components/backtester/TradesTable";
import StrategySettings from "@/components/backtester/StrategySettings";
import { generateStrategyPDF } from "@/utils/generateStrategyPDF";

interface StrategyTrade {
  id: string;
  pair: string;
  direction: string;
  trade_date: string;
  trade_time: string;
  session: string;
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  result: string;
  pnl: number;
  risk_reward: number | null;
}

interface Strategy {
  id: string;
  name: string;
  description: string | null;
  market: string;
  created_at: string;
}

const StrategyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isLogTradeOpen, setIsLogTradeOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch strategy
  const { data: strategy, isLoading: strategyLoading } = useQuery({
    queryKey: ["strategy", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strategies")
        .select("*")
        .eq("id", id)
        .eq("user_id", user?.id)
        .maybeSingle();

      if (error) throw error;
      return data as Strategy | null;
    },
    enabled: !!id && !!user?.id,
  });

  // Fetch trades for this strategy
  const { data: trades = [], isLoading: tradesLoading } = useQuery({
    queryKey: ["strategy_trades", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strategy_trades")
        .select("*")
        .eq("strategy_id", id)
        .order("trade_date", { ascending: false });

      if (error) throw error;
      return data as StrategyTrade[];
    },
    enabled: !!id,
  });

  // Delete strategy mutation
  const deleteStrategy = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("strategies")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      toast.success("Strategy deleted");
      navigate("/backtester/strategies");
    },
    onError: () => {
      toast.error("Failed to delete strategy");
    },
  });

  // Calculate metrics
  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.result === "Win").length;
  const losses = trades.filter((t) => t.result === "Loss").length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

  // Calculate average R:R
  const tradesWithRR = trades.filter((t) => t.risk_reward);
  const avgRR = tradesWithRR.length > 0
    ? tradesWithRR.reduce((acc, t) => acc + (t.risk_reward || 0), 0) / tradesWithRR.length
    : 0;

  // Calculate expectancy
  const totalPnL = trades.reduce((acc, t) => acc + (t.pnl || 0), 0);
  const avgWin = wins > 0 ? trades.filter((t) => t.result === "Win").reduce((acc, t) => acc + (t.pnl || 0), 0) / wins : 0;
  const avgLoss = losses > 0 ? Math.abs(trades.filter((t) => t.result === "Loss").reduce((acc, t) => acc + (t.pnl || 0), 0) / losses) : 0;
  const expectancy = totalTrades > 0 ? ((winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss) / 100 : 0;

  // Session breakdown
  const sessionStats = {
    Asia: trades.filter((t) => t.session === "Asia"),
    London: trades.filter((t) => t.session === "London"),
    "New York": trades.filter((t) => t.session === "New York"),
  };

  // Best pairs
  const pairStats = trades.reduce((acc, t) => {
    if (!acc[t.pair]) {
      acc[t.pair] = { trades: 0, wins: 0, pnl: 0 };
    }
    acc[t.pair].trades++;
    if (t.result === "Win") acc[t.pair].wins++;
    acc[t.pair].pnl += t.pnl || 0;
    return acc;
  }, {} as Record<string, { trades: number; wins: number; pnl: number }>);

  const bestPair = Object.entries(pairStats).sort((a, b) => b[1].pnl - a[1].pnl)[0];

  if (strategyLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Strategy not found</p>
        <Button
          variant="link"
          onClick={() => navigate("/backtester/strategies")}
          className="text-primary mt-2"
        >
          Back to Strategies
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate("/backtester/strategies")}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Strategies</span>
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{strategy.name}</h1>
          {strategy.description && (
            <p className="text-muted-foreground mt-1">{strategy.description}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              if (strategy && trades) {
                generateStrategyPDF(strategy, trades);
                toast.success("PDF report generated!");
              }
            }}
            disabled={trades.length === 0}
            className="border-border text-foreground hover:bg-muted"
          >
            <Download className="w-4 h-4 mr-2" />
            PDF Report
          </Button>
          <Button
            variant="outline"
            onClick={() => deleteStrategy.mutate()}
            className="border-border text-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </Button>
          <Button
            onClick={() => setIsLogTradeOpen(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="w-4 h-4 mr-2" />
            Log Trade
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-card border border-border">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-muted data-[state=active]:text-foreground"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="trades"
            className="data-[state=active]:bg-muted data-[state=active]:text-foreground"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Trades ({totalTrades})
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="data-[state=active]:bg-muted data-[state=active]:text-foreground"
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Trades</span>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-3xl font-bold text-foreground">{totalTrades}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Win Rate</span>
                <Percent className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-3xl font-bold text-primary">{winRate.toFixed(1)}%</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Avg R:R</span>
                <Target className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className="text-3xl font-bold text-foreground">1 : {avgRR.toFixed(1)}</p>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Expectancy</span>
                <Activity className="w-4 h-4 text-muted-foreground" />
              </div>
              <p className={`text-3xl font-bold ${expectancy >= 0 ? "text-primary" : "text-destructive"}`}>
                {expectancy >= 0 ? "+" : ""}{expectancy.toFixed(2)}R
              </p>
            </div>
          </div>

          {/* Win Rate & Session Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Overall Win Rate */}
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Overall Win Rate</span>
                  <p className="text-5xl font-bold text-primary mt-2">{winRate.toFixed(1)}%</p>
                  <p className="text-sm text-muted-foreground mt-1">{wins} wins / {totalTrades} total trades</p>
                </div>
                <div className="text-right">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    {Object.entries(sessionStats).map(([session, sessionTrades]) => {
                      const sessionWins = sessionTrades.filter((t) => t.result === "Win").length;
                      const sessionWinRate = sessionTrades.length > 0 ? (sessionWins / sessionTrades.length) * 100 : 0;
                      return (
                        <div key={session}>
                          <span className="text-xs text-muted-foreground">{session}</span>
                          <p className={`text-lg font-bold ${sessionTrades.length > 0 ? "text-primary" : "text-muted-foreground"}`}>
                            {sessionTrades.length > 0 ? `${sessionWinRate.toFixed(0)}%` : "—"}
                          </p>
                          <span className="text-xs text-muted-foreground">{sessionTrades.length}T</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 10-Trade Performance */}
            <div className="bg-card border border-border rounded-xl p-5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">10-Trade Performance</span>
              {totalTrades >= 10 ? (
                <div className="mt-4">
                  <p className="text-xl font-bold text-foreground">
                    {(trades.slice(0, 10).filter((t) => t.result === "Win").length / 10 * 100).toFixed(0)}% Win Rate
                  </p>
                  <p className="text-sm text-muted-foreground">Last 10 trades</p>
                </div>
              ) : (
                <div className="mt-4 text-center">
                  <p className="text-lg font-medium text-foreground">Need {10 - totalTrades} more trades</p>
                  <p className="text-sm text-muted-foreground">Log at least 10 trades to see performance rating</p>
                </div>
              )}
            </div>
          </div>

          {/* Session P&L & Best Pairs */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Profit & Loss by Session */}
            <div className="bg-card border border-border rounded-xl p-5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Profit & Loss by Session</span>
              <div className="space-y-4 mt-4">
                {Object.entries(sessionStats).map(([session, sessionTrades]) => {
                  const sessionPnL = sessionTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);
                  const sessionWins = sessionTrades.filter((t) => t.result === "Win").length;
                  const sessionWinRate = sessionTrades.length > 0 ? (sessionWins / sessionTrades.length) * 100 : 0;
                  const maxPnL = Math.max(...Object.values(sessionStats).map(s => 
                    Math.abs(s.reduce((acc, t) => acc + (t.pnl || 0), 0))
                  ), 1);
                  const barWidth = Math.abs(sessionPnL) / maxPnL * 100;
                  
                  return (
                    <div key={session}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-foreground">{session}</span>
                        <span className={`text-sm font-medium ${sessionPnL >= 0 ? "text-primary" : "text-destructive"}`}>
                          {sessionPnL >= 0 ? "+" : ""}${sessionPnL.toFixed(2)}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${sessionPnL >= 0 ? "bg-primary" : "bg-destructive"}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs text-muted-foreground">{sessionTrades.length} trades</span>
                        <span className="text-xs text-muted-foreground">{sessionWinRate.toFixed(1)}% win rate</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Best Pairs */}
            <div className="bg-card border border-border rounded-xl p-5">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Best Pairs</span>
              {bestPair ? (
                <div className="mt-4">
                  <div className="bg-muted/50 border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-semibold text-foreground">{bestPair[0]}</span>
                      <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <p className={`text-2xl font-bold ${bestPair[1].pnl >= 0 ? "text-primary" : "text-destructive"}`}>
                      {bestPair[1].pnl >= 0 ? "+" : ""}${bestPair[1].pnl.toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {bestPair[1].trades} trades · {((bestPair[1].wins / bestPair[1].trades) * 100).toFixed(1)}% win
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 text-center py-8">
                  <p className="text-muted-foreground">No trades logged yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Empty state for overview */}
          {totalTrades === 0 && (
            <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
              <p className="text-lg text-muted-foreground mb-4">No trades logged yet</p>
              <Button
                onClick={() => setIsLogTradeOpen(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="w-4 h-4 mr-2" />
                Log Your First Trade
              </Button>
            </div>
          )}
        </TabsContent>

        {/* Trades Tab */}
        <TabsContent value="trades" className="mt-6">
          <TradesTable
            trades={trades}
            isLoading={tradesLoading}
            onLogTrade={() => setIsLogTradeOpen(true)}
            strategyId={id!}
          />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="mt-6">
          <StrategySettings strategy={strategy} />
        </TabsContent>
      </Tabs>

      {/* Log Trade Modal */}
      <LogTradeModal
        open={isLogTradeOpen}
        onOpenChange={setIsLogTradeOpen}
        strategyId={id!}
      />
    </div>
  );
};

export default StrategyDetail;
