import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";

export default function ServiceRequests() {
  const authToken = getAuthToken();

  const { data: requests } = useQuery({
    queryKey: ["/api/service-requests"],
    queryFn: async () => {
      const res = await fetch("/api/service-requests", {
        headers: { "x-user-id": authToken || "" },
      });
      return res.json();
    },
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Service Requests" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">All Service Requests</h3>
            <div className="space-y-4">
              {requests?.map((request: any) => (
                <div key={request.id} className="p-4 border border-border rounded-lg" data-testid={`service-request-${request.id}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono font-semibold">{request.requestNumber}</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${request.status === "completed" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
                      {request.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{request.issueDescription}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
