import { useState } from "react";
import { getAuthToken } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { GlassCard } from "@/components/ui/animated-card";

async function sendTemplate(to: string, templateName: string, parameters: any[] = []) {
  const response = await apiRequest("POST", "/api/whatsapp/send-template", { to, templateName, parameters });
  return response.json();
}

export default function WhatsAppHubPanel() {
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState("");
  const [template, setTemplate] = useState("critical_alert_notification");
  return (
    <GlassCard className="h-full p-6">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-500/10 rounded-xl">
            <i className="fab fa-whatsapp text-green-500 text-xl"></i>
          </div>
          <h3 className="text-xl font-bold text-foreground tracking-tight">WhatsApp Hub</h3>
          <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
        </div>
      </div>

      <div className="flex flex-col gap-3 mb-6 bg-white/5 p-4 rounded-xl border border-white/10">
        <div className="flex gap-2">
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="Recipient phone"
            className="flex-1 px-3 h-10 text-sm bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:border-green-500/50 transition-colors"
          />
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="flex-1 px-3 h-10 text-sm bg-black/20 border border-white/10 rounded-lg focus:outline-none focus:border-green-500/50 transition-colors"
          >
            <option value="critical_alert_notification">Critical Alert</option>
            <option value="service_schedule">Service Schedule</option>
            <option value="invoice_notice">Invoice Notice</option>
          </select>
        </div>
        <button
          disabled={sending}
          onClick={async () => { setSending(true); try { await sendTemplate(to, template, []); } finally { setSending(false); } }}
          className="w-full bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-green-600/20 hover:shadow-green-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? "Sending..." : "Send Template Message"}
        </button>
      </div>

      {/* WhatsApp Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col items-center justify-center text-center">
          <p className="text-2xl font-bold text-foreground">24</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">Active Chats</p>
        </div>
        <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col items-center justify-center text-center">
          <p className="text-2xl font-bold text-foreground">156</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">Today's Msgs</p>
        </div>
        <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex flex-col items-center justify-center text-center">
          <p className="text-2xl font-bold text-green-500">98%</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mt-1">Response Rate</p>
        </div>
      </div>

      {/* Recent Messages */}
      <div className="space-y-4 max-h-64 overflow-y-auto pr-2 scrollbar-thin">
        {/* Client Message */}
        <div className="flex gap-3 group">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center flex-shrink-0 shadow-lg">
            <span className="text-xs font-bold text-white">JD</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-foreground">John Doe</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground">Client</span>
              <span className="text-xs text-muted-foreground ml-auto">5m ago</span>
            </div>
            <div className="bg-white/5 rounded-2xl rounded-tl-none p-3 border border-white/10 group-hover:bg-white/10 transition-colors">
              <p className="text-sm text-foreground/90">Container CNT-4892 status?</p>
            </div>
            <div className="mt-2 ml-4 bg-green-500/10 rounded-2xl rounded-tr-none p-3 border border-green-500/20">
              <p className="text-xs text-green-500 font-semibold mb-1 flex items-center gap-1">
                <i className="fas fa-robot"></i> Auto-response
              </p>
              <p className="text-sm text-foreground/90 leading-relaxed">
                Critical alert detected. Technician dispatched. ETA: 45 min.
              </p>
            </div>
          </div>
        </div>

        {/* Technician Message */}
        <div className="flex gap-3 group">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center flex-shrink-0 shadow-lg">
            <span className="text-xs font-bold text-white">MR</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold text-foreground">Mike Rodriguez</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-muted-foreground">Tech</span>
              <span className="text-xs text-muted-foreground ml-auto">12m ago</span>
            </div>
            <div className="bg-white/5 rounded-2xl rounded-tl-none p-3 border border-white/10 group-hover:bg-white/10 transition-colors">
              <p className="text-sm text-foreground/90">Service completed CNT-3401. Photos uploaded.</p>
            </div>
            <div className="mt-2 flex gap-2">
              <button className="bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                Approve & Invoice
              </button>
              <button className="bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground border border-white/10 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors">
                View Photos
              </button>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
