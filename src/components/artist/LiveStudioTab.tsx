import React, { useState } from 'react';
import { 
  Radio, 
  Copy, 
  Check, 
  Eye, 
  Users, 
  Send, 
  Pin, 
  Trash2, 
  ShieldAlert, 
  DollarSign, 
  Settings, 
  Sparkles,
  AlertCircle,
  Play,
  Square
} from 'lucide-react';
import axios from 'axios';

interface LiveStudioTabProps {
  artist: any;
}

export const LiveStudioTab: React.FC<LiveStudioTabProps> = ({ artist }) => {
  const [streamStatus, setStreamStatus] = useState<'offline' | 'live' | 'scheduled'>('offline');
  const [streamTitle, setStreamTitle] = useState(`${artist?.full_name || 'Artist'} Live Acoustic Session`);
  const [ticketPrice, setTicketPrice] = useState<number>(1000);
  const [isPaidTicket, setIsPaidTicket] = useState(true);

  // Ingest credentials
  const [rtmpUrl] = useState('rtmp://live.paytune.rw/app');
  const [streamKey, setStreamKey] = useState(`live_${artist?.username || 'artist'}_${Math.random().toString(36).substring(2, 9)}`);
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Live broadcast stats
  const [viewers, setViewers] = useState(128);
  const [peakViewers, setPeakViewers] = useState(184);
  const [superChatsTotal, setSuperChatsTotal] = useState(48500);

  // Live Chat Simulation & Moderation
  const [chatMessages, setChatMessages] = useState([
    { id: 'c1', user: 'Keza Diane', text: 'Muraho Bruce! We love you from Kigali!', isPinned: true, superChat: 2000, time: '18:02' },
    { id: 'c2', user: 'Eric Nshuti', text: 'Sound quality is crystal clear 🔥🔥', superChat: 0, time: '18:03' },
    { id: 'c3', user: 'Gael Diaspora', text: 'Watching live from Brussels! Play Sawa Sawa please!', superChat: 5000, time: '18:04' },
    { id: 'c4', user: 'Aline Umutoni', text: 'Best artist in Rwanda hands down 🙌', superChat: 0, time: '18:05' }
  ]);
  const [newChatText, setNewChatText] = useState('');

  const copyToClipboard = (text: string, isUrl: boolean) => {
    navigator.clipboard.writeText(text);
    if (isUrl) {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleStartBroadcast = () => {
    setStreamStatus('live');
    setViewers(Math.floor(Math.random() * 80 + 120));
  };

  const handleEndBroadcast = () => {
    setStreamStatus('offline');
    setViewers(0);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatText.trim()) return;
    const msg = {
      id: `c-${Date.now()}`,
      user: artist?.full_name || 'Host (Artist)',
      text: newChatText,
      isPinned: false,
      superChat: 0,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setChatMessages((prev) => [...prev, msg]);
    setNewChatText('');
  };

  const handlePinMessage = (id: string) => {
    setChatMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, isPinned: !msg.isPinned } : msg))
    );
  };

  const handleDeleteMessage = (id: string) => {
    setChatMessages((prev) => prev.filter((msg) => msg.id !== id));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-white">Live Streaming Studio</h2>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
              streamStatus === 'live'
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                : 'bg-white/10 text-gray-400'
            }`}>
              {streamStatus === 'live' ? '● Broadcast Active' : 'Offline'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Host Pay-Per-View live concert streams with low-latency RTMP ingest and real-time MoMo super chats
          </p>
        </div>

        {streamStatus === 'live' ? (
          <button
            onClick={handleEndBroadcast}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-all flex items-center gap-2 shadow-lg shadow-rose-600/20 self-start sm:self-auto"
          >
            <Square className="w-4 h-4 fill-white" />
            <span>End Live Broadcast</span>
          </button>
        ) : (
          <button
            onClick={handleStartBroadcast}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs transition-all flex items-center gap-2 shadow-lg shadow-rose-600/20 self-start sm:self-auto"
          >
            <Radio className="w-4 h-4" />
            <span>Go Live Now</span>
          </button>
        )}
      </div>

      {/* Main Studio View: Stage & Chat Moderation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Monitor & Broadcast Config */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stream Monitor Preview */}
          <div className="bg-black rounded-2xl overflow-hidden border border-white/10 relative aspect-video flex items-center justify-center group shadow-2xl">
            {streamStatus === 'live' ? (
              <video
                src="https://media.w3.org/2010/05/sintel/trailer.mp4"
                autoPlay
                loop
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center p-6 space-y-3">
                <div className="p-4 rounded-full bg-white/5 border border-white/10 text-gray-500 inline-block">
                  <Radio className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-bold text-gray-300">OBS / StreamYard Signal Awaiting Ingest</h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Copy your RTMP Ingest URL and Stream Key into OBS Studio, vMix, or Prism Live. Then click "Go Live Now".
                </p>
              </div>
            )}

            {/* Live Overlay Metrics */}
            {streamStatus === 'live' && (
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  <span className="text-xs font-black text-white uppercase tracking-wider">LIVE</span>
                  <span className="text-xs text-gray-400">|</span>
                  <div className="flex items-center gap-1 text-xs text-white font-bold">
                    <Users className="w-3.5 h-3.5 text-rose-400" />
                    <span>{viewers} viewers</span>
                  </div>
                </div>

                <div className="bg-black/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-xs font-bold text-[#FFB300]">
                  Super Chats: {superChatsTotal.toLocaleString()} RWF
                </div>
              </div>
            )}
          </div>

          {/* RTMP Credentials Box */}
          <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <Settings className="w-4 h-4 text-[#FFB300]" />
              <span>Broadcast Encoder Setup (OBS Studio, StreamYard, vMix)</span>
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Server Ingest URL (RTMP)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={rtmpUrl}
                    className="flex-1 bg-[#1A1A1A] border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-300 focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(rtmpUrl, true)}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-200 transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Stream Key (Keep secret)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type={showKey ? 'text' : 'password'}
                    readOnly
                    value={streamKey}
                    className="flex-1 bg-[#1A1A1A] border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-300 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-gray-300 transition-colors"
                  >
                    {showKey ? 'Hide' : 'Reveal'}
                  </button>
                  <button
                    onClick={() => copyToClipboard(streamKey, false)}
                    className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-200 transition-colors flex items-center gap-1.5 shrink-0"
                  >
                    {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Pay-Per-View Live Stream Ticketing Config */}
          <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 space-y-4">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-[#FFB300]" />
              <span>Live Concert Access & Ticketing</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">
                  Broadcast Access
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPaidTicket(true)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                      isPaidTicket
                        ? 'bg-[#FFB300] text-black border-[#FFB300]'
                        : 'bg-[#1A1A1A] text-gray-400 border-white/10 hover:text-white'
                    }`}
                  >
                    Paid Ticket (PPV)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPaidTicket(false)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                      !isPaidTicket
                        ? 'bg-emerald-500 text-black border-emerald-500'
                        : 'bg-[#1A1A1A] text-gray-400 border-white/10 hover:text-white'
                    }`}
                  >
                    Free Live
                  </button>
                </div>
              </div>

              {isPaidTicket && (
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1.5">
                    Ticket Price (RWF)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={500}
                      step={500}
                      value={ticketPrice}
                      onChange={(e) => setTicketPrice(Number(e.target.value))}
                      className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-[#FFB300]"
                    />
                    <span className="absolute right-3 top-2 text-xs font-bold text-gray-400">RWF</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Interactive Live Chat & Moderation */}
        <div className="bg-[#161616] border border-white/5 rounded-2xl p-5 flex flex-col h-[640px]">
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div>
              <h3 className="font-bold text-sm text-white">Live Chat & Tips</h3>
              <p className="text-[11px] text-gray-400">Pin messages & moderate fan chat</p>
            </div>
            <span className="text-[11px] text-[#FFB300] font-bold bg-amber-500/10 px-2 py-0.5 rounded">
              Active Stream
            </span>
          </div>

          {/* Chat Stream */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2.5 custom-scrollbar pr-1">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`p-2.5 rounded-xl text-xs space-y-1 relative group transition-all ${
                  msg.isPinned
                    ? 'bg-amber-500/10 border border-amber-500/30'
                    : msg.superChat > 0
                    ? 'bg-emerald-500/10 border border-emerald-500/20'
                    : 'bg-[#1A1A1A] border border-white/5'
                }`}
              >
                {msg.isPinned && (
                  <div className="flex items-center gap-1 text-[10px] font-bold text-[#FFB300] mb-0.5">
                    <Pin className="w-3 h-3" />
                    <span>Pinned Announcement</span>
                  </div>
                )}

                {msg.superChat > 0 && (
                  <div className="flex items-center justify-between text-[10px] font-bold text-emerald-400 mb-0.5">
                    <span>★ MoMo Super Chat</span>
                    <span>+{msg.superChat.toLocaleString()} RWF</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-[11px]">{msg.user}</span>
                  <span className="text-[10px] text-gray-500">{msg.time}</span>
                </div>
                <p className="text-gray-300 leading-snug">{msg.text}</p>

                {/* Moderation actions hover */}
                <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1 bg-[#161616]/90 p-1 rounded-lg border border-white/10">
                  <button
                    onClick={() => handlePinMessage(msg.id)}
                    title={msg.isPinned ? 'Unpin message' : 'Pin message'}
                    className="p-1 hover:text-[#FFB300] text-gray-400"
                  >
                    <Pin className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDeleteMessage(msg.id)}
                    title="Delete message"
                    className="p-1 hover:text-rose-400 text-gray-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendChat} className="pt-3 border-t border-white/10 flex gap-2">
            <input
              type="text"
              value={newChatText}
              onChange={(e) => setNewChatText(e.target.value)}
              placeholder="Post a message as Host..."
              className="flex-1 bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFB300]"
            />
            <button
              type="submit"
              className="p-2 rounded-xl bg-[#FFB300] text-black hover:bg-[#ffc107] transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
