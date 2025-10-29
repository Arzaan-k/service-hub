import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import ReeferDiagnosticChat from "@/components/rag/ReeferDiagnosticChat";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, MessageSquare, BookOpen, Users } from "lucide-react";

export default function RagChat() {
  const { data: userContainers = [] } = useQuery<any[]>({
    queryKey: ["/api/containers"],
    queryFn: async () => (await apiRequest("GET", "/api/containers")).json(),
  });

  const { data: queryHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/rag/history"],
    queryFn: async () => (await apiRequest("GET", "/api/rag/history")).json(),
  });

  const recentQueries = queryHistory.slice(0, 5);

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="Reefer Diagnostic Assistant" />

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Reefer Diagnostic Chat</h1>
                <p className="text-gray-600 mt-1">
                  Get instant troubleshooting guidance powered by AI and service manuals
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Chat Interface */}
              <div className="lg:col-span-2">
                <ReeferDiagnosticChat className="h-full" />
              </div>

              {/* Sidebar with Stats and History */}
              <div className="space-y-6">
                {/* Quick Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <MessageSquare className="h-5 w-5" />
                      Chat Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Total Queries</span>
                      <Badge variant="secondary">{queryHistory.length}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Your Containers</span>
                      <Badge variant="secondary">{userContainers.length}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">High Confidence</span>
                      <Badge className="bg-green-100 text-green-800">
                        {queryHistory.filter(q => q.confidence === 'high').length}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Queries */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <History className="h-5 w-5" />
                      Recent Queries
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {recentQueries.length > 0 ? (
                      <div className="space-y-3">
                        {recentQueries.map((query: any) => (
                          <div key={query.id} className="p-3 bg-gray-50 rounded-lg">
                            <p className="text-sm font-medium text-gray-900 line-clamp-2">
                              {query.queryText}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge
                                className={
                                  query.confidence === 'high' ? 'bg-green-100 text-green-800' :
                                  query.confidence === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-red-100 text-red-800'
                                }
                              >
                                {query.confidence}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {new Date(query.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No queries yet. Start chatting to see your history here!
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Tips */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <BookOpen className="h-5 w-5" />
                      Tips for Better Results
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="text-sm text-gray-600 space-y-2">
                      <p>• Include specific alarm codes (e.g., "Alarm 17")</p>
                      <p>• Mention your unit model when possible</p>
                      <p>• Describe symptoms clearly</p>
                      <p>• Ask about specific components or error messages</p>
                      <p>• The assistant cites manual pages for verification</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Container Selection Helper */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Users className="h-5 w-5" />
                      Your Containers
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {userContainers.length > 0 ? (
                      <div className="space-y-2">
                        {userContainers.slice(0, 3).map((container: any) => (
                          <div key={container.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <span className="text-sm font-medium">{container.containerCode}</span>
                            <Badge variant="outline" className="text-xs">
                              {container.type}
                            </Badge>
                          </div>
                        ))}
                        {userContainers.length > 3 && (
                          <p className="text-xs text-gray-500 text-center">
                            +{userContainers.length - 3} more containers
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No containers assigned yet.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

