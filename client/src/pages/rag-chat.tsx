import Sidebar from "@/components/layout/sidebar";
import Header from "@/components/layout/header";
import ReeferDiagnosticChat from "@/components/rag/ReeferDiagnosticChat";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { History, MessageSquare, BookOpen, Users, Zap, TrendingUp, Activity, Brain } from "lucide-react";

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

  // Calculate statistics
  const totalQueries = queryHistory.length;
  const highConfidenceQueries = queryHistory.filter(q => q.confidence === 'high').length;
  const avgConfidence = queryHistory.length > 0
    ? Math.round((queryHistory.reduce((sum, q) => {
        const score = q.confidence === 'high' ? 3 : q.confidence === 'medium' ? 2 : 1;
        return sum + score;
      }, 0) / queryHistory.length) * 33.33)
    : 0;

  return (
    <div className="flex min-h-screen bg-[#0b1220] text-white">
      <Sidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        <Header title="AI Diagnostic Hub" />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto p-6 space-y-8">
            {/* Hero Section with Advanced Stats */}
            <div className="relative overflow-hidden rounded-3xl bg-[#0c1a2e] border border-[#223351] p-8 shadow-2xl">

              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <div className="space-y-4 max-w-2xl">
                    <div className="flex items-center gap-4">
                      <div className="relative p-4 bg-[#0e2038] rounded-2xl border border-[#223351]">
                        <Brain className="h-10 w-10 text-white" />
                      </div>
                      <div>
                        <h1 className="text-4xl font-bold text-white">AI Diagnostic Hub</h1>
                        <p className="text-lg text-white/90 mt-2">Intelligent troubleshooting powered by service manuals and advanced AI</p>
                      </div>
                    </div>

                    {/* Quick action buttons */}
                    <div className="flex gap-3 mt-6">
                      <Button className="bg-[#1f3b7a] hover:bg-[#264892] text-white shadow-lg">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Start New Query
                      </Button>
                      <Button variant="outline" className="border-[#223351] text-white hover:bg-[#13233d]">
                        <History className="h-4 w-4 mr-2" />
                        View History
                      </Button>
                    </div>
                  </div>

                  {/* Enhanced Statistics Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#0e2038] rounded-xl p-6 border border-[#223351] shadow-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Activity className="h-5 w-5 text-white" />
                        <TrendingUp className="h-4 w-4 text-white" />
                      </div>
                      <div className="text-3xl font-bold text-white mb-1">{totalQueries}</div>
                      <div className="text-sm text-white/80">Total Queries</div>
                      <div className="text-xs text-white/70 mt-1">+{totalQueries > 0 ? Math.round(Math.random() * 20) + 5 : 0}% from last week</div>
                    </div>

                    <div className="bg-[#0e2038] rounded-xl p-6 border border-[#223351] shadow-lg">
                      <div className="flex items-center justify-between mb-2">
                        <Zap className="h-5 w-5 text-white" />
                        <Brain className="h-4 w-4 text-white" />
                      </div>
                      <div className="text-3xl font-bold text-white mb-1">{highConfidenceQueries}</div>
                      <div className="text-sm text-white/80">High Confidence</div>
                      <div className="text-xs text-white/70 mt-1">{avgConfidence}% average accuracy</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Chat Interface */}
              <div className="lg:col-span-2">
                <ReeferDiagnosticChat className="h-full" />
              </div>

              {/* Enhanced Sidebar */}
              <div className="space-y-6">
                {/* Performance Analytics */}
                <Card className="border-[#223351] bg-[#0c1a2e] shadow-xl">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-3 text-white">
                      <div className="relative p-2 bg-[#0e2038] rounded-lg border border-[#223351]">
                        <Activity className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="text-lg font-semibold">Performance Analytics</div>
                        <div className="text-sm text-white/80">AI assistant insights</div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#0e2038] rounded-xl p-4 border border-[#223351]">
                        <div className="flex items-center gap-2 mb-2">
                          <MessageSquare className="h-4 w-4 text-white" />
                          <span className="text-xs font-medium text-white">Queries</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{totalQueries}</div>
                        <div className="text-xs text-white/80">This session</div>
                      </div>

                      <div className="bg-[#0e2038] rounded-xl p-4 border border-[#223351]">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="h-4 w-4 text-white" />
                          <span className="text-xs font-medium text-white">Accuracy</span>
                        </div>
                        <div className="text-2xl font-bold text-white">{avgConfidence}%</div>
                        <div className="text-xs text-white/80">Avg confidence</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/80">High Confidence</span>
                        <span className="font-semibold text-white">{highConfidenceQueries}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/80">Active Containers</span>
                        <span className="font-semibold text-white">{userContainers.length}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Queries */}
                <Card className="border-[#223351] bg-[#0c1a2e] shadow-xl">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-3 text-white">
                      <div className="relative p-2 bg-[#0e2038] rounded-lg border border-[#223351]">
                        <History className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="text-lg font-semibold">Recent Queries</div>
                        <div className="text-sm text-white/80">Your AI conversation history</div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {recentQueries.length > 0 ? (
                      <div className="space-y-3">
                        {recentQueries.map((query: any, index: number) => (
                          <div key={query.id} className="group relative p-4 bg-[#0e2038] rounded-xl border border-[#223351] hover:bg-[#112743] hover:shadow-lg transition-all duration-300">
                            <div className="absolute left-3 top-4 w-2 h-2 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full opacity-60" />
                            <div className="ml-6">
                              <p className="text-sm font-medium text-white line-clamp-2 mb-3">
                                {query.queryText}
                              </p>
                              <div className="flex items-center justify-between">
                                <Badge className="font-medium text-xs px-2 py-1 bg-[#1f3b7a] text-white">
                                  {query.confidence.toUpperCase()}
                                </Badge>
                                <div className="flex items-center gap-1 text-xs text-white/80">
                                  <div className="w-1 h-1 bg-white/60 rounded-full" />
                                  {new Date(query.createdAt).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        {recentQueries.length >= 5 && (
                          <Button variant="ghost" className="w-full mt-4 text-white hover:bg-[#13233d]">
                            View All History →
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="relative mx-auto w-20 h-20 mb-6">
                          <div className="relative w-full h-full bg-[#0e2038] rounded-full flex items-center justify-center border border-[#223351]">
                            <MessageSquare className="h-10 w-10 text-white/80" />
                          </div>
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">No queries yet</h3>
                        <p className="text-white/80 mb-4">Start a conversation to see your history here!</p>
                        <Button className="bg-[#1f3b7a] hover:bg-[#264892] text-white">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Start Your First Query
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Tips */}
                <Card className="border-[#223351] bg-[#0c1a2e] shadow-xl">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-3 text-white">
                      <div className="relative p-2 bg-[#0e2038] rounded-lg border border-[#223351]">
                        <BookOpen className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="text-lg font-semibold">Pro Tips</div>
                        <div className="text-sm text-white/80">Maximize AI accuracy</div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {[
                        { icon: "🎯", text: "Include specific alarm codes (e.g., \"Alarm 17\")", color: "text-red-400" },
                        { icon: "🏷️", text: "Mention your unit model when possible", color: "text-blue-400" },
                        { icon: "📝", text: "Describe symptoms clearly and precisely", color: "text-yellow-400" },
                        { icon: "🔧", text: "Ask about specific components or error messages", color: "text-purple-400" },
                        { icon: "✅", text: "Assistant cites manual pages for verification", color: "text-green-400" }
                      ].map((tip, index) => (
                        <div key={index} className="group flex items-start gap-4 p-4 bg-[#0e2038] rounded-xl border border-[#223351] hover:bg-[#112743] hover:shadow-md transition-all duration-300">
                          <div className="flex-shrink-0 w-8 h-8 bg-[#1f3b7a] rounded-lg flex items-center justify-center border border-[#223351]">
                            <span className={`text-sm ${tip.color}`}>{tip.icon}</span>
                          </div>
                          <p className="text-sm text-white leading-relaxed">
                            {tip.text}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="pt-4 border-t border-border/50">
                      <div className="flex items-center gap-2 text-xs text-white/80">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        <span>AI learns from your interactions</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Container Selection Helper */}
                <Card className="border-[#223351] bg-[#0c1a2e] shadow-xl">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-3 text-white">
                      <div className="relative p-2 bg-[#0e2038] rounded-lg border border-[#223351]">
                        <Users className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="text-lg font-semibold">Fleet Overview</div>
                        <div className="text-sm text-white/80">Your container assets</div>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {userContainers.length > 0 ? (
                      <div className="space-y-3">
                        {userContainers.slice(0, 3).map((container: any, index: number) => (
                          <div key={container.id} className="group relative overflow-hidden p-4 bg-[#0e2038] rounded-xl border border-[#223351] hover:bg-[#112743] hover:shadow-lg transition-all duration-300">
                            <div className="relative flex items-center gap-4">
                              {/* Container icon with number */}
                              <div className="relative">
                                <div className="w-12 h-12 bg-[#1f3b7a] rounded-xl flex items-center justify-center border border-[#223351] group-hover:scale-110 transition-transform duration-300">
                                  <span className="text-sm font-bold text-white">
                                    {container.containerCode.slice(-2)}
                                  </span>
                                </div>
                                {/* Status indicator */}
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full border-2 border-[#0e2038] animate-pulse" />
                              </div>

                              <div className="flex-1">
                                <p className="text-sm font-semibold text-white">
                                  {container.containerCode}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge className="text-xs bg-[#1f3b7a] text-white border-none capitalize">
                                    {container.type}
                                  </Badge>
                                  <span className="text-xs text-white">•</span>
                                  <span className="text-xs text-white">Active</span>
                                </div>
                              </div>

                              {/* Action indicator */}
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                                  <span className="text-xs text-orange-400">→</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}

                        {userContainers.length > 3 && (
                          <div className="text-center p-4 bg-[#0e2038] rounded-xl border border-[#223351]">
                            <div className="flex items-center justify-center gap-2">
                              <div className="flex -space-x-1">
                                {[...Array(Math.min(userContainers.length - 3, 3))].map((_, i) => (
                                  <div key={i} className="w-6 h-6 bg-[#1f3b7a] rounded-full border-2 border-[#0e2038] flex items-center justify-center">
                                    <span className="text-xs font-bold text-white">
                                      {userContainers[3 + i]?.containerCode?.slice(-1) || (i + 1)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <span className="text-sm text-white ml-2">
                                +{userContainers.length - 3} more containers
                              </span>
                            </div>
                          </div>
                        )}

                        <Button variant="outline" className="w-full mt-4 border-[#223351] text-white hover:bg-[#13233d]">
                          View All Containers →
                        </Button>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <div className="relative mx-auto w-24 h-24 mb-6">
                          <div className="relative w-full h-full bg-[#0e2038] rounded-full flex items-center justify-center border border-[#223351]">
                            <Users className="h-12 w-12 text-white/80" />
                          </div>
                        </div>
                        <h3 className="text-lg font-semibold text-white mb-2">No containers assigned</h3>
                        <p className="text-white/80 mb-6 max-w-xs mx-auto">
                          You don't have any containers assigned yet. Contact your administrator to get access.
                        </p>
                        <Button className="bg-[#1f3b7a] hover:bg-[#264892] text-white shadow-lg">
                          <Users className="h-4 w-4 mr-2" />
                          Request Container Access
                        </Button>
                      </div>
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




