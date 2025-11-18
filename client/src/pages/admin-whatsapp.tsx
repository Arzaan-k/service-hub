import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface WhatsAppUser {
  id: string;
  phoneNumber: string;
  name: string;
  email: string;
  role: string;
  whatsappVerified: boolean;
  isActive: boolean;
}

interface WhatsAppTemplate {
  id: string;
  name: string;
  category: string;
  language: string;
  status: string;
  components: any[];
}

export default function AdminWhatsApp() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("users");

  // USERS TAB
  const [filterVerified, setFilterVerified] = useState<"all" | "true" | "false">("all");
  const [verifyForm, setVerifyForm] = useState({ phoneNumber: "", name: "", email: "", role: "client" });
  const [revokePhone, setRevokePhone] = useState("");

  const usersQueryKey = useMemo(() => ["/api/admin/whatsapp/users", filterVerified], [filterVerified]);
  const usersQuery = useQuery({
    queryKey: usersQueryKey,
    queryFn: async () => {
      const url = filterVerified === "all" ? "/api/admin/whatsapp/users" : `/api/admin/whatsapp/users?verified=${filterVerified}`;
      const res = await apiRequest("GET", url);
      return await res.json();
    },
  });

  const verifyMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("POST", "/api/admin/whatsapp/verify-client", body);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Client verified", description: "WhatsApp access enabled" });
      queryClient.invalidateQueries({ queryKey: usersQueryKey });
      setVerifyForm({ phoneNumber: "", name: "", email: "", role: "client" });
    },
    onError: () => toast({ title: "Failed", description: "Could not verify client", variant: "destructive" })
  });

  const revokeMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("POST", "/api/admin/whatsapp/revoke-client", body);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Access revoked" });
      queryClient.invalidateQueries({ queryKey: usersQueryKey });
      setRevokePhone("");
    },
    onError: () => toast({ title: "Failed", description: "Could not revoke access", variant: "destructive" })
  });

  // TEMPLATES TAB
  const templatesQuery = useQuery({
    queryKey: ["/api/whatsapp/templates"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/whatsapp/templates");
      return await res.json();
    }
  });

  const registerAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/whatsapp/templates/register-all", {});
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Templates registration started" });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });
    },
    onError: () => toast({ title: "Failed", description: "Could not register templates", variant: "destructive" })
  });

  // SEND TAB
  const [sendTo, setSendTo] = useState("");
  const [sendText, setSendText] = useState("");
  const [tplTo, setTplTo] = useState("");
  const [tplName, setTplName] = useState("");
  const [tplParams, setTplParams] = useState("");

  const sendTextMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("POST", "/api/admin/whatsapp/send-text", body);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Text sent" });
      setSendTo("");
      setSendText("");
    },
    onError: () => toast({ title: "Failed", description: "Could not send text", variant: "destructive" })
  });

  const sendTplMutation = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("POST", "/api/admin/whatsapp/send-template", body);
      return await res.json();
    },
    onSuccess: () => {
      toast({ title: "Template sent" });
      setTplTo("");
      setTplName("");
      setTplParams("");
    },
    onError: () => toast({ title: "Failed", description: "Could not send template", variant: "destructive" })
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Admin • WhatsApp Management</h1>
          <p className="text-sm text-muted-foreground">Manage client access, templates, and messaging</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="send">Send</TabsTrigger>
          <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
                Verify Client Access
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Input
                placeholder="Phone Number (digits only)"
                value={verifyForm.phoneNumber}
                onChange={(e)=>setVerifyForm(v=>({...v,phoneNumber:e.target.value}))}
              />
              <Input
                placeholder="Full Name"
                value={verifyForm.name}
                onChange={(e)=>setVerifyForm(v=>({...v,name:e.target.value}))}
              />
              <Input
                placeholder="Email Address"
                type="email"
                value={verifyForm.email}
                onChange={(e)=>setVerifyForm(v=>({...v,email:e.target.value}))}
              />
              <Select value={verifyForm.role} onValueChange={(value)=>setVerifyForm(v=>({...v,role:value}))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Client</SelectItem>
                  <SelectItem value="technician">Technician</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button
                disabled={verifyMutation.isPending}
                onClick={()=>verifyMutation.mutate(verifyForm)}
                className="bg-green-600 hover:bg-green-700"
              >
                {verifyMutation.isPending ? 'Verifying...' : 'Verify Access'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                User Management
                {filterVerified !== 'all' && <Badge variant="outline">Filter: {filterVerified}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={filterVerified==='all'?"default":"outline"}
                  onClick={()=>setFilterVerified('all')}
                  size="sm"
                >
                  All Users
                </Button>
                <Button
                  variant={filterVerified==='true'?"default":"outline"}
                  onClick={()=>setFilterVerified('true')}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  Verified Only
                </Button>
                <Button
                  variant={filterVerified==='false'?"default":"outline"}
                  onClick={()=>setFilterVerified('false')}
                  size="sm"
                  className="bg-red-600 hover:bg-red-700"
                >
                  Unverified Only
                </Button>
              </div>

              <div className="grid gap-3">
                {(usersQuery.data || []).map((user: WhatsAppUser) => (
                  <div key={user.id} className="p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground">{user.name}</div>
                          <div className="text-xs text-muted-foreground">{user.email}</div>
                          <div className="text-xs text-muted-foreground">📱 {user.phoneNumber}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={user.whatsappVerified ? "default" : "secondary"}
                          className={user.whatsappVerified ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}
                        >
                          {user.whatsappVerified ? '✅ Verified' : '❌ Unverified'}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {user.role}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
                {usersQuery.isLoading && (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <div className="text-sm text-muted-foreground">Loading users...</div>
                  </div>
                )}
                {usersQuery.data && usersQuery.data.length === 0 && (
                  <div className="text-center py-8">
                    <svg className="h-12 w-12 text-muted-foreground mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <div className="text-sm text-muted-foreground">No users found</div>
                  </div>
                )}
              </div>

              <Card className="border-red-200">
                <CardHeader>
                  <CardTitle className="text-red-600 flex items-center gap-2">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    Revoke Access
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Phone Number (digits only)"
                      value={revokePhone}
                      onChange={(e)=>setRevokePhone(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="destructive"
                      disabled={revokeMutation.isPending || !revokePhone}
                      onClick={()=>revokeMutation.mutate({ phoneNumber: revokePhone })}
                      className="whitespace-nowrap"
                    >
                      {revokeMutation.isPending ? 'Revoking...' : 'Revoke Access'}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    ⚠️ This will disable WhatsApp access for this user
                  </p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                WhatsApp Templates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  onClick={()=>registerAllMutation.mutate()}
                  disabled={registerAllMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {registerAllMutation.isPending ? 'Registering...' : 'Register All Templates'}
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                Templates are registered with WhatsApp Business API and require approval before use.
              </div>

              {templatesQuery.isLoading && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                  <div className="text-sm text-muted-foreground">Loading templates...</div>
                </div>
              )}

              {templatesQuery.data && (
                <div className="space-y-3">
                  {Object.entries(templatesQuery.data).map(([key, template]: [string, any]) => (
                    <div key={key} className="p-4 border border-border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-foreground">{template.name}</h4>
                        <Badge variant="outline">{template.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{template.language}</p>
                      <div className="text-xs bg-muted p-2 rounded font-mono">
                        {JSON.stringify(template.components, null, 2)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="send" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send WhatsApp Message
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Send Text Message</label>
                  <Input
                    placeholder="Recipient phone (digits only)"
                    value={sendTo}
                    onChange={(e)=>setSendTo(e.target.value)}
                  />
                  <Input
                    placeholder="Message text"
                    value={sendText}
                    onChange={(e)=>setSendText(e.target.value)}
                  />
                  <Button
                    onClick={()=>sendTextMutation.mutate({ to: sendTo, text: sendText })}
                    disabled={sendTextMutation.isPending || !sendTo || !sendText}
                    className="w-full"
                  >
                    {sendTextMutation.isPending ? 'Sending...' : 'Send Text'}
                  </Button>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Send Template Message</label>
                  <Input
                    placeholder="Recipient phone (digits only)"
                    value={tplTo}
                    onChange={(e)=>setTplTo(e.target.value)}
                  />
                  <Input
                    placeholder="Template name"
                    value={tplName}
                    onChange={(e)=>setTplName(e.target.value)}
                  />
                  <Input
                    placeholder="Parameters (comma separated)"
                    value={tplParams}
                    onChange={(e)=>setTplParams(e.target.value)}
                  />
                  <Button
                    onClick={()=>sendTplMutation.mutate({
                      to: tplTo,
                      templateName: tplName,
                      parameters: tplParams.split(',').map(s=>s.trim()).filter(Boolean)
                    })}
                    disabled={sendTplMutation.isPending || !tplTo || !tplName}
                    className="w-full"
                  >
                    {sendTplMutation.isPending ? 'Sending...' : 'Send Template'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diagnostics">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                WhatsApp Diagnostics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">Configuration Status</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Phone Number ID:</span>
                      <span className="font-mono text-xs">{process.env.WA_PHONE_NUMBER_ID || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">WABA ID:</span>
                      <span className="font-mono text-xs">{process.env.WABA_ID || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Access Token:</span>
                      <span className="font-mono text-xs">{process.env.CLOUD_API_ACCESS_TOKEN ? 'Set' : 'Not set'}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-muted/50 rounded-lg">
                  <h4 className="font-medium text-foreground mb-2">Recent Activity</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Webhook URL:</span>
                      <span className="font-mono text-xs">{process.env.CORS_ORIGIN || 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Verify Token:</span>
                      <span className="font-mono text-xs">{process.env.WEBHOOK_VERIFICATION_TOKEN ? 'Set' : 'Not set'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last Test:</span>
                      <span className="text-green-600">Working</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Testing Instructions</h4>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>1. Use the Templates tab to register templates with WhatsApp</p>
                  <p>2. Templates require WhatsApp approval before use</p>
                  <p>3. Check server logs for webhook events</p>
                  <p>4. Test sending messages through the Send tab</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}


