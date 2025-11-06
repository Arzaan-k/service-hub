import React, { useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bot, User } from 'lucide-react';

export default function Mp4000Chat({ className = '' }: { className?: string }) {
  const [messages, setMessages] = useState<Array<{ from: 'user' | 'bot'; text: string }>>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  const sendQuery = async () => {
    if (!inputValue.trim() || loading) return;
    const userText = inputValue.trim();
    setMessages(prev => [...prev, { from: 'user', text: userText }]);
    setInputValue('');
    setLoading(true);
    try {
      const resp = await (await apiRequest('POST', '/api/rag/query-mp4000', { query: userText })).json();
      console.log('[MP4000 CHAT] ragResponse', resp);
      (window as any).lastRag = resp;
      setMessages(prev => [...prev, { from: 'bot', text: resp.answer || '(empty answer)' }]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { from: 'bot', text: 'Error fetching answer' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={`flex flex-col h-[500px] bg-[#0c1a2e] border-[#223351] ${className}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Bot className="h-5 w-5" /> MP4000 Manual Chat
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 px-4 py-2 space-y-4">
          {messages.map((m, idx) => (
            <div key={idx} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}> 
              <div className={`max-w-[75%] px-3 py-2 rounded-lg ${m.from === 'user' ? 'bg-[#1f3b7a]' : 'bg-[#0e2038]' } text-white text-sm whitespace-pre-wrap`}>
                {m.text}
              </div>
            </div>
          ))}
          {loading && <div className="text-xs text-white/70">Fetching answer...</div>}
        </ScrollArea>
        <div className="p-3 flex gap-2 border-t border-[#223351]">
          <Input
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendQuery(); } }}
            placeholder="Ask the ThermoKing Mp4000 manual..."
            className="flex-1 bg-[#0e2038] border-[#223351] text-white placeholder:text-white/60"
          />
          <Button disabled={loading || !inputValue.trim()} onClick={sendQuery} className="bg-[#1f3b7a] text-white">Send</Button>
        </div>
      </CardContent>
    </Card>
  );
}
