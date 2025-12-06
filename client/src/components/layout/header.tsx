import { ThemeToggle } from "@/components/theme-toggle";

export default function Header({ title }: { title: string }) {
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

      <div className="flex items-center gap-2">
        {/* Theme Toggle */}
        <div className="hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg p-1 transition-colors">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
