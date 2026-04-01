import jsPDF from "jspdf";
import { format } from "date-fns";

interface Trade {
  id: string;
  pair: string;
  outcome: number;
  session: string | null;
  trade_date: string;
  trade_time: string;
  strategy: string | null;
  risk_reward: string | null;
  notes: string | null;
}

interface PsychEntry {
  period_type: string;
  period_start: string;
  period_end: string;
  title: string | null;
  mental_state: string | null;
  emotions: string | null;
  lessons_learned: string | null;
  improvements: string | null;
  strategy_improvement: string | null;
  conclusion: string | null;
  rating: number | null;
}

interface ReportConfig {
  trades: Trade[];
  psychologyEntries: PsychEntry[];
  periodLabel: string;
  dateRange: { start: string; end: string };
}

const C = {
  dark: [15, 23, 42] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  card: [248, 250, 252] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  text: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  accent: [59, 130, 246] as [number, number, number],
  green: [34, 197, 94] as [number, number, number],
  red: [239, 68, 68] as [number, number, number],
  amber: [245, 158, 11] as [number, number, number],
};

export async function generateTradeLogPDF(config: ReportConfig): Promise<void> {
  const { trades, psychologyEntries, periodLabel, dateRange } = config;
  const pdf = new jsPDF("p", "mm", "a4");
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 20;
  const CW = W - M * 2;

  const fmtPnL = (v: number) => `${v >= 0 ? "+" : ""}$${Math.abs(v).toFixed(2)}`;

  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.outcome > 0).length;
  const losses = trades.filter((t) => t.outcome < 0).length;
  const be = trades.filter((t) => t.outcome === 0).length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const totalPnL = trades.reduce((s, t) => s + t.outcome, 0);
  const avgWin = wins > 0 ? trades.filter((t) => t.outcome > 0).reduce((s, t) => s + t.outcome, 0) / wins : 0;
  const avgLoss = losses > 0 ? Math.abs(trades.filter((t) => t.outcome < 0).reduce((s, t) => s + t.outcome, 0) / losses) : 0;

  // Parse R:R values
  const rrValues = trades
    .filter((t) => t.risk_reward)
    .map((t) => {
      const parts = t.risk_reward!.split(":");
      return parts.length === 2 ? parseFloat(parts[1]) / (parseFloat(parts[0]) || 1) : parseFloat(t.risk_reward!) || 0;
    })
    .filter((v) => !isNaN(v));
  const avgRR = rrValues.length > 0 ? rrValues.reduce((s, v) => s + v, 0) / rrValues.length : 0;

  // Pair stats
  const pairMap: Record<string, { trades: number; wins: number; losses: number; pnl: number; rrVals: number[] }> = {};
  trades.forEach((t) => {
    if (!pairMap[t.pair]) pairMap[t.pair] = { trades: 0, wins: 0, losses: 0, pnl: 0, rrVals: [] };
    pairMap[t.pair].trades++;
    if (t.outcome > 0) pairMap[t.pair].wins++;
    if (t.outcome < 0) pairMap[t.pair].losses++;
    pairMap[t.pair].pnl += t.outcome;
    if (t.risk_reward) {
      const parts = t.risk_reward.split(":");
      const rr = parts.length === 2 ? parseFloat(parts[1]) / (parseFloat(parts[0]) || 1) : parseFloat(t.risk_reward) || 0;
      if (!isNaN(rr)) pairMap[t.pair].rrVals.push(rr);
    }
  });

  // Session stats
  const sessionMap: Record<string, { trades: number; wins: number; losses: number; pnl: number; rrVals: number[] }> = {};
  trades.forEach((t) => {
    const s = t.session || "Unknown";
    if (!sessionMap[s]) sessionMap[s] = { trades: 0, wins: 0, losses: 0, pnl: 0, rrVals: [] };
    sessionMap[s].trades++;
    if (t.outcome > 0) sessionMap[s].wins++;
    if (t.outcome < 0) sessionMap[s].losses++;
    sessionMap[s].pnl += t.outcome;
    if (t.risk_reward) {
      const parts = t.risk_reward.split(":");
      const rr = parts.length === 2 ? parseFloat(parts[1]) / (parseFloat(parts[0]) || 1) : parseFloat(t.risk_reward) || 0;
      if (!isNaN(rr)) sessionMap[s].rrVals.push(rr);
    }
  });

  // Strategy stats
  const stratMap: Record<string, { trades: number; wins: number; losses: number; pnl: number; rrVals: number[] }> = {};
  trades.forEach((t) => {
    const s = t.strategy || "No Strategy";
    if (!stratMap[s]) stratMap[s] = { trades: 0, wins: 0, losses: 0, pnl: 0, rrVals: [] };
    stratMap[s].trades++;
    if (t.outcome > 0) stratMap[s].wins++;
    if (t.outcome < 0) stratMap[s].losses++;
    stratMap[s].pnl += t.outcome;
    if (t.risk_reward) {
      const parts = t.risk_reward.split(":");
      const rr = parts.length === 2 ? parseFloat(parts[1]) / (parseFloat(parts[0]) || 1) : parseFloat(t.risk_reward) || 0;
      if (!isNaN(rr)) stratMap[s].rrVals.push(rr);
    }
  });

  const sortedPairs = Object.entries(pairMap).sort((a, b) => b[1].pnl - a[1].pnl);
  const maxProfitPair = sortedPairs[0];
  const maxLossPair = sortedPairs[sortedPairs.length - 1];

  // Collect notes/mistakes
  const tradeNotes = trades.filter((t) => t.notes).map((t) => ({ date: t.trade_date, pair: t.pair, note: t.notes! }));

  // Helper: draw footer
  const drawFooter = (pageNum: number, totalPages: number) => {
    pdf.setDrawColor(...C.border);
    pdf.line(M, H - 18, W - M, H - 18);
    pdf.setTextColor(...C.muted);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.text("CONFIDENTIAL — Trade Log Performance Report", M, H - 11);
    pdf.text(`Page ${pageNum} of ${totalPages}`, W - M, H - 11, { align: "right" });
  };

  const drawAccent = (y: number) => {
    pdf.setDrawColor(...C.accent);
    pdf.setLineWidth(0.8);
    pdf.line(M, y, M + 50, y);
  };

  // Count total pages
  const totalPages = 4;

  // ===================== PAGE 1: COVER =====================
  pdf.setFillColor(...C.dark);
  pdf.rect(0, 0, W, H, "F");

  pdf.setFillColor(...C.accent);
  pdf.rect(0, H * 0.36, W, 2.5, "F");

  pdf.setTextColor(...C.white);
  pdf.setFontSize(28);
  pdf.setFont("helvetica", "bold");
  pdf.text("TRADE LOG", W / 2, H * 0.44, { align: "center" });
  pdf.setFontSize(22);
  pdf.text("PERFORMANCE REPORT", W / 2, H * 0.50, { align: "center" });

  pdf.setTextColor(...C.accent);
  pdf.setFontSize(16);
  pdf.text(periodLabel.toUpperCase(), W / 2, H * 0.57, { align: "center" });

  pdf.setTextColor(...C.muted);
  pdf.setFontSize(11);
  pdf.text(`${dateRange.start}  —  ${dateRange.end}`, W / 2, H * 0.62, { align: "center" });

  // Quick stats on cover
  const coverY = H * 0.70;
  const coverCards = [
    { label: "TRADES", value: totalTrades.toString() },
    { label: "WIN RATE", value: `${winRate.toFixed(1)}%` },
    { label: "NET P&L", value: fmtPnL(totalPnL) },
  ];
  const ccw = CW / 3;
  coverCards.forEach((c, i) => {
    const x = M + i * ccw + ccw / 2;
    pdf.setTextColor(...C.muted);
    pdf.setFontSize(8);
    pdf.text(c.label, x, coverY, { align: "center" });
    pdf.setTextColor(...C.white);
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text(c.value, x, coverY + 10, { align: "center" });
  });

  pdf.setFillColor(...C.accent);
  pdf.rect(0, H * 0.88, W, 2.5, "F");
  pdf.setTextColor(...C.muted);
  pdf.setFontSize(8);
  pdf.text("CONFIDENTIAL", W / 2, H * 0.92, { align: "center" });
  pdf.setFontSize(7);
  pdf.text(`Generated: ${format(new Date(), "MMMM d, yyyy")}`, W / 2, H * 0.95, { align: "center" });

  // ===================== PAGE 2: OVERVIEW & WIN RATES =====================
  pdf.addPage();
  pdf.setFillColor(...C.white);
  pdf.rect(0, 0, W, H, "F");
  let y = M;

  pdf.setTextColor(...C.text);
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text("PERFORMANCE OVERVIEW", M, y);
  y += 4;
  drawAccent(y);
  y += 14;

  // Top metric cards
  const metricW = (CW - 9) / 4;
  const metrics = [
    { label: "Total Trades", value: totalTrades.toString(), sub: `${wins}W / ${losses}L / ${be}BE` },
    { label: "Win Rate", value: `${winRate.toFixed(1)}%`, sub: "Overall", color: C.green },
    { label: "Net P&L", value: fmtPnL(totalPnL), sub: "Period Total", color: totalPnL >= 0 ? C.green : C.red },
    { label: "Avg R:R", value: `1:${avgRR.toFixed(1)}`, sub: "Risk to Reward" },
  ];

  metrics.forEach((m, i) => {
    const x = M + i * (metricW + 3);
    pdf.setFillColor(...C.card);
    pdf.setDrawColor(...C.border);
    pdf.roundedRect(x, y, metricW, 34, 2, 2, "FD");
    pdf.setTextColor(...C.muted);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.text(m.label, x + 5, y + 9);
    pdf.setTextColor(...(m.color || C.text));
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(m.value, x + 5, y + 21);
    pdf.setTextColor(...C.muted);
    pdf.setFontSize(6);
    pdf.setFont("helvetica", "normal");
    pdf.text(m.sub, x + 5, y + 28);
  });
  y += 42;

  // Win Rate by Pair
  pdf.setTextColor(...C.text);
  pdf.setFontSize(12);
  pdf.setFont("helvetica", "bold");
  pdf.text("Win Rate by Pair", M, y);
  y += 6;

  // Table header
  const colWidths = [35, 22, 22, 30, 30, 30];
  const headers = ["Pair", "Trades", "Wins", "Win Rate", "Avg R:R", "Net P&L"];
  pdf.setFillColor(...C.dark);
  pdf.rect(M, y, CW, 8, "F");
  pdf.setTextColor(...C.white);
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "bold");
  let cx = M + 4;
  headers.forEach((h, i) => {
    pdf.text(h, cx, y + 5.5);
    cx += colWidths[i];
  });
  y += 8;

  sortedPairs.forEach(([pair, stats], idx) => {
    if (y > H - 35) return; // prevent overflow
    const bg = idx % 2 === 0 ? C.white : C.card;
    pdf.setFillColor(...bg);
    pdf.rect(M, y, CW, 7, "F");
    pdf.setTextColor(...C.text);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    let cx = M + 4;
    const wr = stats.trades > 0 ? ((stats.wins / stats.trades) * 100).toFixed(1) + "%" : "0%";
    const pairRR = stats.rrVals.length > 0 ? `1:${(stats.rrVals.reduce((a, b) => a + b, 0) / stats.rrVals.length).toFixed(1)}` : "—";
    const vals = [pair, stats.trades.toString(), stats.wins.toString(), wr, pairRR, fmtPnL(stats.pnl)];
    vals.forEach((v, i) => {
      if (i === 5) {
        pdf.setTextColor(...(stats.pnl >= 0 ? C.green : C.red));
      }
      pdf.text(v, cx, y + 5);
      if (i === 5) pdf.setTextColor(...C.text);
      cx += colWidths[i];
    });
    y += 7;
  });
  y += 8;

  // Win Rate by Session
  if (y < H - 60) {
    pdf.setTextColor(...C.text);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("Win Rate by Session", M, y);
    y += 6;

    pdf.setFillColor(...C.dark);
    pdf.rect(M, y, CW, 8, "F");
    pdf.setTextColor(...C.white);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    cx = M + 4;
    headers.forEach((h, i) => {
      pdf.text(h === "Pair" ? "Session" : h, cx, y + 5.5);
      cx += colWidths[i];
    });
    y += 8;

    Object.entries(sessionMap).forEach(([session, stats], idx) => {
      if (y > H - 35) return;
      const bg = idx % 2 === 0 ? C.white : C.card;
      pdf.setFillColor(...bg);
      pdf.rect(M, y, CW, 7, "F");
      pdf.setTextColor(...C.text);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      let cx = M + 4;
      const wr = stats.trades > 0 ? ((stats.wins / stats.trades) * 100).toFixed(1) + "%" : "0%";
      const sRR = stats.rrVals.length > 0 ? `1:${(stats.rrVals.reduce((a, b) => a + b, 0) / stats.rrVals.length).toFixed(1)}` : "—";
      const vals = [session, stats.trades.toString(), stats.wins.toString(), wr, sRR, fmtPnL(stats.pnl)];
      vals.forEach((v, i) => {
        if (i === 5) pdf.setTextColor(...(stats.pnl >= 0 ? C.green : C.red));
        pdf.text(v, cx, y + 5);
        if (i === 5) pdf.setTextColor(...C.text);
        cx += colWidths[i];
      });
      y += 7;
    });
    y += 8;
  }

  // Win Rate by Strategy
  if (y < H - 50 && Object.keys(stratMap).length > 0) {
    pdf.setTextColor(...C.text);
    pdf.setFontSize(12);
    pdf.setFont("helvetica", "bold");
    pdf.text("Win Rate by Strategy", M, y);
    y += 6;

    pdf.setFillColor(...C.dark);
    pdf.rect(M, y, CW, 8, "F");
    pdf.setTextColor(...C.white);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    cx = M + 4;
    headers.forEach((h, i) => {
      pdf.text(h === "Pair" ? "Strategy" : h, cx, y + 5.5);
      cx += colWidths[i];
    });
    y += 8;

    Object.entries(stratMap).forEach(([strat, stats], idx) => {
      if (y > H - 35) return;
      const bg = idx % 2 === 0 ? C.white : C.card;
      pdf.setFillColor(...bg);
      pdf.rect(M, y, CW, 7, "F");
      pdf.setTextColor(...C.text);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      let cx = M + 4;
      const wr = stats.trades > 0 ? ((stats.wins / stats.trades) * 100).toFixed(1) + "%" : "0%";
      const sRR = stats.rrVals.length > 0 ? `1:${(stats.rrVals.reduce((a, b) => a + b, 0) / stats.rrVals.length).toFixed(1)}` : "—";
      const name = strat.length > 18 ? strat.substring(0, 18) + "..." : strat;
      const vals = [name, stats.trades.toString(), stats.wins.toString(), wr, sRR, fmtPnL(stats.pnl)];
      vals.forEach((v, i) => {
        if (i === 5) pdf.setTextColor(...(stats.pnl >= 0 ? C.green : C.red));
        pdf.text(v, cx, y + 5);
        if (i === 5) pdf.setTextColor(...C.text);
        cx += colWidths[i];
      });
      y += 7;
    });
  }

  drawFooter(1, totalPages);

  // ===================== PAGE 3: BEST/WORST PAIRS & NOTES =====================
  pdf.addPage();
  pdf.setFillColor(...C.white);
  pdf.rect(0, 0, W, H, "F");
  y = M;

  pdf.setTextColor(...C.text);
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text("KEY INSIGHTS", M, y);
  y += 4;
  drawAccent(y);
  y += 14;

  // Max Profit / Max Loss pair cards
  const halfW = (CW - 6) / 2;

  // Max Profit Pair
  if (maxProfitPair && maxProfitPair[1].pnl > 0) {
    pdf.setFillColor(...C.card);
    pdf.setDrawColor(...C.border);
    pdf.roundedRect(M, y, halfW, 40, 2, 2, "FD");
    // Green top bar
    pdf.setFillColor(...C.green);
    pdf.roundedRect(M, y, halfW, 3, 2, 2, "F");
    pdf.rect(M, y + 2, halfW, 1, "F");

    pdf.setTextColor(...C.muted);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.text("MAX PROFIT PAIR", M + 6, y + 12);
    pdf.setTextColor(...C.text);
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text(maxProfitPair[0], M + 6, y + 22);
    pdf.setTextColor(...C.green);
    pdf.setFontSize(12);
    pdf.text(fmtPnL(maxProfitPair[1].pnl), M + 6, y + 32);
    pdf.setTextColor(...C.muted);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    const mpWr = maxProfitPair[1].trades > 0 ? ((maxProfitPair[1].wins / maxProfitPair[1].trades) * 100).toFixed(0) : "0";
    pdf.text(`${maxProfitPair[1].trades} trades · ${mpWr}% win`, M + halfW - 6, y + 32, { align: "right" });
  }

  // Max Loss Pair
  if (maxLossPair && maxLossPair[1].pnl < 0) {
    const lx = M + halfW + 6;
    pdf.setFillColor(...C.card);
    pdf.setDrawColor(...C.border);
    pdf.roundedRect(lx, y, halfW, 40, 2, 2, "FD");
    pdf.setFillColor(...C.red);
    pdf.roundedRect(lx, y, halfW, 3, 2, 2, "F");
    pdf.rect(lx, y + 2, halfW, 1, "F");

    pdf.setTextColor(...C.muted);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.text("MAX LOSS PAIR", lx + 6, y + 12);
    pdf.setTextColor(...C.text);
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text(maxLossPair[0], lx + 6, y + 22);
    pdf.setTextColor(...C.red);
    pdf.setFontSize(12);
    pdf.text(fmtPnL(maxLossPair[1].pnl), lx + 6, y + 32);
    pdf.setTextColor(...C.muted);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    const mlWr = maxLossPair[1].trades > 0 ? ((maxLossPair[1].wins / maxLossPair[1].trades) * 100).toFixed(0) : "0";
    pdf.text(`${maxLossPair[1].trades} trades · ${mlWr}% win`, lx + halfW - 6, y + 32, { align: "right" });
  }
  y += 50;

  // Notes / Mistakes Summary
  pdf.setTextColor(...C.text);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Trade Notes & Mistakes Summary", M, y);
  y += 8;

  if (tradeNotes.length === 0) {
    pdf.setTextColor(...C.muted);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "italic");
    pdf.text("No trade notes recorded for this period.", M, y);
    y += 10;
  } else {
    tradeNotes.slice(0, 15).forEach((n) => {
      if (y > H - 35) return;
      pdf.setFillColor(...C.card);
      pdf.setDrawColor(...C.border);
      const noteText = pdf.splitTextToSize(n.note, CW - 50);
      const noteH = Math.max(10, noteText.length * 4 + 6);
      pdf.roundedRect(M, y, CW, noteH, 1, 1, "FD");

      pdf.setTextColor(...C.accent);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${n.date}  ·  ${n.pair}`, M + 4, y + 5);

      pdf.setTextColor(...C.text);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.text(noteText, M + 4, y + 10);
      y += noteH + 3;
    });
    if (tradeNotes.length > 15) {
      pdf.setTextColor(...C.muted);
      pdf.setFontSize(7);
      pdf.text(`... and ${tradeNotes.length - 15} more notes`, M, y);
      y += 8;
    }
  }

  drawFooter(2, totalPages);

  // ===================== PAGE 4: PSYCHOLOGY SUMMARY =====================
  pdf.addPage();
  pdf.setFillColor(...C.white);
  pdf.rect(0, 0, W, H, "F");
  y = M;

  pdf.setTextColor(...C.text);
  pdf.setFontSize(18);
  pdf.setFont("helvetica", "bold");
  pdf.text("PSYCHOLOGY REVIEW", M, y);
  y += 4;
  drawAccent(y);
  y += 14;

  if (psychologyEntries.length === 0) {
    pdf.setTextColor(...C.muted);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "italic");
    pdf.text("No psychology entries recorded for this period.", M, y);
    y += 12;
  } else {
    psychologyEntries.forEach((entry) => {
      if (y > H - 45) return;

      // Entry header
      pdf.setFillColor(...C.card);
      pdf.setDrawColor(...C.border);
      
      // Calculate content height
      const sections: { label: string; text: string }[] = [];
      if (entry.mental_state) sections.push({ label: "Mental State", text: entry.mental_state });
      if (entry.emotions) sections.push({ label: "Emotions", text: entry.emotions });
      if (entry.lessons_learned) sections.push({ label: "Lessons Learned", text: entry.lessons_learned });
      if (entry.improvements) sections.push({ label: "Improvements", text: entry.improvements });
      if (entry.strategy_improvement) sections.push({ label: "Strategy / Technical", text: entry.strategy_improvement });
      if (entry.conclusion) sections.push({ label: "Conclusion", text: entry.conclusion });

      let entryH = 14;
      const sectionTexts: string[][] = [];
      sections.forEach((s) => {
        const split = pdf.splitTextToSize(s.text, CW - 16);
        sectionTexts.push(split);
        entryH += 8 + split.length * 3.5;
      });

      if (y + entryH > H - 30) return;

      pdf.roundedRect(M, y, CW, entryH, 2, 2, "FD");

      // Period badge
      pdf.setFillColor(...C.accent);
      pdf.roundedRect(M + 4, y + 4, 16, 5, 1, 1, "F");
      pdf.setTextColor(...C.white);
      pdf.setFontSize(5);
      pdf.setFont("helvetica", "bold");
      pdf.text(entry.period_type.toUpperCase(), M + 12, y + 7.5, { align: "center" });

      // Date range
      pdf.setTextColor(...C.muted);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${entry.period_start} — ${entry.period_end}`, M + 24, y + 8);

      // Rating
      if (entry.rating) {
        pdf.setTextColor(...C.amber);
        pdf.setFontSize(7);
        pdf.text("★".repeat(entry.rating) + "☆".repeat(5 - entry.rating), M + CW - 30, y + 8);
      }

      // Title
      if (entry.title) {
        pdf.setTextColor(...C.text);
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.text(entry.title, M + 4, y + 14);
      }

      let sy = y + (entry.title ? 18 : 14);
      sections.forEach((s, i) => {
        pdf.setTextColor(...C.accent);
        pdf.setFontSize(6);
        pdf.setFont("helvetica", "bold");
        pdf.text(s.label.toUpperCase(), M + 6, sy);
        sy += 3.5;
        pdf.setTextColor(...C.text);
        pdf.setFontSize(7);
        pdf.setFont("helvetica", "normal");
        pdf.text(sectionTexts[i], M + 6, sy);
        sy += sectionTexts[i].length * 3.5 + 4;
      });

      y += entryH + 6;
    });
  }

  drawFooter(3, totalPages);

  // Save
  const fileName = `TradeLog_Report_${periodLabel.replace(/\s+/g, "_")}_${dateRange.start}.pdf`;
  pdf.save(fileName);
}
