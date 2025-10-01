import Sidebar from "@/components/sidebar";
import Header from "@/components/header";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";

export default function Technicians() {
  const authToken = getAuthToken();

  const { data: technicians } = useQuery({
    queryKey: ["/api/technicians"],
    queryFn: async () => {
      const res = await fetch("/api/technicians", {
        headers: { "x-user-id": authToken || "" },
      });
      return res.json();
    },
  });

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Technicians" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {technicians?.map((tech: any) => (
              <div key={tech.id} className="bg-card border border-border rounded-lg p-6" data-testid={`card-technician-${tech.id}`}>
                <h3 className="text-lg font-semibold">{tech.techNumber}</h3>
                <p className="text-sm text-muted-foreground">{tech.experienceLevel}</p>
                <div className="mt-4">
                  <span className={`px-2 py-1 rounded-full text-xs ${tech.status === "available" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
                    {tech.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
