import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "@/lib/auth";

export default function Inventory() {
  const authToken = getAuthToken();

  const { data: inventory } = useQuery({
    queryKey: ["/api/inventory"],
    queryFn: async () => {
      const res = await fetch("/api/inventory", {
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
        <Header title="Inventory Management" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-card border border-border rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Spare Parts Inventory</h3>
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
                <i className="fas fa-plus mr-2"></i>Add Part
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Part Number</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Part Name</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Category</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">In Stock</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Reorder Level</th>
                    <th className="text-left py-3 px-2 font-medium text-muted-foreground">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {inventory?.map((item: any) => (
                    <tr key={item.id} className="border-b border-border hover:bg-muted/10" data-testid={`row-inventory-${item.id}`}>
                      <td className="py-3 px-2 font-mono">{item.partNumber}</td>
                      <td className="py-3 px-2">{item.partName}</td>
                      <td className="py-3 px-2">{item.category}</td>
                      <td className="py-3 px-2">
                        <span className={item.quantityInStock < item.reorderLevel ? "text-warning" : "text-foreground"}>
                          {item.quantityInStock}
                        </span>
                      </td>
                      <td className="py-3 px-2">{item.reorderLevel}</td>
                      <td className="py-3 px-2">{item.location || "N/A"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!inventory || inventory.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-8">No inventory items found</p>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
