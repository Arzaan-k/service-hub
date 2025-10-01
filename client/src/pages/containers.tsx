import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";

export default function Containers() {
  const authToken = getAuthToken();

  const { data: containers } = useQuery({
    queryKey: ["/api/containers"],
    queryFn: async () => {
      const res = await fetch("/api/containers", {
        headers: { "x-user-id": authToken || "" },
      });
      return res.json();
    },
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Container Registry" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">All Containers ({containers?.length || 0})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Container ID</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Status</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Location</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Health</th>
                  </tr>
                </thead>
                <tbody>
                  {containers?.map((container: any) => (
                    <tr key={container.id} className="border-b border-border hover:bg-muted/10" data-testid={`row-container-${container.id}`}>
                      <td className="py-3 px-2 font-mono">{container.containerId}</td>
                      <td className="py-3 px-2">{container.type}</td>
                      <td className="py-3 px-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${container.status === "active" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
                          {container.status}
                        </span>
                      </td>
                      <td className="py-3 px-2">{container.currentLocation?.address || "Unknown"}</td>
                      <td className="py-3 px-2">{container.healthScore}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
