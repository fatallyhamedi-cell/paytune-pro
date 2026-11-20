import React, { useState, useEffect, useCallback } from 'react';
import {
  Radio,
  Copy,
  Check,
  Users,
  Send,
  Trash2,
  DollarSign,
  Settings,
  AlertCircle,
  Square,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { api } from '../../lib/api';

interface LiveStudioTabProps {
  artist: any;
}

export const LiveStudioTab: React.FC<LiveStudioTabProps> = ({ artist }) => {
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  const [activeStream, setActiveStream] = useState<any | null>(null);
  const [streamTitle, setStreamTitle] = useState(
    `${artist?.full_name || artist?.artist_name || 'Artist'} Live Session`
  );
  const [ticketPrice, setTicketPrice] = useState<number>(1000);
  const [isPaidTicket, setIsPaidTicket] = useState(false);

  // Real Ingest credentials from backend (streamKeyOnce shown only after create/rotate)
  const [rtmpUrl, setRtmpUrl] = useState<string>('');
  const [streamKey, setStreamKey] = useState<string>('');
  const [keyLast4, setKeyLast4] = useState<string>('');
  const [providerNotice, setProviderNotice] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Live broadcast stats from PostgreSQL
  const [viewers, setViewers] = useState(0);
  const [peakViewers, setPeakViewers] = useState(0);
  const [superChatsTotal, setSuperChatsTotal] = useState(0);

  // Live Chat Messages from PostgreSQL
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newChatText, setNewChatText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);

  const loadStudioState = useCallback(async () => {
    try {
      setErrorMsg(null);
      const res = await api.get('/api/artist/live');
      const streams = Array.isArray(res.data) ? res.data : res.data?.streams || [];
      const current =
        streams.find((s: any) => s.stream_status === 'live') ||
        streams.find((s: any) => s.stream_status === 'draft' || s.stream_status === 'scheduled') ||
        streams[0] ||
        null;

      setActiveStream(current);
      if (current) {
        setStreamTitle(current.title || streamTitle);
        setIsPaidTicket(Boolean(current.is_paid));
        setTicketPrice(Number(current.price_rwf || 1000));
        setViewers(Number(current.current_viewers || 0));
        setPeakViewers(Number(current.peak_viewers || 0));
        setKeyLast4(String(current.metadata?.stream_key_last4 || ''));
        setProviderNotice(current.provider_notice || null);
      } else {
        setViewers(0);
        setPeakViewers(0);
        setSuperChatsTotal(0);
        setChatMessages([]);
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || 'Failed to load livestream studio state.');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStreamActivity = useCallback(async (streamId: string) => {
    try {
      const [chatRes, donRes] = await Promise.all([
        api.get(`/api/live/${streamId}/chat`),
        api.get(`/api/live/${streamId}/donations`),
      ]);
      const msgs = Array.isArray(chatRes.data) ? chatRes.data : chatRes.data?.messages || [];
      setChatMessages(msgs);

      const dons = Array.isArray(donRes.data) ? donRes.data : [];
      const total = dons.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
      setSuperChatsTotal(total);
    } catch {
      // Non-fatal polling error
    }
  }, []);

  useEffect(() => {
    loadStudioState();
  }, [loadStudioState]);

  useEffect(() => {
    if (!activeStream?.id) return;
    loadStreamActivity(activeStream.id);
    const interval = setInterval(() => {
      loadStreamActivity(activeStream.id);
    }, 5000);
    return () => clearInterval(interval);
  }, [activeStream?.id, loadStreamActivity]);

  const copyToClipboard = (text: string, isUrl: boolean) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    if (isUrl) {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleStartBroadcast = async () => {
    setActionLoading(true);
    setErrorMsg(null);
    setNoticeMsg(null);
    try {
      let streamObj = activeStream;
      if (!streamObj || streamObj.stream_status === 'ended') {
        const createRes = await api.post('/api/artist/live/create', {
          title: streamTitle.trim() || 'Live Session',
          is_paid: isPaidTicket,
          price_rwf: isPaidTicket ? ticketPrice : 0,
        });
        streamObj = createRes.data?.stream;
        if (createRes.data?.stream_key_once) {
          setStreamKey(createRes.data.stream_key_once);
        }
        if (createRes.data?.stream_key_last4) {
          setKeyLast4(createRes.data.stream_key_last4);
        }
        if (createRes.data?.ingest_url) {
          setRtmpUrl(createRes.data.ingest_url);
        }
        if (createRes.data?.provider_notice) {
          setProviderNotice(createRes.data.provider_notice);
        }
      }

      if (!streamObj?.id) {
        throw new Error('Could not initialize livestream record.');
      }

      const startRes = await api.put(`/api/artist/live/${streamObj.id}/start`);
      setActiveStream(startRes.data?.stream || { ...streamObj, stream_status: 'live' });
      setNoticeMsg('Broadcast started and persisted to database.');
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || err.message || 'Failed to start broadcast.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEndBroadcast = async () => {
    if (!activeStream?.id) return;
    setActionLoading(true);
    setErrorMsg(null);
    setNoticeMsg(null);
    try {
      const res = await api.put(`/api/artist/live/${activeStream.id}/end`);
      setActiveStream(res.data?.stream || { ...activeStream, stream_status: 'ended' });
      setViewers(0);
      setNoticeMsg('Broadcast ended cleanly.');
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || err.message || 'Failed to end broadcast.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRotateKey = async () => {
    if (!activeStream?.id) return;
    setActionLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.post(`/api/artist/live/${activeStream.id}/key/rotate`);
      if (res.data?.stream_key_once) {
        setStreamKey(res.data.stream_key_once);
        setShowKey(true);
      }
      if (res.data?.stream_key_last4) {
        setKeyLast4(res.data.stream_key_last4);
      }
      setNoticeMsg(res.data?.message || 'New stream key generated.');
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || err.message || 'Failed to rotate stream key.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChatText.trim() || !activeStream?.id || sendingChat) return;
    setSendingChat(true);
    setErrorMsg(null);
    try {
      const res = await api.post(`/api/live/${activeStream.id}/chat`, {
        message: newChatText.trim(),
      });
      if (res.data?.id) {
        setChatMessages((prev) => [...prev, res.data]);
      }
      setNewChatText('');
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || 'Failed to send chat message.');
    } finally {
      setSendingChat(false);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (!activeStream?.id) return;
    try {
      await api.delete(`/api/live/${activeStream.id}/chat/${msgId}`);
      setChatMessages((prev) => prev.filter((msg) => msg.id !== msgId));
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.error || 'Failed to delete chat message.');
    }
  };

  const streamStatus: 'offline' | 'live' | 'scheduled' =
    activeStream?.stream_status === 'live'
      ? 'live'
      : activeStream?.stream_status === 'scheduled'
      ? 'scheduled'
      : 'offline';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 gap-2 text-xs font-bold">
        <Loader2 className="w-5 h-5 animate-spin text-[#FFB300]" />
        <span>Loading Live Studio...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-white">Live Streaming Studio</h2>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                streamStatus === 'live'
                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse'
                  : 'bg-white/10 text-gray-400'
              }`}
            >
              {streamStatus === 'live' ? '● Broadcast Active' : streamStatus === 'scheduled' ? 'Scheduled' : 'Offline'}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            Host live streams backed by real PostgreSQL broadcast records, viewer sessions, and moderated chat
          </p>
        </div>

        {streamStatus === 'live' ? (
          <button
            onClick={handleEndBroadcast}
            disabled={actionLoading}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black text-xs transition-all flex items-center gap-2 shadow-lg shadow-rose-600/20 self-start sm:self-auto"
          >
            <Square className="w-4 h-4 fill-white" />
            <span>{actionLoading ? 'Ending...' : 'End Live Broadcast'}</span>
          </button>
        ) : (
          <button
            onClick={handleStartBroadcast}
            disabled={actionLoading}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-black text-xs transition-all flex items-center gap-2 shadow-lg shadow-rose-600/20 self-start sm:self-auto"
          >
            <Radio className="w-4 h-4" />
            <span>{actionLoading ? 'Starting...' : 'Go Live Now'}</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {noticeMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
          {noticeMsg}
        </div>
      )}

      {providerNotice && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{providerNotice}</span>
        </div>
      )}

      {/* Main Studio View: Stage & Chat Moderation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Live Monitor & Broadcast Config */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stream Title Input when offline */}
          {streamStatus !== 'live' && (
            <div className="bg-[#161616] border border-white/5 rounded-2xl p-4">
              <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                Broadcast Title
              </label>
              <input
                type="text"
                value={streamTitle}
                onChange={(e) => setStreamTitle(e.target.value)}
                placeholder="Enter broadcast title..."
                className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#FFB300]"
              />
            </div>
          )}

          {/* Stream Monitor Preview */}
          <div className="bg-black rounded-2xl overflow-hidden border border-white/10 relative aspect-video flex items-center justify-center group shadow-2xl">
            {streamStatus === 'live' ? (
              <div className="w-full h-full flex flex-col items-center justify-center bg-black text-center p-6 space-y-3">
                <div className="w-4 h-4 rounded-full bg-red-500 animate-ping mb-2" />
                <h4 className="text-sm font-bold text-red-400 uppercase tracking-wider">Broadcasting Live</h4>
                <p className="text-xs text-gray-400">
                  {activeStream?.title || streamTitle} • {viewers} Active Viewers (Peak: {peakViewers})
                </p>
              </div>
            ) : (
              <div className="text-center p-6 space-y-3">
                <div className="p-4 rounded-full bg-white/5 border border-white/10 text-gray-500 inline-block">
                  <Radio className="w-8 h-8" />
                </div>
                <h4 className="text-sm font-bold text-gray-300">Ready to Broadcast</h4>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  Click "Go Live Now" to initialize a broadcast record and retrieve a server-issued stream key.
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
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#FFB300]" />
                <span>Broadcast Encoder Setup (OBS Studio, StreamYard, vMix)</span>
              </h3>
              {activeStream?.id && (
                <button
                  type="button"
                  onClick={handleRotateKey}
                  disabled={actionLoading}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] font-bold text-gray-200 flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Rotate Key</span>
                </button>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Server Ingest URL (RTMP)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={rtmpUrl || 'Not configured by streaming provider'}
                    className="flex-1 bg-[#1A1A1A] border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-300 focus:outline-none"
                  />
                  {rtmpUrl && (
                    <button
                      onClick={() => copyToClipboard(rtmpUrl, true)}
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-gray-200 transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}
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
                    value={streamKey || (keyLast4 ? `••••••••${keyLast4} (rotate to reveal new key)` : 'Click Go Live Now or Rotate Key to issue key')}
                    className="flex-1 bg-[#1A1A1A] border border-white/10 rounded-xl px-3.5 py-2 text-xs font-mono text-gray-300 focus:outline-none"
                  />
                  {streamKey && (
                    <>
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
                    </>
                  )}
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
              <p className="text-[11px] text-gray-400">Real-time database chat moderation</p>
            </div>
            <span className="text-[11px] text-[#FFB300] font-bold bg-purple-600/10 px-2 py-0.5 rounded">
              {streamStatus === 'live' ? 'Live' : 'Standby'}
            </span>
          </div>

          {/* Chat Stream */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2.5 custom-scrollbar pr-1">
            {chatMessages.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-gray-500 text-center px-4">
                {activeStream?.id
                  ? 'No chat messages yet for this broadcast.'
                  : 'Start or select a broadcast to view and moderate live chat messages.'}
              </div>
            ) : (
              chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-2.5 rounded-xl text-xs space-y-1 relative group transition-all ${
                    msg.super_chat_amount > 0
                      ? 'bg-emerald-500/10 border border-emerald-500/20'
                      : 'bg-[#1A1A1A] border border-white/5'
                  }`}
                >
                  {msg.super_chat_amount > 0 && (
                    <div className="flex items-center justify-between text-[10px] font-bold text-emerald-400 mb-0.5">
                      <span>★ Super Chat</span>
                      <span>+{Number(msg.super_chat_amount).toLocaleString()} RWF</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-[11px]">{msg.user_name || 'Viewer'}</span>
                    <span className="text-[10px] text-gray-500">
                      {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <p className="text-gray-300 leading-snug">{msg.message}</p>

                  {/* Moderation actions hover */}
                  <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-1 bg-[#161616]/90 p-1 rounded-lg border border-white/10">
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      title="Delete message"
                      className="p-1 hover:text-rose-400 text-gray-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendChat} className="pt-3 border-t border-white/10 flex gap-2">
            <input
              type="text"
              value={newChatText}
              onChange={(e) => setNewChatText(e.target.value)}
              disabled={!activeStream?.id || sendingChat}
              placeholder={activeStream?.id ? 'Post a message as Host...' : 'Go live first to send chat'}
              className="flex-1 bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#FFB300] disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!activeStream?.id || !newChatText.trim() || sendingChat}
              className="p-2 rounded-xl bg-[#FFB300] text-black hover:bg-[#ffc107] disabled:opacity-40 transition-all"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
