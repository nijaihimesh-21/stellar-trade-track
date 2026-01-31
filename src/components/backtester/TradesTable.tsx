import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Pencil, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { format } from "date-fns";

interface Trade {
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
  lots: number | null;
  pips: number | null;
  notes: string | null;
}

interface TradesTableProps {
  trades: Trade[];
  isLoading: boolean;
  onLogTrade: () => void;
  onEditTrade: (trade: Trade) => void;
  strategyId: string;
}

const TradesTable: React.FC<TradesTableProps> = ({
  trades,
  isLoading,
  onLogTrade,
  onEditTrade,
  strategyId,
}) => {
  const queryClient = useQueryClient();

  const deleteTrade = useMutation({
    mutationFn: async (tradeId: string) => {
      const { error } = await supabase
        .from("strategy_trades")
        .delete()
        .eq("id", tradeId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategy_trades", strategyId] });
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      toast.success("Trade deleted");
    },
    onError: () => {
      toast.error("Failed to delete trade");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="bg-card border border-dashed border-border rounded-xl p-12 text-center">
        <p className="text-lg text-muted-foreground mb-4">No trades logged yet</p>
        <Button
          onClick={onLogTrade}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          Log Your First Trade
        </Button>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Date</TableHead>
                <TableHead className="text-muted-foreground">Pair</TableHead>
                <TableHead className="text-muted-foreground">Direction</TableHead>
                <TableHead className="text-muted-foreground">Session</TableHead>
                <TableHead className="text-muted-foreground">Entry</TableHead>
                <TableHead className="text-muted-foreground">SL</TableHead>
                <TableHead className="text-muted-foreground">TP</TableHead>
                <TableHead className="text-muted-foreground">Lots</TableHead>
                <TableHead className="text-muted-foreground">Pips</TableHead>
                <TableHead className="text-muted-foreground">R:R</TableHead>
                <TableHead className="text-muted-foreground">Result</TableHead>
                <TableHead className="text-muted-foreground">P&L</TableHead>
                <TableHead className="text-muted-foreground">Notes</TableHead>
                <TableHead className="text-muted-foreground"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.map((trade) => (
                <TableRow key={trade.id} className="border-border hover:bg-muted/30">
                  <TableCell className="text-foreground">
                    {format(new Date(trade.trade_date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-foreground font-medium">{trade.pair}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        trade.direction === "Buy"
                          ? "bg-primary/20 text-primary"
                          : "bg-destructive/20 text-destructive"
                      }`}
                    >
                      {trade.direction}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{trade.session}</TableCell>
                  <TableCell className="text-foreground">{trade.entry_price}</TableCell>
                  <TableCell className="text-muted-foreground">{trade.stop_loss || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{trade.take_profit || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{trade.lots || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{trade.pips || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {trade.risk_reward ? `1:${trade.risk_reward.toFixed(1)}` : "—"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        trade.result === "Win"
                          ? "bg-primary/20 text-primary"
                          : trade.result === "Loss"
                          ? "bg-destructive/20 text-destructive"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {trade.result}
                    </span>
                  </TableCell>
                  <TableCell
                    className={`font-medium ${
                      trade.pnl >= 0 ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    {trade.notes ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1 cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
                            <MessageSquare className="w-4 h-4" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-[300px] bg-popover border-border">
                          <p className="text-sm whitespace-pre-wrap">{trade.notes}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEditTrade(trade)}
                        className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTrade.mutate(trade.id)}
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
};

export default TradesTable;
