import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";

export default function Clients() {
  const authToken = getAuthToken();

  const { data: clients } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const res = await fetch("/api/clients", {
        headers: { "x-user-id": authToken || "" },
      });
      if (!res.ok) return [];
      return res.json();
    },
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Client Management" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">All Clients</h3>
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                <i className="fas fa-plus mr-2"></i>Add Client
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clients?.map((client: any) => (
                <div key={client.id} className="p-6 bg-muted/10 rounded-lg border border-border" data-testid={`card-client-${client.id}`}>
                  <h4 className="text-lg font-semibold text-foreground mb-2">{client.companyName}</h4>
                  <p className="text-sm text-muted-foreground mb-4">{client.tier} Tier</p>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contact:</span>
                      <span className="text-foreground">{client.contactPerson || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Payment Terms:</span>
                      <span className="text-foreground">{client.paymentTerms} days</span>
                    </div>
                  </div>
                </div>
              ))}
              {(!clients || clients.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-8 col-span-3">No clients found</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
