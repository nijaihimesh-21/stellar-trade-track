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
  pnl: number;
  winRate: number;
}

interface PairStats {
  trades: number;
  wins: number;
  pnl: number;
}

export async function generateStrategyPDF(
  strategy: Strategy,
  trades: StrategyTrade[]
): Promise<void> {
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  // Colors
  const primaryColor: [number, number, number] = [74, 222, 128]; // Green
  const bgColor: [number, number, number] = [17, 24, 39]; // Dark background
  const cardColor: [number, number, number] = [31, 41, 55]; // Card background
  const textColor: [number, number, number] = [255, 255, 255]; // White text
  const mutedColor: [number, number, number] = [156, 163, 175]; // Muted text
  const destructiveColor: [number, number, number] = [239, 68, 68]; // Red

  // Set background
  pdf.setFillColor(...bgColor);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  // Calculate metrics
  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.result === "Win").length;
  const losses = trades.filter((t) => t.result === "Loss").length;
  const breakeven = trades.filter((t) => t.result === "Breakeven").length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

  const tradesWithRR = trades.filter((t) => t.risk_reward);
  const avgRR =
    tradesWithRR.length > 0
      ? tradesWithRR.reduce((acc, t) => acc + (t.risk_reward || 0), 0) /
        tradesWithRR.length
      : 0;

  const totalPnL = trades.reduce((acc, t) => acc + (t.pnl || 0), 0);
  const avgWin =
    wins > 0
      ? trades
          .filter((t) => t.result === "Win")
          .reduce((acc, t) => acc + (t.pnl || 0), 0) / wins
      : 0;
  const avgLoss =
    losses > 0
      ? Math.abs(
          trades
            .filter((t) => t.result === "Loss")
            .reduce((acc, t) => acc + (t.pnl || 0), 0) / losses
        )
      : 0;
  const expectancy =
    totalTrades > 0
      ? (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss
      : 0;

  // Session breakdown
  const sessionStats: Record<string, SessionStats> = {
    Asia: { trades: 0, wins: 0, pnl: 0, winRate: 0 },
    London: { trades: 0, wins: 0, pnl: 0, winRate: 0 },
    "New York": { trades: 0, wins: 0, pnl: 0, winRate: 0 },
  };

  trades.forEach((t) => {
    if (sessionStats[t.session]) {
      sessionStats[t.session].trades++;
      if (t.result === "Win") sessionStats[t.session].wins++;
      sessionStats[t.session].pnl += t.pnl || 0;
    }
  });

  Object.keys(sessionStats).forEach((session) => {
    const s = sessionStats[session];
    s.winRate = s.trades > 0 ? (s.wins / s.trades) * 100 : 0;
  });

  // Pair stats
  const pairStats: Record<string, PairStats> = {};
  trades.forEach((t) => {
    if (!pairStats[t.pair]) {
      pairStats[t.pair] = { trades: 0, wins: 0, pnl: 0 };
    }
    pairStats[t.pair].trades++;
    if (t.result === "Win") pairStats[t.pair].wins++;
    pairStats[t.pair].pnl += t.pnl || 0;
  });

  const sortedPairs = Object.entries(pairStats).sort(
    (a, b) => b[1].pnl - a[1].pnl
  );
  const bestPair = sortedPairs[0];

  // Helper function to draw rounded rectangle
  const drawRoundedRect = (
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    color: [number, number, number]
  ) => {
    pdf.setFillColor(...color);
    pdf.roundedRect(x, y, w, h, r, r, "F");
  };

  // --- HEADER ---
  drawRoundedRect(margin, yPos, pageWidth - margin * 2, 35, 4, cardColor);

  pdf.setTextColor(...primaryColor);
  pdf.setFontSize(22);
  pdf.setFont("helvetica", "bold");
  pdf.text(strategy.name, margin + 8, yPos + 15);

  pdf.setTextColor(...mutedColor);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Strategy Performance Report`, margin + 8, yPos + 24);

  pdf.setTextColor(...textColor);
  pdf.setFontSize(9);
  pdf.text(
    `Generated: ${new Date().toLocaleDateString()}`,
    pageWidth - margin - 8,
    yPos + 15,
    { align: "right" }
  );
  pdf.text(`Market: ${strategy.market}`, pageWidth - margin - 8, yPos + 24, {
    align: "right",
  });

  yPos += 45;

  // --- DESCRIPTION ---
  if (strategy.description) {
    drawRoundedRect(margin, yPos, pageWidth - margin * 2, 20, 4, cardColor);
    pdf.setTextColor(...mutedColor);
    pdf.setFontSize(9);
    pdf.text(strategy.description, margin + 8, yPos + 12);
    yPos += 30;
  }

  // --- KEY METRICS ---
  pdf.setTextColor(...textColor);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("KEY METRICS", margin, yPos);
  yPos += 8;

  const metricCardWidth = (pageWidth - margin * 2 - 12) / 4;
  const metricCards = [
    { label: "Total Trades", value: totalTrades.toString() },
    { label: "Win Rate", value: `${winRate.toFixed(1)}%`, isPositive: true },
    { label: "Avg R:R", value: `1 : ${avgRR.toFixed(1)}` },
    {
      label: "Expectancy",
      value: `${expectancy >= 0 ? "+" : ""}${expectancy.toFixed(2)}R`,
      isPositive: expectancy >= 0,
      isNegative: expectancy < 0,
    },
  ];

  metricCards.forEach((metric, i) => {
    const x = margin + i * (metricCardWidth + 4);
    drawRoundedRect(x, yPos, metricCardWidth, 28, 4, cardColor);

    pdf.setTextColor(...mutedColor);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.text(metric.label.toUpperCase(), x + 6, yPos + 9);

    if (metric.isPositive) {
      pdf.setTextColor(...primaryColor);
    } else if (metric.isNegative) {
      pdf.setTextColor(...destructiveColor);
    } else {
      pdf.setTextColor(...textColor);
    }
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(metric.value, x + 6, yPos + 21);
  });

  yPos += 38;

  // --- P&L SUMMARY ---
  pdf.setTextColor(...textColor);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("P&L SUMMARY", margin, yPos);
  yPos += 8;

  const summaryWidth = (pageWidth - margin * 2 - 8) / 3;
  const pnlCards = [
    {
      label: "Total P&L",
      value: `$${totalPnL.toFixed(2)}`,
      isPositive: totalPnL >= 0,
      isNegative: totalPnL < 0,
    },
    {
      label: "Avg Win",
      value: `+$${avgWin.toFixed(2)}`,
      isPositive: true,
    },
    {
      label: "Avg Loss",
      value: `-$${avgLoss.toFixed(2)}`,
      isNegative: true,
    },
  ];

  pnlCards.forEach((card, i) => {
    const x = margin + i * (summaryWidth + 4);
    drawRoundedRect(x, yPos, summaryWidth, 28, 4, cardColor);

    pdf.setTextColor(...mutedColor);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.text(card.label.toUpperCase(), x + 6, yPos + 9);

    if (card.isPositive) {
      pdf.setTextColor(...primaryColor);
    } else if (card.isNegative) {
      pdf.setTextColor(...destructiveColor);
    } else {
      pdf.setTextColor(...textColor);
    }
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(card.value, x + 6, yPos + 21);
  });

  yPos += 38;

  // --- WIN/LOSS BREAKDOWN (PIE CHART REPRESENTATION) ---
  const halfWidth = (pageWidth - margin * 2 - 8) / 2;

  // Left card: Win/Loss Breakdown
  drawRoundedRect(margin, yPos, halfWidth, 65, 4, cardColor);

  pdf.setTextColor(...textColor);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.text("WIN / LOSS BREAKDOWN", margin + 8, yPos + 12);

  // Draw pie chart representation using bars
  const pieY = yPos + 22;
  const barHeight = 12;
  const barMaxWidth = halfWidth - 20;

  // Wins bar
  pdf.setFillColor(...primaryColor);
  const winBarWidth = totalTrades > 0 ? (wins / totalTrades) * barMaxWidth : 0;
  pdf.roundedRect(margin + 8, pieY, winBarWidth, barHeight, 2, 2, "F");

  pdf.setTextColor(...textColor);
  pdf.setFontSize(8);
  pdf.text(`Wins: ${wins} (${winRate.toFixed(1)}%)`, margin + 8, pieY + 22);

  // Losses bar
  pdf.setFillColor(...destructiveColor);
  const lossBarWidth =
    totalTrades > 0 ? (losses / totalTrades) * barMaxWidth : 0;
  pdf.roundedRect(margin + 8, pieY + 28, lossBarWidth, barHeight, 2, 2, "F");

  const lossRate = totalTrades > 0 ? (losses / totalTrades) * 100 : 0;
  pdf.setTextColor(...textColor);
  pdf.text(
    `Losses: ${losses} (${lossRate.toFixed(1)}%)`,
    margin + 8,
    pieY + 50
  );

  // Breakeven (if any)
  if (breakeven > 0) {
    pdf.setTextColor(...mutedColor);
    pdf.text(`Breakeven: ${breakeven}`, margin + halfWidth / 2, pieY + 50);
  }

  // Right card: Session Performance
  const rightX = margin + halfWidth + 8;
  drawRoundedRect(rightX, yPos, halfWidth, 65, 4, cardColor);

  pdf.setTextColor(...textColor);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.text("SESSION PERFORMANCE", rightX + 8, yPos + 12);

  let sessionY = yPos + 22;
  const maxSessionPnL = Math.max(
    ...Object.values(sessionStats).map((s) => Math.abs(s.pnl)),
    1
  );

  Object.entries(sessionStats).forEach(([session, stats]) => {
    pdf.setTextColor(...textColor);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.text(session, rightX + 8, sessionY);

    // Bar
    const barWidth =
      maxSessionPnL > 0
        ? (Math.abs(stats.pnl) / maxSessionPnL) * (halfWidth - 80)
        : 0;
    if (stats.pnl >= 0) {
      pdf.setFillColor(...primaryColor);
    } else {
      pdf.setFillColor(...destructiveColor);
    }
    pdf.roundedRect(rightX + 40, sessionY - 4, barWidth, 6, 1, 1, "F");

    // Value
    if (stats.pnl >= 0) {
      pdf.setTextColor(...primaryColor);
    } else {
      pdf.setTextColor(...destructiveColor);
    }
    pdf.text(
      `$${stats.pnl >= 0 ? "+" : ""}${stats.pnl.toFixed(0)}`,
      rightX + halfWidth - 12,
      sessionY,
      { align: "right" }
    );

    sessionY += 14;
  });

  yPos += 75;

  // --- BEST PAIR ---
  if (bestPair) {
    pdf.setTextColor(...textColor);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("BEST PERFORMING PAIR", margin, yPos);
    yPos += 8;

    drawRoundedRect(margin, yPos, pageWidth - margin * 2, 30, 4, cardColor);

    pdf.setTextColor(...primaryColor);
    pdf.setFontSize(16);
    pdf.setFont("helvetica", "bold");
    pdf.text(bestPair[0], margin + 8, yPos + 14);

    pdf.setTextColor(...textColor);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const pairWinRate = (bestPair[1].wins / bestPair[1].trades) * 100;
    pdf.text(
      `${bestPair[1].trades} trades  ·  ${pairWinRate.toFixed(1)}% win rate`,
      margin + 8,
      yPos + 23
    );

    if (bestPair[1].pnl >= 0) {
      pdf.setTextColor(...primaryColor);
    } else {
      pdf.setTextColor(...destructiveColor);
    }
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text(
      `${bestPair[1].pnl >= 0 ? "+" : ""}$${bestPair[1].pnl.toFixed(2)}`,
      pageWidth - margin - 8,
      yPos + 17,
      { align: "right" }
    );

    yPos += 40;
  }

  // --- RECENT TRADES ---
  if (trades.length > 0) {
    pdf.setTextColor(...textColor);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("RECENT TRADES", margin, yPos);
    yPos += 8;

    const recentTrades = trades.slice(0, 8);
    const tableHeight = 8 + recentTrades.length * 8;
    drawRoundedRect(margin, yPos, pageWidth - margin * 2, tableHeight, 4, cardColor);

    // Table header
    pdf.setTextColor(...mutedColor);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    const cols = [
      { label: "PAIR", x: margin + 8 },
      { label: "DATE", x: margin + 35 },
      { label: "SESSION", x: margin + 65 },
      { label: "DIRECTION", x: margin + 95 },
      { label: "RESULT", x: margin + 125 },
      { label: "P&L", x: pageWidth - margin - 8 },
    ];

    cols.forEach((col) => {
      if (col.label === "P&L") {
        pdf.text(col.label, col.x, yPos + 6, { align: "right" });
      } else {
        pdf.text(col.label, col.x, yPos + 6);
      }
    });

    yPos += 8;

    recentTrades.forEach((trade) => {
      pdf.setTextColor(...textColor);
      pdf.setFontSize(7);
      pdf.text(trade.pair, cols[0].x, yPos + 5);
      pdf.text(trade.trade_date, cols[1].x, yPos + 5);
      pdf.text(trade.session, cols[2].x, yPos + 5);
      pdf.text(trade.direction, cols[3].x, yPos + 5);

      if (trade.result === "Win") {
        pdf.setTextColor(...primaryColor);
      } else if (trade.result === "Loss") {
        pdf.setTextColor(...destructiveColor);
      } else {
        pdf.setTextColor(...mutedColor);
      }
      pdf.text(trade.result, cols[4].x, yPos + 5);

      if (trade.pnl >= 0) {
        pdf.setTextColor(...primaryColor);
      } else {
        pdf.setTextColor(...destructiveColor);
      }
      pdf.text(
        `${trade.pnl >= 0 ? "+" : ""}$${trade.pnl.toFixed(2)}`,
        cols[5].x,
        yPos + 5,
        { align: "right" }
      );

      yPos += 8;
    });
  }

  // --- FOOTER ---
  pdf.setTextColor(...mutedColor);
  pdf.setFontSize(8);
  pdf.text(
    "Generated by Strategy Backtester",
    pageWidth / 2,
    pageHeight - 10,
    { align: "center" }
  );

  // Save PDF
  pdf.save(`${strategy.name.replace(/\s+/g, "_")}_Report.pdf`);
}
