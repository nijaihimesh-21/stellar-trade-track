import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, FolderPlus, RefreshCw, TrendingUp, BarChart3, Layers, ChevronRight, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";

interface Strategy {
  id: string;
  name: string;
  description: string | null;
  market: string;
  created_at: string;
  trades_count?: number;
  win_rate?: number;
  expectancy?: number;
}

const Strategies: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newStrategy, setNewStrategy] = useState({ name: "", description: "" });

  // Fetch strategies with trade counts
  const { data: strategies = [], isLoading } = useQuery({
    queryKey: ["strategies", user?.id],
    queryFn: async () => {
      const { data: strategiesData, error: strategiesError } = await supabase
        .from("strategies")
        .select("*")
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (strategiesError) throw strategiesError;

      // Fetch trade counts and calculate metrics for each strategy
      const strategiesWithMetrics = await Promise.all(
        (strategiesData || []).map(async (strategy) => {
          const { data: trades } = await supabase
            .from("strategy_trades")
            .select("*")
            .eq("strategy_id", strategy.id);

          const tradesCount = trades?.length || 0;
          const wins = trades?.filter(t => t.result === "Win").length || 0;
          const winRate = tradesCount > 0 ? (wins / tradesCount) * 100 : 0;
          
          // Calculate expectancy
          const avgWin = trades?.filter(t => t.result === "Win").reduce((acc, t) => acc + (Number(t.pnl) || 0), 0) / (wins || 1);
          const losses = trades?.filter(t => t.result === "Loss").length || 0;
          const avgLoss = Math.abs(trades?.filter(t => t.result === "Loss").reduce((acc, t) => acc + (Number(t.pnl) || 0), 0) / (losses || 1));
          const expectancy = tradesCount > 0 ? ((winRate / 100) * avgWin) - ((1 - winRate / 100) * avgLoss) : 0;

          return {
            ...strategy,
            trades_count: tradesCount,
            win_rate: winRate,
            expectancy: isNaN(expectancy) ? 0 : expectancy / 100,
          };
        })
      );

      return strategiesWithMetrics as Strategy[];
    },
    enabled: !!user?.id,
  });

  const createStrategy = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("strategies")
        .insert({
          user_id: user?.id,
          name: newStrategy.name,
          description: newStrategy.description || null,
          market: "Forex",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      setIsCreateOpen(false);
      setNewStrategy({ name: "", description: "" });
      toast.success("Strategy created successfully");
      navigate(`/backtester/strategy/${data.id}`);
    },
    onError: () => {
      toast.error("Failed to create strategy");
    },
  });

  const handleCreate = () => {
    if (!newStrategy.name.trim()) {
      toast.error("Strategy name is required");
      return;
    }
    createStrategy.mutate();
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Strategy Folders</h1>
          <p className="text-muted-foreground mt-1">Each strategy is an isolated backtesting universe</p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Strategy
        </Button>
      </div>

      {/* Empty State */}
      {strategies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-20 h-20 rounded-2xl border border-dashed border-border flex items-center justify-center mb-6">
            <FolderPlus className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">No Strategies Yet</h2>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            Create your first strategy folder to start backtesting.
            Each strategy is isolated with its own trades, custom fields, and deep analytics.
          </p>
          <div className="flex gap-3">
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <FolderPlus className="w-4 h-4 mr-2" />
              Create First Strategy
            </Button>
            <Button variant="outline" className="border-border text-foreground hover:bg-muted">
              <RefreshCw className="w-4 h-4 mr-2" />
              Recover Existing Data
            </Button>
          </div>

          {/* Feature Icons */}
          <div className="flex gap-12 mt-12">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Log Trades</span>
              <span className="text-xs text-muted-foreground">Manual backtesting</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                <BarChart3 className="w-6 h-6 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Session Analysis</span>
              <span className="text-xs text-muted-foreground">Asia / London / NYC</span>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3">
                <Layers className="w-6 h-6 text-amber-500" />
              </div>
              <span className="text-sm font-medium text-foreground">Custom Fields</span>
              <span className="text-xs text-muted-foreground">Unlimited notes</span>
            </div>
          </div>
        </div>
      ) : (
        /* Strategy Cards Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {strategies.map((strategy) => (
            <div
              key={strategy.id}
              onClick={() => navigate(`/backtester/strategy/${strategy.id}`)}
              className="group relative bg-card border border-border rounded-xl p-5 cursor-pointer transition-all duration-300 hover:border-primary hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-primary">{strategy.name}</h3>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              
              {/* Description */}
              {strategy.description && (
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {strategy.description}
                </p>
              )}

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Trades</span>
                  <p className="text-lg font-bold text-foreground">{strategy.trades_count}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Win Rate</span>
                  <p className="text-lg font-bold text-primary">{strategy.win_rate?.toFixed(1)}%</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Expectancy</span>
                  <p className="text-lg font-bold text-foreground">{strategy.expectancy?.toFixed(2)}R</p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  <span>0 custom fields</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>{format(new Date(strategy.created_at), "MMM d, yyyy")}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Strategy Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-foreground">New Strategy</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Create a new strategy folder. Each strategy is isolated with its own trades, custom fields, and analytics.
            </p>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">Strategy Name</Label>
              <Input
                id="name"
                placeholder="e.g., London Liquidity Sweep"
                value={newStrategy.name}
                onChange={(e) => setNewStrategy({ ...newStrategy, name: e.target.value })}
                className="bg-background border-border focus:border-primary focus:ring-primary/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-foreground">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="description"
                placeholder="Describe your strategy's core logic..."
                value={newStrategy.description}
                onChange={(e) => setNewStrategy({ ...newStrategy, description: e.target.value })}
                className="bg-background border-border focus:border-primary focus:ring-primary/20 min-h-[100px]"
              />
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              <span>Market: Forex (default)</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="ghost"
              onClick={() => setIsCreateOpen(false)}
              className="text-foreground hover:bg-muted"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createStrategy.isPending}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Create Strategy
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Strategies;
