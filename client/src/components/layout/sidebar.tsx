import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { getCurrentUser, clearAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export default function Sidebar() {
  const [location] = useLocation();
  const user = getCurrentUser();

  // Close sidebar on route change for mobile
  useEffect(() => {
    const handleRouteChange = () => {
      if (window.innerWidth < 1024) {
        document.getElementById("sidebar")?.classList.add("hidden");
      }
    };
    handleRouteChange();
  }, [location]);

  const role = (user?.role || "client").toLowerCase();
  const navItems = [
    // Everyone
    { path: "/", label: "Dashboard", icon: "fas fa-th-large", badge: "3", color: "text-dashboard", roles: ["admin", "coordinator", "technician", "client", "super_admin", "senior_technician"] },
    { path: "/containers", label: "Containers", icon: "fas fa-box", badge: "250", color: "text-containers", roles: ["admin", "coordinator", "technician", "client", "super_admin", "senior_technician", "amc"] },
    { path: "/alerts", label: "Alerts", icon: "fas fa-exclamation-triangle", badge: "12", color: "text-alerts", roles: ["admin", "coordinator", "technician", "client", "super_admin", "senior_technician"] },
    { path: "/service-requests", label: "Service Requests", icon: "fas fa-wrench", color: "text-service", roles: ["admin", "coordinator", "technician", "client", "super_admin", "senior_technician"] },
    { path: "/service-history", label: "Service History", icon: "fas fa-history", color: "text-service", roles: ["admin", "coordinator", "technician", "client", "super_admin", "senior_technician"] },
    // Client self profile quick link
    { path: "/my-profile", label: "My Profile", icon: "fas fa-id-card", color: "text-clients", roles: ["client"] },
    // Technician self profile quick link
    { path: "/my-profile", label: "My Profile", icon: "fas fa-id-card", color: "text-technicians", roles: ["technician", "senior_technician"] },
    // AMC self profile
    { path: "/my-profile", label: "My Profile", icon: "fas fa-id-card", color: "text-primary", roles: ["amc"] },
    // Admin/Coordinator only
    { path: "/technicians", label: "Technicians", icon: "fas fa-user-hard-hat", color: "text-technicians", roles: ["admin", "coordinator", "super_admin"] },
    { path: "/scheduling", label: "Scheduling", icon: "fas fa-calendar-alt", color: "text-scheduling", roles: ["admin", "coordinator", "super_admin"] },
    { path: "/clients", label: "Clients", icon: "fas fa-users", color: "text-clients", roles: ["admin", "coordinator", "super_admin", "amc", "senior_technician"] },
    // Admin/Coordinator/Technician
    { path: "/whatsapp", label: "WhatsApp Hub", icon: "fab fa-whatsapp", hasPulse: true, color: "text-whatsapp", roles: ["admin", "coordinator", "super_admin"] },
    { path: "/inventory", label: "Inventory", icon: "fas fa-warehouse", color: "text-inventory", roles: ["admin", "coordinator", "technician", "super_admin", "senior_technician"] },
    // User management
    { path: "/admin/user-management", label: "User Management", icon: "fas fa-users-cog", color: "text-primary", roles: ["admin", "super_admin"] },
    // Admin-only analytics
    { path: "/analytics", label: "Analytics", icon: "fas fa-chart-line", color: "text-analytics", roles: ["admin", "super_admin"] },
  ].filter(item => item.roles.includes(role));

  const handleLogout = () => {
    clearAuth();
    window.location.href = "/login";
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        id="sidebar-backdrop"
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden hidden transition-opacity duration-300"
        onClick={() => {
          document.getElementById("sidebar")?.classList.add("hidden");
          document.getElementById("sidebar-backdrop")?.classList.add("hidden");
        }}
      ></div>

      <aside
        id="sidebar"
        className="sidebar hidden lg:flex w-72 bg-white/95 dark:bg-black/95 lg:bg-white/60 lg:dark:bg-black/40 backdrop-blur-xl border-r border-white/20 dark:border-white/10 flex-col fixed lg:sticky top-0 h-[100dvh] lg:h-screen z-50 transition-all duration-500 shadow-2xl lg:shadow-sm"
      >
        {/* Logo & Close Button */}
        <div className="p-6 lg:p-8 border-b border-white/20 dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-2xl bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center shadow-lg shadow-primary/20">
              <i className="fas fa-ship text-white text-lg lg:text-xl"></i>
            </div>
            <div>
              <h2 className="font-bold text-lg lg:text-xl text-foreground tracking-tight">Container MS</h2>
              <p className="text-xs text-muted-foreground font-medium">Enterprise v2.0</p>
            </div>
          </div>
          {/* Close Button - Mobile Only */}
          <button
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg bg-black/5 dark:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => {
              document.getElementById("sidebar")?.classList.add("hidden");
              document.getElementById("sidebar-backdrop")?.classList.add("hidden");
            }}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 overflow-y-auto scrollbar-thin space-y-2 overscroll-contain pb-20 lg:pb-4">
          {navItems.map((item) => {
            const isActive = location === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden",
                  isActive
                    ? "bg-primary text-white font-bold shadow-md shadow-primary/25"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/10"
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <i
                  className={cn(
                    item.icon,
                    "w-6 text-center transition-colors duration-300",
                    isActive ? "text-white" : "text-muted-foreground group-hover:text-primary"
                  )}
                ></i>
                <span className="text-sm tracking-wide">{item.label}</span>

                {item.badge && (
                  <span
                    className={cn(
                      "ml-auto text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm",
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-gray-100 dark:bg-white/10 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                    )}
                  >
                    {item.badge}
                  </span>
                )}

                {item.hasPulse && (
                  <span className="ml-auto flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                  </span>
                )}
              </Link>
            );
          })}

          <div className="mt-8 pt-6 border-t border-white/20 dark:border-white/10 space-y-2">
            <Link
              href="/settings"
              className="flex items-center gap-4 px-4 py-3.5 rounded-2xl text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-white/10 transition-all duration-300"
            >
              <i className="fas fa-cog w-6 text-center"></i>
              <span className="text-sm font-medium tracking-wide">Settings</span>
            </Link>
          </div>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-white/20 dark:border-white/10 bg-white/30 dark:bg-white/5 backdrop-blur-xl">
          <div className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/50 dark:hover:bg-white/10 cursor-pointer transition-all duration-300 group">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-purple-500 flex items-center justify-center text-white font-bold shadow-md group-hover:shadow-lg transition-all">
              {user?.name?.charAt(0) || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{user?.name || "User"}</p>
              <p className="text-xs text-muted-foreground truncate">{user?.phoneNumber}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-8 h-8 flex items-center justify-center rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              data-testid="button-logout"
            >
              <i className="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
