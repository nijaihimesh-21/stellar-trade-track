import React, { useMemo, useState, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { format, parseISO, eachDayOfInterval, addDays, startOfMonth } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
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
        ${payload[0].value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

const CustomCursor = (props: any) => {
  const { points, top, left, height, payload } = props;
  if (!points || !points.length) return null;
  const { x, y } = points[0];
  // payload here is the array of tooltip entries; each has a .payload with the data point
  const dataPoint = payload?.[0]?.payload;
  const balance = dataPoint?.pnl;
  const formattedValue = balance != null
    ? `$${Number(balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : "";
  const labelWidth = formattedValue.length * 6.5 + 12;
  return (
    <g>
      {/* Vertical dashed line */}
      <line
        x1={x} y1={top} x2={x} y2={top + height}
        stroke="hsl(160, 84%, 39%)" strokeWidth={1} strokeDasharray="4 4" opacity={0.6}
      />
      {/* Horizontal dashed line to Y-axis */}
      <line
        x1={left} y1={y} x2={x} y2={y}
        stroke="hsl(160, 84%, 39%)" strokeWidth={1} strokeDasharray="4 4" opacity={0.6}
      />
      {/* Y-axis balance label */}
      {formattedValue && (
        <g>
          <rect x={left - labelWidth - 2} y={y - 10} width={labelWidth} height={20} rx={4} fill="hsl(160, 84%, 39%)" opacity={0.9} />
          <text x={left - labelWidth + 4} y={y + 4} fontSize={10} fill="hsl(0, 0%, 5%)" fontWeight={600}>
            {formattedValue}
          </text>
        </g>
      )}
    </g>
  );
};

const PnLLineChart: React.FC<PnLLineChartProps> = ({ trades, period, dateRange }) => {
  const { user } = useAuth();
  const [startingBalance, setStartingBalance] = useState<number>(0);
  const [brokerCharges, setBrokerCharges] = useState<number>(0);
  const [carriedForwardPnl, setCarriedForwardPnl] = useState<number>(0);
  const [monthWithdrawals, setMonthWithdrawals] = useState<number>(0);

  useEffect(() => {
    const fetchBalanceContext = async () => {
      if (!user) return;

      const startDate = parseISO(dateRange.start);
      const year = startDate.getFullYear();
      const monthZeroBased = startDate.getMonth();
      const monthOneBased = monthZeroBased + 1;

      // 1. Try month-specific balance
      const { data: monthData } = await supabase
        .from("monthly_balances")
        .select("starting_balance, broker_charges")
        .eq("user_id", user.id)
        .eq("year", year)
        .eq("month", monthZeroBased)
        .eq("is_global", false)
        .maybeSingle();

      let resolvedBalance: number | null = null;
      let resolvedCharges = 0;

      if (monthData) {
        resolvedBalance = Number(monthData.starting_balance);
        resolvedCharges = Number(monthData.broker_charges ?? 0);
      } else {
        // 2. Carry forward from previous months
        const carried = await computeCarriedForwardBalance(year, monthZeroBased);
        if (carried !== null) {
          resolvedBalance = carried;
          resolvedCharges = 0;
        } else {
          // 3. Fall back to global
          const { data: globalData } = await supabase
            .from("monthly_balances")
            .select("starting_balance")
            .eq("user_id", user.id)
            .eq("is_global", true)
            .maybeSingle();

          resolvedBalance = globalData ? Number(globalData.starting_balance) : 0;
          resolvedCharges = 0;
        }
      }

      setStartingBalance(resolvedBalance ?? 0);
      setBrokerCharges(resolvedCharges);

      // Fetch month withdrawals
      const wStartDate = `${year}-${String(monthOneBased).padStart(2, "0")}-01`;
      const endDay = new Date(year, monthOneBased, 0).getDate();
      const wEndDate = `${year}-${String(monthOneBased).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

      const { data: wData } = await supabase
        .from("withdrawals")
        .select("amount")
        .eq("user_id", user.id)
        .gte("withdrawal_date", wStartDate)
        .lte("withdrawal_date", wEndDate);

      setMonthWithdrawals((wData || []).reduce((s, w) => s + Number(w.amount), 0));

      // Carry forward month-to-date P&L before the current visible range
      const monthStart = format(startOfMonth(startDate), "yyyy-MM-dd");
      const previousDay = format(addDays(startDate, -1), "yyyy-MM-dd");

      if (previousDay < monthStart) {
        setCarriedForwardPnl(0);
        return;
      }

      const { data: previousTrades } = await supabase
        .from("trades")
        .select("outcome")
        .eq("user_id", user.id)
        .gte("trade_date", monthStart)
        .lte("trade_date", previousDay);

      setCarriedForwardPnl(
        (previousTrades ?? []).reduce((sum, t) => sum + Number(t.outcome ?? 0), 0)
      );
    };

    const computeCarriedForwardBalance = async (
      targetYear: number,
      targetMonth: number
    ): Promise<number | null> => {
      if (!user) return null;

      const { data: allBalances } = await supabase
        .from("monthly_balances")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_global", false);

      const { data: globalData } = await supabase
        .from("monthly_balances")
        .select("starting_balance")
        .eq("user_id", user.id)
        .eq("is_global", true)
        .maybeSingle();

      const balanceMap = new Map<number, { starting_balance: number; broker_charges: number }>();
      (allBalances || []).forEach((b) => {
        const key = b.year * 12 + b.month;
        balanceMap.set(key, {
          starting_balance: Number(b.starting_balance),
          broker_charges: Number(b.broker_charges ?? 0),
        });
      });

      const targetKey = targetYear * 12 + targetMonth;

      let anchorKey: number | null = null;
      for (const key of Array.from(balanceMap.keys()).sort((a, b) => b - a)) {
        if (key < targetKey) { anchorKey = key; break; }
      }

      let runningBalance: number;
      let startKey: number;

      if (anchorKey !== null) {
        runningBalance = balanceMap.get(anchorKey)!.starting_balance;
        startKey = anchorKey;
      } else if (globalData) {
        runningBalance = Number(globalData.starting_balance);
        const { data: earliest } = await supabase
          .from("trades")
          .select("trade_date")
          .eq("user_id", user.id)
          .order("trade_date", { ascending: true })
          .limit(1);
        if (!earliest?.length) return null;
        const ed = new Date(earliest[0].trade_date);
        startKey = ed.getFullYear() * 12 + ed.getMonth();
        if (startKey >= targetKey) return null;
      } else {
        return null;
      }

      for (let k = startKey; k < targetKey; k++) {
        const y = Math.floor(k / 12);
        const m = k % 12;
        const monthBal = balanceMap.get(k);

        if (monthBal && k !== startKey) {
          runningBalance = monthBal.starting_balance;
        }

        const charges = monthBal?.broker_charges ?? 0;
        const mn = m + 1;
        const sd = `${y}-${String(mn).padStart(2, "0")}-01`;
        const ed2 = new Date(y, mn, 0).getDate();
        const endD = `${y}-${String(mn).padStart(2, "0")}-${String(ed2).padStart(2, "0")}`;

        const { data: mTrades } = await supabase
          .from("trades").select("outcome").eq("user_id", user.id)
          .gte("trade_date", sd).lte("trade_date", endD);

        const { data: mWith } = await supabase
          .from("withdrawals").select("amount").eq("user_id", user.id)
          .gte("withdrawal_date", sd).lte("withdrawal_date", endD);

        const pnl = (mTrades || []).reduce((s, t) => s + Number(t.outcome), 0);
        const wth = (mWith || []).reduce((s, w) => s + Number(w.amount), 0);

        runningBalance = runningBalance + pnl - charges - wth;
      }

      return runningBalance;
    };

    fetchBalanceContext();
  }, [user, dateRange.start]);

  const chartData = useMemo(() => {
    const base = startingBalance - brokerCharges - monthWithdrawals + carriedForwardPnl;
    const now = new Date();
    const currentHour = now.getHours();
    const todayStr = format(now, "yyyy-MM-dd");

    if (period === "daily") {
      const hourly: Record<number, number> = {};
      for (let h = 0; h <= currentHour; h++) hourly[h] = 0;
      trades.forEach((t) => {
        if (t.trade_time) {
          const hour = parseInt(t.trade_time.split(":")[0], 10);
          if (!isNaN(hour) && hour <= currentHour) hourly[hour] += Number(t.outcome);
        }
      });
      let cum = base;
      return Object.entries(hourly).map(([h, pnl]) => {
        cum += pnl;
        return { label: `${String(h).padStart(2, "0")}:00`, pnl: cum };
      });
    }

    if (period === "weekly") {
      const start = parseISO(dateRange.start);
      const end = parseISO(dateRange.end);
      const days = eachDayOfInterval({ start, end }).filter((d) => format(d, "yyyy-MM-dd") <= todayStr);
      const dailyMap: Record<string, number> = {};
      days.forEach((d) => (dailyMap[format(d, "yyyy-MM-dd")] = 0));
      trades.forEach((t) => {
        if (dailyMap[t.trade_date] !== undefined) dailyMap[t.trade_date] += Number(t.outcome);
      });
      let cum = base;
      return days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        cum += dailyMap[key] || 0;
        return { label: format(d, "EEE"), pnl: cum };
      });
    }

    // Monthly
    const start = parseISO(dateRange.start);
    const end = parseISO(dateRange.end);
    const days = eachDayOfInterval({ start, end }).filter((d) => format(d, "yyyy-MM-dd") <= todayStr);
    const dailyMap: Record<string, number> = {};
    days.forEach((d) => (dailyMap[format(d, "yyyy-MM-dd")] = 0));
    trades.forEach((t) => {
      if (dailyMap[t.trade_date] !== undefined) dailyMap[t.trade_date] += Number(t.outcome);
    });
    let cum = base;
    return days.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      cum += dailyMap[key] || 0;
      return { label: format(d, "dd MMM"), pnl: cum };
    });
  }, [trades, period, dateRange, startingBalance, brokerCharges, monthWithdrawals, carriedForwardPnl]);

  const periodLabel =
    period === "daily" ? "Hourly Account Balance" : period === "weekly" ? "Daily Account Balance" : "Monthly Account Balance";

  return (
    <div className="stat-card">
      <p className="text-muted-foreground text-sm mb-4">{periodLabel}</p>
      <div className="h-[280px] sm:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
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
              tick={{ fontSize: 10, fill: "hsl(0, 0%, 55%)" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(0, 0%, 14%)" }}
              interval={period === "monthly" ? Math.max(Math.floor(chartData.length / 6), 1) : period === "weekly" ? 0 : Math.max(Math.floor(chartData.length / 8), 1)}
              angle={period === "monthly" ? -45 : 0}
              textAnchor={period === "monthly" ? "end" : "middle"}
              height={period === "monthly" ? 50 : 30}
            />
            <YAxis
              stroke="hsl(0, 0%, 55%)"
              tick={{ fontSize: 11, fill: "hsl(0, 0%, 55%)" }}
              tickLine={false}
              axisLine={{ stroke: "hsl(0, 0%, 14%)" }}
              tickFormatter={(v) => `$${v.toLocaleString()}`}
              domain={["dataMin - 50", "dataMax + 50"]}
            />
            <Tooltip content={<CustomTooltip />} cursor={<CustomCursor />} />
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
