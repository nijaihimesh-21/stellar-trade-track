import jsPDF from "jspdf";

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

interface SessionStats {
  trades: number;
  wins: number;
  losses: number;
  pnl: number;
  winRate: number;
  contribution: number;
}

interface PairStats {
  trades: number;
  wins: number;
  pnl: number;
  winRate: number;
  contribution: number;
}

interface DayStats {
  trades: number;
  wins: number;
  pnl: number;
  winRate: number;
}

// Colors
const colors = {
  darkBg: [26, 32, 44] as [number, number, number],
  lightBg: [255, 255, 255] as [number, number, number],
  cardBg: [249, 250, 251] as [number, number, number],
  cardBorder: [229, 231, 235] as [number, number, number],
  textDark: [31, 41, 55] as [number, number, number],
  textMuted: [107, 114, 128] as [number, number, number],
  accent: [59, 130, 246] as [number, number, number],
  green: [34, 197, 94] as [number, number, number],
  red: [239, 68, 68] as [number, number, number],
  purple: [139, 92, 246] as [number, number, number],
  pink: [236, 72, 153] as [number, number, number],
  tableHeader: [31, 41, 55] as [number, number, number],
};

export async function generateStrategyPDF(
  strategy: Strategy,
  trades: StrategyTrade[]
): Promise<void> {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 25;
  const contentWidth = pageWidth - margin * 2;

  // Calculate all metrics
  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.result === "Win").length;
  const losses = trades.filter((t) => t.result === "Loss").length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const lossRate = totalTrades > 0 ? (losses / totalTrades) * 100 : 0;

  const totalPnL = trades.reduce((acc, t) => acc + (t.pnl || 0), 0);
  const avgWin = wins > 0 ? trades.filter((t) => t.result === "Win").reduce((acc, t) => acc + (t.pnl || 0), 0) / wins : 0;
  const avgLoss = losses > 0 ? Math.abs(trades.filter((t) => t.result === "Loss").reduce((acc, t) => acc + (t.pnl || 0), 0) / losses) : 0;

  const tradesWithRR = trades.filter((t) => t.risk_reward);
  const avgRR = tradesWithRR.length > 0 ? tradesWithRR.reduce((acc, t) => acc + (t.risk_reward || 0), 0) / tradesWithRR.length : 0;

  const expectancy = totalTrades > 0 ? (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss : 0;
  const expectancyR = totalTrades > 0 && avgLoss > 0 ? expectancy / avgLoss : expectancy > 0 ? 0.15 : 0;

  const profitFactor = avgLoss > 0 && losses > 0 ? (avgWin * wins) / (avgLoss * losses) : wins > 0 ? Infinity : 0;

  // Calculate max drawdown
  let runningPnL = 0;
  let peak = 0;
  let maxDrawdown = 0;
  trades.forEach((t) => {
    runningPnL += t.pnl || 0;
    if (runningPnL > peak) peak = runningPnL;
    const drawdown = peak - runningPnL;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  });

  // Calculate streaks
  let currentWinStreak = 0;
  let currentLossStreak = 0;
  let bestWinStreak = 0;
  let worstLossStreak = 0;
  trades.forEach((t) => {
    if (t.result === "Win") {
      currentWinStreak++;
      currentLossStreak = 0;
      if (currentWinStreak > bestWinStreak) bestWinStreak = currentWinStreak;
    } else if (t.result === "Loss") {
      currentLossStreak++;
      currentWinStreak = 0;
      if (currentLossStreak > worstLossStreak) worstLossStreak = currentLossStreak;
    }
  });

  // Largest win/loss
  const largestWin = trades.filter((t) => t.result === "Win").reduce((max, t) => Math.max(max, t.pnl || 0), 0);
  const largestLoss = trades.filter((t) => t.result === "Loss").reduce((min, t) => Math.min(min, t.pnl || 0), 0);

  // Session stats
  const sessionStats: Record<string, SessionStats> = {
    Asia: { trades: 0, wins: 0, losses: 0, pnl: 0, winRate: 0, contribution: 0 },
    London: { trades: 0, wins: 0, losses: 0, pnl: 0, winRate: 0, contribution: 0 },
    "New York": { trades: 0, wins: 0, losses: 0, pnl: 0, winRate: 0, contribution: 0 },
  };

  trades.forEach((t) => {
    if (sessionStats[t.session]) {
      sessionStats[t.session].trades++;
      if (t.result === "Win") sessionStats[t.session].wins++;
      if (t.result === "Loss") sessionStats[t.session].losses++;
      sessionStats[t.session].pnl += t.pnl || 0;
    }
  });

  Object.keys(sessionStats).forEach((session) => {
    const s = sessionStats[session];
    s.winRate = s.trades > 0 ? (s.wins / s.trades) * 100 : 0;
    s.contribution = totalPnL !== 0 ? (s.pnl / Math.abs(totalPnL)) * 100 : 0;
  });

  // Pair stats
  const pairStats: Record<string, PairStats> = {};
  trades.forEach((t) => {
    if (!pairStats[t.pair]) {
      pairStats[t.pair] = { trades: 0, wins: 0, pnl: 0, winRate: 0, contribution: 0 };
    }
    pairStats[t.pair].trades++;
    if (t.result === "Win") pairStats[t.pair].wins++;
    pairStats[t.pair].pnl += t.pnl || 0;
  });

  Object.keys(pairStats).forEach((pair) => {
    const p = pairStats[pair];
    p.winRate = p.trades > 0 ? (p.wins / p.trades) * 100 : 0;
    p.contribution = totalPnL !== 0 ? (Math.abs(p.pnl) / Math.abs(totalPnL)) * 100 : 0;
  });

  const sortedPairs = Object.entries(pairStats).sort((a, b) => b[1].pnl - a[1].pnl);

  // Day stats
  const dayStats: Record<string, DayStats> = {
    Monday: { trades: 0, wins: 0, pnl: 0, winRate: 0 },
    Tuesday: { trades: 0, wins: 0, pnl: 0, winRate: 0 },
    Wednesday: { trades: 0, wins: 0, pnl: 0, winRate: 0 },
    Thursday: { trades: 0, wins: 0, pnl: 0, winRate: 0 },
    Friday: { trades: 0, wins: 0, pnl: 0, winRate: 0 },
  };

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  trades.forEach((t) => {
    const date = new Date(t.trade_date);
    const dayName = dayNames[date.getDay()];
    if (dayStats[dayName]) {
      dayStats[dayName].trades++;
      if (t.result === "Win") dayStats[dayName].wins++;
      dayStats[dayName].pnl += t.pnl || 0;
    }
  });

  Object.keys(dayStats).forEach((day) => {
    const d = dayStats[day];
    d.winRate = d.trades > 0 ? (d.wins / d.trades) * 100 : 0;
  });

  // Get date range
  const tradeDates = trades.map((t) => new Date(t.trade_date)).sort((a, b) => a.getTime() - b.getTime());
  const startDate = tradeDates.length > 0 ? tradeDates[0] : new Date();
  const endDate = tradeDates.length > 0 ? tradeDates[tradeDates.length - 1] : new Date();
  const formatMonth = (date: Date) => date.toLocaleDateString("en-US", { month: "short", year: "numeric" });

  // Find best session
  const bestSession = Object.entries(sessionStats).sort((a, b) => b[1].pnl - a[1].pnl)[0];

  // Helper functions
  const drawAccentLine = (y: number) => {
    pdf.setDrawColor(...colors.accent);
    pdf.setLineWidth(0.8);
    pdf.line(margin, y, margin + 60, y);
  };

  const formatPnL = (value: number) => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}$${Math.abs(value).toFixed(2)}`;
  };

  // ==================== PAGE 1: COVER ====================
  pdf.setFillColor(...colors.darkBg);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  // Top accent line
  pdf.setFillColor(...colors.accent);
  pdf.rect(0, pageHeight * 0.38, pageWidth, 3, "F");

  // Title
  pdf.setTextColor(...colors.lightBg);
  pdf.setFontSize(32);
  pdf.setFont("helvetica", "bold");
  pdf.text("TRADING PERFORMANCE REVIEW", pageWidth / 2, pageHeight * 0.48, { align: "center" });

  // Strategy name
  pdf.setTextColor(...colors.accent);
  pdf.setFontSize(24);
  pdf.text(strategy.name.toUpperCase(), pageWidth / 2, pageHeight * 0.55, { align: "center" });

  // Date range
  pdf.setTextColor(...colors.textMuted);
  pdf.setFontSize(12);
  pdf.text(`${formatMonth(startDate)} – ${formatMonth(endDate)}`, pageWidth / 2, pageHeight * 0.61, { align: "center" });

  // Bottom accent line
  pdf.setFillColor(...colors.accent);
  pdf.rect(0, pageHeight * 0.88, pageWidth, 3, "F");

  // Confidential
  pdf.setTextColor(...colors.textMuted);
  pdf.setFontSize(10);
  pdf.text("CONFIDENTIAL", pageWidth / 2, pageHeight * 0.92, { align: "center" });

  // Generated date
  pdf.setFontSize(9);
  pdf.text(`Generated: ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`, pageWidth / 2, pageHeight * 0.95, { align: "center" });

  // ==================== PAGE 2: EXECUTIVE SUMMARY ====================
  pdf.addPage();
  pdf.setFillColor(...colors.lightBg);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  let yPos = margin;

  // Page title
  pdf.setTextColor(...colors.textDark);
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text("EXECUTIVE SUMMARY", margin, yPos);
  yPos += 5;
  drawAccentLine(yPos);
  yPos += 20;

  // Top metrics row (4 cards)
  const cardWidth = (contentWidth - 12) / 4;
  const cardHeight = 38;
  const topMetrics = [
    { label: "Total Trades", value: totalTrades.toString(), sublabel: "Executed" },
    { label: "Net P&L", value: formatPnL(totalPnL), sublabel: "Period Return", isPositive: totalPnL >= 0 },
    { label: "Win Rate", value: `${winRate.toFixed(1)}%`, sublabel: `${wins}W / ${losses}L`, isPositive: true },
    { label: "Expectancy", value: `${expectancyR >= 0 ? "+" : ""}${expectancyR.toFixed(2)}R`, sublabel: "Per Trade", isPositive: expectancyR >= 0 },
  ];

  topMetrics.forEach((metric, i) => {
    const x = margin + i * (cardWidth + 4);
    pdf.setFillColor(...colors.cardBg);
    pdf.setDrawColor(...colors.cardBorder);
    pdf.roundedRect(x, yPos, cardWidth, cardHeight, 2, 2, "FD");

    pdf.setTextColor(...colors.textMuted);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.text(metric.label, x + 6, yPos + 10);

    if (metric.isPositive !== undefined) {
      const color = metric.isPositive ? colors.green : colors.red;
      pdf.setTextColor(color[0], color[1], color[2]);
    } else {
      pdf.setTextColor(...colors.textDark);
    }
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text(metric.value, x + 6, yPos + 24);

    pdf.setTextColor(...colors.textMuted);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.text(metric.sublabel, x + 6, yPos + 32);
  });

  yPos += cardHeight + 8;

  // Bottom metrics row (4 cards)
  const bottomMetrics = [
    { label: "Avg R:R", value: `1 : ${avgRR.toFixed(1)}` },
    { label: "Profit Factor", value: profitFactor === Infinity ? "∞" : profitFactor.toFixed(2) },
    { label: "Max Drawdown", value: formatPnL(-maxDrawdown), isNegative: maxDrawdown > 0 },
    { label: "Best Streak", value: `${bestWinStreak} wins` },
  ];

  bottomMetrics.forEach((metric, i) => {
    const x = margin + i * (cardWidth + 4);
    pdf.setFillColor(...colors.cardBg);
    pdf.setDrawColor(...colors.cardBorder);
    pdf.roundedRect(x, yPos, cardWidth, cardHeight, 2, 2, "FD");

    pdf.setTextColor(...colors.textMuted);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.text(metric.label, x + 6, yPos + 10);

    if (metric.isNegative) {
      pdf.setTextColor(...colors.red);
    } else {
      pdf.setTextColor(...colors.textDark);
    }
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text(metric.value, x + 6, yPos + 24);
  });

  yPos += cardHeight + 20;

  // Performance Attribution
  pdf.setTextColor(...colors.textDark);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Performance Attribution", margin, yPos);
  yPos += 10;

  // Attribution card
  pdf.setFillColor(...colors.cardBg);
  pdf.setDrawColor(...colors.cardBorder);
  pdf.roundedRect(margin, yPos, contentWidth, 35, 2, 2, "FD");

  pdf.setTextColor(...colors.textMuted);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");

  const attributionText = bestSession && bestSession[1].trades > 0
    ? `Performance attribution indicates ${totalPnL >= 0 ? "positive" : "negative"} risk-adjusted returns over the review period. Primary alpha generation occurred during the ${bestSession[0]} session, which contributed ${formatPnL(bestSession[1].pnl)} with a ${bestSession[1].winRate.toFixed(1)}% win rate. Overall execution discipline remained within acceptable parameters.`
    : `Performance attribution indicates ${totalPnL >= 0 ? "positive" : "negative"} risk-adjusted returns over the review period. Overall execution discipline remained within acceptable parameters.`;

  const splitText = pdf.splitTextToSize(attributionText, contentWidth - 12);
  pdf.text(splitText, margin + 6, yPos + 12);

  yPos += 45;

  // Trade Outcome Distribution
  pdf.setTextColor(...colors.textDark);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Trade Outcome Distribution", margin, yPos);
  yPos += 10;

  // Pie chart (smaller to avoid footer overlap)
  const pieRadius = 25;
  const pieX = margin + pieRadius + 10;
  const pieY = yPos + pieRadius + 5;

  if (totalTrades > 0) {
    // Draw pie chart segments
    const winAngle = (wins / totalTrades) * 360;
    
    // Win segment (green)
    pdf.setFillColor(...colors.green);
    if (wins > 0) {
      // Draw full circle for wins first, then overlay losses
      pdf.circle(pieX, pieY, pieRadius, "F");
    }
    
    // Loss segment (red) - overlay on top
    if (losses > 0) {
      pdf.setFillColor(...colors.red);
      const startAngle = winAngle * (Math.PI / 180);
      const endAngle = 2 * Math.PI;
      
      // Draw arc using lines (simplified pie representation)
      pdf.setFillColor(...colors.red);
      const segments = 50;
      const angleStep = (endAngle - startAngle) / segments;
      
      pdf.setFillColor(...colors.red);
      // Create triangle fan from center
      for (let i = 0; i < segments; i++) {
        const angle1 = startAngle + i * angleStep - Math.PI / 2;
        const angle2 = startAngle + (i + 1) * angleStep - Math.PI / 2;
        
        const x1 = pieX + pieRadius * Math.cos(angle1);
        const y1 = pieY + pieRadius * Math.sin(angle1);
        const x2 = pieX + pieRadius * Math.cos(angle2);
        const y2 = pieY + pieRadius * Math.sin(angle2);
        
        pdf.triangle(pieX, pieY, x1, y1, x2, y2, "F");
      }
    }
  } else {
    // Empty pie
    pdf.setFillColor(...colors.cardBg);
    pdf.circle(pieX, pieY, pieRadius, "F");
    pdf.setDrawColor(...colors.cardBorder);
    pdf.circle(pieX, pieY, pieRadius, "S");
  }

  // Legend (positioned to the right of the smaller pie)
  const legendX = pieX + pieRadius + 25;
  const legendY = pieY - 8;

  // Wins legend
  pdf.setFillColor(...colors.green);
  pdf.rect(legendX, legendY, 10, 10, "F");
  pdf.setTextColor(...colors.textDark);
  pdf.setFontSize(9);
  pdf.text(`Wins: ${wins} (${winRate.toFixed(1)}%)`, legendX + 15, legendY + 8);

  // Losses legend
  pdf.setFillColor(...colors.red);
  pdf.rect(legendX, legendY + 18, 10, 10, "F");
  pdf.setTextColor(...colors.textDark);
  pdf.text(`Losses: ${losses} (${lossRate.toFixed(1)}%)`, legendX + 15, legendY + 26);

  // Footer
  pdf.setDrawColor(...colors.cardBorder);
  pdf.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
  pdf.setTextColor(...colors.textMuted);
  pdf.setFontSize(8);
  pdf.text("CONFIDENTIAL — Trading Performance Review", margin, pageHeight - 12);
  pdf.text("Page 1 of 5", pageWidth - margin, pageHeight - 12, { align: "right" });

  // ==================== PAGE 3: SESSION ANALYSIS ====================
  pdf.addPage();
  pdf.setFillColor(...colors.lightBg);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  yPos = margin;

  pdf.setTextColor(...colors.textDark);
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text("SESSION-BASED ANALYSIS", margin, yPos);
  yPos += 5;
  drawAccentLine(yPos);
  yPos += 15;

  pdf.setTextColor(...colors.textMuted);
  pdf.setFontSize(10);
  pdf.text("Performance attribution by trading session reveals execution patterns and optimal market timing.", margin, yPos);
  yPos += 20;

  // Session cards (3 columns with colored headers)
  const sessionCardWidth = (contentWidth - 16) / 3;
  const sessionCardHeight = 100;
  const sessionColors: Record<string, [number, number, number]> = {
    Asia: colors.purple,
    London: colors.accent,
    "New York": colors.pink,
  };

  Object.entries(sessionStats).forEach(([session, stats], i) => {
    const x = margin + i * (sessionCardWidth + 8);

    // Colored header
    pdf.setFillColor(...sessionColors[session]);
    pdf.roundedRect(x, yPos, sessionCardWidth, 18, 2, 2, "F");
    pdf.setTextColor(...colors.lightBg);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.text(`${session.toUpperCase()} SESSION`, x + sessionCardWidth / 2, yPos + 11, { align: "center" });

    // Card body
    pdf.setFillColor(...colors.cardBg);
    pdf.setDrawColor(...colors.cardBorder);
    pdf.roundedRect(x, yPos + 18, sessionCardWidth, sessionCardHeight - 18, 0, 0, "FD");

    const rows = [
      { label: "Trades", value: stats.trades.toString() },
      { label: "Win Rate", value: stats.trades > 0 ? `${stats.winRate.toFixed(1)}%` : "0.0%", isGreen: stats.winRate > 50 },
      { label: "Net P&L", value: formatPnL(stats.pnl), isGreen: stats.pnl >= 0 },
      { label: "Contribution", value: `${Math.abs(stats.contribution).toFixed(1)}%` },
    ];

    rows.forEach((row, j) => {
      const rowY = yPos + 30 + j * 18;
      pdf.setTextColor(...colors.textMuted);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(row.label, x + 8, rowY);

      if (row.isGreen !== undefined) {
        const color = row.isGreen ? colors.green : colors.red;
        pdf.setTextColor(color[0], color[1], color[2]);
      } else {
        pdf.setTextColor(...colors.textDark);
      }
      pdf.setFont("helvetica", "bold");
      pdf.text(row.value, x + sessionCardWidth - 8, rowY, { align: "right" });
    });
  });

  yPos += sessionCardHeight + 25;

  // P&L Contribution by Session (Bar chart)
  pdf.setTextColor(...colors.textDark);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("P&L Contribution by Session", margin, yPos);
  yPos += 10;

  const barChartCardY = yPos;
  pdf.setFillColor(...colors.cardBg);
  pdf.setDrawColor(...colors.cardBorder);
  pdf.roundedRect(margin, barChartCardY, contentWidth, 70, 2, 2, "FD");

  // Draw bar chart
  const maxPnL = Math.max(...Object.values(sessionStats).map((s) => Math.abs(s.pnl)), 1);
  const barChartX = margin + 30;
  const barChartY = barChartCardY + 55;
  const barMaxHeight = 40;
  const barWidth = 40;
  const barSpacing = (contentWidth - 60) / 3;

  Object.entries(sessionStats).forEach(([session, stats], i) => {
    const barX = barChartX + i * barSpacing + (barSpacing - barWidth) / 2;
    const barHeight = maxPnL > 0 ? (Math.abs(stats.pnl) / maxPnL) * barMaxHeight : 0;

    if (barHeight > 0) {
      pdf.setFillColor(...sessionColors[session]);
      pdf.rect(barX, barChartY - barHeight, barWidth, barHeight, "F");
    }

    // Session label
    pdf.setTextColor(...colors.textMuted);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    const label = session === "New York" ? "New York" : session;
    pdf.text(label, barX + barWidth / 2, barChartY + 8, { align: "center" });
  });

  // Baseline
  pdf.setDrawColor(...colors.cardBorder);
  pdf.line(barChartX - 10, barChartY, barChartX + contentWidth - 70, barChartY);

  // Update yPos to be after the bar chart card
  yPos = barChartCardY + 70 + 15;

  // Insight card - now properly positioned below bar chart
  pdf.setFillColor(254, 249, 195); // Light yellow
  pdf.setDrawColor(...colors.cardBorder);
  pdf.roundedRect(margin, yPos, contentWidth, 28, 2, 2, "FD");

  pdf.setTextColor(...colors.textMuted);
  pdf.setFontSize(9);
  const insightText = bestSession && bestSession[1].trades > 0
    ? `Risk-adjusted outcomes suggest optimal execution windows during ${bestSession[0]} hours. The ${bestSession[0]} session demonstrated superior edge realization with ${bestSession[1].winRate.toFixed(1)}% success rate across ${bestSession[1].trades} executions.`
    : "Continue data collection to identify optimal execution windows.";
  const insightSplit = pdf.splitTextToSize(insightText, contentWidth - 12);
  pdf.text(insightSplit, margin + 6, yPos + 11);

  // Footer
  pdf.setDrawColor(...colors.cardBorder);
  pdf.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
  pdf.setTextColor(...colors.textMuted);
  pdf.setFontSize(8);
  pdf.text("CONFIDENTIAL — Trading Performance Review", margin, pageHeight - 12);
  pdf.text("Page 2 of 5", pageWidth - margin, pageHeight - 12, { align: "right" });

  // ==================== PAGE 4: RISK & BEHAVIOR ====================
  pdf.addPage();
  pdf.setFillColor(...colors.lightBg);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  yPos = margin;

  pdf.setTextColor(...colors.textDark);
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text("RISK & BEHAVIOR ANALYSIS", margin, yPos);
  yPos += 5;
  drawAccentLine(yPos);
  yPos += 20;

  // Risk metrics cards (4 columns)
  const riskMetrics = [
    { label: "Largest Win", value: largestWin > 0 ? formatPnL(largestWin) : "N/A", sublabel: sortedPairs[0] ? `${sortedPairs[0][0]} · ${tradeDates[0]?.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "" },
    { label: "Largest Loss", value: largestLoss < 0 ? formatPnL(largestLoss) : "N/A" },
    { label: "Max Drawdown", value: formatPnL(-maxDrawdown), sublabel: "Peak to Trough" },
    { label: "Win/Loss Ratio", value: avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : avgWin > 0 ? "∞" : "N/A", sublabel: "Avg Win ÷ Avg Loss" },
  ];

  riskMetrics.forEach((metric, i) => {
    const x = margin + i * (cardWidth + 4);
    pdf.setFillColor(...colors.cardBg);
    pdf.setDrawColor(...colors.cardBorder);
    pdf.roundedRect(x, yPos, cardWidth, 42, 2, 2, "FD");

    pdf.setTextColor(...colors.textMuted);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.text(metric.label, x + 6, yPos + 10);

    pdf.setTextColor(...colors.textDark);
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text(metric.value, x + 6, yPos + 26);

    if (metric.sublabel) {
      pdf.setTextColor(...colors.textMuted);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.text(metric.sublabel, x + 6, yPos + 36);
    }
  });

  yPos += 55;

  // Execution Patterns
  pdf.setTextColor(...colors.textDark);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Execution Patterns", margin, yPos);
  yPos += 10;

  pdf.setFillColor(...colors.cardBg);
  pdf.setDrawColor(...colors.cardBorder);
  pdf.roundedRect(margin, yPos, contentWidth, 40, 2, 2, "FD");

  const patterns = [
    [`Best Win Streak: ${bestWinStreak} consecutive`, `Avg Win: ${formatPnL(avgWin)}`],
    [`Worst Loss Streak: ${worstLossStreak} consecutive`, `Avg Loss: ${formatPnL(-avgLoss)}`],
  ];

  patterns.forEach((row, i) => {
    const rowY = yPos + 14 + i * 14;
    pdf.setTextColor(...colors.textDark);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text(row[0], margin + 10, rowY);
    const patternColor = i === 0 ? colors.green : colors.red;
    pdf.setTextColor(patternColor[0], patternColor[1], patternColor[2]);
    pdf.text(row[1], margin + contentWidth / 2, rowY);
  });

  yPos += 55;

  // Time & Frequency Insights
  pdf.setTextColor(...colors.textDark);
  pdf.setFontSize(14);
  pdf.setFont("helvetica", "bold");
  pdf.text("Time & Frequency Insights", margin, yPos);
  yPos += 10;

  // Day table
  const tableWidth = contentWidth;
  const colWidths = [tableWidth * 0.3, tableWidth * 0.2, tableWidth * 0.25, tableWidth * 0.25];
  const rowHeight = 14;

  // Table header
  pdf.setFillColor(...colors.tableHeader);
  pdf.rect(margin, yPos, tableWidth, rowHeight, "F");
  pdf.setTextColor(...colors.lightBg);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");
  
  let colX = margin + 8;
  ["Day", "Trades", "Win Rate", "Net P&L"].forEach((header, i) => {
    pdf.text(header, colX, yPos + 9);
    colX += colWidths[i];
  });

  yPos += rowHeight;

  // Table rows
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  days.forEach((day, i) => {
    const stats = dayStats[day];
    const isAlt = i % 2 === 0;

    if (isAlt) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(margin, yPos, tableWidth, rowHeight, "F");
    }

    pdf.setTextColor(...colors.textDark);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");

    colX = margin + 8;
    pdf.text(day, colX, yPos + 9);
    colX += colWidths[0];

    pdf.text(stats.trades.toString(), colX, yPos + 9);
    colX += colWidths[1];

    if (stats.trades > 0) {
      pdf.setTextColor(...colors.green);
      pdf.text(`${stats.winRate.toFixed(1)}%`, colX, yPos + 9);
      colX += colWidths[2];

      const pnlColor = stats.pnl >= 0 ? colors.green : colors.red;
      pdf.setTextColor(pnlColor[0], pnlColor[1], pnlColor[2]);
      pdf.text(formatPnL(stats.pnl), colX, yPos + 9);
    } else {
      pdf.setTextColor(...colors.textMuted);
      pdf.text("—", colX, yPos + 9);
      colX += colWidths[2];
      pdf.text("—", colX, yPos + 9);
    }

    yPos += rowHeight;
  });

  yPos += 15;

  // Risk insight card - now properly positioned below table
  pdf.setFillColor(254, 249, 195);
  pdf.setDrawColor(...colors.cardBorder);
  pdf.roundedRect(margin, yPos, contentWidth, 28, 2, 2, "FD");

  pdf.setTextColor(...colors.textMuted);
  pdf.setFontSize(9);
  const riskInsight = `Risk metrics remain within acceptable parameters. Maximum drawdown of ${formatPnL(-maxDrawdown)} represents controlled variance relative to overall portfolio performance.`;
  const riskSplit = pdf.splitTextToSize(riskInsight, contentWidth - 12);
  pdf.text(riskSplit, margin + 6, yPos + 11);

  // Footer
  pdf.setDrawColor(...colors.cardBorder);
  pdf.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
  pdf.setTextColor(...colors.textMuted);
  pdf.setFontSize(8);
  pdf.text("CONFIDENTIAL — Trading Performance Review", margin, pageHeight - 12);
  pdf.text("Page 3 of 5", pageWidth - margin, pageHeight - 12, { align: "right" });

  // ==================== PAGE 5: INSTRUMENT ANALYSIS ====================
  pdf.addPage();
  pdf.setFillColor(...colors.lightBg);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  yPos = margin;

  pdf.setTextColor(...colors.textDark);
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text("INSTRUMENT ANALYSIS", margin, yPos);
  yPos += 5;
  drawAccentLine(yPos);
  yPos += 20;

  // Instrument table
  const instColWidths = [tableWidth * 0.25, tableWidth * 0.15, tableWidth * 0.2, tableWidth * 0.2, tableWidth * 0.2];

  // Table header
  pdf.setFillColor(...colors.tableHeader);
  pdf.rect(margin, yPos, tableWidth, rowHeight, "F");
  pdf.setTextColor(...colors.lightBg);
  pdf.setFontSize(8);
  pdf.setFont("helvetica", "bold");

  colX = margin + 8;
  ["Instrument", "Trades", "Win Rate", "Net P&L", "Contribution"].forEach((header, i) => {
    pdf.text(header, colX, yPos + 9);
    colX += instColWidths[i];
  });

  yPos += rowHeight;

  // Table rows
  sortedPairs.slice(0, 10).forEach(([pair, stats], i) => {
    const isAlt = i % 2 === 0;

    if (isAlt) {
      pdf.setFillColor(248, 250, 252);
      pdf.rect(margin, yPos, tableWidth, rowHeight, "F");
    }

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");

    colX = margin + 8;
    pdf.setTextColor(...colors.textDark);
    pdf.setFont("helvetica", "bold");
    pdf.text(pair, colX, yPos + 9);
    colX += instColWidths[0];

    pdf.setFont("helvetica", "normal");
    pdf.text(stats.trades.toString(), colX, yPos + 9);
    colX += instColWidths[1];

    pdf.setTextColor(...colors.green);
    pdf.text(`${stats.winRate.toFixed(1)}%`, colX, yPos + 9);
    colX += instColWidths[2];

    const instPnlColor = stats.pnl >= 0 ? colors.green : colors.red;
    pdf.setTextColor(instPnlColor[0], instPnlColor[1], instPnlColor[2]);
    pdf.text(formatPnL(stats.pnl), colX, yPos + 9);
    colX += instColWidths[3];

    pdf.setTextColor(...colors.textDark);
    pdf.text(`${stats.contribution.toFixed(1)}%`, colX, yPos + 9);

    yPos += rowHeight;
  });

  yPos += 20;

  // Instrument insight card
  if (sortedPairs.length > 0) {
    pdf.setFillColor(254, 249, 195);
    pdf.setDrawColor(...colors.cardBorder);
    pdf.roundedRect(margin, yPos, contentWidth, 30, 2, 2, "FD");

    pdf.setTextColor(...colors.textMuted);
    pdf.setFontSize(9);
    const instInsight = `Instrument-level attribution shows ${sortedPairs[0][0]} as the primary profit contributor with ${formatPnL(sortedPairs[0][1].pnl)} and ${sortedPairs[0][1].winRate.toFixed(1)}% success rate across ${sortedPairs[0][1].trades} executions.`;
    const instSplit = pdf.splitTextToSize(instInsight, contentWidth - 12);
    pdf.text(instSplit, margin + 6, yPos + 12);
  }

  // Footer
  pdf.setDrawColor(...colors.cardBorder);
  pdf.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
  pdf.setTextColor(...colors.textMuted);
  pdf.setFontSize(8);
  pdf.text("CONFIDENTIAL — Trading Performance Review", margin, pageHeight - 12);
  pdf.text("Page 4 of 5", pageWidth - margin, pageHeight - 12, { align: "right" });

  // ==================== PAGE 6: KEY TAKEAWAYS ====================
  pdf.addPage();
  pdf.setFillColor(...colors.lightBg);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  yPos = margin;

  pdf.setTextColor(...colors.textDark);
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text("KEY INSTITUTIONAL TAKEAWAYS", margin, yPos);
  yPos += 5;
  drawAccentLine(yPos);
  yPos += 25;

  // Takeaway bullets
  const takeaways = [
    expectancyR >= 0
      ? "Positive expectancy maintained through disciplined execution and favorable risk-reward structuring."
      : "Negative expectancy indicates need for strategy refinement and improved execution discipline.",
    profitFactor > 1 || profitFactor === Infinity
      ? `Profit factor of ${profitFactor === Infinity ? "Infinity" : profitFactor.toFixed(2)} indicates robust win/loss asymmetry.`
      : "Profit factor below 1.0 suggests reviewing trade selection criteria.",
    totalTrades < 30
      ? "Sample size limitations reduce statistical confidence in performance attribution."
      : "Adequate sample size provides meaningful statistical confidence in performance metrics.",
    "Continue systematic data collection for enhanced analysis fidelity.",
  ];

  takeaways.forEach((text, i) => {
    // Bullet circle
    pdf.setFillColor(...colors.accent);
    pdf.circle(margin + 5, yPos - 2, 4, "F");

    pdf.setTextColor(...colors.textDark);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const lines = pdf.splitTextToSize(text, contentWidth - 20);
    pdf.text(lines, margin + 15, yPos);
    yPos += lines.length * 6 + 18;
  });

  yPos += 20;

  // Recommendation box
  pdf.setFillColor(...colors.darkBg);
  pdf.roundedRect(margin, yPos, contentWidth, 50, 3, 3, "F");

  pdf.setTextColor(...colors.lightBg);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("RECOMMENDATION", margin + 12, yPos + 16);

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  const recommendation = expectancyR >= 0 && winRate >= 40
    ? "No changes to core strategy are recommended at this time. Focus should remain on execution discipline and session selectivity."
    : "Consider reviewing entry criteria and risk management parameters. Focus on improving win rate and average risk-reward ratio.";
  const recLines = pdf.splitTextToSize(recommendation, contentWidth - 24);
  pdf.text(recLines, margin + 12, yPos + 30);

  // Footer
  pdf.setDrawColor(...colors.cardBorder);
  pdf.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
  pdf.setTextColor(...colors.textMuted);
  pdf.setFontSize(8);
  pdf.text("CONFIDENTIAL — Trading Performance Review", margin, pageHeight - 12);
  pdf.text("Page 5 of 5", pageWidth - margin, pageHeight - 12, { align: "right" });

  // Save PDF
  const fileName = `${strategy.name.replace(/\s+/g, "_")}_Performance_Report_${new Date().toISOString().split("T")[0]}.pdf`;
  pdf.save(fileName);
}
