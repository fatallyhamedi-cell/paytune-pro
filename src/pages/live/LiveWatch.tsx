import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import { io } from "socket.io-client";
import {
  Users,
  Send,
  DollarSign,
  MessageSquare,
  Ticket,
  Radio,
  ShieldCheck,
  Award,
  Share2,
  Info,
  AlertCircle,
  Flame,
  Check,
  X,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { LiveChatMessage } from "../../components/LiveChatMessage";
import { LiveSuperThanksModal } from "../../components/LiveSuperThanksModal";

interface PendingAction {
  type: "delete_message" | "block_user";
  targetId: string;
  label: string;
}

export default function LiveWatch() {
  const { streamId } = useParams<{ streamId: string }>();
  const { user } = useAuth();
  const [stream, setStream] = useState<any>(null);
  const [hasAccess, setHasAccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // Chat elements
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState<string>("");
  const [activeViewers, setActiveViewers] = useState<number>(0);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  const [chatTab, setChatTab] = useState<"chat" | "donors">("chat");
  const [donations, setDonations] = useState<any[]>([]);
  const [latestSuperThanks, setLatestSuperThanks] = useState<any | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);

  // Ticket Paywall Modal
  const [checkoutModal, setCheckoutModal] = useState<boolean>(false);
  const [paywallLoading, setPaywallLoading] = useState<boolean>(false);
  const [payPhone, setPayPhone] = useState<string>("");
  const [payProvider, setPayProvider] = useState<string>("MTN");

  // Super Thanks Modal
  const [superChatModal, setSuperChatModal] = useState<boolean>(false);

  const getAuthToken = () => {
    try {
      return localStorage.getItem("paytune_auth_token") || localStorage.getItem("token");
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (!streamId) return;
    fetchStreamDetails();
    fetchDonations();
    initChatSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave", { streamId, userId: user?.id });
        socketRef.current.disconnect();
      }
    };
  }, [streamId]);

  // Real viewer session heartbeat against PostgreSQL livestream_viewer_sessions
  useEffect(() => {
    if (!streamId || !stream || stream.status !== "live") return;
    const sendHeartbeat = async () => {
      try {
        const token = getAuthToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(`/api/live/${streamId}/heartbeat`, {
          method: "POST",
          headers,
        });
        if (res.ok) {
          const data = await res.json();
          if (typeof data.current_viewers === "number") {
            setActiveViewers(data.current_viewers);
          }
        }
      } catch {
        // Non-fatal heartbeat failure
      }
    };

    sendHeartbeat();
    const timer = setInterval(sendHeartbeat, 20000);
    return () => clearInterval(timer);
  }, [streamId, stream?.status]);

  useEffect(() => {
    if (scrollRef.current && chatTab === "chat") {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatTab]);

  const showToast = (type: "success" | "error", text: string) => {
    setFeedback({ type, text });
    setTimeout(() => {
      setFeedback((curr) => (curr?.text === text ? null : curr));
    }, 5000);
  };

  const fetchStreamDetails = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/live/${streamId}`, { headers });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || "This live broadcast is unavailable.");
      }

      const data = await res.json();
      setStream(data.stream);
      setHasAccess(Boolean(data.userHasAccess) || !data.stream?.is_paid);
      setActiveViewers(Number(data.stream?.current_viewers ?? data.stream?.total_viewers ?? 0));

      const chatRes = await fetch(`/api/live/${streamId}/chat`);
      if (chatRes.ok) {
        const chatData = await chatRes.json();
        setChatMessages(Array.isArray(chatData) ? chatData : []);
      }

      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load broadcast.");
    } finally {
      setLoading(false);
    }
  };

  const fetchDonations = async () => {
    try {
      const res = await fetch(`/api/live/${streamId}/donations`);
      if (res.ok) {
        const data = await res.json();
        setDonations(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      console.error("fetchDonations error:", e);
    }
  };

  const initChatSocket = () => {
    const socket = io(window.location.origin);
    socketRef.current = socket;

    socket.emit("join", { streamId, userId: user?.id });

    socket.on("viewer:count", (data: any) => {
      setActiveViewers(Number(data?.count ?? 0));
    });

    socket.on("viewer:join", (data: any) => {
      setActiveViewers(Number(data?.count ?? 0));
    });

    socket.on("viewer:leave", (data: any) => {
      setActiveViewers(Number(data?.count ?? 0));
    });

    socket.on("chat:message", (msg: any) => {
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    socket.on("chat:super-thanks", (data: any) => {
      setLatestSuperThanks(data);
      fetchDonations();
      setTimeout(() => {
        setLatestSuperThanks((curr: any) => (curr?.id === data.id ? null : curr));
      }, 6000);
    });

    socket.on("chat:deleted", (data: any) => {
      setChatMessages((prev) => prev.filter((m) => m.id !== data.messageId));
    });

    socket.on("moderation", (data: any) => {
      if (data.action === "delete_message") {
        setChatMessages((prev) => prev.filter((m) => m.id !== data.messageId));
      }
      if (data.action === "block_user" && data.userId === user?.id) {
        setIsBlocked(true);
      }
      if (data.action === "unblock_user" && data.userId === user?.id) {
        setIsBlocked(false);
      }
    });
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isBlocked) return;

    try {
      const token = getAuthToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/live/${streamId}/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: newMessage,
          userName: user?.user_metadata?.full_name || (user as any)?.full_name || "Listener",
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 403) {
          setIsBlocked(true);
        }
        throw new Error(errData.error || "Could not deliver chat message.");
      }

      const data = await res.json();
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, data];
      });
      setNewMessage("");
    } catch (err: any) {
      showToast("error", err.message || "Failed to send message.");
    }
  };

  const handleBuyTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payPhone.trim()) return;

    setPaywallLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/live/${streamId}/purchase`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          paymentPhone: payPhone,
          provider: payProvider,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || "Ticket purchase failed.");
      }

      if (body.has_access || body.status === "paid" || body.status === "confirmed") {
        setHasAccess(true);
        setCheckoutModal(false);
        showToast("success", "Ticket confirmed. Access unlocked.");
        fetchStreamDetails();
      } else {
        setCheckoutModal(false);
        showToast("success", body.message || "Payment initiated. Authorize the prompt on your device.");
      }
    } catch (err: any) {
      showToast("error", err.message || "Ticket purchase failed.");
    } finally {
      setPaywallLoading(false);
    }
  };

  const isModerator = Boolean(
    user &&
      (stream?.artists?.user_id === user.id ||
        stream?.created_by_user_id === user.id ||
        (user as any).role === "master" ||
        (user as any).role === "admin")
  );

  const confirmModerationAction = async () => {
    if (!pendingAction) return;
    const { type, targetId, label } = pendingAction;
    setPendingAction(null);

    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      if (type === "delete_message") {
        const res = await fetch(`/api/live/${streamId}/chat/${targetId}`, {
          method: "DELETE",
          headers,
        });
        if (!res.ok) throw new Error("Failed to remove chat message.");
        setChatMessages((prev) => prev.filter((m) => m.id !== targetId));
        showToast("success", "Chat message removed.");
      } else if (type === "block_user") {
        const res = await fetch(`/api/live/${streamId}/block/${targetId}`, {
          method: "POST",
          headers,
        });
        if (!res.ok) throw new Error("Failed to block user.");
        showToast("success", `${label} has been blocked from chat.`);
      }
    } catch (err: any) {
      showToast("error", err.message || "Moderation action failed.");
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600" />
        <p className="text-gray-500 dark:text-gray-400 mt-4 text-xs font-mono">
          LOADING BROADCAST...
        </p>
      </div>
    );
  }

  if (error || !stream) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center border border-red-200 bg-red-50 dark:bg-red-950/10 dark:border-red-900 rounded-3xl mt-12 space-y-4">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
        <h3 className="text-red-600 dark:text-red-400 font-black tracking-tight uppercase">
          Stream unavailable
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm">
          {error || "Live stream record missing."}
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={fetchStreamDetails}
            className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-black uppercase cursor-pointer"
          >
            Retry
          </button>
          <Link
            to="/live"
            className="px-4 py-2 rounded-xl border border-gray-300 dark:border-zinc-700 text-xs font-black uppercase text-purple-600"
          >
            Return to Live Hub
          </Link>
        </div>
      </div>
    );
  }

  const effectivePriceRwf = Number(stream.price_rwf || 0);
  const effectivePriceUsd =
    stream.price_usd != null
      ? Number(stream.price_usd).toFixed(2)
      : (effectivePriceRwf / 1300).toFixed(2);
  const vatAmount = effectivePriceRwf * 0.05;
  const artistShare = effectivePriceRwf * 0.95 * 0.7;

  const creatorName = stream.artists?.full_name || stream.artist_name || "Creator";
  const creatorAvatar = stream.artists?.profile_image || stream.artist_avatar || null;
  const playableUrl = stream.stream_url || stream.playback_url || "";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-4"
    >
      {/* Inline Status / Error Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-bold ${
            feedback.type === "error"
              ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-700 dark:text-red-400"
              : "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400"
          }`}
        >
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} className="cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Inline Moderation Confirmation */}
      {pendingAction && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <span className="font-bold text-amber-900 dark:text-amber-200">
            {pendingAction.type === "delete_message"
              ? `Confirm deleting message "${pendingAction.label}" from live chat?`
              : `Confirm blocking ${pendingAction.label} from chatting in this broadcast?`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPendingAction(null)}
              className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-zinc-800 text-gray-800 dark:text-gray-200 font-bold uppercase cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmModerationAction}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold uppercase cursor-pointer"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {/* Super Thanks Floating Alert Banner */}
      <AnimatePresence>
        {latestSuperThanks && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-purple-600 via-purple-500 to-purple-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 font-bold border border-purple-300"
          >
            <Flame className="w-5 h-5 text-amber-300 fill-current" />
            <span className="text-xs uppercase tracking-tight">
              <strong>{latestSuperThanks.user_name || "A supporter"}</strong> sent Super Thanks of{" "}
              <strong>RWF {Number(latestSuperThanks.super_chat_amount || 0).toLocaleString()}</strong>!
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PLAYER & STREAM DETAILS SECTION */}
        <div className="lg:col-span-2 space-y-6">
          <div className="relative aspect-video bg-black rounded-3xl overflow-hidden group shadow-md border border-gray-100 dark:border-[#222222]">
            {!hasAccess ? (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8 bg-black/90 backdrop-blur-md text-white text-center space-y-5">
                <Ticket className="w-16 h-16 text-purple-500" />
                <div className="max-w-md space-y-2">
                  <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight">
                    Ticketed Live Virtual Broadcast
                  </h3>
                  <p className="text-sm text-gray-400 max-w-sm mx-auto">
                    Entry requires a valid ticket pass stored in your PAYTUNE account.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="text-xl font-black text-purple-400">
                    RWF {effectivePriceRwf.toLocaleString()}{" "}
                    <span className="text-xs text-gray-400 font-normal">(${effectivePriceUsd} USD)</span>
                  </div>
                  {user ? (
                    <button
                      type="button"
                      onClick={() => setCheckoutModal(true)}
                      className="px-8 py-3.5 bg-purple-600 hover:bg-purple-700 font-black text-white text-xs uppercase rounded-xl transition-all duration-200 shadow-lg shadow-purple-600/20 cursor-pointer"
                    >
                      Buy Entry Ticket
                    </button>
                  ) : (
                    <Link
                      to="/login"
                      className="inline-block px-8 py-3 bg-purple-600 text-white font-black uppercase text-xs rounded-xl"
                    >
                      Log in to Purchase Ticket
                    </Link>
                  )}
                </div>
              </div>
            ) : playableUrl ? (
              <div className="w-full h-full relative">
                <video
                  src={playableUrl}
                  className="w-full h-full object-cover"
                  autoPlay
                  controls
                  playsInline
                />

                <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-none z-10">
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 text-white font-black uppercase text-[10px] rounded-md tracking-wider shadow ${
                      stream.status === "live" ? "bg-red-600" : "bg-zinc-800"
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    {stream.status === "live" ? "LIVE" : String(stream.status || "scheduled").toUpperCase()}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-black/70 backdrop-blur-md text-white font-black text-[10px] rounded-lg">
                    <Users className="w-3.5 h-3.5 text-purple-400" />
                    {activeViewers.toLocaleString()} VIEWERS
                  </span>
                </div>

                <div className="absolute bottom-16 right-4 md:right-6 z-10 pointer-events-none select-none flex items-center gap-1.5 opacity-60">
                  <span className="w-3 h-3 rounded-sm bg-[#8B5CF6] shadow-md" />
                  <span className="text-white font-black text-base md:text-lg tracking-wider drop-shadow-lg">
                    PayTune
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center text-white space-y-3 bg-zinc-950">
                <Radio className="w-12 h-12 text-purple-400" />
                <div className="space-y-1 max-w-md">
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    {stream.status === "live"
                      ? stream.provider_configured === false
                        ? "Live Video Ingest Provider Not Configured"
                        : "Waiting for Host Video Feed"
                      : `Broadcast Status: ${String(stream.status || "scheduled").toUpperCase()}`}
                  </h3>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {stream.provider_note ||
                      "No HLS/RTMP playback stream URL is attached to this broadcast yet. Live chat, viewer sessions, and database state remain active."}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-mono text-gray-400 pt-2">
                  <Users className="w-3.5 h-3.5 text-purple-400" />
                  <span>{activeViewers.toLocaleString()} Active Room Viewers</span>
                </div>
              </div>
            )}
          </div>

          {/* Stream Particulars & Artist Block */}
          <div className="p-6 bg-white dark:bg-[#121212] rounded-3xl border border-gray-100 dark:border-[#222222] shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-xl font-black text-gray-950 dark:text-white uppercase tracking-tight leading-tight">
                  {stream.title}
                </h1>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 font-bold uppercase">
                  <span>PAYTUNE Live</span>
                  <span>•</span>
                  <span>{new Date(stream.created_at).toLocaleDateString()}</span>
                  {stream.is_paid && (
                    <>
                      <span>•</span>
                      <span className="text-purple-600">
                        RWF {effectivePriceRwf.toLocaleString()} Ticket
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(window.location.href);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-gray-50 hover:bg-gray-100 dark:bg-[#1E1E22] dark:hover:bg-[#272727] rounded-xl text-xs font-bold text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                  title="Copy Stream Link"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
                  {copiedLink ? "Copied" : "Share"}
                </button>

                {user && hasAccess && (
                  <button
                    type="button"
                    onClick={() => setSuperChatModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600/15 hover:bg-purple-600 hover:text-white text-purple-700 dark:text-purple-400 font-black uppercase text-xs transition-all duration-200 shadow-sm border border-purple-600/30 cursor-pointer"
                  >
                    <DollarSign className="w-4 h-4" />
                    Super Thanks / Tip
                  </button>
                )}
              </div>
            </div>

            <hr className="border-gray-100 dark:border-[#222222]" />

            {/* Artist Creator Profile */}
            <div className="flex items-start gap-4">
              {creatorAvatar ? (
                <img
                  src={creatorAvatar}
                  alt={creatorName}
                  className="w-12 h-12 rounded-full border border-purple-600 object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-purple-600 text-white font-black text-base flex items-center justify-center border border-purple-500">
                  {creatorName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="space-y-1 max-w-2xl">
                <h3 className="text-sm font-black text-gray-950 dark:text-white uppercase flex items-center gap-1">
                  {creatorName}
                  {stream.artists?.is_approved && (
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                  )}
                </h3>
                <p className="text-xs text-purple-700 dark:text-purple-500 font-black uppercase tracking-wider">
                  Creator Profile
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
                  {stream.artists?.bio || "No biography details available for this creator."}
                </p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-[#1B1B1E]/60 p-4 rounded-2xl border border-gray-100 dark:border-[#222222]/35 space-y-1 mt-4">
              <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> Broadcast Notes
              </span>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                {stream.description || "No additional description provided."}
              </p>
            </div>
          </div>
        </div>

        {/* CHAT & DONORS PANEL */}
        <div className="flex flex-col h-[520px] lg:h-[calc(100vh-140px)] min-h-[420px] bg-white dark:bg-[#121212] rounded-3xl border border-gray-100 dark:border-[#222222] shadow-sm overflow-hidden justify-between">
          <div className="p-3 border-b border-gray-100 dark:border-[#222222] bg-gray-50/50 dark:bg-[#1C1C1E]/30 flex items-center justify-between">
            <div className="flex gap-1 bg-gray-200 dark:bg-zinc-800 p-1 rounded-xl text-xs font-black uppercase">
              <button
                type="button"
                onClick={() => setChatTab("chat")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  chatTab === "chat"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Live Chat
              </button>
              <button
                type="button"
                onClick={() => setChatTab("donors")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  chatTab === "donors"
                    ? "bg-purple-600 text-white shadow-xs"
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <Award className="w-3 h-3" /> Top Donors ({donations.length})
              </button>
            </div>

            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase rounded-md">
              {String(stream.status || "live").toUpperCase()}
            </span>
          </div>

          {chatTab === "chat" ? (
            <div
              ref={scrollRef}
              className="flex-1 p-4 overflow-y-auto space-y-3.5 scrollbar-thin dark:scrollbar-thumb-zinc-800 scrollbar-thumb-gray-200"
            >
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-1">
                  <MessageSquare className="w-8 h-8 text-gray-300" />
                  <span className="text-[10px] font-black tracking-widest text-gray-400 uppercase">
                    Chat is empty
                  </span>
                  <p className="text-[11px] text-gray-500">Be the first to leave a message.</p>
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <LiveChatMessage
                    key={msg.id || idx}
                    message={msg}
                    isModerator={isModerator}
                    onDelete={(messageId) =>
                      setPendingAction({
                        type: "delete_message",
                        targetId: messageId,
                        label: (msg.message || "").slice(0, 40),
                      })
                    }
                    onBlock={(targetUserId, targetName) =>
                      setPendingAction({
                        type: "block_user",
                        targetId: targetUserId,
                        label: targetName,
                      })
                    }
                  />
                ))
              )}
            </div>
          ) : (
            <div className="flex-1 p-4 overflow-y-auto space-y-2.5">
              {donations.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-1">
                  <Award className="w-8 h-8 text-gray-300" />
                  <span className="text-[10px] font-black tracking-widest text-gray-400 uppercase">
                    No contributions yet
                  </span>
                  <p className="text-[11px] text-gray-500">
                    Super Thanks contributions from listeners appear here.
                  </p>
                </div>
              ) : (
                donations.map((d, index) => (
                  <div
                    key={d.id || index}
                    className="p-3 bg-gray-50 dark:bg-zinc-900/50 rounded-2xl border border-gray-100 dark:border-zinc-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                          index === 0
                            ? "bg-purple-600 text-white font-black"
                            : index === 1
                            ? "bg-gray-300 text-black"
                            : index === 2
                            ? "bg-purple-800 text-white"
                            : "bg-zinc-800 text-gray-400"
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">
                          {d.profiles?.full_name || d.profiles?.username || "Supporter"}
                        </div>
                        {d.message && (
                          <div className="text-[11px] text-gray-500 italic truncate max-w-[160px]">
                            "{d.message}"
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="font-mono font-black text-purple-600">
                      RWF {Number(d.amount || 0).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Chat Form Section */}
          <div className="p-4 border-t border-gray-100 dark:border-[#222222] bg-gray-50/50 dark:bg-[#1C1C1E]/30">
            {isBlocked ? (
              <div className="text-center p-2.5 text-xs text-red-500 uppercase tracking-wider font-bold">
                You are blocked from chatting in this broadcast.
              </div>
            ) : user && hasAccess ? (
              <form onSubmit={handleSendChat} className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Write a message in chat..."
                  className="flex-1 bg-white dark:bg-[#1E1E22] border border-gray-200 dark:border-[#272727] font-semibold text-xs text-gray-900 dark:text-white rounded-xl px-4 py-2.5 focus:outline-none focus:border-purple-500 transition-colors"
                />
                <button
                  type="submit"
                  className="p-2.5 bg-purple-600 text-white hover:bg-purple-700 rounded-xl transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            ) : !user ? (
              <div className="text-center p-2 text-xs text-gray-500 uppercase tracking-wider font-mono">
                <Link to="/login" className="text-purple-600 underline font-bold">
                  Log in
                </Link>{" "}
                to participate in live chat.
              </div>
            ) : (
              <div className="text-center p-2 text-xs text-purple-600 uppercase tracking-wider font-mono">
                Entry ticket required for chat access.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* TICKET PURCHASE MODAL DIALOG */}
      {checkoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#222222] p-6 rounded-3xl space-y-6 shadow-2xl text-gray-900 dark:text-white"
          >
            <div className="text-center space-y-1.5">
              <Ticket className="w-12 h-12 text-purple-600 mx-auto" />
              <h3 className="text-lg font-black uppercase tracking-tight">Buy Entry Ticket</h3>
              <p className="text-xs text-gray-500">
                Requires configured MTN MoMo, Airtel Money, or Stripe credentials.
              </p>
            </div>

            <form onSubmit={handleBuyTicket} className="space-y-4 font-semibold text-xs">
              <div className="space-y-1">
                <label className="text-gray-400 text-[10px] font-black uppercase tracking-wider">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["MTN", "Airtel", "Stripe"].map((prov) => (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => setPayProvider(prov)}
                      className={`py-2.5 rounded-xl border text-center text-xs font-black uppercase transition-all cursor-pointer ${
                        payProvider === prov
                          ? "border-purple-600 bg-purple-600/10 text-purple-600"
                          : "border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                      }`}
                    >
                      {prov === "Stripe" ? "Card" : prov}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-gray-400 text-[10px] font-black uppercase tracking-wider">
                  {payProvider === "Stripe" ? "Cardholder Contact Phone" : "Mobile Money Number"}
                </label>
                <input
                  type="text"
                  required
                  placeholder="078XXXXXXX"
                  value={payPhone}
                  onChange={(e) => setPayPhone(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#1E1E22] border border-gray-200 dark:border-[#272727] rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="p-3 bg-gray-50 dark:bg-zinc-900/40 rounded-xl space-y-1.5 border border-gray-100 dark:border-zinc-800 text-[11px]">
                <div className="flex justify-between text-gray-500">
                  <span>Ticket Price:</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    RWF {effectivePriceRwf.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>5% Rwanda VAT:</span>
                  <span>RWF {vatAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-emerald-600 dark:text-emerald-500 font-bold border-t border-gray-200 dark:border-zinc-800 pt-1">
                  <span>Artist Net (70%):</span>
                  <span>RWF {artistShare.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setCheckoutModal(false)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-[#1E1E22] rounded-xl text-center text-[10px] font-black uppercase text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paywallLoading}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-black uppercase text-[10px] rounded-xl tracking-wider transition-colors cursor-pointer"
                >
                  {paywallLoading ? "Processing..." : `Pay RWF ${effectivePriceRwf.toLocaleString()}`}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* SUPER CHAT / SUPER THANKS DIALOG */}
      <LiveSuperThanksModal
        isOpen={superChatModal}
        onClose={() => setSuperChatModal(false)}
        streamId={streamId || ""}
        artistId={stream?.artists?.id || stream?.artist_id}
        artistName={creatorName}
        onSuccess={() => {
          fetchDonations();
        }}
      />
    </motion.div>
  );
}
