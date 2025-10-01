import Sidebar from "@/components/sidebar";
import Header from "@/components/header";

export default function Scheduling() {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Scheduling" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Daily Schedule Planner</h3>
            <p className="text-muted-foreground">Scheduling interface coming soon...</p>
          </div>
        </div>
      </main>
    </div>
  );
}
