import { useState } from "react";
import ColorGuide from "@/components/color-guide";

export default function Header({ title }: { title: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showColorGuide, setShowColorGuide] = useState(false);

  return (
    <header className="h-16 bg-[#0b1220] border-b border-[#223351] flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <span className="text-sm text-white/80">Last updated: 2 min ago</span>
        <div className="w-2 h-2 bg-green-500 rounded-full pulse-indicator"></div>
      </div>

      <div className="flex items-center gap-4">
        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search containers, alerts..."
            className="w-80 pl-10 pr-4 py-2 bg-[#0e2038] border border-[#223351] rounded-md text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2 focus:ring-[#1f3b7a]"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search"
          />
          <i className="fas fa-search text-white/80 absolute left-3 top-1/2 -translate-y-1/2"></i>
        </div>

        {/* Notification Bell */}
        <button className="relative p-2 hover:bg-[#13233d] rounded-md transition-smooth" data-testid="button-notifications">
          <i className="fas fa-bell text-white/80"></i>
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>

        {/* Color Guide Button */}
        <button
          onClick={() => setShowColorGuide(true)}
          className="p-2 hover:bg-[#13233d] rounded-md transition-smooth"
          title="Color Coding Guide"
        >
          <i className="fas fa-palette text-white/80"></i>
        </button>

        {/* WhatsApp Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 border border-green-500/30 rounded-md">
          <i className="fab fa-whatsapp text-green-400"></i>
          <span className="text-xs font-medium text-green-400">Connected</span>
        </div>
      </div>

      <ColorGuide isOpen={showColorGuide} onClose={() => setShowColorGuide(false)} />
    </header>
  );
}
