import { useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Building2, Phone, Mail, MapPin, CreditCard, Plus, Edit, Trash2, Package, Shield, ShieldOff } from "lucide-react";
import { Link } from "wouter";
import { getCurrentUser } from "@/lib/auth";

interface Customer {
  id: string;
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  whatsappNumber: string;
  customerTier: string;
  paymentTerms: string;
  billingAddress: string;
  status: string;
  containerCount?: number;
}

export default function Clients() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Customer | null>(null);
  const [selectedClient, setSelectedClient] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
    whatsappNumber: "",
    customerTier: "standard",
    paymentTerms: "net30",
    billingAddress: "",
  });

  const user = getCurrentUser();
  const role = (user?.role || "client").toLowerCase();
  const canManage = ["admin", "coordinator", "super_admin"].includes(role);


  const { data: clients, isLoading } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/clients");
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  // Fetch all containers so we can map them to clients by currentCustomerId
  const { data: containers, error: containersError } = useQuery({
    queryKey: ["/api/containers"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/containers");
      return response.json();
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });

  // Allocation state for assigning containers during client creation
  const [allocation, setAllocation] = useState<{ type: "dry" | "refrigerated" | ""; containerIds: string[] }>(
    { type: "", containerIds: [] }
  );
  const [containerSearchOpen, setContainerSearchOpen] = useState(false);

  // Show only unassigned containers of the selected type
  const filteredContainers = allocation.type && containers
    ? (containers || []).filter((c: any) => 
        String(c.type).toLowerCase() === allocation.type && !c.currentCustomerId
      )
    : [];

  const selectedContainers = filteredContainers.filter((c: any) => 
    allocation.containerIds.includes(c.id)
  );

  const createClient = useMutation({
    mutationFn: async (data: any) => {
      const requestData = {
        ...data,
        containerIds: allocation.containerIds.length > 0 ? allocation.containerIds : undefined
      };
      const res = await apiRequest("POST", "/api/clients", requestData);
      const created = await res.json();

      // The backend automatically creates a user account and sends credentials
      return created;
    },
    onSuccess: async (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/containers"] });
      setIsAddDialogOpen(false);
      resetForm();

      const containerMsg = allocation.containerIds.length > 0
        ? ` and ${allocation.containerIds.length} container(s) assigned`
        : "";

      let successMessage = `Client added${containerMsg}.`;

      if (result.userReused) {
        successMessage = `Client added${containerMsg}. Existing user account reused.`;
      } else if (result.userCreated !== undefined) {
        if (result.resetLinkSent) {
          successMessage = `Client added${containerMsg}. User account created and password setup link sent via email.`;
        } else if (result.userCreated) {
          successMessage = `Client added${containerMsg}. User account created. ⚠️ ${result.emailError || 'Email failed - check server logs for password setup link.'}`;
        } else {
          successMessage = `Client added${containerMsg}. User account creation failed.`;
        }
      }

      // Log reset link in dev mode or when email fails
      if (result.resetLink) {
        console.log('🔗 Client password setup link:', result.resetLink);
      }

      toast({
        title: "Success",
        description: successMessage,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add client",
        variant: "destructive",
      });
    },
  });

  const updateClient = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PUT", `/api/clients/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setIsEditDialogOpen(false);
      resetForm();
      toast({
        title: "Success",
        description: "Client updated successfully",
      });
    },
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/clients/${id}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Success",
        description: "Client deleted successfully",
      });
    },
  });

  const toggleAccess = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/customers/${id}/toggle-access`);
      return await res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      toast({
        title: "Success",
        description: data.message,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to toggle client access",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      companyName: "",
      contactPerson: "",
      email: "",
      phone: "",
      whatsappNumber: "",
      customerTier: "standard",
      paymentTerms: "net30",
      billingAddress: "",
    });
    setSelectedClient(null);
    setAllocation({ type: "", containerIds: [] });
    setContainerSearchOpen(false);
  };

  const handleAdd = () => {
    createClient.mutate(formData);
  };

  const handleEdit = (client: Customer) => {
    setSelectedClient(client);
    setFormData({
      companyName: client.companyName,
      contactPerson: client.contactPerson,
      email: client.email,
      phone: client.phone,
      whatsappNumber: client.whatsappNumber,
      customerTier: client.customerTier,
      paymentTerms: client.paymentTerms,
      billingAddress: client.billingAddress,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (selectedClient) {
      updateClient.mutate({ id: selectedClient.id, data: formData });
    }
  };

  const handleDelete = (client: Customer) => {
    setClientToDelete(client);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (clientToDelete) {
      deleteClient.mutate(clientToDelete.id);
      setIsDeleteDialogOpen(false);
      setClientToDelete(null);
    }
  };

  const getTierBadge = (tier: string) => {
    const tierMap: Record<string, string> = {
      premium: "bg-purple-100 text-purple-800 border-purple-200",
      standard: "bg-blue-100 text-blue-800 border-blue-200",
      basic: "bg-gray-100 text-gray-800 border-gray-200",
    };
    return tierMap[tier] || tierMap.standard;
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, string> = {
      active: "bg-green-100 text-green-800 border-green-200",
      inactive: "bg-gray-100 text-gray-800 border-gray-200",
      suspended: "bg-red-100 text-red-800 border-red-200",
    };
    return statusMap[status] || statusMap.active;
  };

  const getAccessBadge = (status: string) => {
    const accessMap: Record<string, string> = {
      active: "bg-green-100 text-green-800 border-green-200",
      inactive: "bg-red-100 text-red-800 border-red-200",
      suspended: "bg-orange-100 text-orange-800 border-orange-200",
    };
    return accessMap[status] || accessMap.active;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="Clients" />
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
        <Header title="Client Management" />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Clients</h2>
              <p className="text-sm text-muted-foreground">Manage your client relationships and accounts</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
                  queryClient.invalidateQueries({ queryKey: ["/api/containers"] });
                }}
              >
                Refresh
              </Button>
              {canManage && (
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Client
                </Button>
              )}
            </div>
          </div>


          {/* Calculate container count for each client */}
          {(() => {
            const clientsWithCounts = clients?.map((client: Customer) => ({
              ...client,
              containerCount: (containers || []).filter((container: any) => container.currentCustomerId === client.id).length
            })) || [];
            return (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {clientsWithCounts.map((client: Customer & { containerCount: number }) => {
                  const containerCount = client.containerCount;
              return (
              <Card key={client.id} className="card-surface hover:shadow-soft transition-all">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: '#FFE5B4', border: '1px solid #FFE0D6' }}>
                        <Building2 className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{client.companyName}</CardTitle>
                        <p className="text-sm text-muted-foreground">{client.contactPerson}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Badge className={`${getTierBadge(client.customerTier)} border text-xs rounded-full`}>
                      {client.customerTier.toUpperCase()}
                    </Badge>
                    <Badge className={`${getStatusBadge(client.status)} border text-xs rounded-full`}>
                      {client.status}
                    </Badge>
                    <Badge className={`${getAccessBadge(client.status)} border text-xs rounded-full`}>
                      Access: {client.status === 'active' ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground truncate">{client.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{client.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{client.paymentTerms}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{containerCount} containers</span>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Link href={`/clients/${client.id}`}>
                      <Button size="sm" className="flex-1 btn-secondary">
                        View Profile
                      </Button>
                    </Link>
                    {canManage && (
                      <Button
                        size="sm"
                        className="flex-1 btn-secondary"
                        onClick={() => handleEdit(client)}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        size="sm"
                        className="flex-1 btn-primary"
                        onClick={() => toggleAccess.mutate(client.id)}
                        disabled={toggleAccess.isPending}
                      >
                        {client.status === 'active' ? <ShieldOff className="h-3 w-3 mr-1" /> : <Shield className="h-3 w-3 mr-1" />}
                        {client.status === 'active' ? 'Disable' : 'Enable'}
                      </Button>
                    )}
                    {canManage && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(client)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );})}
              </div>
            );
          })()}

          {(!clients || clients.length === 0) && (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No clients found</h3>
              <p className="text-sm text-muted-foreground mb-4">Get started by adding your first client</p>
              {canManage && (
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Client
                </Button>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Add Client Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                placeholder="Acme Corporation"
              />
            </div>
            <div>
              <Label htmlFor="contactPerson">Contact Person</Label>
              <Input
                id="contactPerson"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@acme.com"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+1234567890"
              />
            </div>
            <div>
              <Label htmlFor="whatsapp">WhatsApp Number</Label>
              <Input
                id="whatsapp"
                value={formData.whatsappNumber}
                onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                placeholder="+1234567890"
              />
            </div>
            <div>
              <Label htmlFor="customerTier">Customer Tier</Label>
              <Select
                value={formData.customerTier}
                onValueChange={(value) => setFormData({ ...formData, customerTier: value })}
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
              <Label htmlFor="paymentTerms">Payment Terms</Label>
              <Select
                value={formData.paymentTerms}
                onValueChange={(value) => setFormData({ ...formData, paymentTerms: value })}
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
              <Label htmlFor="billingAddress">Billing Address</Label>
              <Textarea
                id="billingAddress"
                value={formData.billingAddress}
                onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                placeholder="123 Main St, City, State, ZIP"
                rows={3}
              />
            </div>
            {/* Container Allocation */}
            <div>
              <Label>Container Type</Label>
              <Select
                value={allocation.type}
                onValueChange={(value) => {
                  setAllocation({ type: value as any, containerIds: [] });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select container type (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dry">DRY</SelectItem>
                  <SelectItem value="refrigerated">REEFER</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Container Numbers</Label>
              <Popover open={containerSearchOpen} onOpenChange={setContainerSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={containerSearchOpen}
                    className="w-full justify-between"
                    disabled={!allocation.type || filteredContainers.length === 0}
                  >
                    {selectedContainers.length > 0 ? (
                      <span>
                        {selectedContainers.length} container(s) selected
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {allocation.type ? "Search containers..." : "Select type first"}
                      </span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0 z-[60]" align="start">
                  <Command>
                    <CommandInput placeholder="Search containers..." />
                    <CommandList>
                      <CommandEmpty>No unassigned containers found.</CommandEmpty>
                      <CommandGroup>
                        {filteredContainers.map((c: any) => (
                          <CommandItem
                            key={c.id}
                            value={c.containerCode}
                            onSelect={() => {
                              const isSelected = allocation.containerIds.includes(c.id);
                              if (isSelected) {
                                setAllocation((a) => ({
                                  ...a,
                                  containerIds: a.containerIds.filter(id => id !== c.id)
                                }));
                              } else {
                                setAllocation((a) => ({
                                  ...a,
                                  containerIds: [...a.containerIds, c.id]
                                }));
                              }
                            }}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                allocation.containerIds.includes(c.id) ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            <span>{c.containerCode}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedContainers.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {selectedContainers.map((c: any) => (
                    <Badge key={c.id} variant="secondary" className="text-xs">
                      {c.containerCode}
                      <button
                        className="ml-1 hover:text-destructive"
                        onClick={() => {
                          setAllocation((a) => ({
                            ...a,
                            containerIds: a.containerIds.filter(id => id !== c.id)
                          }));
                        }}
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            {canManage && (
              <Button onClick={handleAdd} disabled={createClient.isPending}>
                {createClient.isPending ? "Adding..." : "Add Client"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-companyName">Company Name</Label>
              <Input
                id="edit-companyName"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-contactPerson">Contact Person</Label>
              <Input
                id="edit-contactPerson"
                value={formData.contactPerson}
                onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-whatsapp">WhatsApp Number</Label>
              <Input
                id="edit-whatsapp"
                value={formData.whatsappNumber}
                onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-customerTier">Customer Tier</Label>
              <Select
                value={formData.customerTier}
                onValueChange={(value) => setFormData({ ...formData, customerTier: value })}
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
                value={formData.paymentTerms}
                onValueChange={(value) => setFormData({ ...formData, paymentTerms: value })}
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
              <Label htmlFor="edit-billingAddress">Billing Address</Label>
              <Textarea
                id="edit-billingAddress"
                value={formData.billingAddress}
                onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            {canManage && (
              <Button onClick={handleUpdate} disabled={updateClient.isPending}>
                {updateClient.isPending ? "Updating..." : "Update Client"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <i className="fas fa-exclamation-triangle"></i>
              Delete Client
            </DialogTitle>
            <DialogDescription className="text-left">
              <div className="space-y-3">
                <p className="font-medium">
                  Are you sure you want to delete <strong>{clientToDelete?.companyName}</strong>?
                </p>
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <i className="fas fa-trash-alt text-destructive mt-0.5"></i>
                    <div>
                      <p className="text-sm font-medium text-destructive-foreground mb-1">
                        ⚠️ This action cannot be undone and will:
                      </p>
                      <ul className="text-xs text-destructive-foreground space-y-1 ml-4">
                        <li>• Delete the client account permanently</li>
                        <li>• Remove all associated user data</li>
                        <li>• Delete all service requests and history</li>
                        <li>• Remove all invoices and financial records</li>
                        <li>• Unassign all containers from this client</li>
                      </ul>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  This will completely remove all data associated with this client from the system.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setClientToDelete(null);
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleteClient.isPending}
              className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {deleteClient.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Deleting...
                </>
              ) : (
                <>
                  <i className="fas fa-trash-alt mr-2"></i>
                  Delete Client
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
