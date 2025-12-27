import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isAfter,
  startOfDay,
} from "date-fns";

interface Habit {
  id: string;
  name: string;
  is_positive: boolean;
}

interface HabitLog {
  habit_id: string;
  log_date: string;
  completed: boolean;
}

const SelfMonitoring = () => {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [newHabitName, setNewHabitName] = useState("");
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [tempSelections, setTempSelections] = useState<Record<string, boolean>>({});
  const [calendarData, setCalendarData] = useState<Record<string, { positive: number; negative: number }>>({});

  const today = startOfDay(new Date());

  const fetchHabits = async () => {
    if (!user) return;
    const { data } = await supabase.from("habits").select("*").eq("user_id", user.id);
    if (data) setHabits(data);
  };

  const fetchHabitLogs = async () => {
    if (!user) return;
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const { data } = await supabase
      .from("habit_logs")
      .select("*")
      .eq("user_id", user.id)
      .eq("log_date", dateStr);
    if (data) {
      setHabitLogs(data);
      const selections: Record<string, boolean> = {};
      data.forEach((log) => {
        selections[log.habit_id] = log.completed;
      });
      setTempSelections(selections);
    } else {
      setHabitLogs([]);
      setTempSelections({});
    }
  };

  const fetchCalendarData = async () => {
    if (!user) return;
    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
    const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");
    
    const { data: logs } = await supabase
      .from("habit_logs")
      .select("*, habits!inner(is_positive)")
      .eq("user_id", user.id)
      .gte("log_date", start)
      .lte("log_date", end)
      .eq("completed", true);

    if (logs) {
      const dateStats: Record<string, { positive: number; negative: number }> = {};
      logs.forEach((log: any) => {
        const date = log.log_date;
        if (!dateStats[date]) dateStats[date] = { positive: 0, negative: 0 };
        if (log.habits.is_positive) {
          dateStats[date].positive += 1;
        } else {
          dateStats[date].negative += 1;
        }
      });
      setCalendarData(dateStats);
    }
  };

  useEffect(() => {
    fetchHabits();
  }, [user]);

  useEffect(() => {
    fetchHabitLogs();
  }, [user, selectedDate]);

  useEffect(() => {
    fetchCalendarData();
  }, [user, currentMonth]);

  const addHabit = async (isPositive: boolean) => {
    if (!user || !newHabitName.trim()) return;
    
    const { error } = await supabase.from("habits").insert({
      user_id: user.id,
      name: newHabitName.trim(),
      is_positive: isPositive,
    });

    if (error) {
      toast.error("Failed to add habit");
    } else {
      toast.success("Habit added");
      setNewHabitName("");
      setShowAddHabit(false);
      fetchHabits();
    }
  };

  const deleteHabit = async (id: string) => {
    const { error } = await supabase.from("habits").delete().eq("id", id);
    if (!error) {
      toast.success("Habit deleted");
      fetchHabits();
    }
  };

  const toggleHabit = (habitId: string) => {
    if (isAfter(startOfDay(selectedDate), today)) {
      toast.error("Cannot fill data for future dates");
      return;
    }
    setTempSelections((prev) => ({ ...prev, [habitId]: !prev[habitId] }));
  };

  const saveHabits = async () => {
    if (!user) return;
    if (isAfter(startOfDay(selectedDate), today)) {
      toast.error("Cannot save data for future dates");
      return;
    }

    const dateStr = format(selectedDate, "yyyy-MM-dd");
    
    for (const habit of habits) {
      const completed = tempSelections[habit.id] || false;
      const existing = habitLogs.find((l) => l.habit_id === habit.id);
      
      if (existing) {
        await supabase
          .from("habit_logs")
          .update({ completed })
          .eq("habit_id", habit.id)
          .eq("log_date", dateStr);
      } else if (completed) {
        await supabase.from("habit_logs").insert({
          user_id: user.id,
          habit_id: habit.id,
          log_date: dateStr,
          completed: true,
        });
      }
    }

    toast.success("Habits saved");
    fetchHabitLogs();
    fetchCalendarData();
  };

  const clearSelections = () => {
    setTempSelections({});
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  // Calculate preview stats for the selected date based on tempSelections
  const getPreviewStats = () => {
    let positive = 0;
    let negative = 0;
    habits.forEach((habit) => {
      if (tempSelections[habit.id]) {
        if (habit.is_positive) {
          positive += 1;
        } else {
          negative += 1;
        }
      }
    });
    return { positive, negative };
  };

  const getDayColor = (date: Date, isPreview = false) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const selectedDateStr = format(selectedDate, "yyyy-MM-dd");
    
    // For the selected date, show real-time preview based on tempSelections
    if (dateStr === selectedDateStr && isPreview) {
      const previewStats = getPreviewStats();
      if (previewStats.positive === 0 && previewStats.negative === 0) {
        return "bg-secondary";
      }
      if (previewStats.positive > previewStats.negative) return "bg-profit";
      if (previewStats.negative > previewStats.positive) return "bg-loss";
      return "bg-foreground";
    }
    
    // For other dates, use saved calendar data
    const stats = calendarData[dateStr];
    if (!stats) return "bg-secondary";
    
    const { positive, negative } = stats;
    if (positive > negative) return "bg-profit";
    if (negative > positive) return "bg-loss";
    return "bg-foreground";
  };

  // Get tooltip text for a day based on habit completion
  const getDayTooltip = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const isFuture = isAfter(startOfDay(date), today);
    
    if (isFuture) return "Future date";
    
    const stats = calendarData[dateStr];
    if (!stats || (stats.positive === 0 && stats.negative === 0)) {
      return "No habits recorded";
    }
    
    const total = stats.positive + stats.negative;
    const totalHabits = habits.length;
    
    if (total >= totalHabits && totalHabits > 0) {
      return "All habits recorded";
    } else if (total > 0) {
      return "Some habits recorded";
    }
    return "No habits recorded";
  };

  // Check if there are unsaved changes
  const hasUnsavedChanges = () => {
    const savedSelections: Record<string, boolean> = {};
    habitLogs.forEach((log) => {
      savedSelections[log.habit_id] = log.completed;
    });
    
    return habits.some((habit) => {
      const temp = tempSelections[habit.id] || false;
      const saved = savedSelections[habit.id] || false;
      return temp !== saved;
    });
  };

  const startDayOfWeek = startOfMonth(currentMonth).getDay();

  return (
    <div className="animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Habits Panel */}
        <div className="stat-card">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-foreground">Today's Habits</h2>
            <p className="text-muted-foreground text-sm">{format(selectedDate, "EEEE, MMM d")}</p>
          </div>

          <div className="space-y-2">
            {habits.map((habit) => (
              <div
                key={habit.id}
                className="flex items-center justify-between bg-secondary rounded-lg p-4 group"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleHabit(habit.id)}
                    className={cn(
                      "w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center",
                      tempSelections[habit.id]
                        ? habit.is_positive
                          ? "bg-profit border-profit"
                          : "bg-loss border-loss"
                        : "border-muted-foreground"
                    )}
                  >
                    {tempSelections[habit.id] && (
                      <div className="w-2 h-2 rounded-full bg-background" />
                    )}
                  </button>
                  <span className="text-foreground">{habit.name}</span>
                  {!habit.is_positive && (
                    <span className="text-xs bg-loss/20 text-loss px-2 py-0.5 rounded">
                      Negative
                    </span>
                  )}
                </div>
                <button
                  onClick={() => deleteHabit(habit.id)}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-muted rounded transition-all"
                >
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            ))}
          </div>

          {/* Add Habit */}
          {showAddHabit ? (
            <div className="mt-4 space-y-3">
              <Input
                placeholder="Habit name..."
                value={newHabitName}
                onChange={(e) => setNewHabitName(e.target.value)}
                className="bg-secondary border-border"
              />
              <div className="flex gap-2">
                <Button
                  onClick={() => addHabit(true)}
                  className="flex-1 bg-profit hover:bg-profit/90 text-primary-foreground"
                >
                  Add Positive
                </Button>
                <Button
                  onClick={() => addHabit(false)}
                  variant="destructive"
                  className="flex-1"
                >
                  Add Negative
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddHabit(true)}
              className="w-full mt-4 py-3 border border-dashed border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-muted-foreground transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              onClick={clearSelections}
              className="flex-1 border-border"
            >
              Clear
            </Button>
            <Button
              onClick={saveHabits}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              Save
            </Button>
          </div>
        </div>

        {/* Calendar Panel */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Calendar</h2>
              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-profit" /> Good
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-loss" /> Needs work
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-foreground" /> Equal
                </span>
                <span className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-muted" /> No Data
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </button>
              <span className="text-foreground font-medium min-w-[140px] text-center">
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <button
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                className="p-2 hover:bg-secondary rounded-lg transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
              <div key={i} className="text-center text-muted-foreground text-sm py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {days.map((day) => {
              const isSelected = isSameDay(day, selectedDate);
              const isToday = isSameDay(day, today);
              const isFuture = isAfter(startOfDay(day), today);
              const isSelectedDate = isSameDay(day, selectedDate);
              const showPreview = isSelectedDate && hasUnsavedChanges();
              const dayColor = isSelected && !isFuture ? getDayColor(day, true) : (!isSelected && !isFuture ? getDayColor(day, false) : "");
              const isNeutral = dayColor === "bg-foreground";
              
              return (
                <Tooltip key={day.toISOString()}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setSelectedDate(day)}
                      className={cn(
                        "aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all",
                        !isSameMonth(day, currentMonth) && "text-muted-foreground/50",
                        isSelected && "ring-2 ring-foreground",
                        !isSelected && !isFuture && getDayColor(day, false),
                        isSelected && !isFuture && getDayColor(day, true),
                        isFuture && "bg-secondary text-muted-foreground",
                        isToday && !isSelected && "ring-1 ring-muted-foreground",
                        showPreview && "animate-pulse",
                        isNeutral && !isFuture && "text-background"
                      )}
                    >
                      {format(day, "d")}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{format(day, "MMM d, yyyy")}</p>
                    <p className="text-xs text-muted-foreground">{getDayTooltip(day)}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelfMonitoring;
