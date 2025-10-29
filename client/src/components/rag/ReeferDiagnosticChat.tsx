import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, BookOpen, AlertTriangle, CheckCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
      // Call RAG API
      const response = await fetch('/api/rag/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          user_id: localStorage.getItem('userId'),
          unit_id: containerId,
          unit_model: containerModel,
          alarm_code: alarmCode,
          query: userMessage.content,
          context: context || {}
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get diagnostic response');
      }

      const ragResponse = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: ragResponse.answer,
        timestamp: new Date(),
        metadata: {
          steps: ragResponse.steps,
          sources: ragResponse.sources,
          confidence: ragResponse.confidence,
          suggestedParts: ragResponse.suggested_spare_parts
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

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
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
    <Card className={`flex flex-col ${compact ? 'h-96' : 'h-[600px]'} ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bot className="h-5 w-5 text-blue-600" />
          Reefer Diagnostic Assistant
          {alarmCode && (
            <Badge variant="outline" className="ml-2">
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
                  <Bot className="h-12 w-12 text-gray-400 mx-auto" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-gray-900">
                      {alarmCode
                        ? `Ask about ${alarmCode} troubleshooting`
                        : "Ask me anything about reefer maintenance"
                      }
                    </p>
                    <p className="text-xs text-gray-500">
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
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {message.type === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                      </div>

                      <div className={`rounded-lg px-4 py-3 ${
                        message.type === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-200 shadow-sm'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      </div>
                    </div>
                  </div>

                  {message.type === 'assistant' && message.metadata && (
                    <div className={`${message.type === 'user' ? 'mr-11' : 'ml-11'} space-y-4`}>
                      {/* Confidence Badge */}
                      <div className="flex items-center gap-2">
                        <Badge className={`${getConfidenceColor(message.metadata.confidence)} flex items-center gap-1`}>
                          {getConfidenceIcon(message.metadata.confidence)}
                          <span className="capitalize">{message.metadata.confidence} Confidence</span>
                        </Badge>
                      </div>

                      {/* Steps */}
                      {message.metadata.steps && message.metadata.steps.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-gray-900">Troubleshooting Steps:</h4>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 ml-2">
                            {message.metadata.steps.map((step, index) => (
                              <li key={index} className="leading-relaxed">{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {/* Suggested Parts */}
                      {message.metadata.suggestedParts && message.metadata.suggestedParts.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-gray-900">Suggested Spare Parts:</h4>
                          <div className="flex flex-wrap gap-2">
                            {message.metadata.suggestedParts.map((part, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {part}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Sources */}
                      {message.metadata.sources && message.metadata.sources.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            Sources:
                          </h4>
                          <div className="space-y-1">
                            {message.metadata.sources.map((source, index) => (
                              <div key={index} className="text-xs text-gray-600 bg-gray-50 rounded px-3 py-2">
                                {source.manual_name} - Page {source.page}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-gray-400 text-center">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}

            {isLoading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-gray-600" />
                </div>
                <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                    <span className="text-sm text-gray-600">Analyzing manuals...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <Separator />

        <div className="p-4">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={alarmCode ? `Ask about ${alarmCode}...` : "Ask about troubleshooting, alarms, or maintenance..."}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {alarmCode && (
            <div className="mt-2 text-xs text-gray-500">
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
