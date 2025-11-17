import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Header({ title }: { title: string }) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <header className="navbar h-16 backdrop-blur bg-[#FFF9F7] border-b border-[#FFE0D6] shadow-soft flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <span className="text-sm text-muted-foreground">Last updated: 2 min ago</span>
        <div className="w-2 h-2 rounded-full pulse-indicator" style={{ backgroundColor: '#FFCBA4' }}></div>
      </div>

      <div className="flex items-center gap-4">
        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search containers, alerts..."
            className="w-80 pl-10 pr-4 py-2 input-soft rounded-md text-sm placeholder:text-[#7a7a7a]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search"
          />
          <i className="fas fa-search text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2"></i>
        </div>

        {/* Notification Bell */}
        <button className="relative p-2 rounded-md transition-smooth hover:bg-[#FFF6F9]" data-testid="button-notifications">
          <i className="fas fa-bell text-muted-foreground"></i>
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ backgroundColor: '#FF6F61' }}></span>
        </button>

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* WhatsApp Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md" style={{ background: 'rgba(207, 239, 219, 0.6)', border: '1px solid rgba(207, 239, 219, 0.8)' }}>
          <i className="fab fa-whatsapp" style={{ color: '#5A9E7A' }}></i>
          <span className="text-xs font-medium" style={{ color: '#5A9E7A' }}>Connected</span>
        </div>
      </div>

      
    </header>
  );
}
