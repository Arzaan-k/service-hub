import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

export default function Header({ title }: { title: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  return (
    <header className="navbar h-16 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40 shadow-sm transition-colors duration-300">
      <div className="flex items-center gap-3 lg:gap-6">
        {/* Mobile Menu Toggle */}
        <button
          className="lg:hidden w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
          onClick={() => document.getElementById("sidebar")?.classList.remove("hidden")}
        >
          <i className="fas fa-bars"></i>
        </button>

        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight truncate max-w-[150px] lg:max-w-none">{title}</h2>
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-4">
        {/* Search Bar - Responsive */}
        <div className={`absolute lg:relative top-16 lg:top-0 left-0 w-full lg:w-auto bg-white dark:bg-slate-950 lg:bg-transparent p-4 lg:p-0 border-b lg:border-none border-slate-200 dark:border-slate-800 transition-all duration-200 ${isSearchOpen ? 'translate-y-0 opacity-100' : '-translate-y-full lg:translate-y-0 opacity-0 lg:opacity-100 pointer-events-none lg:pointer-events-auto'} -z-10 lg:z-0`}>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <i className="fas fa-search text-slate-400 group-focus-within:text-primary transition-colors"></i>
            </div>
            <input
              type="text"
              placeholder="Search..."
              className="w-full lg:w-64 pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-900 border border-transparent focus:border-primary/50 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search"
            />
          </div>
        </div>

        {/* Mobile Search Toggle */}
        <button
          className="lg:hidden w-9 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500"
          onClick={() => setIsSearchOpen(!isSearchOpen)}
        >
          <i className={`fas ${isSearchOpen ? 'fa-times' : 'fa-search'}`}></i>
        </button>

        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <button
            className="relative w-9 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 hover:text-primary transition-colors"
            data-testid="button-notifications"
          >
            <i className="fas fa-bell"></i>
            <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-950"></span>
          </button>

          {/* Theme Toggle */}
          <div className="hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg p-1 transition-colors">
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
