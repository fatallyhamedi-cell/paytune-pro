import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { LiveChatMessage, ChatMessageData } from './LiveChatMessage';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';

export interface LiveChatProps {
  streamId: string;
  className?: string;
  onOpenSuperThanks?: () => void;
}

export const LiveChat: React.FC<LiveChatProps> = ({
  streamId,
  className = '',
  onOpenSuperThanks
}) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Poll or load messages
  useEffect(() => {
    if (!streamId) return;

    const fetchChat = async () => {
      try {
        const res = await axios.get(`/api/live/streams/${streamId}/chat`);
        if (Array.isArray(res.data?.messages)) {
          setMessages(res.data.messages);
        }
      } catch (err) {
        // silent fallback
      }
    };

    fetchChat();
    const interval = setInterval(fetchChat, 4000);
    return () => clearInterval(interval);
  }, [streamId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || sending) return;

    const text = inputMessage.trim();
    setInputMessage('');
    setSending(true);

    const tempMsg: ChatMessageData = {
      id: `temp-${Date.now()}`,
      stream_id: streamId,
      user_id: user?.id || 'guest',
      user_name: user?.user_metadata?.full_name || 'Fan',
      message: text,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, tempMsg]);

    try {
      const token = localStorage.getItem('paytune_auth_token');
      await axios.post(`/api/live/streams/${streamId}/chat`, {
        message: text,
        userName: user?.user_metadata?.full_name || 'Fan'
      }, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
    } catch (err) {
      console.warn('Failed to send live chat message:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`flex flex-col h-full bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
        <h3 className="font-semibold text-sm text-white flex items-center gap-2">
          <span>Live Chat</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </h3>
        {onOpenSuperThanks && (
          <button
            onClick={onOpenSuperThanks}
            className="flex items-center gap-1.5 text-xs bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 px-2.5 py-1 rounded-full border border-amber-500/20 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Super Thanks</span>
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-zinc-500">
            Say hello in the chat!
          </div>
        ) : (
          messages.map(msg => (
            <LiveChatMessage key={msg.id} message={msg} />
          ))
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-zinc-800 bg-zinc-900/40 flex items-center gap-2">
        <input
          type="text"
          value={inputMessage}
          onChange={e => setInputMessage(e.target.value)}
          placeholder="Send a message..."
          className="flex-1 bg-zinc-800/70 border border-zinc-700/50 rounded-full px-4 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          disabled={!inputMessage.trim() || sending}
          className="w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-600 disabled:opacity-40 flex items-center justify-center text-black transition-colors shrink-0"
        >
          <Send className="w-4 h-4 ml-0.5" />
        </button>
      </form>
    </div>
  );
};

export default LiveChat;
