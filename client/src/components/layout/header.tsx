import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export default function Header({ title }: { title: string }) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <header className="navbar h-20 bg-white/60 dark:bg-black/40 backdrop-blur-xl border-b border-white/20 dark:border-white/10 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40 transition-all duration-500 shadow-sm">
      <div className="flex items-center gap-4 lg:gap-6">
        {/* Mobile Menu Toggle */}
        <button
          className="lg:hidden w-10 h-10 rounded-full bg-white/50 dark:bg-white/10 border border-white/20 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all active:scale-95"
          onClick={() => document.getElementById("sidebar")?.classList.toggle("hidden")}
        >
          <i className="fas fa-bars"></i>
        </button>

        <div>
          <h2 className="text-xl lg:text-2xl font-semibold text-foreground tracking-tight">{title}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]"></span>
            <span className="text-xs text-muted-foreground font-medium">System Operational</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 lg:gap-6">
        {/* Search Bar - Hidden on mobile */}
        <div className="hidden md:block relative group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i className="fas fa-search text-muted-foreground group-focus-within:text-primary transition-colors"></i>
          </div>
          <input
            type="text"
            placeholder="Search containers, alerts..."
            className="w-64 lg:w-96 pl-10 pr-4 py-2.5 bg-gray-100/50 dark:bg-white/5 border-transparent focus:border-primary/30 rounded-full text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white dark:focus:bg-black/20 transition-all duration-300"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search"
          />
        </div>

        <div className="flex items-center gap-2 lg:gap-3">
          {/* Notification Bell */}
          <button
            className="relative w-10 h-10 rounded-full bg-gray-100/50 dark:bg-white/5 border border-transparent hover:border-primary/20 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-300 active:scale-95"
            data-testid="button-notifications"
          >
            <i className="fas fa-bell"></i>
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-red-500 ring-2 ring-background animate-pulse"></span>
          </button>

          {/* Theme Toggle */}
          <div className="bg-gray-100/50 dark:bg-white/5 border border-transparent rounded-full p-1">
            <ThemeToggle />
          </div>

          {/* WhatsApp Status - Hidden on mobile */}
          <div className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 backdrop-blur-sm">
            <i className="fab fa-whatsapp"></i>
            <span className="text-xs font-bold">Connected</span>
          </div>
        </div>
      </div>
    </header>
  );
}
