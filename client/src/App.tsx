import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isAuthenticated } from "./lib/auth";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Containers from "@/pages/containers";
import Alerts from "@/pages/alerts";
import ServiceRequests from "@/pages/service-requests";
import Technicians from "@/pages/technicians";
import Scheduling from "@/pages/scheduling";
import WhatsAppHub from "@/pages/whatsapp-hub";
import Clients from "@/pages/clients";
import Inventory from "@/pages/inventory";
import Analytics from "@/pages/analytics";

function ProtectedRoute({ component: Component }: { component: () => JSX.Element }) {
  if (!isAuthenticated()) {
    return <Redirect to="/login" />;
  }
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/containers">
        {() => <ProtectedRoute component={Containers} />}
      </Route>
      <Route path="/alerts">
        {() => <ProtectedRoute component={Alerts} />}
      </Route>
      <Route path="/service-requests">
        {() => <ProtectedRoute component={ServiceRequests} />}
      </Route>
      <Route path="/technicians">
        {() => <ProtectedRoute component={Technicians} />}
      </Route>
      <Route path="/scheduling">
        {() => <ProtectedRoute component={Scheduling} />}
      </Route>
      <Route path="/whatsapp">
        {() => <ProtectedRoute component={WhatsAppHub} />}
      </Route>
      <Route path="/clients">
        {() => <ProtectedRoute component={Clients} />}
      </Route>
      <Route path="/inventory">
        {() => <ProtectedRoute component={Inventory} />}
      </Route>
      <Route path="/analytics">
        {() => <ProtectedRoute component={Analytics} />}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
