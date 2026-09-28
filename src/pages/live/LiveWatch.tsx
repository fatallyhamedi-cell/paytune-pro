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
  Trash2,
  Ban,
  Heart,
  Sparkles,
  CreditCard,
  Phone,
  CheckCircle2,
  Flame
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { LiveChatMessage } from "../../components/LiveChatMessage";
import { LiveSuperThanksModal } from "../../components/LiveSuperThanksModal";

export default function LiveWatch() {
  const { streamId } = useParams<{ streamId: string }>();
  const { user } = useAuth();
  const [stream, setStream] = useState<any>(null);
  const [hasAccess, setHasAccess] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Chat elements
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState<string>("");
  const [activeViewers, setActiveViewers] = useState<number>(1);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  const [chatTab, setChatTab] = useState<"chat" | "donors">("chat");
  const [donations, setDonations] = useState<any[]>([]);
  const [latestSuperThanks, setLatestSuperThanks] = useState<any | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);

  // Ticket Paywall Modal
  const [checkoutModal, setCheckoutModal] = useState<boolean>(false);
  const [paywallLoading, setPaywallLoading] = useState<boolean>(false);
  const [payPhone, setPayPhone] = useState<string>("");
  const [payProvider, setPayProvider] = useState<string>("MTN");
  
  // Super Thanks Modal
  const [superChatModal, setSuperChatModal] = useState<boolean>(false);
  const [tipAmount, setTipAmount] = useState<string>("2000");
  const [customTip, setCustomTip] = useState<string>("");
  const [tipMessage, setTipMessage] = useState<string>("");
  const [donateProvider, setDonateProvider] = useState<string>("MTN");
  const [donatePhone, setDonatePhone] = useState<string>("");
  const [donateLoading, setDonateLoading] = useState<boolean>(false);

  const getAuthToken = () => {
    try {
      const directToken = localStorage.getItem("paytune_auth_token");
      if (directToken) return directToken;
      const session = localStorage.getItem("paytune_mock_session");
      return session ? JSON.parse(session).access_token : null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    fetchStreamDetails();
    fetchDonations();
    initChatSocket();

    return () => {
      if (socketRef.current) {
        socketRef.current.emit("leave", streamId);
        socketRef.current.disconnect();
      }
    };
  }, [streamId]);

  useEffect(() => {
    if (scrollRef.current && chatTab === "chat") {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatTab]);

  const fetchStreamDetails = async () => {
    setLoading(true);
    try {
      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/live/${streamId}`, { headers });
      if (!res.ok) throw new Error("This live broadcast is no longer available.");

      const data = await res.json();
      setStream(data.stream);
      setHasAccess(!!data.userHasAccess || !data.stream?.is_paid);

      // Fetch existing chats
      const chatRes = await fetch(`/api/live/${streamId}/chat`);
      if (chatRes.ok) {
        const chatData = await chatRes.json();
        setChatMessages(chatData);
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
        setDonations(data || []);
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
      setActiveViewers(data.count || 1);
    });

    socket.on("viewer:join", (data: any) => {
      setActiveViewers(data.count || 1);
    });

    socket.on("viewer:leave", (data: any) => {
      setActiveViewers(data.count || 1);
    });

    // Message receiver
    socket.on("chat:message", (msg: any) => {
      setChatMessages((prev) => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    // Super Thanks celebration
    socket.on("chat:super-thanks", (data: any) => {
      setLatestSuperThanks(data);
      fetchDonations();
      setTimeout(() => {
        setLatestSuperThanks((curr: any) => (curr?.id === data.id ? null : curr));
      }, 6000);
    });

    // Message deleted
    socket.on("chat:deleted", (data: any) => {
      setChatMessages((prev) => prev.filter(m => m.id !== data.messageId));
    });

    // Moderation events
    socket.on("moderation", (data: any) => {
      if (data.action === "delete_message") {
        setChatMessages((prev) => prev.filter(m => m.id !== data.messageId));
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
          userName: user?.user_metadata?.full_name || (user as any)?.full_name || "Guest Listener"
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        if (res.status === 403) {
          setIsBlocked(true);
        }
        throw new Error(errData.error || "Could not deliver message.");
      }

      const data = await res.json();
      setChatMessages((prev) => {
        if (prev.some(m => m.id === data.id)) return prev;
        return [...prev, data];
      });
      setNewMessage("");
    } catch (err: any) {
      alert(err.message);
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
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          paymentPhone: payPhone,
          provider: payProvider
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Ticket purchase rejected.");
      }
      
      setHasAccess(true);
      setCheckoutModal(false);
      fetchStreamDetails();
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setPaywallLoading(false);
    }
  };

  const handleSendSuperChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalAmount = customTip ? Number(customTip) : Number(tipAmount);
    if (!finalAmount || finalAmount <= 0) return;

    setDonateLoading(true);
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/live/${streamId}/donate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: finalAmount,
          message: tipMessage,
          paymentPhone: donatePhone || "0780000000",
          provider: donateProvider
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Super Thanks donation failed.");
      }
      
      setSuperChatModal(false);
      setTipMessage("");
      setCustomTip("");
      fetchStreamDetails();
      fetchDonations();
    } catch (err: any) {
      alert("Donation Error: " + err.message);
    } finally {
      setDonateLoading(false);
    }
  };

  // Moderation Handlers
  const isModerator = user && (stream?.artists?.user_id === user.id || (user as any).role === "master");

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Delete this message from chat?")) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/live/${streamId}/chat/${messageId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        setChatMessages(prev => prev.filter(m => m.id !== messageId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleBlockUser = async (targetUserId: string, targetName: string) => {
    if (!confirm(`Block ${targetName} from chatting in this broadcast?`)) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/live/${streamId}/block/${targetUserId}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (res.ok) {
        alert(`${targetName} has been blocked from chat.`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
        <p className="text-gray-500 dark:text-gray-400 mt-4 text-xs font-mono">LOADING BROADCAST...</p>
      </div>
    );
  }

  if (error || !stream) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center border border-red-200 bg-red-50 dark:bg-red-950/10 dark:border-red-900 rounded-3xl mt-12">
        <h3 className="text-red-600 dark:text-red-400 font-black tracking-tight uppercase">Stream unavailable</h3>
        <p className="text-gray-600 dark:text-gray-400 mt-2 text-sm">{error || "Live stream record missing."}</p>
        <Link to="/live" className="inline-block mt-6 text-xs font-black uppercase tracking-widest text-amber-500 hover:underline">
          Return to Live Hub
        </Link>
      </div>
    );
  }

  const effectivePriceRwf = stream.price_rwf || 1000;
  const effectivePriceUsd = stream.price_usd || (effectivePriceRwf / 1300).toFixed(2);
  const vatAmount = effectivePriceRwf * 0.05;
  const artistShare = effectivePriceRwf * 0.95 * 0.70;

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 md:px-6 py-6"
    >
      {/* Super Thanks Floating Alert Banner */}
      <AnimatePresence>
        {latestSuperThanks && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 font-bold border border-amber-300"
          >
            <Flame className="w-5 h-5 text-red-600 fill-current animate-bounce" />
            <span className="text-xs uppercase tracking-tight">
              <strong>{latestSuperThanks.user_name || "A fan"}</strong> sent a Super Thanks of{" "}
              <strong>RWF {latestSuperThanks.super_chat_amount?.toLocaleString()}</strong>!
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* PLAYER & STREAM DETAILS SECTION */}
        <div className="lg:col-span-2 space-y-6">
          <div className="relative aspect-video bg-black rounded-3xl overflow-hidden group shadow-md border border-gray-100 dark:border-[#222222]">
            
            {/* Paywall Overlay */}
            {!hasAccess ? (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8 bg-black/90 backdrop-blur-md text-white text-center space-y-5">
                <Ticket className="w-16 h-16 text-amber-500 animate-bounce" />
                <div className="max-w-md space-y-2">
                  <h3 className="text-xl md:text-2xl font-black uppercase tracking-tight">
                    Paid Live Virtual Concert
                  </h3>
                  <p className="text-sm text-gray-400 max-w-sm mx-auto">
                    This broadcast requires an entry ticket. Tickets support the artist directly (70% net revenue split).
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="text-xl font-black text-amber-500">
                    RWF {Number(effectivePriceRwf).toLocaleString()}{" "}
                    <span className="text-xs text-gray-400 font-normal">(${effectivePriceUsd} USD)</span>
                  </div>
                  {user ? (
                    <button 
                      onClick={() => setCheckoutModal(true)}
                      className="px-8 py-3.5 bg-amber-500 hover:bg-amber-600 font-black text-black text-xs uppercase rounded-full transition-all duration-200 shadow-lg shadow-amber-500/20 cursor-pointer"
                    >
                      Buy Ticket Now (MTN / Airtel / Stripe)
                    </button>
                  ) : (
                    <Link
                      to="/login"
                      className="inline-block px-8 py-3 bg-amber-500 text-black font-black uppercase text-xs rounded-full"
                    >
                      Log in to Purchase Ticket
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              // Live Broadcast Video
              <div className="w-full h-full relative">
                <video 
                  src={stream.stream_url || ""}
                  className="w-full h-full object-cover"
                  autoPlay
                  controls
                  loop
                  playsInline
                />
                
                {/* Live stream badge */}
                <div className="absolute top-4 left-4 flex items-center gap-2 pointer-events-none z-10">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-white font-black uppercase text-[10px] rounded-full tracking-wider shadow ${
                    stream.status === "live" ? "bg-red-600 animate-pulse" : "bg-zinc-800"
                  }`}>
                    <Radio className="w-3.5 h-3.5" />
                    {stream.status === "live" ? "LIVE" : stream.status.toUpperCase()}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-black/60 backdrop-blur-md text-white font-black text-[10px] rounded-lg">
                    <Users className="w-3.5 h-3.5 text-amber-500" />
                    {activeViewers} VIEWERS
                  </span>
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
                      <span className="text-amber-500">RWF {Number(stream.price_rwf || 0).toLocaleString()} Ticket</span>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    alert("Stream link copied!");
                  }}
                  className="p-3 bg-gray-50 hover:bg-gray-100 dark:bg-[#1E1E22] dark:hover:bg-[#272727] rounded-full text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                  title="Share Stream"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                
                {user && hasAccess && (
                  <button 
                    onClick={() => setSuperChatModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500/15 hover:bg-amber-500 hover:text-black text-amber-600 dark:text-amber-500 font-black uppercase text-xs transition-all duration-200 shadow-sm border border-amber-500/30 cursor-pointer"
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
              {stream.artists?.profile_image ? (
                <img 
                  src={stream.artists.profile_image} 
                  alt={stream.artists?.full_name} 
                  className="w-12 h-12 rounded-full border border-amber-500 object-cover"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-amber-500 text-black font-black text-base flex items-center justify-center border border-amber-500">
                  {stream.artists?.full_name?.charAt(0)?.toUpperCase() || 'A'}
                </div>
              )}
              <div className="space-y-1 max-w-2xl">
                <h3 className="text-sm font-black text-gray-950 dark:text-white uppercase flex items-center gap-1">
                  {stream.artists?.full_name}
                  {stream.artists?.is_approved && <ShieldCheck className="w-4 h-4 text-amber-500" />}
                </h3>
                <p className="text-xs text-amber-600 dark:text-amber-500 font-black uppercase tracking-wider">
                  Verified Artist
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 select-none mt-2 leading-relaxed">
                  {stream.artists?.bio || "No biography details available for this artist."}
                </p>
              </div>
            </div>

            {/* Description accordion */}
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
          
          {/* Header with Chat & Top Donors Tabs */}
          <div className="p-3 border-b border-gray-100 dark:border-[#222222] bg-gray-50/50 dark:bg-[#1C1C1E]/30 flex items-center justify-between">
            <div className="flex gap-1 bg-gray-200 dark:bg-zinc-800 p-1 rounded-xl text-xs font-black uppercase">
              <button
                onClick={() => setChatTab("chat")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  chatTab === "chat" ? "bg-amber-500 text-black shadow-xs" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                Live Chat
              </button>
              <button
                onClick={() => setChatTab("donors")}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  chatTab === "donors" ? "bg-amber-500 text-black shadow-xs" : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
                }`}
              >
                <Award className="w-3 h-3" /> Top Donors ({donations.length})
              </button>
            </div>

            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 text-[10px] font-black uppercase rounded-full">
              Live
            </span>
          </div>

          {/* Tab View: Live Chat */}
          {chatTab === "chat" ? (
            <div 
              ref={scrollRef}
              className="flex-1 p-4 overflow-y-auto space-y-3.5 scrollbar-thin dark:scrollbar-thumb-zinc-800 scrollbar-thumb-gray-200"
            >
              {chatMessages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-1">
                  <MessageSquare className="w-8 h-8 text-gray-300" />
                  <span className="text-[10px] font-black tracking-widest text-gray-400 uppercase">Chat is empty</span>
                  <p className="text-[11px] text-gray-500">Be the first to leave a comment!</p>
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <LiveChatMessage
                    key={msg.id || idx}
                    message={msg}
                    isModerator={isModerator}
                    onDelete={handleDeleteMessage}
                    onBlock={handleBlockUser}
                  />
                ))
              )}
            </div>
          ) : (
            /* Tab View: Top Donors */
            <div className="flex-1 p-4 overflow-y-auto space-y-2.5">
              {donations.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-1">
                  <Award className="w-8 h-8 text-gray-300" />
                  <span className="text-[10px] font-black tracking-widest text-gray-400 uppercase">No donations yet</span>
                  <p className="text-[11px] text-gray-500">Send a Super Thanks to top the leaderboard!</p>
                </div>
              ) : (
                donations.map((d, index) => (
                  <div 
                    key={d.id || index}
                    className="p-3 bg-gray-50 dark:bg-zinc-900/50 rounded-2xl border border-gray-100 dark:border-zinc-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                        index === 0 
                          ? "bg-amber-500 text-black font-black" 
                          : index === 1 
                          ? "bg-gray-300 text-black" 
                          : index === 2 
                          ? "bg-amber-700 text-white" 
                          : "bg-zinc-800 text-gray-400"
                      }`}>
                        {index + 1}
                      </span>
                      <div>
                        <div className="font-bold text-gray-900 dark:text-white">
                          {d.profiles?.full_name || d.profiles?.username || "Generous Supporter"}
                        </div>
                        {d.message && (
                          <div className="text-[11px] text-gray-500 italic truncate max-w-[160px]">
                            "{d.message}"
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="font-mono font-black text-amber-500">
                      RWF {Number(d.amount).toLocaleString()}
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
                  placeholder="Say something nice in chat..."
                  className="flex-1 bg-white dark:bg-[#1E1E22] border border-gray-200 dark:border-[#272727] font-semibold text-xs text-gray-900 dark:text-white rounded-full px-4 py-2.5 focus:outline-none focus:border-amber-500 transition-colors"
                />
                <button
                  type="submit"
                  className="p-2.5 bg-amber-500 text-black hover:bg-amber-600 rounded-full transition-colors flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            ) : !user ? (
              <div className="text-center p-2 text-xs text-gray-500 uppercase tracking-wider font-mono">
                <Link to="/login" className="text-amber-500 underline font-bold">Log in</Link> to participate in the chat room.
              </div>
            ) : (
              <div className="text-center p-2 text-xs text-amber-500 uppercase tracking-wider font-mono">
                Access ticket required for chat operations.
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
              <Ticket className="w-12 h-12 text-amber-500 mx-auto" />
              <h3 className="text-lg font-black uppercase tracking-tight">Buy Entry Ticket</h3>
              <p className="text-xs text-gray-500">Direct payment via MTN MoMo, Airtel Money, or Stripe Card.</p>
            </div>

            <form onSubmit={handleBuyTicket} className="space-y-4 font-semibold text-xs">
              <div className="space-y-1">
                <label className="text-gray-400 text-[10px] font-black uppercase tracking-wider">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {["MTN", "Airtel", "Stripe"].map((prov) => (
                    <button
                      key={prov}
                      type="button"
                      onClick={() => setPayProvider(prov)}
                      className={`py-2.5 rounded-xl border text-center text-xs font-black uppercase transition-all cursor-pointer ${
                        payProvider === prov 
                          ? "border-amber-500 bg-amber-500/10 text-amber-500" 
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
                  {payProvider === "Stripe" ? "Cardholder Phone / Contact" : "Mobile Money Number"}
                </label>
                <input
                  type="text"
                  required
                  placeholder={payProvider === "Stripe" ? "0780000000" : "0781234567"}
                  value={payPhone}
                  onChange={(e) => setPayPhone(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#1E1E22] border border-gray-200 dark:border-[#272727] rounded-xl px-4 py-3 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Price and Split Breakdown */}
              <div className="p-3 bg-gray-50 dark:bg-zinc-900/40 rounded-xl space-y-1.5 border border-gray-100 dark:border-zinc-800 text-[11px]">
                <div className="flex justify-between text-gray-500">
                  <span>Ticket Price:</span>
                  <span className="font-bold text-gray-900 dark:text-white">RWF {Number(effectivePriceRwf).toLocaleString()}</span>
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
                  className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-black font-black uppercase text-[10px] rounded-xl tracking-wider transition-colors cursor-pointer"
                >
                  {paywallLoading ? "Processing..." : `Pay RWF ${Number(effectivePriceRwf).toLocaleString()}`}
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
        artistName={stream?.artists?.stage_name || stream?.artists?.full_name || "the artist"}
        onSuccess={() => {
          fetchDonations();
        }}
      />
    </motion.div>
  );
}
