import { useMemo, useState } from "react";
import { useRoute, useLocation, Link } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCurrentUser, getAuthToken } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Edit } from "lucide-react";
import { cn } from "@/lib/utils";

type Container = {
  id: string;
  containerCode: string;
  excelMetadata?: {
    rentalRow?: Record<string, any>;
  } | null;
};

type Customer = {
  id: string;
  companyName: string;
  contactPerson: string;
  status: string;
  customerTier?: string;
  paymentTerms?: string;
  phone?: string;
  whatsappNumber?: string;
  email?: string | null;
  billingAddress?: string | null;
  shippingAddress?: string | null;
};

export default function ClientProfile() {
  const [, params] = useRoute("/clients/:id");
  const [, setLocation] = useLocation();

  const user = getCurrentUser();
  const isSelfProfile = !params?.id;
  const isAdmin = ["admin", "coordinator", "super_admin"].includes((user?.role || "").toLowerCase());

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Edit modal state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    companyName: "",
    contactPerson: "",
    phone: "",
    whatsappNumber: "",
    email: "",
    customerTier: "standard",
    paymentTerms: "net30",
    billingAddress: "",
    shippingAddress: "",
    status: "active",
  });

  const customerQueryKey = isSelfProfile ? ["/api/customers/me"] : ["/api/customers", params!.id];
  const containersQueryKey = isSelfProfile ? ["/api/customers/me/containers"] : ["/api/customers", params!.id, "containers"];

  const token = getAuthToken();
  const commonHeaders: Record<string, string> = token ? { "x-user-id": token } : {};

  const { data: customer, isLoading: loadingCustomer, error: customerError } = useQuery<Customer | null>({
    queryKey: customerQueryKey,
    queryFn: async () => {
      const customerId = isSelfProfile ? "me" : params?.id;
      if (!customerId) throw new Error("No customer ID available");
      const url = isSelfProfile ? "/api/customers/me" : `/api/customers/${customerId}`;
      const res = await fetch(url, { headers: commonHeaders, credentials: "include" });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return (await res.json()) as Customer;
    },
    enabled: isSelfProfile || !!params?.id,
  });

  // Mutation for updating customer
  const updateCustomer = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PUT",
        headers: { ...commonHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setIsEditDialogOpen(false);
      resetEditForm();
      toast({
        title: "Success",
        description: "Client details updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update client details",
        variant: "destructive",
      });
    },
  });

  const resetEditForm = () => {
    setEditFormData({
      companyName: "",
      contactPerson: "",
      phone: "",
      whatsappNumber: "",
      email: "",
      customerTier: "standard",
      paymentTerms: "net30",
      billingAddress: "",
      shippingAddress: "",
      status: "active",
    });
  };

  const { data: containers, isLoading: loadingContainers, error: containersError } = useQuery<Container[] | null>({
    queryKey: containersQueryKey,
    queryFn: async () => {
      const customerId = isSelfProfile ? "me" : params?.id;
      if (!customerId) throw new Error("No customer ID available");
      const url = isSelfProfile ? "/api/customers/me/containers" : `/api/customers/${customerId}/containers`;
      const res = await fetch(url, { headers: commonHeaders, credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      return (await res.json()) as Container[];
    },
    enabled: isSelfProfile || !!params?.id,
  });

  // Alerts (filter to this customer's containers)
  const { data: allAlerts } = useQuery<any[] | null>({
    queryKey: ["/api/alerts"],
    queryFn: async () => {
      const res = await fetch("/api/alerts", { headers: commonHeaders, credentials: "include" });
      if (!res.ok) return [];
      return await res.json();
    },
  });

  // Service Requests for this customer
  const role = (user?.role || "client").toLowerCase();
  const { data: serviceRequests, error: serviceRequestsError } = useQuery<any[] | null>({
    queryKey: ["service-requests", isSelfProfile ? "me" : params?.id || ""] as any,
    queryFn: async () => {
      const customerId = isSelfProfile ? "me" : params?.id;
      if (!customerId) return [];
      const url = role === "client" && isSelfProfile
        ? "/api/service-requests"
        : `/api/service-requests/customer/${customerId}`;
      const res = await fetch(url, { headers: commonHeaders, credentials: "include" });
      if (!res.ok) {
        console.error("Failed to fetch service requests:", res.status, await res.text());
        return [];
      }
      return await res.json();
    },
    enabled: isSelfProfile || !!params?.id,
    retry: 1,
  });

  // Invoices summary (filter by customer id when available)
  const { data: invoices } = useQuery<any[] | null>({
    queryKey: ["/api/invoices"],
    queryFn: async () => {
      const res = await fetch("/api/invoices", { headers: commonHeaders, credentials: "include" });
      if (!res.ok) return [];
      return await res.json();
    },
  });

  // Derived values (must come AFTER queries above)
  const cust = customer as Customer | null;
  const list = (containers as Container[] | null) || [];
  const containerIds = new Set(list.map((c) => c.id));
  const alerts = (allAlerts || []).filter((a: any) => containerIds.has(a.containerId));
  const activeAlerts = alerts.filter((a: any) => !a.resolvedAt);
  const pendingServices = (serviceRequests || []).filter((sr: any) => !sr.actualEndTime && !serviceRequestsError);
  const customerInvoices = (invoices || []).filter((inv: any) => inv.customerId === (cust?.id || ""));
  const outstandingInvoices = customerInvoices.filter((inv: any) => ["pending", "overdue", "partially_paid"].includes((inv.paymentStatus || "").toLowerCase()));
  const outstandingAmount = outstandingInvoices.reduce((sum: number, inv: any) => sum + Number(inv.totalAmount || 0) - Number(inv.amountPaid || 0), 0);

  // Handlers that depend on cust
  const handleEdit = () => {
    if (!cust) return;
    setEditFormData({
      companyName: cust.companyName,
      contactPerson: cust.contactPerson,
      phone: cust.phone || "",
      whatsappNumber: cust.whatsappNumber || "",
      email: cust.email || "",
      customerTier: cust.customerTier || "standard",
      paymentTerms: cust.paymentTerms || "net30",
      billingAddress: cust.billingAddress || "",
      shippingAddress: cust.shippingAddress || "",
      status: cust.status,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!cust) return;
    updateCustomer.mutate({ id: cust.id, data: editFormData });
  };

  const excelHeaders = useMemo(() => [
    "Container  No",
    "Customer Name",
    "Size",
    "Type",
    "Location",
    "City",
    "State",
    "Deployed  Date",
  ], []);

  const isLoading = loadingCustomer || loadingContainers;

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="Client Profile" />
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </main>
      </div>
    );
  }

  if (customerError || containersError) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="Client Profile" />
          <div className="p-6">
            <Card>
              <CardHeader>
                <CardTitle>Error</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-destructive">Failed to load profile data.</p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Client Profile" />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl">{cust?.companyName || (isSelfProfile ? user?.name : "Client")}</CardTitle>
                <p className="text-sm text-muted-foreground">{cust?.contactPerson}</p>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && !isSelfProfile && (
                  <Button variant="outline" size="sm" onClick={handleEdit}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
                {cust?.customerTier && (
                  <Badge className="border text-xs">{String(cust.customerTier).toUpperCase()}</Badge>
                )}
                {cust?.status && (
                  <Badge className="border text-xs">{cust.status}</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Phone</div>
                  <div className="text-foreground">{cust?.phone || "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">WhatsApp</div>
                  <div className="text-foreground">{cust?.whatsappNumber || "-"}</div>
                </div>
                {cust?.email && (
                  <div>
                    <div className="text-muted-foreground">Email</div>
                    <div className="text-foreground">{cust.email}</div>
                  </div>
                )}
                <div>
                  <div className="text-muted-foreground">Customer Tier</div>
                  <div className="text-foreground">{cust?.customerTier || "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Payment Terms</div>
                  <div className="text-foreground">{cust?.paymentTerms || "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div className="text-foreground">{cust?.status || "-"}</div>
                </div>
              </div>
              <Separator className="my-4" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Billing Address</div>
                  <div className="text-foreground whitespace-pre-wrap">{cust?.billingAddress || "-"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Shipping Address</div>
                  <div className="text-foreground whitespace-pre-wrap">{cust?.shippingAddress || "-"}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Total Containers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{list.length}</div>
                <div className="text-xs text-muted-foreground">Assigned to this customer</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Active Alerts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{activeAlerts.length}</div>
                <div className="text-xs text-muted-foreground">Open/unresolved</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Pending Services</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{pendingServices.length}</div>
                <div className="text-xs text-muted-foreground">Scheduled or in progress</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Outstanding Invoices</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{outstandingInvoices.length}</div>
                <div className="text-xs text-muted-foreground">₹ {outstandingAmount.toLocaleString()}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Containers from Rental List.xlsx</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {excelHeaders.map((h) => (
                        <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {list.map((c) => {
                      const row = c.excelMetadata?.rentalRow || {};
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-mono text-sm">
                            <Link href={`/containers/${c.id}`} className="text-primary hover:underline cursor-pointer">
                              {row["Container  No"] || c.containerCode || ""}
                            </Link>
                          </TableCell>
                          <TableCell>{row["Customer Name"] || ""}</TableCell>
                          <TableCell>{row["Size"] || ""}</TableCell>
                          <TableCell>{row["Type"] || ""}</TableCell>
                          <TableCell>{row["Location"] || ""}</TableCell>
                          <TableCell>{row["City"] || ""}</TableCell>
                          <TableCell>{row["State"] || ""}</TableCell>
                          <TableCell>{row["Deployed  Date"] || ""}</TableCell>
                        </TableRow>
                      );
                    })}
                    {list.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={excelHeaders.length} className="text-center text-muted-foreground">
                          No containers found for this client.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Recent Alerts */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alert Code</TableHead>
                      <TableHead>Container</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Detected At</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(alerts || []).slice(0, 10).map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-sm">{a.alertCode || "-"}</TableCell>
                        <TableCell>{list.find((c) => c.id === a.containerId)?.containerCode || a.containerId}</TableCell>
                        <TableCell>
                          <Badge className={cn("border text-xs", a.severity === "critical" && "bg-red-100 text-red-800 border-red-200", a.severity === "high" && "bg-orange-100 text-orange-800 border-orange-200", a.severity === "medium" && "bg-yellow-100 text-yellow-800 border-yellow-200", a.severity === "low" && "bg-green-100 text-green-800 border-green-200")}>{a.severity}</Badge>
                        </TableCell>
                        <TableCell>{a.resolvedAt ? "Resolved" : "Open"}</TableCell>
                        <TableCell>{a.detectedAt ? new Date(a.detectedAt).toLocaleString() : "-"}</TableCell>
                      </TableRow>
                    ))}
                    {alerts.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">No alerts for this customer.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Service Requests */}
          <Card>
            <CardHeader>
              <CardTitle>Service Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Request #</TableHead>
                      <TableHead>Container</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Scheduled Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(serviceRequests || []).slice(0, 10).map((sr: any) => (
                      <TableRow key={sr.id}>
                        <TableCell className="font-mono text-sm">{sr.requestNumber}</TableCell>
                        <TableCell>{list.find((c) => c.id === sr.containerId)?.containerCode || sr.containerId}</TableCell>
                        <TableCell>{sr.status}</TableCell>
                        <TableCell>{sr.priority}</TableCell>
                        <TableCell>{sr.scheduledDate ? new Date(sr.scheduledDate).toLocaleString() : "-"}</TableCell>
                      </TableRow>
                    ))}
                    {(serviceRequests || []).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">No service requests yet.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Invoice Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Invoices (Outstanding)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Issue Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outstandingInvoices.slice(0, 10).map((inv: any) => (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono text-sm">{inv.invoiceNumber}</TableCell>
                        <TableCell>{inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : "-"}</TableCell>
                        <TableCell>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "-"}</TableCell>
                        <TableCell>₹ {Number(inv.totalAmount || 0).toLocaleString()}</TableCell>
                        <TableCell>{inv.paymentStatus}</TableCell>
                      </TableRow>
                    ))}
                    {outstandingInvoices.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">No outstanding invoices.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Edit Client Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-companyName">Company Name</Label>
                <Input
                  id="edit-companyName"
                  value={editFormData.companyName}
                  onChange={(e) => setEditFormData({ ...editFormData, companyName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-contactPerson">Contact Person</Label>
                <Input
                  id="edit-contactPerson"
                  value={editFormData.contactPerson}
                  onChange={(e) => setEditFormData({ ...editFormData, contactPerson: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-whatsapp">WhatsApp Number</Label>
                <Input
                  id="edit-whatsapp"
                  value={editFormData.whatsappNumber}
                  onChange={(e) => setEditFormData({ ...editFormData, whatsappNumber: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-customerTier">Customer Tier</Label>
                <Select
                  value={editFormData.customerTier}
                  onValueChange={(value) => setEditFormData({ ...editFormData, customerTier: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-paymentTerms">Payment Terms</Label>
                <Select
                  value={editFormData.paymentTerms}
                  onValueChange={(value) => setEditFormData({ ...editFormData, paymentTerms: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prepaid">Prepaid</SelectItem>
                    <SelectItem value="net15">Net 15 Days</SelectItem>
                    <SelectItem value="net30">Net 30 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-status">Status</Label>
                <Select
                  value={editFormData.status}
                  onValueChange={(value) => setEditFormData({ ...editFormData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-billingAddress">Billing Address</Label>
              <Textarea
                id="edit-billingAddress"
                value={editFormData.billingAddress}
                onChange={(e) => setEditFormData({ ...editFormData, billingAddress: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-shippingAddress">Shipping Address</Label>
              <Textarea
                id="edit-shippingAddress"
                value={editFormData.shippingAddress}
                onChange={(e) => setEditFormData({ ...editFormData, shippingAddress: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateCustomer.isPending}>
              {updateCustomer.isPending ? "Updating..." : "Update Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}



