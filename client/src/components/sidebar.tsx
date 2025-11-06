import { Link, useLocation } from "wouter";
import { getCurrentUser, clearAuth } from "@/lib/auth";

export default function Sidebar() {
  const [location] = useLocation();
  const user = getCurrentUser();

  const role = (user?.role || "client").toLowerCase();
  const navItems = [
    // Everyone
    { path: "/", label: "Dashboard", icon: "fas fa-th-large", badge: "3", roles: ["admin","coordinator","technician","client","super_admin"] },
    { path: "/containers", label: "Containers", icon: "fas fa-box", badge: "250", roles: ["admin","coordinator","technician","client","super_admin"] },
    { path: "/alerts", label: "Alerts", icon: "fas fa-exclamation-triangle", badge: "12", badgeColor: "bg-destructive", roles: ["admin","coordinator","technician","client","super_admin"] },
    { path: "/service-requests", label: "Service Requests", icon: "fas fa-wrench", roles: ["admin","coordinator","technician","client","super_admin"] },
    // Admin/Coordinator only
    { path: "/technicians", label: "Technicians", icon: "fas fa-user-hard-hat", roles: ["admin","coordinator","super_admin"] },
    { path: "/scheduling", label: "Scheduling", icon: "fas fa-calendar-alt", roles: ["admin","coordinator","super_admin"] },
    { path: "/clients", label: "Clients", icon: "fas fa-users", roles: ["admin","coordinator","super_admin"] },
    // Admin/Coordinator/Technician (and WhatsApp also visible to client per earlier rule)
    { path: "/whatsapp", label: "WhatsApp Hub", icon: "fab fa-whatsapp", hasPulse: true, roles: ["admin","coordinator","super_admin"] },
    { path: "/inventory", label: "Inventory", icon: "fas fa-warehouse", roles: ["admin","coordinator","technician","super_admin"] },
    // Admin analytics
    { path: "/analytics", label: "Analytics", icon: "fas fa-chart-line", roles: ["admin","super_admin"] },
    // ORBCOMM data (temporary for testing)
    { path: "/orbcomm-data", label: "ORBCOMM Data", icon: "fas fa-satellite", roles: ["admin","coordinator","super_admin"] },
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
            <Link key={item.path} href={item.path}>
              <a
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-smooth ${
                  location === item.path
                    ? "bg-primary/10 text-primary"
                    : "text-gray-300 hover:bg-muted hover:text-white"
                }`}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <i className={`${item.icon} w-5`}></i>
                <span className="font-medium">{item.label}</span>
                {item.badge && (
                  <span
                    className={`ml-auto ${item.badgeColor || "bg-primary"} text-${
                      item.badgeColor ? "destructive-" : "primary-"
                    }foreground text-xs px-2 py-0.5 rounded-full`}
                    style={{
                      backgroundColor: item.badgeColor === 'bg-destructive' ? '#ef4444' : '#0046FF'
                    }}
                  >
                    {item.badge}
                  </span>
                )}
                {item.hasPulse && <span className="ml-auto w-2 h-2 bg-success rounded-full pulse-dot"></span>}
              </a>
            </Link>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-border space-y-1">
          <Link href="/settings">
            <a className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-muted hover:text-white transition-smooth">
              <i className="fas fa-cog w-5"></i>
              <span className="font-medium">Settings</span>
            </a>
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
            <p className="text-xs text-slate-400">{user?.phoneNumber}</p>
          </div>
          <button onClick={handleLogout} className="text-slate-400 hover:text-white" data-testid="button-logout">
            <i className="fas fa-sign-out-alt"></i>
          </button>
        </div>
      </div>
    </aside>
  );
}
