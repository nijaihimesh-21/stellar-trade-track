import { useState, useCallback } from "react";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
  format,
} from "date-fns";

export type TimeWindowPeriod = "weekly" | "monthly";
export type TimeWindowType = "calendar" | "rolling";

export interface TimeWindowDates {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
}

const STORAGE_KEY_PERIOD = "analytics_time_window_period";
const STORAGE_KEY_TYPE = "analytics_time_window_type";

export function getTimeWindowDates(
  period: TimeWindowPeriod,
  type: TimeWindowType
): TimeWindowDates {
  const now = new Date();
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");

  if (type === "calendar") {
    if (period === "weekly") {
      const start = startOfWeek(now, { weekStartsOn: 1 }); // Monday
      const end = endOfWeek(now, { weekStartsOn: 1 });     // Sunday
      return { start: fmt(start), end: fmt(end) };
    }
    // monthly
    return { start: fmt(startOfMonth(now)), end: fmt(endOfMonth(now)) };
  }

  // rolling
  if (period === "weekly") {
    return { start: fmt(subDays(now, 6)), end: fmt(now) };
  }
  return { start: fmt(subDays(now, 29)), end: fmt(now) };
}

export function useTimeWindow() {
  const [period, setPeriodState] = useState<TimeWindowPeriod>(
    () => (localStorage.getItem(STORAGE_KEY_PERIOD) as TimeWindowPeriod) || "weekly"
  );
  const [type, setTypeState] = useState<TimeWindowType>(
    () => (localStorage.getItem(STORAGE_KEY_TYPE) as TimeWindowType) || "calendar"
  );

  const setPeriod = useCallback((p: TimeWindowPeriod) => {
    localStorage.setItem(STORAGE_KEY_PERIOD, p);
    setPeriodState(p);
  }, []);

  const setType = useCallback((t: TimeWindowType) => {
    localStorage.setItem(STORAGE_KEY_TYPE, t);
    setTypeState(t);
  }, []);

  const dates = getTimeWindowDates(period, type);

  return { period, type, setPeriod, setType, dates };
}
