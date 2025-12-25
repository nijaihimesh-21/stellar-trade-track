import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart3,
  Target,
  BookOpen,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { icon: BarChart3, label: "Overall Analytics", path: "/" },
  { icon: Target, label: "Self Monitoring", path: "/self-monitoring" },
  { icon: BookOpen, label: "Trade Log", path: "/trade-log" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 z-50 flex flex-col",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Toggle Button */}
        <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
          {!collapsed && (
            <span className="font-semibold text-foreground tracking-wide">
              ACCUMULATE
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors text-sidebar-foreground"
          >
            {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "sidebar-link w-full",
                  isActive && "active"
                )}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Sign Out */}
        <div className="p-3 border-t border-sidebar-border">
          <button
            onClick={handleSignOut}
            className="sidebar-link w-full text-destructive hover:bg-destructive/10"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main
        className={cn(
          "flex-1 transition-all duration-300",
          collapsed ? "ml-16" : "ml-60"
        )}
      >
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
