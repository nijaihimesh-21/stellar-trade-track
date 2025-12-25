import React from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { User, LogOut, Shield } from "lucide-react";

const Settings = () => {
  const { user, signOut } = useAuth();

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

      {/* Preferences Placeholder */}
      <div className="stat-card mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Preferences</h2>
        <p className="text-muted-foreground text-sm">
          Additional preferences will be available in future updates.
        </p>
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
