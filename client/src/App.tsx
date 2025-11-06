import React from "react";
import { Switch, Route, Redirect, useRoute } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isAuthenticated, getCurrentUser, initTestAuth } from "./lib/auth";

import Login from "@/pages/login";
import SignUp from "@/pages/signup";
import Dashboard from "@/pages/dashboard";
import Containers from "@/pages/containers";
import ContainerDetail from "@/pages/container-detail";
import Alerts from "@/pages/alerts";
import ServiceRequests from "@/pages/service-requests";
import ServiceRequestDetail from "@/pages/service-request-detail";
import Technicians from "@/pages/technicians";
import TechnicianProfile from "@/pages/technician-profile";
import Scheduling from "@/pages/scheduling";
import WhatsAppHub from "@/pages/whatsapp-hub";
import Clients from "@/pages/clients";
import Inventory from "@/pages/inventory";
import Analytics from "@/pages/analytics";
import ClientProfile from "@/pages/client-profile";
import AdminWhatsApp from "@/pages/admin-whatsapp";
import OrbcommData from "@/pages/orbcomm-data";
import OrbcommLiveData from "@/pages/orbcomm-live-data";
import RagChat from "@/pages/rag-chat";
import AdminManualUpload from "@/pages/admin-manual-upload";

function ProtectedRoute({ component: Component, roles }: { component: () => JSX.Element; roles?: string[] }) {
  if (!isAuthenticated()) {
    return <Redirect to="/login" />;
  }
  
  // Role-based access control
  if (roles && roles.length > 0) {
    const user = getCurrentUser();
    const userRole = (user?.role || "client").toLowerCase();
    const allowedRoles = roles.map(r => r.toLowerCase());
    
    if (!allowedRoles.includes(userRole)) {
      // Redirect to dashboard if user doesn't have required role
      return <Redirect to="/" />;
    }
  }
  
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={SignUp} />
      <Route path="/">
        {() => <ProtectedRoute component={Dashboard} />}
      </Route>
      <Route path="/containers">
        {() => <ProtectedRoute component={Containers} />}
      </Route>
      <Route path="/containers/:id">
        {() => <ProtectedRoute component={ContainerDetail} />}
      </Route>
      <Route path="/alerts">
        {() => <ProtectedRoute component={Alerts} />}
      </Route>
      <Route path="/service-requests">
        {() => <ProtectedRoute component={ServiceRequests} />}
      </Route>
      <Route path="/service-requests/:id">
        {() => <ProtectedRoute component={ServiceRequestDetail} />}
      </Route>
      <Route path="/technicians">
        {() => <ProtectedRoute component={Technicians} roles={["admin", "coordinator", "super_admin"]} />}
      </Route>
      <Route path="/technicians/:id">
        {() => <ProtectedRoute component={TechnicianProfile} roles={["admin", "coordinator", "super_admin", "technician"]} />}
      </Route>
      <Route path="/scheduling">
        {() => <ProtectedRoute component={Scheduling} roles={["admin", "coordinator", "super_admin"]} />}
      </Route>
      <Route path="/whatsapp">
        {() => <ProtectedRoute component={WhatsAppHub} roles={["admin", "coordinator", "technician", "client", "super_admin"]} />}
      </Route>
      <Route path="/clients">
        {() => <ProtectedRoute component={Clients} roles={["admin", "coordinator", "super_admin"]} />}
      </Route>
      <Route path="/clients/:id">
        {() => <ProtectedRoute component={ClientProfile} roles={["admin", "coordinator", "super_admin"]} />}
      </Route>
      <Route path="/my-profile">
        {() => <ProtectedRoute component={ClientProfile} roles={["client", "admin", "coordinator", "super_admin"]} />}
      </Route>
      <Route path="/inventory">
        {() => <ProtectedRoute component={Inventory} roles={["admin", "coordinator", "technician", "super_admin"]} />}
      </Route>
      <Route path="/analytics">
        {() => <ProtectedRoute component={Analytics} roles={["admin", "super_admin"]} />}
      </Route>
      <Route path="/admin/whatsapp">
        {() => <ProtectedRoute component={AdminWhatsApp} roles={["admin", "coordinator", "super_admin"]} />}
      </Route>
      <Route path="/orbcomm-data">
        {() => <ProtectedRoute component={OrbcommData} roles={["admin", "coordinator", "super_admin"]} />}
      </Route>
      <Route path="/orbcomm/live-data">
        {() => <ProtectedRoute component={OrbcommLiveData} roles={["admin", "coordinator", "super_admin"]} />}
      </Route>
      <Route path="/rag-chat">
        {() => <ProtectedRoute component={RagChat} />}
      </Route>
      <Route path="/admin/manuals">
        {() => <ProtectedRoute component={AdminManualUpload} roles={["admin", "super_admin"]} />}
      </Route>
    </Switch>
  );
}

function App() {
  // Initialize authentication and fetch current user
  React.useEffect(() => {
    const initAuth = async () => {
      // Initialize test auth for development
      initTestAuth();

      // Try to fetch current user from API
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          const response = await fetch('/api/auth/me', {
            headers: {
              'Content-Type': 'application/json',
              'x-user-id': token
            }
          });

          if (response.ok) {
            const userData = await response.json();
            // In development, force client role for consistent testing
            if (process.env.NODE_ENV === 'development') {
              userData.role = 'client';
              console.log('[AUTH] Forced client role for development:', userData);
            }
            // Store user data in localStorage
            localStorage.setItem('current_user', JSON.stringify(userData));
            console.log('[AUTH] Fetched and stored user data:', userData);
          }
        }
      } catch (error) {
        console.log('[AUTH] Could not fetch user data:', error);
      }
    };

    initAuth();
  }, []);

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
