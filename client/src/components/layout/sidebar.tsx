import { Link, useLocation } from "wouter";
import { getCurrentUser, clearAuth } from "@/lib/auth";

export default function Sidebar() {
  const [location] = useLocation();
  const user = getCurrentUser();

  const role = (user?.role || "client").toLowerCase();
  const navItems = [
    // Everyone
    { path: "/", label: "Dashboard", icon: "fas fa-th-large", badge: "3", color: "dashboard", roles: ["admin","coordinator","technician","client","super_admin"] },
    { path: "/containers", label: "Containers", icon: "fas fa-box", badge: "250", color: "containers", roles: ["admin","coordinator","technician","client","super_admin"] },
    { path: "/alerts", label: "Alerts", icon: "fas fa-exclamation-triangle", badge: "12", color: "alerts", roles: ["admin","coordinator","technician","client","super_admin"] },
    { path: "/service-requests", label: "Service Requests", icon: "fas fa-wrench", color: "service", roles: ["admin","coordinator","technician","client","super_admin"] },
    // Admin/Coordinator only
    { path: "/technicians", label: "Technicians", icon: "fas fa-user-hard-hat", color: "technicians", roles: ["admin","coordinator","super_admin"] },
    { path: "/scheduling", label: "Scheduling", icon: "fas fa-calendar-alt", color: "scheduling", roles: ["admin","coordinator","super_admin"] },
    { path: "/clients", label: "Clients", icon: "fas fa-users", color: "clients", roles: ["admin","coordinator","super_admin"] },
    // Admin/Coordinator/Technician
    { path: "/whatsapp", label: "WhatsApp Hub", icon: "fab fa-whatsapp", hasPulse: true, color: "whatsapp", roles: ["admin","coordinator","super_admin"] },
    { path: "/inventory", label: "Inventory", icon: "fas fa-warehouse", color: "inventory", roles: ["admin","coordinator","technician","super_admin"] },
    // Admin-only analytics
    { path: "/analytics", label: "Analytics", icon: "fas fa-chart-line", color: "analytics", roles: ["admin","super_admin"] },
  ].filter(item => item.roles.includes(role));

  const handleLogout = () => {
    clearAuth();
    window.location.href = "/login";
  };

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col sticky top-0 h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <i className="fas fa-ship text-white"></i>
          </div>
          <div>
            <h2 className="font-bold text-foreground">Container MS</h2>
            <p className="text-xs text-muted-foreground">v2.0.1</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 overflow-y-auto scrollbar-thin">
        <div className="space-y-1">
          {navItems.map((item) => (
            <Link 
              key={item.path} 
              href={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-smooth group ${
                location === item.path
                  ? "text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              style={location === item.path ? {
                backgroundColor: item.color === 'containers' ? 'rgba(74, 222, 128, 0.1)' :
                                item.color === 'alerts' ? 'rgba(239, 68, 68, 0.1)' :
                                item.color === 'service' ? 'rgba(249, 115, 22, 0.1)' :
                                item.color === 'technicians' ? 'rgba(168, 85, 247, 0.1)' :
                                item.color === 'scheduling' ? 'rgba(6, 182, 212, 0.1)' :
                                item.color === 'clients' ? 'rgba(20, 184, 166, 0.1)' :
                                item.color === 'whatsapp' ? 'rgba(34, 197, 94, 0.1)' :
                                item.color === 'inventory' ? 'rgba(234, 179, 8, 0.1)' :
                                item.color === 'analytics' ? 'rgba(217, 70, 239, 0.1)' :
                                'rgba(59, 130, 246, 0.1)',
                borderLeftColor: item.color === 'containers' ? '#4ade80' :
                                item.color === 'alerts' ? '#ef4444' :
                                item.color === 'service' ? '#f97316' :
                                item.color === 'technicians' ? '#a855f7' :
                                item.color === 'scheduling' ? '#06b6d4' :
                                item.color === 'clients' ? '#14b8a6' :
                                item.color === 'whatsapp' ? '#22c55e' :
                                item.color === 'inventory' ? '#eab308' :
                                item.color === 'analytics' ? '#d946ef' :
                                '#3b82f6',
                borderLeftWidth: '4px',
                color: item.color === 'containers' ? '#4ade80' :
                       item.color === 'alerts' ? '#ef4444' :
                       item.color === 'service' ? '#f97316' :
                       item.color === 'technicians' ? '#a855f7' :
                       item.color === 'scheduling' ? '#06b6d4' :
                       item.color === 'clients' ? '#14b8a6' :
                       item.color === 'whatsapp' ? '#22c55e' :
                       item.color === 'inventory' ? '#eab308' :
                       item.color === 'analytics' ? '#d946ef' :
                       '#3b82f6'
              } : {}}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <i 
                className={`${item.icon} w-5`}
                style={location === item.path ? {
                  color: item.color === 'containers' ? '#4ade80' :
                         item.color === 'alerts' ? '#ef4444' :
                         item.color === 'service' ? '#f97316' :
                         item.color === 'technicians' ? '#a855f7' :
                         item.color === 'scheduling' ? '#06b6d4' :
                         item.color === 'clients' ? '#14b8a6' :
                         item.color === 'whatsapp' ? '#22c55e' :
                         item.color === 'inventory' ? '#eab308' :
                         item.color === 'analytics' ? '#d946ef' :
                         '#3b82f6'
                } : {}}
              ></i>
              <span className="font-medium">{item.label}</span>
              {item.badge && (
                <span
                  className="ml-auto text-white text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: item.color === 'containers' ? '#4ade80' :
                                    item.color === 'alerts' ? '#ef4444' :
                                    item.color === 'service' ? '#f97316' :
                                    item.color === 'technicians' ? '#a855f7' :
                                    item.color === 'scheduling' ? '#06b6d4' :
                                    item.color === 'clients' ? '#14b8a6' :
                                    item.color === 'whatsapp' ? '#22c55e' :
                                    item.color === 'inventory' ? '#eab308' :
                                    item.color === 'analytics' ? '#d946ef' :
                                    '#3b82f6'
                  }}
                >
                  {item.badge}
                </span>
              )}
              {item.hasPulse && (
                <span 
                  className="ml-auto w-2 h-2 rounded-full pulse-dot"
                  style={{
                    backgroundColor: item.color === 'whatsapp' ? '#22c55e' : '#3b82f6'
                  }}
                ></span>
              )}
            </Link>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-border space-y-1">
          <Link 
            href="/settings"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-smooth"
          >
            <i className="fas fa-cog w-5"></i>
            <span className="font-medium">Settings</span>
          </Link>
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer transition-smooth">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold">
            {user?.name?.charAt(0) || "U"}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{user?.name || "User"}</p>
            <p className="text-xs text-muted-foreground">{user?.phoneNumber}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground"
            data-testid="button-logout"
          >
            <i className="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </div>
    </aside>
  );
}
