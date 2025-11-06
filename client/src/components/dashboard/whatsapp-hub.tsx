import { useState } from "react";

interface WhatsAppMessage {
  id: string;
  phoneNumber: string;
  userName: string;
  userRole: string;
  messageType: "text" | "interactive" | "image";
  content: string;
  timestamp: string;
  direction: "inbound" | "outbound";
  status?: "sent" | "delivered" | "read";
  isAutomated?: boolean;
}

interface WhatsAppHubProps {
  onSendMessage?: (phoneNumber: string, message: string) => void;
}

export default function WhatsAppHub({ onSendMessage }: WhatsAppHubProps) {
  const [activeTab, setActiveTab] = useState<"clients" | "technicians" | "admins">("clients");
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");

  // Mock conversations data - in production, this would come from props or API
  const conversations: Record<string, WhatsAppMessage[]> = {
    "+15550123": [
      {
        id: "1",
        phoneNumber: "+15550123",
        userName: "John Doe",
        userRole: "client",
        messageType: "text",
        content: "Container CNT-4892 status?",
        timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
        direction: "inbound",
      },
      {
        id: "2",
        phoneNumber: "+15550123",
        userName: "System",
        userRole: "system",
        messageType: "interactive",
        content: "Critical alert detected. Technician dispatched. ETA: 45 min. Track: [Link]",
        timestamp: new Date(Date.now() - 4 * 60000).toISOString(),
        direction: "outbound",
        status: "read",
        isAutomated: true,
      },
    ],
    "+15550456": [
      {
        id: "3",
        phoneNumber: "+15550456",
        userName: "Mike Rodriguez",
        userRole: "technician",
        messageType: "text",
        content: "Service completed CNT-3401. Before/After photos uploaded.",
        timestamp: new Date(Date.now() - 12 * 60000).toISOString(),
        direction: "inbound",
      },
    ],
  };

  const activeConversations = Object.entries(conversations).map(([phone, messages]) => ({
    phoneNumber: phone,
    lastMessage: messages[messages.length - 1],
    unreadCount: messages.filter((m) => m.direction === "inbound" && !m.status).length,
  }));

  const filteredConversations = activeConversations.filter((conv) => {
    const role = conv.lastMessage.userRole;
    if (activeTab === "clients") return role === "client";
    if (activeTab === "technicians") return role === "technician";
    if (activeTab === "admins") return role === "admin";
    return true;
  });

  const handleSendMessage = () => {
    if (messageInput.trim() && selectedConversation) {
      onSendMessage?.(selectedConversation, messageInput);
      setMessageInput("");
    }
  };

  const getRoleColor = (role: string) => {
    const colors = {
      client: "bg-primary/20 text-primary",
      technician: "bg-secondary/20 text-secondary",
      admin: "bg-accent/20 text-accent",
      system: "bg-muted/20 text-muted-foreground",
    };
    return colors[role as keyof typeof colors] || colors.system;
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col h-[600px]">
      {/* Header */}
      <div className="p-6 border-b border-border bg-success/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-success flex items-center justify-center">
              <i className="fab fa-whatsapp text-white text-xl"></i>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">WhatsApp Communication Hub</h3>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-success rounded-full pulse-dot"></div>
                <p className="text-sm text-success">Connected & Authorized</p>
              </div>
            </div>
          </div>
          <button
            className="px-3 py-1.5 bg-success text-white rounded-lg text-xs font-medium hover:opacity-90"
            data-testid="button-new-message"
          >
            <i className="fas fa-plus mr-1"></i>New Message
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("clients")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-smooth ${
              activeTab === "clients" ? "bg-success/20 text-success" : "bg-card border border-border text-foreground"
            }`}
            data-testid="tab-clients"
          >
            Clients ({activeConversations.filter((c) => c.lastMessage.userRole === "client").length})
          </button>
          <button
            onClick={() => setActiveTab("technicians")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-smooth ${
              activeTab === "technicians" ? "bg-success/20 text-success" : "bg-card border border-border text-foreground"
            }`}
            data-testid="tab-technicians"
          >
            Technicians ({activeConversations.filter((c) => c.lastMessage.userRole === "technician").length})
          </button>
          <button
            onClick={() => setActiveTab("admins")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-smooth ${
              activeTab === "admins" ? "bg-success/20 text-success" : "bg-card border border-border text-foreground"
            }`}
            data-testid="tab-admins"
          >
            Admins ({activeConversations.filter((c) => c.lastMessage.userRole === "admin").length})
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conversation List */}
        <div className="w-1/3 border-r border-border overflow-y-auto scrollbar-thin">
          {filteredConversations.map((conv) => (
            <div
              key={conv.phoneNumber}
              onClick={() => setSelectedConversation(conv.phoneNumber)}
              className={`p-4 border-b border-border cursor-pointer hover:bg-muted/10 transition-smooth ${
                selectedConversation === conv.phoneNumber ? "bg-primary/10" : ""
              }`}
              data-testid={`conversation-${conv.phoneNumber}`}
            >
              <div className="flex items-start gap-3">
                <div className="relative">
                  <div
                    className={`w-12 h-12 rounded-full ${getRoleColor(conv.lastMessage.userRole)} flex items-center justify-center font-bold`}
                  >
                    {conv.lastMessage.userName.charAt(0)}
                  </div>
                  {conv.lastMessage.userRole === "client" && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-success border-2 border-card rounded-full"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-foreground truncate">{conv.lastMessage.userName}</p>
                    <span className="text-xs text-muted-foreground">
                      {new Date(conv.lastMessage.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mb-1">{conv.phoneNumber}</p>
                  <div className="flex items-center gap-2">
                    {conv.lastMessage.isAutomated && (
                      <span className="px-2 py-0.5 bg-success/20 text-success text-xs rounded-full">Auto</span>
                    )}
                    <p className="text-sm text-foreground truncate flex-1">{conv.lastMessage.content}</p>
                    {conv.unreadCount > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full font-medium">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {filteredConversations.length === 0 && (
            <div className="p-8 text-center">
              <i className="fas fa-inbox text-muted-foreground text-3xl mb-2"></i>
              <p className="text-sm text-muted-foreground">No conversations</p>
            </div>
          )}
        </div>

        {/* Message View */}
        <div className="flex-1 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Conversation Header */}
              <div className="p-4 border-b border-border bg-muted/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full ${getRoleColor(conversations[selectedConversation][0].userRole)} flex items-center justify-center font-bold`}
                    >
                      {conversations[selectedConversation][0].userName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {conversations[selectedConversation][0].userName}
                      </p>
                      <p className="text-xs text-muted-foreground">{selectedConversation}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="p-2 hover:bg-muted/20 rounded-lg transition-smooth"
                      data-testid="button-call"
                    >
                      <i className="fas fa-phone text-foreground"></i>
                    </button>
                    <button
                      className="p-2 hover:bg-muted/20 rounded-lg transition-smooth"
                      data-testid="button-menu"
                    >
                      <i className="fas fa-ellipsis-v text-foreground"></i>
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gradient-to-b from-background/50 to-card/50 scrollbar-thin">
                {conversations[selectedConversation].map((message) => (
                  <div key={message.id} className={`flex ${message.direction === "outbound" ? "justify-end" : ""}`}>
                    {message.direction === "inbound" && (
                      <div
                        className={`w-8 h-8 rounded-full ${getRoleColor(message.userRole)} flex items-center justify-center flex-shrink-0 mr-3`}
                      >
                        {message.userName.charAt(0)}
                      </div>
                    )}
                    <div className={`max-w-md ${message.direction === "outbound" ? "ml-auto" : ""}`}>
                      <div
                        className={`rounded-2xl p-4 ${
                          message.direction === "outbound"
                            ? "bg-primary text-primary-foreground rounded-tr-none"
                            : "bg-card border border-border rounded-tl-none"
                        }`}
                      >
                        {message.isAutomated && (
                          <div className="flex items-center gap-2 mb-2">
                            <i className="fas fa-robot text-xs"></i>
                            <span className="text-xs font-medium">Automated Response</span>
                          </div>
                        )}
                        <p className="text-sm">{message.content}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 ml-2">
                        {new Date(message.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {message.status && message.direction === "outbound" && (
                          <>
                            {" • "}
                            <span className="capitalize">{message.status}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                ))}

                {/* Security Notice */}
                <div className="flex justify-center my-4">
                  <div className="px-4 py-2 bg-muted/50 rounded-full text-xs text-muted-foreground flex items-center gap-2">
                    <i className="fas fa-shield-alt text-success"></i>
                    All messages validated against authorized user database
                  </div>
                </div>
              </div>

              {/* Message Input */}
              <div className="p-4 border-t border-border bg-card">
                <div className="flex gap-3">
                  <button
                    className="p-3 hover:bg-muted/20 rounded-lg transition-smooth"
                    data-testid="button-attach"
                  >
                    <i className="fas fa-paperclip text-foreground"></i>
                  </button>
                  <input
                    type="text"
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                    data-testid="input-message"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim()}
                    className="p-3 bg-success text-white rounded-lg hover:opacity-90 transition-smooth disabled:opacity-50"
                    data-testid="button-send"
                  >
                    <i className="fas fa-paper-plane"></i>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <i className="fab fa-whatsapp text-muted-foreground text-6xl mb-4"></i>
                <p className="text-muted-foreground">Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats Footer */}
      <div className="p-4 border-t border-border bg-card/50">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-2xl font-bold text-foreground">{activeConversations.length}</p>
            <p className="text-xs text-muted-foreground">Active Chats</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">
              {Object.values(conversations).flat().length}
            </p>
            <p className="text-xs text-muted-foreground">Today's Messages</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-success">98%</p>
            <p className="text-xs text-muted-foreground">Response Rate</p>
          </div>
        </div>
      </div>
    </div>
  );
}
