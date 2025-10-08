import { useState } from "react";
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

export default function WhatsAppHub() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("messages");
  const [selectedRecipient, setSelectedRecipient] = useState("");
  const [messageText, setMessageText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: messages, isLoading } = useQuery({
    queryKey: ["/api/whatsapp/messages"],
  });

  const { data: templates } = useQuery({
    queryKey: ["/api/whatsapp/templates"],
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
              <Card>
                <CardHeader>
                  <CardTitle>Message Templates</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {templates && templates.length > 0 ? (
                      templates.map((template: any) => (
                        <div
                          key={template.id}
                          className="p-4 border border-border rounded-lg"
                        >
                          <h4 className="font-medium text-foreground mb-2">{template.name}</h4>
                          <p className="text-sm text-muted-foreground mb-3">
                            {template.description}
                          </p>
                          <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                            {template.content}
                          </pre>
                          <div className="flex gap-2 mt-3">
                            <Badge variant="outline">{template.category}</Badge>
                            <Badge variant="outline">{template.status}</Badge>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-12">
                        <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-foreground mb-2">
                          No Templates Found
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Message templates will appear here once configured
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
