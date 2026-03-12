import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { User, LogOut, Shield, Clock } from "lucide-react";
import { useTimeWindow, TimeWindowPeriod, TimeWindowType } from "@/hooks/useTimeWindow";
import { cn } from "@/lib/utils";

const Settings = () => {
  const { user, signOut } = useAuth();
  const { period, type, setPeriod, setType } = useTimeWindow();

  return (
    <div className="max-w-2xl animate-fade-in">
      <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
      <p className="text-muted-foreground mb-8">Manage your account preferences</p>

      {/* Account Info */}
      <div className="stat-card mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Account</h2>
            <p className="text-muted-foreground">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <span className="text-foreground">Email Verified</span>
            </div>
            <span className="text-profit text-sm">Verified</span>
          </div>
        </div>
      </div>

      {/* Time Window Preference */}
      <div className="stat-card mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Analytics Time Window</h2>
            <p className="text-sm text-muted-foreground">Choose how date ranges are calculated on your Analytics page</p>
          </div>
        </div>

        {/* Period */}
        <div className="mb-5">
          <p className="text-sm font-medium text-foreground mb-2">Period</p>
          <div className="flex bg-secondary rounded-lg p-1">
            {(["daily", "weekly", "monthly"] as TimeWindowPeriod[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all capitalize",
                  period === p
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Type */}
        <div>
          <p className="text-sm font-medium text-foreground mb-2">Window Type</p>
          <div className="space-y-3">
            {([
              {
                value: "calendar" as TimeWindowType,
                title: "Calendar-based",
                desc: period === "daily"
                  ? "Today only"
                  : period === "weekly"
                    ? "Monday → Sunday of the current week"
                    : "1st → last day of the current month",
              },
              {
                value: "rolling" as TimeWindowType,
                title: "Rolling",
                desc: period === "daily"
                  ? "Today only"
                  : period === "weekly"
                    ? "Last 7 days from today"
                    : "Last 30 days from today",
              },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setType(opt.value)}
                className={cn(
                  "w-full flex items-center gap-3 p-4 rounded-lg border transition-all text-left",
                  type === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:border-muted-foreground/30"
                )}
              >
                <div
                  className={cn(
                    "w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                    type === opt.value ? "border-primary" : "border-muted-foreground"
                  )}
                >
                  {type === opt.value && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{opt.title}</p>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="stat-card border-destructive/30">
        <h2 className="text-lg font-semibold text-foreground mb-4">Danger Zone</h2>
        <Button
          variant="destructive"
          onClick={signOut}
          className="flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default Settings;
