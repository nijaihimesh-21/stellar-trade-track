import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Layout from "@/components/Layout";
import Auth from "@/pages/Auth";
import Analytics from "@/pages/Analytics";

import TradeLog from "@/pages/TradeLog";
import StrategyHealth from "@/pages/StrategyHealth";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";
import Strategies from "@/pages/backtester/Strategies";
import StrategyDetail from "@/pages/backtester/StrategyDetail";
import BacktesterAnalytics from "@/pages/backtester/BacktesterAnalytics";
import Canvas from "@/pages/backtester/Canvas";
import BacktesterSettings from "@/pages/backtester/BacktesterSettings";

const queryClient = new QueryClient();

const AuthRedirect = () => {
  const { user, loading } = useAuth();
  
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<AuthRedirect />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Analytics />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/trade-log"
              element={
                <ProtectedRoute>
                  <Layout>
                    <TradeLog />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/strategy-health"
              element={
                <ProtectedRoute>
                  <Layout>
                    <StrategyHealth />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Settings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            {/* Strategy Backtester Routes */}
            <Route
              path="/backtester/strategies"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Strategies />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/backtester/strategy/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <StrategyDetail />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/backtester/analytics"
              element={
                <ProtectedRoute>
                  <Layout>
                    <BacktesterAnalytics />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/backtester/canvas"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Canvas />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/backtester/settings"
              element={
                <ProtectedRoute>
                  <Layout>
                    <BacktesterSettings />
                  </Layout>
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
