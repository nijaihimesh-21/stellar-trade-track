import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import type { TimeWindowPeriod } from "@/hooks/useTimeWindow";

interface Trade {
  id: string;
  pair: string;
  outcome: number;
  session: string | null;
  trade_date: string;
  trade_time?: string;
}

interface PnLLineChartProps {
  trades: Trade[];
  period: TimeWindowPeriod;
  dateRange: { start: string; end: string };
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-xl">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p
        className="text-sm font-bold"
        style={{ color: payload[0].value >= 0 ? "hsl(160, 84%, 45%)" : "hsl(0, 84%, 60%)" }}
      >
        {payload[0].value >= 0 ? "+" : ""}${payload[0].value.toFixed(2)}
      </p>
    </div>
  );
};

const GlowDot = (props: any) => {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill="hsl(160, 84%, 39%)" opacity={0.25} />
      <circle cx={cx} cy={cy} r={5} fill="hsl(160, 84%, 39%)" opacity={0.5} />
      <circle cx={cx} cy={cy} r={3} fill="hsl(160, 84%, 55%)" />
    </g>
  );
};

const PnLLineChart: React.FC<PnLLineChartProps> = ({ trades, period, dateRange }) => {
  const chartData = useMemo(() => {
    if (period === "daily") {
      // Group by hour (0-23)
      const hourly: Record<number, number> = {};
      for (let h = 0; h < 24; h++) hourly[h] = 0;
      trades.forEach((t) => {
        if (t.trade_time) {
          const hour = parseInt(t.trade_time.split(":")[0], 10);
          if (!isNaN(hour)) hourly[hour] += Number(t.outcome);
        }
      });
      // Cumulative
      let cum = 0;
      return Object.entries(hourly).map(([h, pnl]) => {
        cum += pnl;
        return { label: `${String(h).padStart(2, "0")}:00`, pnl: cum };
      });
    }

    if (period === "weekly") {
      // Group by day
      const start = parseISO(dateRange.start);
      const end = parseISO(dateRange.end);
      const days = eachDayOfInterval({ start, end });
      const dailyMap: Record<string, number> = {};
      days.forEach((d) => (dailyMap[format(d, "yyyy-MM-dd")] = 0));
      trades.forEach((t) => {
        if (dailyMap[t.trade_date] !== undefined) dailyMap[t.trade_date] += Number(t.outcome);
      });
      let cum = 0;
      return days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        cum += dailyMap[key] || 0;
        return { label: format(d, "EEE"), pnl: cum };
      });
    }

    // Monthly - group by day of month
    const start = parseISO(dateRange.start);
    const end = parseISO(dateRange.end);
    const days = eachDayOfInterval({ start, end });
    const dailyMap: Record<string, number> = {};
    days.forEach((d) => (dailyMap[format(d, "yyyy-MM-dd")] = 0));
    trades.forEach((t) => {
      if (dailyMap[t.trade_date] !== undefined) dailyMap[t.trade_date] += Number(t.outcome);
    });
    let cum = 0;
    return days.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      cum += dailyMap[key] || 0;
      return { label: format(d, "dd MMM"), pnl: cum };
    });
  }, [trades, period, dateRange]);

  const periodLabel =
    period === "daily" ? "Hourly P&L" : period === "weekly" ? "Daily P&L" : "Monthly P&L";

  return (
    <div className="stat-card">
      <p className="text-muted-foreground text-sm mb-4">{periodLabel}</p>
      <div className="h-[280px] sm:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="lineGlow" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(160, 84%, 45%)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(160, 84%, 45%)" stopOpacity={0} />
              </linearGradient>
              <filter id="glowFilter">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0, 0%, 14%)" />
            <XAxis
              dataKey="label"
              stroke="hsl(0, 0%, 55%)"
              tick={{ fontSize: 11, fill: "hsl(0, 0%, 55%)" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(0, 0%, 14%)" }}
              interval={period === "monthly" ? Math.max(Math.floor(chartData.length / 8), 1) : 0}
            />
            <YAxis
              stroke="hsl(0, 0%, 55%)"
              tick={{ fontSize: 11, fill: "hsl(0, 0%, 55%)" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(0, 0%, 14%)" }}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(160, 84%, 39%)", strokeWidth: 1, strokeDasharray: "4 4" }} />
            <Line
              type="monotone"
              dataKey="pnl"
              stroke="hsl(160, 84%, 45%)"
              strokeWidth={2}
              dot={false}
              activeDot={<GlowDot />}
              filter="url(#glowFilter)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PnLLineChart;
