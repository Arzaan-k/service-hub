import { useState } from "react";
import { getAuthToken } from "@/lib/auth";

async function sendTemplate(to: string, templateName: string, parameters: any[] = []) {
  const res = await fetch("/api/whatsapp/send-template", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-user-id": getAuthToken() || "" },
    body: JSON.stringify({ to, templateName, parameters }),
  });
  return res.json();
}

export default function WhatsAppHubPanel() {
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState("");
  const [template, setTemplate] = useState("critical_alert_notification");
  return (
    <div className="bg-card border border-whatsapp/20 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-whatsapp/10 rounded-lg">
            <i className="fab fa-whatsapp text-whatsapp text-sm"></i>
          </div>
          <h3 className="text-lg font-semibold text-foreground">WhatsApp Communication Hub</h3>
          <div className="w-2 h-2 bg-whatsapp rounded-full pulse-indicator"></div>
        </div>
        <div className="flex items-center gap-2">
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Recipient phone" className="px-2 py-1 text-xs bg-muted/20 border border-border rounded" />
          <select value={template} onChange={(e)=>setTemplate(e.target.value)} className="px-2 py-1 text-xs bg-muted/20 border border-border rounded">
            <option value="critical_alert_notification">Critical Alert</option>
            <option value="service_schedule">Service Schedule</option>
            <option value="invoice_notice">Invoice Notice</option>
          </select>
          <button disabled={sending} onClick={async ()=>{ setSending(true); try { await sendTemplate(to, template, []);} finally { setSending(false);} }} className="text-xs text-whatsapp hover:underline disabled:opacity-50">{sending?"Sending...":"Send Template"}</button>
        </div>
      </div>

      {/* WhatsApp Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="p-3 bg-muted/10 rounded-lg">
          <p className="text-2xl font-bold text-foreground">24</p>
          <p className="text-xs text-muted-foreground">Active Chats</p>
        </div>
        <div className="p-3 bg-muted/10 rounded-lg">
          <p className="text-2xl font-bold text-foreground">156</p>
          <p className="text-xs text-muted-foreground">Today's Messages</p>
        </div>
        <div className="p-3 bg-muted/10 rounded-lg">
          <p className="text-2xl font-bold text-foreground">98%</p>
          <p className="text-xs text-muted-foreground">Response Rate</p>
        </div>
      </div>

      {/* Recent Messages */}
      <div className="space-y-3 max-h-64 overflow-y-auto pr-2 scrollbar-thin">
        {/* Client Message */}
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-primary">JD</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-foreground">John Doe (Client)</span>
              <span className="text-xs text-muted-foreground">+1 555-0123</span>
              <span className="text-xs text-muted-foreground">• 5 min ago</span>
            </div>
            <div className="bg-muted/20 rounded-lg p-3">
              <p className="text-sm text-foreground">Container CNT-4892 status?</p>
            </div>
            <div className="mt-2 bg-primary/10 border border-primary/20 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-2">Auto-Response Sent:</p>
              <p className="text-sm text-foreground">
                Critical alert detected. Technician dispatched. ETA: 45 min.
              </p>
            </div>
          </div>
        </div>

        {/* Technician Message */}
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-secondary">MR</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-foreground">Mike Rodriguez (Tech)</span>
              <span className="text-xs text-muted-foreground">+1 555-0456</span>
              <span className="text-xs text-muted-foreground">• 12 min ago</span>
            </div>
            <div className="bg-muted/20 rounded-lg p-3">
              <p className="text-sm text-foreground">Service completed CNT-3401. Photos uploaded.</p>
            </div>
            <div className="mt-2 flex gap-2">
              <button className="px-3 py-1.5 text-xs font-medium bg-success text-success-foreground rounded hover:bg-success/90 transition-smooth">
                Approve & Invoice
              </button>
              <button className="px-3 py-1.5 text-xs font-medium border border-border rounded hover:bg-muted/20 transition-smooth">
                View Photos
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground mb-2">Quick Actions</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={()=>to && sendTemplate(to, "critical_alert_notification", [])} className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-smooth">
            Send Alert Broadcast
          </button>
          <button className="px-3 py-1.5 text-xs font-medium border border-border rounded hover:bg-muted/20 transition-smooth">
            Schedule Message
          </button>
          <button className="px-3 py-1.5 text-xs font-medium border border-border rounded hover:bg-muted/20 transition-smooth">
            View Templates
          </button>
        </div>
      </div>
    </div>
  );
}
