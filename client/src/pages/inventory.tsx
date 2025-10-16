import { useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Package,
  AlertTriangle,
  Plus,
  Minus,
  Edit,
  Trash2,
  Search,
  Filter,
  TrendingDown,
  Box,
} from "lucide-react";

interface InventoryItem {
  id: string;
  partNumber: string;
  partName: string;
  category: string;
  quantityInStock: number;
  reorderLevel: number;
  unitPrice: number;
  location: string;
  lastRestocked?: string;
}

export default function Inventory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<"add" | "remove">("add");
  const [adjustmentQuantity, setAdjustmentQuantity] = useState(0);
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [isImporting, setIsImporting] = useState(false);
  const [importApiKey, setImportApiKey] = useState("");
  const [importBaseUrl, setImportBaseUrl] = useState("http://localhost:5000");
  const [importEndpoint, setImportEndpoint] = useState("/api/products");

  const [formData, setFormData] = useState({
    partNumber: "",
    partName: "",
    category: "",
    quantityInStock: 0,
    reorderLevel: 0,
    unitPrice: 0,
    location: "",
  });

  const { data: inventory, isLoading } = useQuery({
    queryKey: ["/api/inventory"],
  });

  const { data: reorderAlerts } = useQuery({
    queryKey: ["/api/inventory/reorder-alerts"],
  });

  const createItem = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/inventory", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Inventory item added successfully",
      });
    },
  });

  const adjustStock = useMutation({
    mutationFn: async ({ id, quantity, reason }: { id: string; quantity: number; reason: string }) => {
      const endpoint = quantity > 0 ? "add-stock" : "remove-stock";
      return await apiRequest("POST", `/api/inventory/${id}/${endpoint}`, {
        quantity: Math.abs(quantity),
        reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/reorder-alerts"] });
      setIsAdjustDialogOpen(false);
      setSelectedItem(null);
      toast({
        title: "Success",
        description: "Stock adjusted successfully",
      });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/inventory/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      toast({
        title: "Success",
        description: "Inventory item deleted successfully",
      });
    },
  });

  const importInventory = useMutation({
    mutationFn: async ({ apiKey, baseUrl, endpointPath }: { apiKey: string; baseUrl: string; endpointPath?: string }) => {
      const res = await apiRequest("POST", "/api/inventory/import", { apiKey, baseUrl, endpointPath });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/inventory"] });
      setIsImporting(false);
      toast({ title: "Imported", description: "Inventory imported successfully" });
    },
    onError: (err: any) => {
      const errorMsg = err?.message || "Unable to import";
      const suggestions = err?.suggestions || [];
      const details = err?.details || "";

      let fullMessage = errorMsg;
      if (details) fullMessage += `\n\nDetails: ${details}`;
      if (suggestions.length > 0) {
        fullMessage += `\n\nSuggestions:\n${suggestions.map((s: string) => `• ${s}`).join('\n')}`;
      }

      toast({
        title: "Import failed",
        description: fullMessage,
        variant: "destructive"
      });
    }
  });

  const debugConnection = useMutation({
    mutationFn: async ({ apiKey, baseUrl, endpointPath }: { apiKey: string; baseUrl: string; endpointPath?: string }) => {
      const res = await apiRequest("POST", "/api/inventory/debug", { apiKey, baseUrl, endpointPath });
      return await res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "Connection successful",
          description: `Found ${data.totalItems} items. Ready to import!`
        });
      } else {
        toast({
          title: "Connection failed",
          description: data.error,
          variant: "destructive"
        });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Debug failed",
        description: err?.message || "Unable to test connection",
        variant: "destructive"
      });
    }
  });

  const resetForm = () => {
    setFormData({
      partNumber: "",
      partName: "",
      category: "",
      quantityInStock: 0,
      reorderLevel: 0,
      unitPrice: 0,
      location: "",
    });
  };

  const handleAdd = () => {
    createItem.mutate(formData);
  };

  const handleAdjust = () => {
    if (!selectedItem) return;
    const quantity = adjustmentType === "add" ? adjustmentQuantity : -adjustmentQuantity;
    adjustStock.mutate({
      id: selectedItem.id,
      quantity,
      reason: adjustmentReason,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this item?")) {
      deleteItem.mutate(id);
    }
  };

  const openAdjustDialog = (item: InventoryItem, type: "add" | "remove") => {
    setSelectedItem(item);
    setAdjustmentType(type);
    setAdjustmentQuantity(0);
    setAdjustmentReason("");
    setIsAdjustDialogOpen(true);
  };

  // Filter inventory
  const filteredInventory = inventory?.filter((item: InventoryItem) => {
    const matchesSearch =
      item.partName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.partNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = Array.from(
    new Set(inventory?.map((item: InventoryItem) => item.category) || [])
  );

  const totalValue = inventory?.reduce(
    (sum: number, item: InventoryItem) => sum + item.quantityInStock * item.unitPrice,
    0
  );

  const lowStockCount = inventory?.filter(
    (item: InventoryItem) => item.quantityInStock <= item.reorderLevel
  ).length || 0;

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="Inventory" />
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Inventory Management" />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Box className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {inventory?.length || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Items</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <TrendingDown className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{lowStockCount}</p>
                    <p className="text-xs text-muted-foreground">Low Stock Items</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Package className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      {inventory?.reduce(
                        (sum: number, item: InventoryItem) => sum + item.quantityInStock,
                        0
                      ) || 0}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Units</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <Package className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">
                      ${(totalValue || 0).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Total Value</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Low Stock Alerts */}
          {lowStockCount > 0 && (
            <Card className="border-orange-200 bg-orange-50/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <CardTitle className="text-orange-900">Low Stock Alert</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-orange-800">
                  {lowStockCount} item(s) are below reorder level and need restocking
                </p>
              </CardContent>
            </Card>
          )}

          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search parts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat: string) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsImporting(true)}>
                Import Spares
              </Button>
              <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
              </Button>
            </div>
          </div>

          {/* Inventory Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                        Part Number
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                        Name
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                        Category
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                        In Stock
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                        Reorder Level
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                        Unit Price
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                        Location
                      </th>
                      <th className="text-left py-3 px-4 font-medium text-sm text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInventory?.map((item: InventoryItem) => (
                      <tr
                        key={item.id}
                        className="border-b border-border hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 px-4 font-mono text-sm">{item.partNumber}</td>
                        <td className="py-3 px-4 text-sm">{item.partName}</td>
                        <td className="py-3 px-4 text-sm">
                          <Badge variant="outline" className="text-xs">
                            {item.category}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <span
                            className={`font-medium ${
                              item.quantityInStock <= item.reorderLevel
                                ? "text-orange-600"
                                : "text-foreground"
                            }`}
                          >
                            {item.quantityInStock}
                            {item.quantityInStock <= item.reorderLevel && (
                              <AlertTriangle className="inline h-3 w-3 ml-1" />
                            )}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">{item.reorderLevel}</td>
                        <td className="py-3 px-4 text-sm">${item.unitPrice.toFixed(2)}</td>
                        <td className="py-3 px-4 text-sm">{item.location || "N/A"}</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openAdjustDialog(item, "add")}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openAdjustDialog(item, "remove")}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(item.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {(!filteredInventory || filteredInventory.length === 0) && (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      No inventory items found
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Get started by adding your first item
                    </p>
                    <Button onClick={() => setIsAddDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Item
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Add Item Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="partNumber">Part Number</Label>
              <Input
                id="partNumber"
                value={formData.partNumber}
                onChange={(e) => setFormData({ ...formData, partNumber: e.target.value })}
                placeholder="PN-12345"
              />
            </div>
            <div>
              <Label htmlFor="partName">Part Name</Label>
              <Input
                id="partName"
                value={formData.partName}
                onChange={(e) => setFormData({ ...formData, partName: e.target.value })}
                placeholder="Compressor Belt"
              />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Refrigeration"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="quantity">Initial Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  value={formData.quantityInStock}
                  onChange={(e) =>
                    setFormData({ ...formData, quantityInStock: parseInt(e.target.value || "0") })
                  }
                />
              </div>
              <div>
                <Label htmlFor="reorderLevel">Reorder Level</Label>
                <Input
                  id="reorderLevel"
                  type="number"
                  value={formData.reorderLevel}
                  onChange={(e) =>
                    setFormData({ ...formData, reorderLevel: parseInt(e.target.value || "0") })
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="unitPrice">Unit Price ($)</Label>
              <Input
                id="unitPrice"
                type="number"
                step="0.01"
                value={formData.unitPrice}
                onChange={(e) =>
                  setFormData({ ...formData, unitPrice: parseFloat(e.target.value || "0") })
                }
              />
            </div>
            <div>
              <Label htmlFor="location">Storage Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Warehouse A, Shelf 12"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={createItem.isPending}>
              {createItem.isPending ? "Adding..." : "Add Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Stock Dialog */}
      <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {adjustmentType === "add" ? "Add Stock" : "Remove Stock"} - {selectedItem?.partName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="adjustQuantity">Quantity</Label>
              <Input
                id="adjustQuantity"
                type="number"
                value={adjustmentQuantity}
                onChange={(e) => setAdjustmentQuantity(parseInt(e.target.value || "0"))}
                min="0"
              />
            </div>
            <div>
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                value={adjustmentReason}
                onChange={(e) => setAdjustmentReason(e.target.value)}
                placeholder="Restock, Usage, Damaged, etc."
              />
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Current Stock</p>
              <p className="text-2xl font-bold text-foreground">{selectedItem?.quantityInStock}</p>
              <p className="text-sm text-muted-foreground mt-2">New Stock</p>
              <p className="text-xl font-medium text-foreground">
                {adjustmentType === "add"
                  ? (selectedItem?.quantityInStock || 0) + adjustmentQuantity
                  : (selectedItem?.quantityInStock || 0) - adjustmentQuantity}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdjustDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdjust} disabled={adjustStock.isPending}>
              {adjustStock.isPending
                ? "Adjusting..."
                : adjustmentType === "add"
                ? "Add Stock"
                : "Remove Stock"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Inventory Dialog */}
      <Dialog open={isImporting} onOpenChange={setIsImporting}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Inventory from External API</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="baseUrl">Base URL</Label>
              <Input
                id="baseUrl"
                value={importBaseUrl}
                onChange={(e) => setImportBaseUrl(e.target.value)}
                placeholder="http://localhost:5000"
              />
            </div>
            <div>
              <Label htmlFor="endpoint">Endpoint Path (optional)</Label>
              <Input
                id="endpoint"
                value={importEndpoint}
                onChange={(e) => setImportEndpoint(e.target.value)}
                placeholder="/api/products"
              />
            </div>
            <div>
              <Label htmlFor="apiKey">X-API-Key</Label>
              <Input
                id="apiKey"
                value={importApiKey}
                onChange={(e) => setImportApiKey(e.target.value)}
                placeholder="Enter API key"
              />
            </div>
            <p className="text-xs text-muted-foreground">We will call baseUrl + endpoint with X-API-Key header (fallback to api_key query) and upsert by part number.</p>
          </div>
          <DialogFooter>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsImporting(false)}>Cancel</Button>
              <Button
                variant="outline"
                onClick={() => debugConnection.mutate({ apiKey: importApiKey, baseUrl: importBaseUrl, endpointPath: importEndpoint })}
                disabled={debugConnection.isPending || !importApiKey}
              >
                {debugConnection.isPending ? "Testing..." : "Test Connection"}
              </Button>
              <Button onClick={() => importInventory.mutate({ apiKey: importApiKey, baseUrl: importBaseUrl, endpointPath: importEndpoint })} disabled={importInventory.isPending || !importApiKey}>
                {importInventory.isPending ? "Importing..." : "Import"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
