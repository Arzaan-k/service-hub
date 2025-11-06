import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, BookOpen, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    steps?: string[];
    sources?: Array<{
      manual_id: string;
      manual_name: string;
      page: number;
    }>;
    confidence: 'high' | 'medium' | 'low';
    suggestedParts?: string[];
  };
}

interface ReeferDiagnosticChatProps {
  containerId?: string;
  containerModel?: string;
  alarmCode?: string;
  context?: any;
  className?: string;
  compact?: boolean;
}

export default function ReeferDiagnosticChat({
  containerId,
  containerModel,
  alarmCode,
  context,
  className = '',
  compact = false
}: ReeferDiagnosticChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize with alarm context if provided
  useEffect(() => {
    if (alarmCode && containerModel) {
      const initialMessage = `I see you're dealing with ${alarmCode} on a ${containerModel}. How can I help you troubleshoot this issue?`;
      setMessages([{
        id: 'initial',
        type: 'assistant',
        content: initialMessage,
        timestamp: new Date(),
        metadata: {
          confidence: 'high',
          steps: [
            'Please describe the issue in detail',
            'Include any error messages or symptoms',
            'Mention recent maintenance or changes'
          ]
        }
      }]);
    }
  }, [alarmCode, containerModel]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Call new diagnosis endpoint (manual-grounded)
      const ragResponse = await apiRequest('POST', '/api/rag/query', {
        unit_id: containerId,
        unit_model: containerModel,
        alarm_code: alarmCode,
        query: userMessage.content,
        context: context || {}
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: ragResponse.answer,
        timestamp: new Date(),
        metadata: {
          steps: ragResponse.steps,
          sources: ragResponse.sources,
          confidence: ragResponse.confidence,
          suggestedParts: ragResponse.suggested_spare_parts || ragResponse.suggestedParts
        }
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('RAG query failed:', error);

      // Show error message to user instead of mock response
      const errorResponse = getErrorMessage();
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: errorResponse.answer,
        timestamp: new Date(),
        metadata: {
          steps: errorResponse.steps,
          sources: errorResponse.sources,
          confidence: errorResponse.confidence,
          suggestedParts: errorResponse.suggestedParts
        }
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getConfidenceColor = (confidence: Confidence) => {
    switch (confidence) {
      case 'high':
        return 'bg-green-500/20 text-green-200';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-200';
      case 'low':
        return 'bg-red-500/20 text-red-200';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getConfidenceIcon = (confidence: string) => {
    switch (confidence) {
      case 'high': return <CheckCircle className="h-4 w-4" />;
      case 'medium': return <AlertTriangle className="h-4 w-4" />;
      case 'low': return <X className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <Card className={`flex flex-col ${compact ? 'h-96' : 'h-[600px]'} ${className} bg-[#0c1a2e] border-[#223351]`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg text-white">
          <Bot className="h-5 w-5 text-white" />
          Reefer Diagnostic Assistant
          {alarmCode && (
            <Badge variant="outline" className="ml-2 text-white border-[#223351]">
              {alarmCode}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 px-4">
          <div className="space-y-6 pb-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center">
                <div className="space-y-3">
                  <Bot className="h-12 w-12 text-white/80 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-white">
                      {alarmCode
                        ? `Ask about ${alarmCode} troubleshooting`
                        : "Ask me anything about reefer maintenance"
                      }
                    </p>
                    <p className="text-xs text-white/80">
                      I can help with alarms, diagnostics, and repair procedures
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="space-y-3">
                  <div className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex gap-3 max-w-[85%] ${message.type === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        message.type === 'user'
                          ? 'bg-[#1f3b7a] text-white'
                          : 'bg-[#0e2038] text-white border border-[#223351]'
                      }`}>
                        {message.type === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                      </div>

                      <div className={`rounded-lg px-4 py-3 ${
                        message.type === 'user'
                          ? 'bg-[#1f3b7a] text-white'
                          : 'bg-[#0e2038] border border-[#223351] text-white'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap text-white">{message.content}</p>
                      </div>
                    </div>
                  </div>

                  {message.type === 'assistant' && message.metadata && (
                    <div className={`${message.type === 'user' ? 'mr-11' : 'ml-11'} space-y-4`}>
                      {/* Confidence Badge */}
                      <div className="flex items-center gap-2">
                        <Badge className={`${getConfidenceColor(message.metadata.confidence)} flex items-center gap-1 text-white`}>
                          {getConfidenceIcon(message.metadata.confidence)}
                          <span className="capitalize">{message.metadata.confidence} Confidence</span>
                        </Badge>
                      </div>

                      {/* Steps */}
                      {message.metadata.steps && message.metadata.steps.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-white">Troubleshooting Steps:</h4>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-white/90 ml-2">
                            {message.metadata.steps.map((step, index) => (
                              <li key={index} className="leading-relaxed text-white/90">{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {/* Suggested Parts */}
                      {message.metadata.suggestedParts && message.metadata.suggestedParts.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-white">Suggested Spare Parts:</h4>
                          <div className="flex flex-wrap gap-2">
                            {message.metadata.suggestedParts.map((part, index) => (
                              <Badge key={index} variant="secondary" className="text-xs text-white bg-[#0e2038] border-[#223351]">
                                {part}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sources */}
                      {message.metadata.sources && message.metadata.sources.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-white" />
                            Sources:
                          </h4>
                          <div className="space-y-1">
                            {message.metadata.sources.map((source, index) => (
                              <div key={index} className="text-xs text-white bg-[#0c1a2e] rounded px-3 py-2 border border-[#223351]">
                                {source.manual_name} - Page {source.page}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-white/70 text-center">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#0e2038] flex items-center justify-center border border-[#223351]">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="bg-[#0e2038] border border-[#223351] rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span className="text-sm text-white">Analyzing manuals...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <Separator className="bg-[#223351]" />

        <div className="p-4">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={alarmCode ? `Ask about ${alarmCode}...` : "Ask about troubleshooting, alarms, or maintenance..."}
              disabled={isLoading}
              className="flex-1 bg-[#0e2038] border-[#223351] text-white placeholder:text-white/60"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              size="sm"
              className="bg-[#1f3b7a] hover:bg-[#264892] text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {alarmCode && (
            <div className="mt-2 text-xs text-white/80">
            💡 Try asking: "What causes {alarmCode}?" or "How to fix {alarmCode}?"
          </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Error message function for when RAG service is unavailable
function getErrorMessage() {
  return {
    answer: "Sorry, I'm having trouble accessing the diagnostic database right now. Please try again later or contact support.",
    steps: [],
    sources: [],
    confidence: 'low' as const,
    suggestedParts: []
  };
}
