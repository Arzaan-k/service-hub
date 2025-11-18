import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState(
    typeof window !== "undefined" ? localStorage.getItem("theme") || "light" : "light"
  );

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("theme", theme);
    }
  }, [theme]);

  return (
    <button
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="ml-3 p-2 rounded-full bg-[#FFD4E3] hover:bg-[#FFC6B3] dark:bg-[#2B2B2B] dark:hover:bg-[#3A3A3A] transition-all duration-300"
      aria-label="Toggle Dark Mode"
      title="Toggle Dark Mode"
    >
      {theme === "light" ? (
        <Moon className="w-5 h-5 text-[#333]" />
      ) : (
        <Sun className="w-5 h-5 text-[#FFD4E3]" />
      )}
    </button>
  );
}

