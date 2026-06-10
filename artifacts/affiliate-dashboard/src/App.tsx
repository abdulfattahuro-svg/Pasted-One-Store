import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Affiliates from "@/pages/affiliates";
import AffiliateDetail from "@/pages/affiliate-detail";
import Conversions from "@/pages/conversions";
import Payouts from "@/pages/payouts";
import Events from "@/pages/events";
import Settings from "@/pages/settings";
import Portal from "@/pages/portal";
import Apps from "@/pages/apps";
import Products from "@/pages/products";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function HomeRedirect() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/dashboard"); }, [setLocation]);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/portal" component={Portal} />
      <Route>
        <Layout>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/dashboard" component={Dashboard} />
            <Route path="/affiliates/:id" component={AffiliateDetail} />
            <Route path="/affiliates" component={Affiliates} />
            <Route path="/apps" component={Apps} />
            <Route path="/products" component={Products} />
            <Route path="/conversions" component={Conversions} />
            <Route path="/payouts" component={Payouts} />
            <Route path="/events" component={Events} />
            <Route path="/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
