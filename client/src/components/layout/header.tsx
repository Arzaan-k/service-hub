import { useState } from "react";
import ColorGuide from "@/components/color-guide";

export default function Header({ title }: { title: string }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showColorGuide, setShowColorGuide] = useState(false);

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <span className="text-sm text-muted-foreground">Last updated: 2 min ago</span>
        <div className="w-2 h-2 bg-success rounded-full pulse-indicator"></div>
      </div>

      <div className="flex items-center gap-4">
        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search containers, alerts..."
            className="w-80 pl-10 pr-4 py-2 bg-muted/20 border border-border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search"
          />
          <i className="fas fa-search text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2"></i>
        </div>

        {/* Notification Bell */}
        <button className="relative p-2 hover:bg-muted/20 rounded-md transition-smooth" data-testid="button-notifications">
          <i className="fas fa-bell text-muted-foreground"></i>
          <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
        </button>

        {/* Color Guide Button */}
        <button
          onClick={() => setShowColorGuide(true)}
          className="p-2 hover:bg-muted/20 rounded-md transition-smooth"
          title="Color Coding Guide"
        >
          <i className="fas fa-palette text-muted-foreground"></i>
        </button>

        {/* WhatsApp Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-success/10 border border-success/20 rounded-md">
          <i className="fab fa-whatsapp text-success"></i>
          <span className="text-xs font-medium text-success">Connected</span>
        </div>
      </div>

      <ColorGuide isOpen={showColorGuide} onClose={() => setShowColorGuide(false)} />
    </header>
  );
}
