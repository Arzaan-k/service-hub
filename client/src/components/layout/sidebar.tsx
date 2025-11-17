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
    // Client self profile quick link
    { path: "/my-profile", label: "My Profile", icon: "fas fa-id-card", color: "clients", roles: ["client"] },
    // Technician self profile quick link
    { path: "/my-profile", label: "My Profile", icon: "fas fa-id-card", color: "technicians", roles: ["technician"] },
    // Admin/Coordinator only
    { path: "/technicians", label: "Technicians", icon: "fas fa-user-hard-hat", color: "technicians", roles: ["admin","coordinator","super_admin"] },
    { path: "/scheduling", label: "Scheduling", icon: "fas fa-calendar-alt", color: "scheduling", roles: ["admin","coordinator","super_admin"] },
    { path: "/clients", label: "Clients", icon: "fas fa-users", color: "clients", roles: ["admin","coordinator","super_admin"] },
    // Admin/Coordinator/Technician
    { path: "/whatsapp", label: "WhatsApp Hub", icon: "fab fa-whatsapp", hasPulse: true, color: "whatsapp", roles: ["admin","coordinator","super_admin"] },
    { path: "/inventory", label: "Inventory", icon: "fas fa-warehouse", color: "inventory", roles: ["admin","coordinator","technician","super_admin"] },
    // Admin-only analytics
    { path: "/analytics", label: "Analytics", icon: "fas fa-chart-line", color: "analytics", roles: ["admin","super_admin"] },
    // Manuals for all users
    { path: "/manuals", label: "Manuals", icon: "fas fa-book-open", color: "manuals", roles: ["admin","coordinator","technician","client","super_admin"] },
    // RAG Chat for everyone
    { path: "/rag-chat", label: "AI Assistant", icon: "fas fa-robot", color: "rag", roles: ["admin","coordinator","technician","client","super_admin"] },
  ].filter(item => item.roles.includes(role));

  const handleLogout = () => {
    clearAuth();
    window.location.href = "/login";
  };

  return (
    <aside className="sidebar w-64 bg-[#FFF8F5] border-r border-[#FFE0D6] flex flex-col sticky top-0 h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-[#FFE0D6]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl gradient-accent flex items-center justify-center shadow-soft">
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
                  : "text-foreground hover:bg-[#FFF6F9]"
              }`}
              style={location === item.path ? {
                backgroundColor: '#FFD4E3',
                borderLeftColor: '#FFA07A',
                borderLeftWidth: '4px',
                color: '#333333'
              } : {}}
              data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <i 
                className={`${item.icon} w-5`}
                style={location === item.path ? {
                  color: item.color === 'alerts' ? '#FF6F61' :
                         item.color === 'service' ? '#FFA07A' :
                         '#E19E64'
                } : {}}
              ></i>
              <span className="font-medium text-foreground">{item.label}</span>
              {item.badge && (
                <span
                  className="ml-auto text-foreground text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: item.color === 'alerts' ? '#FFD4E3' :
                                     item.color === 'service' ? '#FFCBA4' :
                                     '#FFE5B4'
                  }}
                >
                  {item.badge}
                </span>
              )}
              {item.hasPulse && (
                <span 
                  className="ml-auto w-2 h-2 rounded-full pulse-dot"
                  style={{
                    backgroundColor: item.color === 'whatsapp' ? '#CFEFDB' : '#FFCBA4'
                  }}
                ></span>
              )}
            </Link>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-[#FFE0D6] space-y-1">
          <Link 
            href="/settings"
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-foreground hover:bg-[#FFF6F9] transition-smooth"
          >
            <i className="fas fa-cog w-5 text-muted-foreground"></i>
            <span className="font-medium text-foreground">Settings</span>
          </Link>
        </div>
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-[#FFE0D6]">
        <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#FFF6F9] cursor-pointer transition-smooth">
          <div className="w-10 h-10 rounded-full gradient-accent flex items-center justify-center text-white font-bold">
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
