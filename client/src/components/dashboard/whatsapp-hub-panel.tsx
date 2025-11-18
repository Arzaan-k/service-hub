import { useState } from "react";
import { getAuthToken } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

async function sendTemplate(to: string, templateName: string, parameters: any[] = []) {
  const response = await apiRequest("POST", "/api/whatsapp/send-template", { to, templateName, parameters });
  return response.json();
}

export default function WhatsAppHubPanel() {
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState("");
  const [template, setTemplate] = useState("critical_alert_notification");
  return (
    <div className="bg-card border border-whatsapp/20 rounded-lg p-6 h-full">
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-whatsapp/10 rounded-lg">
            <i className="fab fa-whatsapp text-whatsapp text-sm"></i>
          </div>
          <h3 className="text-lg font-semibold text-foreground">WhatsApp Communication Hub</h3>
          <div className="w-2 h-2 bg-whatsapp rounded-full pulse-indicator"></div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Recipient phone" className="px-3 h-9 text-sm input-soft rounded-md" />
          <select value={template} onChange={(e)=>setTemplate(e.target.value)} className="px-3 h-9 text-sm input-soft rounded-md">
            <option value="critical_alert_notification">Critical Alert</option>
            <option value="service_schedule">Service Schedule</option>
            <option value="invoice_notice">Invoice Notice</option>
          </select>
          <button disabled={sending} onClick={async ()=>{ setSending(true); try { await sendTemplate(to, template, []);} finally { setSending(false);} }} className="btn-primary disabled:opacity-50 px-4 py-2 rounded-md text-sm">{sending?"Sending...":"Send Template"}</button>
        </div>
      </div>

      {/* WhatsApp Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 items-stretch">
        <div className="p-4 bg-muted/10 rounded-lg flex flex-col justify-center">
          <p className="text-2xl font-bold text-foreground">24</p>
          <p className="text-xs text-muted-foreground">Active Chats</p>
        </div>
        <div className="p-4 bg-muted/10 rounded-lg flex flex-col justify-center">
          <p className="text-2xl font-bold text-foreground">156</p>
          <p className="text-xs text-muted-foreground">Today's Messages</p>
        </div>
        <div className="p-4 bg-muted/10 rounded-lg flex flex-col justify-center">
          <p className="text-2xl font-bold text-foreground">98%</p>
          <p className="text-xs text-muted-foreground">Response Rate</p>
        </div>
      </div>

      {/* Recent Messages */}
      <div className="space-y-3 max-h-64 overflow-y-auto pr-2 scrollbar-thin">
        {/* Client Message */}
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#FFE0D6' }}>
            <span className="text-xs font-medium" style={{ color: '#B96E57' }}>JD</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-foreground">John Doe (Client)</span>
              <span className="text-xs text-muted-foreground">+1 555-0123</span>
              <span className="text-xs text-muted-foreground">• 5 min ago</span>
            </div>
            <div className="bg-white rounded-2xl p-3 shadow-soft border border-[#FFE0D6]">
              <p className="text-sm text-foreground">Container CNT-4892 status?</p>
            </div>
            <div className="mt-2 rounded-2xl p-3 shadow-soft border" style={{ background: '#FFFDFB', borderColor: '#FFE0D6' }}>
              <p className="text-xs text-muted-foreground mb-2">Auto-response sent:</p>
              <p className="text-sm text-foreground leading-relaxed">
                Critical alert detected. Technician dispatched. ETA: 45 min.
              </p>
            </div>
          </div>
        </div>

        {/* Technician Message */}
        <div className="flex gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#FFD4E3' }}>
            <span className="text-xs font-medium" style={{ color: '#A9586B' }}>MR</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-foreground">Mike Rodriguez (Tech)</span>
              <span className="text-xs text-muted-foreground">+1 555-0456</span>
              <span className="text-xs text-muted-foreground">• 12 min ago</span>
            </div>
            <div className="bg-white rounded-2xl p-3 shadow-soft border border-[#FFE0D6]">
              <p className="text-sm text-foreground">Service completed CNT-3401. Photos uploaded.</p>
            </div>
            <div className="mt-2 flex gap-2">
              <button className="btn-primary px-4 py-2 rounded-md text-xs font-medium">
                Approve & Invoice
              </button>
              <button className="btn-secondary px-4 py-2 rounded-md text-xs font-medium">
                View Photos
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-4 pt-4 border-t" style={{ borderColor: '#FFE0D6' }}>
        <p className="text-xs text-muted-foreground mb-2">Quick Actions</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={()=>to && sendTemplate(to, "critical_alert_notification", [])} className="btn-primary px-4 py-2 rounded-md text-xs font-medium">
            Send Alert Broadcast
          </button>
          <button className="btn-secondary px-4 py-2 rounded-md text-xs font-medium">
            Schedule Message
          </button>
          <button className="btn-secondary px-4 py-2 rounded-md text-xs font-medium">
            View Templates
          </button>
        </div>
      </div>
    </div>
  );
}
