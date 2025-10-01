import Sidebar from "@/components/sidebar";
import Header from "@/components/header";

export default function WhatsAppHub() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="WhatsApp Communication Hub" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <i className="fab fa-whatsapp text-success text-2xl"></i>
              <h3 className="text-lg font-semibold">WhatsApp Integration</h3>
              <div className="w-2 h-2 bg-success rounded-full pulse-indicator ml-auto"></div>
              <span className="text-xs text-success">Connected</span>
            </div>
            <p className="text-muted-foreground">WhatsApp message interface coming soon...</p>
          </div>
        </div>
      </main>
    </div>
  );
}
