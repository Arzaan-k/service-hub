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
    { path: "/", label: "Dashboard", icon: "fas fa-th-large", badge: "3", roles: ["admin", "coordinator", "technician", "client", "super_admin", "senior_technician"] },
    { path: "/containers", label: "Containers", icon: "fas fa-box", badge: "250", roles: ["admin", "coordinator", "technician", "client", "super_admin", "senior_technician", "amc"] },
    { path: "/alerts", label: "Alerts", icon: "fas fa-exclamation-triangle", badge: "12", roles: ["admin", "coordinator", "technician", "client", "super_admin", "senior_technician"] },
    { path: "/service-requests", label: "Service Requests", icon: "fas fa-wrench", roles: ["admin", "coordinator", "technician", "client", "super_admin", "senior_technician"] },
    { path: "/service-history", label: "Service History", icon: "fas fa-history", roles: ["admin", "coordinator", "technician", "client", "super_admin", "senior_technician"] },
    // Client self profile quick link
    { path: "/my-profile", label: "My Profile", icon: "fas fa-id-card", roles: ["client"] },
    // Technician self profile quick link
    { path: "/my-profile", label: "My Profile", icon: "fas fa-id-card", roles: ["technician", "senior_technician"] },
    // AMC self profile
    { path: "/my-profile", label: "My Profile", icon: "fas fa-id-card", roles: ["amc"] },
    // Admin/Coordinator only
    { path: "/technicians", label: "Technicians", icon: "fas fa-user-hard-hat", roles: ["admin", "coordinator", "super_admin"] },
    { path: "/scheduling", label: "Scheduling", icon: "fas fa-calendar-alt", roles: ["admin", "coordinator", "super_admin"] },
    { path: "/clients", label: "Clients", icon: "fas fa-users", roles: ["admin", "coordinator", "super_admin", "amc", "senior_technician"] },
    // Admin/Coordinator/Technician
    { path: "/inventory", label: "Inventory", icon: "fas fa-warehouse", roles: ["admin", "coordinator", "technician", "super_admin", "senior_technician"] },
    // User management
    { path: "/admin/user-management", label: "User Management", icon: "fas fa-users-cog", roles: ["admin", "super_admin"] },
    // Admin-only analytics
    { path: "/analytics", label: "Analytics", icon: "fas fa-chart-line", roles: ["admin", "super_admin"] },
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
        className="sidebar hidden lg:flex w-72 bg-slate-900 text-white flex-col fixed lg:sticky top-0 h-[100dvh] lg:h-screen z-50 transition-all duration-300 shadow-xl border-r border-slate-800"
      >
        {/* Logo & Close Button */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <i className="fas fa-ship text-white text-lg"></i>
            </div>
            <div>
              <h2 className="font-bold text-lg text-white tracking-tight">Service Hub</h2>
              <p className="text-xs text-slate-400 font-medium">Enterprise Edition</p>
            </div>
          </div>
          {/* Close Button - Mobile Only */}
          <button
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
            onClick={() => {
              document.getElementById("sidebar")?.classList.add("hidden");
              document.getElementById("sidebar-backdrop")?.classList.add("hidden");
            }}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-4 overflow-y-auto scrollbar-thin space-y-1 overscroll-contain pb-20 lg:pb-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-4 mt-2">
            Main Menu
          </div>
          {navItems.map((item) => {
            const isActive = location === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative",
                  isActive
                    ? "bg-primary text-white font-medium shadow-md shadow-primary/10"
                    : "text-slate-400 hover:text-white hover:bg-slate-800"
                )}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <i
                  className={cn(
                    item.icon,
                    "w-5 text-center transition-colors duration-200",
                    isActive ? "text-white" : "text-slate-500 group-hover:text-white"
                  )}
                ></i>
                <span className="text-sm">{item.label}</span>

                {item.badge && (
                  <span
                    className={cn(
                      "ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full",
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-white"
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}

          <div className="mt-8 pt-6 border-t border-slate-800 space-y-1">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-4">
              System
            </div>
            <Link
              href="/settings"
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-all duration-200"
            >
              <i className="fas fa-cog w-5 text-center text-slate-500 group-hover:text-white"></i>
              <span className="text-sm font-medium">Settings</span>
            </Link>
          </div>
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-800 cursor-pointer transition-all duration-200 group">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-blue-600 flex items-center justify-center text-white font-bold shadow-md">
              {user?.name?.charAt(0) || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{user?.name || "User"}</p>
              <p className="text-xs text-slate-400 truncate">{user?.phoneNumber}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
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
