import React, { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface Trade {
  id: string;
  trade_date: string;
  outcome: number;
  session: string | null;
  strategy: string | null;
  position_size: number;
}

type StrategyStatus = "Active" | "Caution" | "Paused";
type HealthLabel = "Healthy" | "Watch" | "Risky" | "Halt Recommended";
type PerformanceLabel = "Strong" | "Tradable" | "Neutral" | "Weak" | "Invalid";
type TrendLabel = "Improving" | "Stable" | "Degrading";

const StrategyHealth: React.FC = () => {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrades = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from("trades")
        .select("id, trade_date, outcome, session, strategy, position_size")
        .eq("user_id", user.id)
        .order("trade_date", { ascending: false });

      if (!error && data) {
        setTrades(data);
      }
      setLoading(false);
    };

    fetchTrades();
  }, [user]);

  const analytics = useMemo(() => {
    if (trades.length === 0) {
      return null;
    }

    // Last 10 trades analysis
    const last10 = trades.slice(0, 10);
    const last10Wins = last10.filter(t => t.outcome > 0).length;
    const last10WinRate = last10.length > 0 ? (last10Wins / last10.length) * 100 : 0;
    const last10NetR = last10.reduce((sum, t) => sum + t.outcome, 0);

    // Last 20 trades analysis
    const last20 = trades.slice(0, 20);
    const last20Wins = last20.filter(t => t.outcome > 0).length;
    const last20WinRate = last20.length > 0 ? (last20Wins / last20.length) * 100 : 0;

    // Previous 20 trades (21-40) for comparison
    const prev20 = trades.slice(20, 40);
    const prev20Wins = prev20.filter(t => t.outcome > 0).length;
    const prev20WinRate = prev20.length > 0 ? (prev20Wins / prev20.length) * 100 : 0;

    // Determine trend
    let trend: TrendLabel = "Stable";
    if (prev20.length >= 10) {
      const diff = last20WinRate - prev20WinRate;
      if (diff > 5) trend = "Improving";
      else if (diff < -5) trend = "Degrading";
    }

    // Performance label for last 10
    let performanceLabel: PerformanceLabel = "Neutral";
    if (last10.length < 5) {
      performanceLabel = "Invalid";
    } else if (last10WinRate >= 60 && last10NetR > 0) {
      performanceLabel = "Strong";
    } else if (last10WinRate >= 50 && last10NetR >= 0) {
      performanceLabel = "Tradable";
    } else if (last10WinRate >= 40) {
      performanceLabel = "Neutral";
    } else {
      performanceLabel = "Weak";
    }

    // Drawdown calculations
    let peak = 0;
    let currentBalance = 0;
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    let drawdownStart: string | null = null;
    let currentDrawdownDays = 0;
    const reversedTrades = [...trades].reverse();

    reversedTrades.forEach((trade, idx) => {
      currentBalance += trade.outcome;
      if (currentBalance > peak) {
        peak = currentBalance;
        drawdownStart = null;
      }
      const dd = peak > 0 ? ((peak - currentBalance) / peak) * 100 : 0;
      if (dd > maxDrawdown) maxDrawdown = dd;
      if (idx === reversedTrades.length - 1) {
        currentDrawdown = dd;
        if (dd > 0 && !drawdownStart) {
          drawdownStart = trade.trade_date;
        }
      }
    });

    // Calculate drawdown duration
    if (drawdownStart && currentDrawdown > 0) {
      const start = new Date(drawdownStart);
      const now = new Date();
      currentDrawdownDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Session analysis
    const sessionStats: Record<string, { wins: number; total: number; pnl: number }> = {};
    trades.forEach(trade => {
      const session = trade.session || "Unknown";
      if (!sessionStats[session]) {
        sessionStats[session] = { wins: 0, total: 0, pnl: 0 };
      }
      sessionStats[session].total++;
      sessionStats[session].pnl += trade.outcome;
      if (trade.outcome > 0) sessionStats[session].wins++;
    });

    const totalPnl = trades.reduce((sum, t) => sum + t.outcome, 0);
    let dominantSession: string | null = null;
    let dominantSessionPct = 0;
    let weakSessions: string[] = [];

    Object.entries(sessionStats).forEach(([session, stats]) => {
      const pct = totalPnl > 0 ? (stats.pnl / totalPnl) * 100 : 0;
      if (pct > dominantSessionPct) {
        dominantSessionPct = pct;
        dominantSession = session;
      }
      const expectancy = stats.total > 0 ? stats.pnl / stats.total : 0;
      if (expectancy < 0 && stats.total >= 5) {
        weakSessions.push(session);
      }
    });

    // Health score calculation (0-100)
    let healthScore = 50;

    // Rolling performance factor (0-30 points)
    if (performanceLabel === "Strong") healthScore += 30;
    else if (performanceLabel === "Tradable") healthScore += 20;
    else if (performanceLabel === "Neutral") healthScore += 10;
    else if (performanceLabel === "Weak") healthScore -= 10;

    // Drawdown factor (0-30 points)
    if (currentDrawdown < 5) healthScore += 30;
    else if (currentDrawdown < 10) healthScore += 20;
    else if (currentDrawdown < 20) healthScore += 10;
    else healthScore -= 10;

    // Trend factor (0-20 points)
    if (trend === "Improving") healthScore += 20;
    else if (trend === "Stable") healthScore += 10;
    else healthScore -= 10;

    // Session dependency factor
    if (dominantSessionPct > 80) healthScore -= 10;

    healthScore = Math.max(0, Math.min(100, healthScore));

    // Health label
    let healthLabel: HealthLabel;
    if (healthScore >= 80) healthLabel = "Healthy";
    else if (healthScore >= 60) healthLabel = "Watch";
    else if (healthScore >= 40) healthLabel = "Risky";
    else healthLabel = "Halt Recommended";

    // Status
    let status: StrategyStatus;
    if (healthScore >= 70) status = "Active";
    else if (healthScore >= 50) status = "Caution";
    else status = "Paused";

    // Action guidance
    let actionGuidance: { icon: string; text: string; secondary?: string };
    if (healthScore >= 80) {
      actionGuidance = { icon: "✅", text: "Continue trading at current risk" };
    } else if (healthScore >= 60) {
      actionGuidance = { icon: "⚠️", text: "Reduce risk (½ size recommended)" };
    } else if (healthScore >= 40) {
      actionGuidance = { icon: "🔍", text: "Trade only during top-performing session", secondary: dominantSession || undefined };
    } else {
      actionGuidance = { icon: "⛔", text: "Pause strategy and review logic" };
    }

    return {
      status,
      healthScore,
      healthLabel,
      last10WinRate,
      last10NetR,
      performanceLabel,
      last20WinRate,
      trend,
      currentDrawdown,
      maxDrawdown,
      currentDrawdownDays,
      dominantSession,
      dominantSessionPct,
      weakSessions,
      actionGuidance,
      totalTrades: trades.length,
    };
  }, [trades]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-muted-foreground">Loading strategy data...</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="max-w-4xl mx-auto">
        <header className="mb-12">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-2">
            Strategy Health & Risk Control
          </h1>
          <p className="text-muted-foreground text-sm">
            Institutional oversight layer for decision-making discipline
          </p>
        </header>
        <div className="border border-border rounded-lg p-8 text-center">
          <p className="text-muted-foreground">No trades recorded yet. Add trades to see strategy health metrics.</p>
        </div>
      </div>
    );
  }

  const getStatusStyle = (status: StrategyStatus) => {
    switch (status) {
      case "Active": return "text-primary";
      case "Caution": return "text-yellow-500";
      case "Paused": return "text-destructive";
    }
  };

  const getHealthStyle = (label: HealthLabel) => {
    switch (label) {
      case "Healthy": return "text-primary";
      case "Watch": return "text-yellow-500";
      case "Risky": return "text-orange-500";
      case "Halt Recommended": return "text-destructive";
    }
  };

  const getPerformanceStyle = (label: PerformanceLabel) => {
    switch (label) {
      case "Strong": return "text-primary";
      case "Tradable": return "text-primary/70";
      case "Neutral": return "text-muted-foreground";
      case "Weak": return "text-orange-500";
      case "Invalid": return "text-muted-foreground";
    }
  };

  const getTrendStyle = (trend: TrendLabel) => {
    switch (trend) {
      case "Improving": return "text-primary";
      case "Stable": return "text-muted-foreground";
      case "Degrading": return "text-destructive";
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <header className="mb-12">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight mb-2">
          Strategy Health & Risk Control
        </h1>
        <p className="text-muted-foreground text-sm">
          Institutional oversight layer for decision-making discipline
        </p>
      </header>

      <div className="space-y-10">
        {/* 1. Strategy Status Header */}
        <section>
          <div className="flex items-baseline justify-between border-b border-border pb-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
                Strategy
              </p>
              <h2 className="text-xl font-medium text-foreground">
                Primary Strategy
              </h2>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">
                Current Status
              </p>
              <p className={`text-xl font-semibold ${getStatusStyle(analytics.status)}`}>
                {analytics.status}
              </p>
            </div>
          </div>
        </section>

        {/* 2. Live Strategy Health Score */}
        <section>
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Strategy Health Score
          </h3>
          <div className="border border-border rounded-lg p-6">
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-light text-foreground tabular-nums">
                {analytics.healthScore}
              </span>
              <span className="text-lg text-muted-foreground">/100</span>
              <span className={`text-sm font-medium ml-4 ${getHealthStyle(analytics.healthLabel)}`}>
                {analytics.healthLabel}
              </span>
            </div>
            <div className="mt-6 pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Composite score derived from rolling performance, drawdown depth, win rate stability, and session consistency.
              </p>
            </div>
          </div>
        </section>

        {/* 3. Rolling Performance Monitor */}
        <section>
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Rolling Performance Monitor
          </h3>
          <div className="border border-border rounded-lg divide-y divide-border">
            {/* Last 10 */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-foreground">Last 10 Trades</p>
                <span className={`text-sm font-medium ${getPerformanceStyle(analytics.performanceLabel)}`}>
                  {analytics.performanceLabel}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
                  <p className="text-2xl font-light text-foreground tabular-nums">
                    {analytics.last10WinRate.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Net R-Multiple</p>
                  <p className={`text-2xl font-light tabular-nums ${analytics.last10NetR >= 0 ? 'text-profit' : 'text-loss'}`}>
                    {analytics.last10NetR >= 0 ? '+' : ''}{analytics.last10NetR.toFixed(2)}R
                  </p>
                </div>
              </div>
            </div>

            {/* Last 20 */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-foreground">Last 20 Trades</p>
                <span className={`text-sm font-medium ${getTrendStyle(analytics.trend)}`}>
                  {analytics.trend}
                </span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Win Rate</p>
                <p className="text-2xl font-light text-foreground tabular-nums">
                  {analytics.last20WinRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Drawdown Control Panel */}
        <section>
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Drawdown Control Panel
          </h3>
          <div className="border border-border rounded-lg p-6">
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Current Drawdown</p>
                <p className={`text-2xl font-light tabular-nums ${analytics.currentDrawdown > 10 ? 'text-loss' : 'text-foreground'}`}>
                  {analytics.currentDrawdown.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Max Historical Drawdown</p>
                <p className="text-2xl font-light text-foreground tabular-nums">
                  {analytics.maxDrawdown.toFixed(1)}%
                </p>
              </div>
            </div>
            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-1">Current Drawdown Duration</p>
              <p className="text-lg font-light text-foreground">
                {analytics.currentDrawdownDays > 0 ? `${analytics.currentDrawdownDays} days` : 'No active drawdown'}
              </p>
            </div>
            {analytics.currentDrawdown > analytics.maxDrawdown * 0.8 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-orange-500">
                  ⚠ Drawdown approaching historical maximum
                </p>
              </div>
            )}
          </div>
        </section>

        {/* 5. Session Dependency Warning */}
        <section>
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Session Dependency Analysis
          </h3>
          <div className="border border-border rounded-lg p-6">
            {analytics.dominantSession && analytics.dominantSessionPct > 50 && (
              <div className="mb-4">
                <p className="text-sm text-foreground">
                  <span className="font-medium">{analytics.dominantSessionPct.toFixed(0)}%</span> of profits generated during{' '}
                  <span className="font-medium">{analytics.dominantSession}</span> session.
                </p>
              </div>
            )}
            {analytics.weakSessions.length > 0 && (
              <div className="pt-4 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  {analytics.weakSessions.join(', ')} session{analytics.weakSessions.length > 1 ? 's show' : ' shows'} negative expectancy.
                </p>
              </div>
            )}
            {!analytics.dominantSession && analytics.weakSessions.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No significant session dependency detected.
              </p>
            )}
          </div>
        </section>

        {/* 6. Strategy Action Guidance */}
        <section>
          <h3 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
            Recommended Action
          </h3>
          <div className="border border-border rounded-lg p-6 bg-card">
            <div className="flex items-start gap-4">
              <span className="text-2xl">{analytics.actionGuidance.icon}</span>
              <div>
                <p className="text-lg font-medium text-foreground">
                  {analytics.actionGuidance.text}
                </p>
                {analytics.actionGuidance.secondary && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Recommended session: {analytics.actionGuidance.secondary}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Footer note */}
        <footer className="pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Analysis based on {analytics.totalTrades} recorded trades. Review weekly for optimal decision-making.
          </p>
        </footer>
      </div>
    </div>
  );
};

export default StrategyHealth;
