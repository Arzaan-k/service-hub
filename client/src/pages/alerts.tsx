import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";
import AlertItem from "@/components/alert-item";

export default function Alerts() {
  const authToken = getAuthToken();

  const { data: alerts } = useQuery({
    queryKey: ["/api/alerts"],
    queryFn: async () => {
      const res = await fetch("/api/alerts", {
        headers: { "x-user-id": authToken || "" },
      });
      return res.json();
    },
  });

  const { data: containers } = useQuery({
    queryKey: ["/api/containers"],
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Alerts & Monitoring" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {alerts?.map((alert: any) => {
              const container = containers?.find((c: any) => c.id === alert.containerId);
              return (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  containerName={container?.containerId || "Unknown"}
                />
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
