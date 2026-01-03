import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  BarChart3,
  BookOpen,
  Settings,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  FlaskConical,
  Layers,
  LineChart,
  Cog,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { icon: BarChart3, label: "Overall Analytics", path: "/" },
  { icon: BookOpen, label: "Trade Log", path: "/trade-log" },
  { icon: ShieldCheck, label: "Strategy Health", path: "/strategy-health" },
  { icon: Settings, label: "Settings", path: "/settings" },
];

const backtesterDropdownItems = [
  { icon: Layers, label: "Canvas", path: "/backtester/canvas" },
  { icon: LineChart, label: "Analytics", path: "/backtester/analytics" },
  { icon: Cog, label: "Settings", path: "/backtester/settings" },
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
    <div className="min-h-screen bg-background">
      {/* Backdrop overlay with blur */}
      {!collapsed && (
        <div
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 transition-opacity duration-300"
          onClick={() => setCollapsed(true)}
        />
      )}

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
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors text-sidebar-foreground"
              >
                {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {collapsed ? "Open Menu" : "Close Menu"}
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate(item.path)}
                    className={cn(
                      "sidebar-link w-full",
                      isActive && "active",
                      collapsed && "justify-center"
                    )}
                  >
                    <item.icon className="w-5 h-5 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </button>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right">
                    {item.label}
                  </TooltipContent>
                )}
              </Tooltip>
            );
          })}

          {/* Strategy Backtester Section */}
          <div className="pt-4 mt-4 border-t border-sidebar-border">
            <div className="flex items-center gap-1">
              {/* Main clickable button - navigates to Strategies */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate("/backtester/strategies")}
                    className={cn(
                      "sidebar-link flex-1",
                      location.pathname.startsWith("/backtester") && "active",
                      collapsed && "justify-center"
                    )}
                  >
                    <FlaskConical className="w-5 h-5 shrink-0" />
                    {!collapsed && <span>Strategy Backtester</span>}
                  </button>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right">
                    Strategy Backtester
                  </TooltipContent>
                )}
              </Tooltip>

              {/* Dropdown for other items */}
              {!collapsed && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors text-sidebar-foreground">
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent 
                    side="right" 
                    align="start"
                    className="w-40 bg-popover border border-border shadow-lg z-[60]"
                  >
                    {backtesterDropdownItems.map((item) => (
                      <DropdownMenuItem
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={cn(
                          "flex items-center gap-2 cursor-pointer",
                          location.pathname === item.path && "bg-accent"
                        )}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
        </nav>

        {/* Sign Out */}
        <div className="p-3 border-t border-sidebar-border">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleSignOut}
                className={cn(
                  "sidebar-link w-full text-destructive hover:bg-destructive/10",
                  collapsed && "justify-center"
                )}
              >
                <LogOut className="w-5 h-5 shrink-0" />
                {!collapsed && <span>Sign Out</span>}
              </button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">
                Sign Out
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </aside>

      {/* Main Content - always full width with fixed left padding for collapsed sidebar */}
      <main className="min-h-screen ml-16">
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
