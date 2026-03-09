import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Brain, Plus, Pencil, Trash2, Calendar, Star, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface PsychologyEntry {
  id: string;
  user_id: string;
  period_type: string;
  period_start: string;
  period_end: string;
  title: string | null;
  mental_state: string | null;
  emotions: string | null;
  lessons_learned: string | null;
  improvements: string | null;
  notes: string | null;
  conclusion: string | null;
  rating: number | null;
  created_at: string;
}

const Psychology = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<PsychologyEntry[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<PsychologyEntry | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  // Form state
  const [periodType, setPeriodType] = useState("weekly");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [title, setTitle] = useState("");
  const [mentalState, setMentalState] = useState("");
  const [emotions, setEmotions] = useState("");
  const [lessonsLearned, setLessonsLearned] = useState("");
  const [improvements, setImprovements] = useState("");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState<number>(3);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("psychology_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("period_start", { ascending: false });
    if (data) setEntries(data as PsychologyEntry[]);
  }, [user]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const resetForm = () => {
    setPeriodType("weekly");
    setPeriodStart("");
    setPeriodEnd("");
    setTitle("");
    setMentalState("");
    setEmotions("");
    setLessonsLearned("");
    setImprovements("");
    setNotes("");
    setRating(3);
    setEditEntry(null);
  };

  const handlePeriodTypeChange = (type: string) => {
    setPeriodType(type);
    if (periodStart) {
      const date = parseISO(periodStart);
      if (type === "weekly") {
        setPeriodStart(format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd"));
        setPeriodEnd(format(endOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd"));
      } else if (type === "monthly") {
        setPeriodStart(format(startOfMonth(date), "yyyy-MM-dd"));
        setPeriodEnd(format(endOfMonth(date), "yyyy-MM-dd"));
      }
    }
  };

  const handleStartDateChange = (dateStr: string) => {
    setPeriodStart(dateStr);
    if (dateStr) {
      const date = parseISO(dateStr);
      if (periodType === "weekly") {
        setPeriodStart(format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd"));
        setPeriodEnd(format(endOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd"));
      } else if (periodType === "monthly") {
        setPeriodStart(format(startOfMonth(date), "yyyy-MM-dd"));
        setPeriodEnd(format(endOfMonth(date), "yyyy-MM-dd"));
      } else {
        setPeriodEnd(dateStr);
      }
    }
  };

  const openEdit = (entry: PsychologyEntry) => {
    setEditEntry(entry);
    setPeriodType(entry.period_type);
    setPeriodStart(entry.period_start);
    setPeriodEnd(entry.period_end);
    setTitle(entry.title || "");
    setMentalState(entry.mental_state || "");
    setEmotions(entry.emotions || "");
    setLessonsLearned(entry.lessons_learned || "");
    setImprovements(entry.improvements || "");
    setNotes(entry.notes || "");
    setRating(entry.rating || 3);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user || !periodStart || !periodEnd) {
      toast.error("Please fill in the period dates");
      return;
    }

    const payload = {
      user_id: user.id,
      period_type: periodType,
      period_start: periodStart,
      period_end: periodEnd,
      title: title || null,
      mental_state: mentalState || null,
      emotions: emotions || null,
      lessons_learned: lessonsLearned || null,
      improvements: improvements || null,
      notes: notes || null,
      rating,
    };

    if (editEntry) {
      const { error } = await supabase
        .from("psychology_entries")
        .update(payload)
        .eq("id", editEntry.id);
      if (error) {
        toast.error("Failed to update entry");
        return;
      }
      toast.success("Entry updated");
    } else {
      const { error } = await supabase.from("psychology_entries").insert(payload);
      if (error) {
        toast.error("Failed to add entry");
        return;
      }
      toast.success("Entry added");
    }

    resetForm();
    setDialogOpen(false);
    fetchEntries();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("psychology_entries").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete entry");
    } else {
      toast.success("Entry deleted");
      fetchEntries();
    }
  };

  const filtered = filterType === "all" ? entries : entries.filter((e) => e.period_type === filterType);

  const getRatingStars = (r: number | null) => {
    const val = r || 0;
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={cn("w-4 h-4", i < val ? "text-primary fill-primary" : "text-muted-foreground")}
      />
    ));
  };

  const getPeriodLabel = (entry: PsychologyEntry) => {
    const start = parseISO(entry.period_start);
    const end = parseISO(entry.period_end);
    if (entry.period_type === "weekly") {
      return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
    }
    if (entry.period_type === "monthly") {
      return format(start, "MMMM yyyy");
    }
    return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Brain className="w-8 h-8 text-primary" />
            Trading Psychology
          </h1>
          <p className="text-muted-foreground mt-1">
            Reflect on your mindset and emotional patterns over time
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setDialogOpen(true);
          }}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Entry
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-6">
        {["all", "weekly", "monthly", "custom"].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize",
              filterType === type
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Entries */}
      <div className="space-y-4">
        {filtered.map((entry) => (
          <div key={entry.id} className="stat-card">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-medium uppercase",
                    entry.period_type === "weekly" ? "bg-primary/20 text-primary" :
                    entry.period_type === "monthly" ? "bg-accent/20 text-accent" :
                    "bg-secondary text-muted-foreground"
                  )}>
                    {entry.period_type}
                  </span>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {getPeriodLabel(entry)}
                  </span>
                </div>
                {entry.title && (
                  <h3 className="text-lg font-semibold text-foreground mt-2">{entry.title}</h3>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 mr-2">{getRatingStars(entry.rating)}</div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEdit(entry)}
                  className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(entry.id)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {entry.mental_state && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">Mental State</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{entry.mental_state}</p>
                </div>
              )}
              {entry.emotions && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">Emotions</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{entry.emotions}</p>
                </div>
              )}
              {entry.lessons_learned && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">Lessons Learned</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{entry.lessons_learned}</p>
                </div>
              )}
              {entry.improvements && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">Improvements</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{entry.improvements}</p>
                </div>
              )}
            </div>
            {entry.notes && (
              <div className="mt-4 pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground uppercase mb-1">Additional Notes</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{entry.notes}</p>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="stat-card text-center py-12">
            <Brain className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No psychology entries yet</p>
            <p className="text-sm text-muted-foreground mt-1">Start reflecting on your trading mindset</p>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {editEntry ? "Edit Psychology Entry" : "New Psychology Entry"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-muted-foreground">Period Type</Label>
              <Select value={periodType} onValueChange={handlePeriodTypeChange}>
                <SelectTrigger className="bg-secondary border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground">Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-secondary border-border",
                        !periodStart && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {periodStart ? format(parseISO(periodStart), "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={periodStart ? parseISO(periodStart) : undefined}
                      onSelect={(date) => date && handleStartDateChange(format(date, "yyyy-MM-dd"))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-muted-foreground">End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal bg-secondary border-border",
                        !periodEnd && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {periodEnd ? format(parseISO(periodEnd), "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={periodEnd ? parseISO(periodEnd) : undefined}
                      onSelect={(date) => date && setPeriodEnd(format(date, "yyyy-MM-dd"))}
                      disabled={periodType !== "custom"}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div>
              <Label className="text-muted-foreground">Title (optional)</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Week of discipline"
                className="bg-secondary border-border text-foreground"
              />
            </div>

            <div>
              <Label className="text-muted-foreground">Mental State</Label>
              <Textarea
                value={mentalState}
                onChange={(e) => setMentalState(e.target.value)}
                placeholder="How was your mental state during this period?"
                className="bg-secondary border-border text-foreground"
                rows={2}
              />
            </div>

            <div>
              <Label className="text-muted-foreground">Emotions</Label>
              <Textarea
                value={emotions}
                onChange={(e) => setEmotions(e.target.value)}
                placeholder="What emotions did you experience while trading?"
                className="bg-secondary border-border text-foreground"
                rows={2}
              />
            </div>

            <div>
              <Label className="text-muted-foreground">Lessons Learned</Label>
              <Textarea
                value={lessonsLearned}
                onChange={(e) => setLessonsLearned(e.target.value)}
                placeholder="Key takeaways from this period"
                className="bg-secondary border-border text-foreground"
                rows={2}
              />
            </div>

            <div>
              <Label className="text-muted-foreground">Areas for Improvement</Label>
              <Textarea
                value={improvements}
                onChange={(e) => setImprovements(e.target.value)}
                placeholder="What can you improve?"
                className="bg-secondary border-border text-foreground"
                rows={2}
              />
            </div>

            <div>
              <Label className="text-muted-foreground">Additional Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any other thoughts..."
                className="bg-secondary border-border text-foreground"
                rows={2}
              />
            </div>

            <div>
              <Label className="text-muted-foreground">Overall Rating</Label>
              <div className="flex items-center gap-1 mt-1">
                {Array.from({ length: 5 }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setRating(i + 1)}
                    className="p-1 hover:scale-110 transition-transform"
                  >
                    <Star
                      className={cn(
                        "w-6 h-6",
                        i < rating ? "text-primary fill-primary" : "text-muted-foreground"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleSubmit} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {editEntry ? "Update Entry" : "Save Entry"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Psychology;
