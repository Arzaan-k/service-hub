import React, { useState } from "react";
import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  MessageCircle,
  Send,
  Users,
  CheckCheck,
  Clock,
  AlertCircle,
  Phone,
  FileText,
  Search,
  Edit,
  Trash2,
  Plus,
  Eye,
  RefreshCw,
  Check,
  X,
} from "lucide-react";

interface Message {
  id: string;
  recipientType: string;
  phoneNumber: string;
  messageType: string;
  messageContent: any;
  status: string;
  sentAt: string;
  deliveredAt?: string;
  readAt?: string;
}

interface Conversation {
  phoneNumber: string;
  recipientType: string;
  lastMessage: string;
  lastMessageAt: string;
  messageCount: number;
}

interface WhatsAppTemplate {
  id?: string;
  name: string;
  category: string;
  language: string;
  status?: string;
  components: any[];
  content?: string;
  description?: string;
}

interface TemplateEditDialogProps {
  template: WhatsAppTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (template: WhatsAppTemplate) => void;
  onError: (message: string) => void;
}

export default function WhatsAppHub() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("messages");
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [messageText, setMessageText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [templateFilter, setTemplateFilter] = useState("all");

  const { data: messages, isLoading } = useQuery({
    queryKey: ["/api/whatsapp/messages"],
  });

  const { data: templates, isLoading: templatesLoading, refetch: refetchTemplates, error: templatesError } = useQuery({
    queryKey: ["/api/whatsapp/templates"],
    retry: 1,
    onError: (error) => {
      console.error("Templates query error:", error);
    },
    onSuccess: (data) => {
      console.log("Templates data received:", data);
    }
  });

  const createTemplate = useMutation({
    mutationFn: async (template: WhatsAppTemplate) => {
      return await apiRequest("POST", "/api/whatsapp/templates/register", template);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });
      toast({
        title: "Template Created",
        description: "WhatsApp template created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Creation Failed",
        description: "Failed to create WhatsApp template",
        variant: "destructive",
      });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ name, template }: { name: string; template: WhatsAppTemplate }) => {
      return await apiRequest("PUT", `/api/whatsapp/templates/${name}`, template);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });
      toast({
        title: "Template Updated",
        description: "WhatsApp template updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Update Failed",
        description: "Failed to update WhatsApp template",
        variant: "destructive",
      });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateName: string) => {
      return await apiRequest("DELETE", `/api/whatsapp/templates/${templateName}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });
      toast({
        title: "Template Deleted",
        description: "WhatsApp template deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Deletion Failed",
        description: "Failed to delete WhatsApp template",
        variant: "destructive",
      });
    },
  });

  const registerAllTemplates = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/whatsapp/templates/register-all");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/templates"] });
      toast({
        title: "Templates Registered",
        description: "All WhatsApp templates registered successfully",
      });
    },
    onError: () => {
      toast({
        title: "Registration Failed",
        description: "Failed to register WhatsApp templates",
        variant: "destructive",
      });
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (data: { to: string; message: string }) => {
      return await apiRequest("POST", "/api/whatsapp/send", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/messages"] });
      setMessageText("");
      setSelectedRecipient("");
      toast({
        title: "Message Sent",
        description: "WhatsApp message sent successfully",
      });
    },
    onError: () => {
      toast({
        title: "Send Failed",
        description: "Failed to send WhatsApp message",
        variant: "destructive",
      });
    },
  });

  const handleSend = () => {
    if (!selectedRecipient || !messageText.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter recipient number and message",
        variant: "destructive",
      });
      return;
    }
    sendMessage.mutate({ to: selectedRecipient, message: messageText });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <CheckCheck className="h-3 w-3 text-gray-400" />;
      case "delivered":
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case "read":
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      case "failed":
        return <AlertCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Clock className="h-3 w-3 text-gray-400" />;
    }
  };

  // Group messages by conversation
  const conversations: Conversation[] = messages?.reduce((acc: any[], msg: Message) => {
    const existing = acc.find((c) => c.phoneNumber === msg.phoneNumber);
    if (existing) {
      existing.messageCount++;
      if (new Date(msg.sentAt) > new Date(existing.lastMessageAt)) {
        existing.lastMessage = typeof msg.messageContent === "string"
          ? msg.messageContent
          : msg.messageContent?.text || "Media message";
        existing.lastMessageAt = msg.sentAt;
      }
    } else {
      acc.push({
        phoneNumber: msg.phoneNumber,
        recipientType: msg.recipientType,
        lastMessage: typeof msg.messageContent === "string"
          ? msg.messageContent
          : msg.messageContent?.text || "Media message",
        lastMessageAt: msg.sentAt,
        messageCount: 1,
      });
    }
    return acc;
  }, []) || [];

  const filteredConversations = conversations.filter((c) =>
    c.phoneNumber.includes(searchTerm) || c.recipientType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredMessages = messages?.filter((msg: Message) =>
    msg.phoneNumber.includes(searchTerm)
  );

  // Calculate stats
  const totalMessages = messages?.length || 0;
  const deliveredMessages = messages?.filter((m: Message) => m.status === "delivered" || m.status === "read").length || 0;
  const failedMessages = messages?.filter((m: Message) => m.status === "failed").length || 0;
  const deliveryRate = totalMessages > 0 ? ((deliveredMessages / totalMessages) * 100).toFixed(1) : "0";

  // Template helper functions
  const handleEditTemplate = (template: WhatsAppTemplate) => {
    setSelectedTemplate(template);
    setEditDialogOpen(true);
  };

  const handleCreateTemplate = () => {
    setSelectedTemplate(null);
    setEditDialogOpen(true);
  };

  const handleSaveTemplate = (template: WhatsAppTemplate) => {
    if (selectedTemplate) {
      updateTemplate.mutate({ name: selectedTemplate.name, template });
    } else {
      createTemplate.mutate(template);
    }
    setEditDialogOpen(false);
  };

  const handleTemplateError = (message: string) => {
    toast({
      title: "Validation Error",
      description: message,
      variant: "destructive",
    });
  };

  const handleDeleteTemplate = (templateName: string) => {
    if (!templateName) {
      toast({
        title: "Error",
        description: "Template name is missing",
        variant: "destructive",
      });
      return;
    }
    if (confirm(`Are you sure you want to delete template "${templateName}"?`)) {
      deleteTemplate.mutate(templateName);
    }
  };

  const getStatusBadgeVariant = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'rejected':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getStatusBadgeColor = (status?: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'text-green-600';
      case 'pending':
        return 'text-yellow-600';
      case 'rejected':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  // Handle different possible template data structures
  let templatesArray: WhatsAppTemplate[] = [];

  if (templates) {
    if (Array.isArray(templates)) {
      templatesArray = templates;
    } else if (templates.data && Array.isArray(templates.data)) {
      templatesArray = templates.data;
    } else if (templates.templates && Array.isArray(templates.templates)) {
      templatesArray = templates.templates;
    } else if (templates.localTemplates && typeof templates.localTemplates === 'object') {
      // Use local templates as fallback
      templatesArray = Object.values(templates.localTemplates);
    }
  }

  const filteredTemplates = templatesArray.filter((template: WhatsAppTemplate) => {
    if (templateFilter === 'all') return true;
    return template.status?.toLowerCase() === templateFilter;
  });

  const formatTemplateContent = (components: any[]) => {
    let content = '';
    components.forEach((component) => {
      if (component.type === 'HEADER' && component.text) {
        content += `Header: ${component.text}\n`;
      } else if (component.type === 'BODY' && component.text) {
        content += `Body: ${component.text}\n`;
      } else if (component.type === 'FOOTER' && component.text) {
        content += `Footer: ${component.text}\n`;
      }
    });
    return content.trim();
  };

  if (templatesLoading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="WhatsApp Communication Hub" />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading WhatsApp Hub...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (templatesError) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden">
          <Header title="WhatsApp Communication Hub" />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">Error Loading WhatsApp Hub</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {templatesError instanceof Error ? templatesError.message : 'Failed to load templates'}
              </p>
              <Button onClick={() => refetchTemplates()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="WhatsApp Communication Hub" />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <MessageCircle className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">WhatsApp Business API</h2>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-green-600">Connected</span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <MessageCircle className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{totalMessages}</p>
                    <p className="text-xs text-muted-foreground">Total Messages</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <CheckCheck className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{deliveryRate}%</p>
                    <p className="text-xs text-muted-foreground">Delivery Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{failedMessages}</p>
                    <p className="text-xs text-muted-foreground">Failed Messages</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Users className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{conversations.length}</p>
                    <p className="text-xs text-muted-foreground">Conversations</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="messages">Messages</TabsTrigger>
              <TabsTrigger value="send">Send Message</TabsTrigger>
              <TabsTrigger value="templates">Templates</TabsTrigger>
            </TabsList>

            {/* Messages Tab */}
            <TabsContent value="messages" className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search conversations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Conversations List */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageCircle className="h-5 w-5" />
                      Conversations ({filteredConversations.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredConversations.map((conv) => (
                      <div
                        key={conv.phoneNumber}
                        className="p-3 border border-border rounded-lg hover:bg-muted/20 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Phone className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{conv.phoneNumber}</p>
                              <p className="text-xs text-muted-foreground">
                                {conv.recipientType}
                              </p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {conv.messageCount}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-1">
                          {conv.lastMessage}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(conv.lastMessageAt).toLocaleString()}
                        </p>
                      </div>
                    ))}

                    {filteredConversations.length === 0 && (
                      <div className="text-center py-8">
                        <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No conversations found</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Messages */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Recent Messages
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredMessages?.slice(0, 20).map((msg: Message) => (
                      <div
                        key={msg.id}
                        className="p-3 border border-border rounded-lg hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="font-medium text-sm">{msg.phoneNumber}</p>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {msg.messageType}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {msg.recipientType}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(msg.status)}
                            <span className="text-xs text-muted-foreground">{msg.status}</span>
                          </div>
                        </div>
                        <p className="text-sm text-foreground">
                          {typeof msg.messageContent === "string"
                            ? msg.messageContent
                            : msg.messageContent?.text || JSON.stringify(msg.messageContent).substring(0, 100)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {new Date(msg.sentAt).toLocaleString()}
                        </p>
                      </div>
                    ))}

                    {(!filteredMessages || filteredMessages.length === 0) && (
                      <div className="text-center py-8">
                        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No messages found</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Send Message Tab */}
            <TabsContent value="send">
              <Card>
                <CardHeader>
                  <CardTitle>Send WhatsApp Message</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Recipient Phone Number
                    </label>
                    <Input
                      placeholder="+1234567890"
                      value={selectedRecipient}
                      onChange={(e) => setSelectedRecipient(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Include country code (e.g., +1 for US)
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Message
                    </label>
                    <Textarea
                      placeholder="Enter your message..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      rows={6}
                    />
                  </div>
                  <Button
                    onClick={handleSend}
                    disabled={sendMessage.isPending}
                    className="w-full gap-2"
                  >
                    <Send className="h-4 w-4" />
                    {sendMessage.isPending ? "Sending..." : "Send Message"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Templates Tab */}
            <TabsContent value="templates">
              <div className="space-y-4">
                {/* Template Management Header */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        WhatsApp Message Templates ({filteredTemplates.length})
                      </CardTitle>
                      <div className="flex gap-2">
                        <Select value={templateFilter} onValueChange={setTemplateFilter}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={() => registerAllTemplates.mutate()}
                          disabled={registerAllTemplates.isPending}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          <RefreshCw className={`h-4 w-4 ${registerAllTemplates.isPending ? 'animate-spin' : ''}`} />
                          Register All
                        </Button>
                        <Button
                          onClick={() => refetchTemplates()}
                          disabled={templatesLoading}
                          variant="outline"
                          size="sm"
                          className="gap-2"
                        >
                          <RefreshCw className={`h-4 w-4 ${templatesLoading ? 'animate-spin' : ''}`} />
                          Refresh
                        </Button>
                        <Button
                          onClick={handleCreateTemplate}
                          size="sm"
                          className="gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Create Template
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Templates List */}
                <div className="grid gap-4">
                  {filteredTemplates.map((template: WhatsAppTemplate) => (
                    <Card key={template.name || template.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-medium text-foreground">{template.name || 'Unnamed Template'}</h4>
                              <Badge variant={getStatusBadgeVariant(template.status)}>
                                {template.status || 'Unknown'}
                              </Badge>
                            </div>
                            <div className="flex gap-2 mb-2">
                              <Badge variant="outline" className="text-xs">
                                {template.category || 'UTILITY'}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {template.language || 'en'}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleEditTemplate(template)}
                              variant="outline"
                              size="sm"
                              className="gap-1"
                            >
                              <Edit className="h-3 w-3" />
                              Edit
                            </Button>
                            <Button
                              onClick={() => handleDeleteTemplate(template.name)}
                              variant="outline"
                              size="sm"
                              className="gap-1 text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-sm text-muted-foreground">
                            <strong>Components:</strong>
                          </div>
                          <div className="bg-muted p-3 rounded-md text-xs font-mono overflow-auto max-h-32">
                            {template.components ? formatTemplateContent(template.components) : 'No components defined'}
                          </div>
                        </div>

                        {template.components?.some((c: any) => c.type === 'BUTTONS') && (
                          <div className="mt-2">
                            <div className="text-sm text-muted-foreground mb-1">
                              <strong>Buttons:</strong>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {template.components.find((c: any) => c.type === 'BUTTONS')?.buttons?.map((button: any, idx: number) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {button.text || button.type}
                                </Badge>
                              )) || []}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}

                  {filteredTemplates.length === 0 && (
                    <Card>
                      <CardContent className="p-8">
                        <div className="text-center">
                          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-foreground mb-2">
                            No Templates Found
                          </h3>
                          <p className="text-sm text-muted-foreground mb-4">
                            {templateFilter === 'all'
                              ? 'No WhatsApp templates found. Create your first template or register all templates.'
                              : `No templates with status "${templateFilter}" found.`
                            }
                          </p>
                          <div className="flex gap-2 justify-center">
                            <Button onClick={handleCreateTemplate} className="gap-2">
                              <Plus className="h-4 w-4" />
                              Create Template
                            </Button>
                            <Button
                              onClick={() => registerAllTemplates.mutate()}
                              disabled={registerAllTemplates.isPending}
                              variant="outline"
                              className="gap-2"
                            >
                              <RefreshCw className={`h-4 w-4 ${registerAllTemplates.isPending ? 'animate-spin' : ''}`} />
                              Register All
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Template Edit Dialog */}
            <TemplateEditDialog
              template={selectedTemplate}
              open={editDialogOpen}
              onOpenChange={setEditDialogOpen}
              onSave={handleSaveTemplate}
              onError={handleTemplateError}
            />
          </Tabs>
        </div>
      </main>
    </div>
  );
}

// Template Edit Dialog Component
function TemplateEditDialog({ template, open, onOpenChange, onSave, onError }: TemplateEditDialogProps) {
  const [formData, setFormData] = useState<WhatsAppTemplate>({
    name: '',
    category: 'UTILITY',
    language: 'en',
    components: [
      { type: 'HEADER', format: 'TEXT', text: '' },
      { type: 'BODY', text: '' },
      { type: 'FOOTER', text: '' }
    ]
  });

  React.useEffect(() => {
    if (template) {
      setFormData(template);
    } else {
      setFormData({
        name: '',
        category: 'UTILITY',
        language: 'en',
        components: [
          { type: 'HEADER', format: 'TEXT', text: '' },
          { type: 'BODY', text: '' },
          { type: 'FOOTER', text: '' }
        ]
      });
    }
  }, [template]);

  const handleSave = () => {
    if (!formData.name.trim()) {
      onError("Template name is required");
      return;
    }

    if (!formData.components.some((c: any) => c.type === 'BODY' && c.text?.trim())) {
      onError("Template must have a body component");
      return;
    }

    onSave(formData);
  };

  const updateComponent = (index: number, field: string, value: string) => {
    const updatedComponents = [...formData.components];
    if (updatedComponents[index]) {
      updatedComponents[index] = { ...updatedComponents[index], [field]: value };
      setFormData({ ...formData, components: updatedComponents });
    }
  };

  const addButton = () => {
    const buttonComponent = formData.components.find((c: any) => c.type === 'BUTTONS');
    if (!buttonComponent) {
      setFormData({
        ...formData,
        components: [
          ...formData.components,
          {
            type: 'BUTTONS',
            buttons: [{ type: 'QUICK_REPLY', text: 'New Button' }]
          }
        ]
      });
    } else {
      const updatedButtons = [...(buttonComponent.buttons || []), { type: 'QUICK_REPLY', text: 'New Button' }];
      updateComponent(formData.components.indexOf(buttonComponent), 'buttons', updatedButtons);
    }
  };

  const removeButton = (buttonIndex: number) => {
    const buttonComponent = formData.components.find((c: any) => c.type === 'BUTTONS');
    if (buttonComponent && buttonComponent.buttons) {
      const updatedButtons = buttonComponent.buttons.filter((_: any, index: number) => index !== buttonIndex);
      if (updatedButtons.length === 0) {
        // Remove the entire BUTTONS component if no buttons left
        setFormData({
          ...formData,
          components: formData.components.filter((c: any) => c.type !== 'BUTTONS')
        });
      } else {
        updateComponent(formData.components.indexOf(buttonComponent), 'buttons', updatedButtons);
      }
    }
  };

  const updateButton = (buttonIndex: number, field: string, value: string) => {
    const buttonComponent = formData.components.find((c: any) => c.type === 'BUTTONS');
    if (buttonComponent && buttonComponent.buttons && buttonComponent.buttons[buttonIndex]) {
      const updatedButtons = [...buttonComponent.buttons];
      updatedButtons[buttonIndex] = { ...updatedButtons[buttonIndex], [field]: value };
      updateComponent(formData.components.indexOf(buttonComponent), 'buttons', updatedButtons);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Edit WhatsApp Template' : 'Create WhatsApp Template'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name *</Label>
              <Input
                id="template-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="template_name_v1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTILITY">Utility</SelectItem>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-language">Language</Label>
            <Select
              value={formData.language}
              onValueChange={(value) => setFormData({ ...formData, language: value })}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="hi">Hindi</SelectItem>
                <SelectItem value="es">Spanish</SelectItem>
                <SelectItem value="fr">French</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Components */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Template Components</Label>
              {formData.components.some((c: any) => c.type === 'BUTTONS') && (
                <Button onClick={addButton} size="sm" variant="outline" className="gap-2">
                  <Plus className="h-3 w-3" />
                  Add Button
                </Button>
              )}
            </div>

            {formData.components.map((component: any, index: number) => (
              <div key={index} className="border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant="outline">{component.type}</Badge>
                  {component.type === 'BUTTONS' && (
                    <Button onClick={addButton} size="sm" variant="outline" className="gap-1">
                      <Plus className="h-3 w-3" />
                      Add Button
                    </Button>
                  )}
                </div>

                {component.type === 'BUTTONS' ? (
                  <div className="space-y-2">
                    {component.buttons?.map((button: any, buttonIndex: number) => (
                      <div key={buttonIndex} className="flex items-center gap-2">
                        <Input
                          value={button.text || ''}
                          onChange={(e) => updateButton(buttonIndex, 'text', e.target.value)}
                          placeholder="Button text"
                          className="flex-1"
                        />
                        <Select
                          value={button.type}
                          onValueChange={(value) => updateButton(buttonIndex, 'type', value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="QUICK_REPLY">Quick Reply</SelectItem>
                            <SelectItem value="PHONE_NUMBER">Phone Number</SelectItem>
                            <SelectItem value="URL">URL</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          onClick={() => removeButton(buttonIndex)}
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Textarea
                    value={component.text || ''}
                    onChange={(e) => updateComponent(index, 'text', e.target.value)}
                    placeholder={`Enter ${component.type.toLowerCase()} text...`}
                    rows={component.type === 'BODY' ? 4 : 2}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label className="text-base font-medium">Preview</Label>
            <div className="border border-border rounded-lg p-4 bg-muted/20">
              <div className="text-sm font-mono whitespace-pre-line">
                {formData.components.map((component: any, index: number) => {
                  if (component.type === 'HEADER' && component.text) {
                    return `Header: ${component.text}\n`;
                  } else if (component.type === 'BODY' && component.text) {
                    return `Body: ${component.text}\n`;
                  } else if (component.type === 'FOOTER' && component.text) {
                    return `Footer: ${component.text}\n`;
                  } else if (component.type === 'BUTTONS' && component.buttons) {
                    return `Buttons: ${component.buttons.map((b: any) => b.text).join(', ')}\n`;
                  }
                  return '';
                }).filter(Boolean).join('\n')}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {template ? 'Update Template' : 'Create Template'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
