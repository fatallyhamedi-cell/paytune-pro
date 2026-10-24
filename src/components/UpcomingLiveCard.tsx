import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Bell, BellRing, Calendar, Clock, Radio, CheckCircle, Ticket, Loader2 } from "lucide-react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";

export interface UpcomingLiveStream {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  artist_id?: string;
  artist_name?: string;
  artist_avatar?: string;
  scheduled_start: string;
  is_paid?: boolean;
  price_rwf?: number;
  price_usd?: number;
  is_reminded?: boolean;
}

interface UpcomingLiveCardProps {
  stream: UpcomingLiveStream;
  onReminderChange?: (streamId: string, isReminded: boolean) => void;
}

export default function UpcomingLiveCard({ stream, onReminderChange }: UpcomingLiveCardProps) {
  const { user } = useAuth();
  const [isReminded, setIsReminded] = useState(Boolean(stream.is_reminded));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Calculate humanized time remaining
  const getTimeRemaining = (scheduledIso: string) => {
    const diffMs = new Date(scheduledIso).getTime() - Date.now();
    if (diffMs <= 0) return "Starting soon";

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `Starts in ${diffDays}d ${diffHours % 24}h`;
    }
    if (diffHours > 0) {
      return `Starts in ${diffHours}h ${diffMinutes}m`;
    }
    return `Starts in ${diffMinutes}m`;
  };

  const formatScheduledDate = (scheduledIso: string) => {
    try {
      const d = new Date(scheduledIso);
      return d.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });
    } catch {
      return scheduledIso;
    }
  };

  const handleToggleReminder = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      setToastMessage("Please sign in to set live reminders");
      setTimeout(() => setToastMessage(null), 3500);
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await axios.post(`/api/live/${stream.id}/remind`);
      const newState = res.data?.isReminded ?? !isReminded;
      setIsReminded(newState);
      if (onReminderChange) {
        onReminderChange(stream.id, newState);
      }
      setToastMessage(res.data?.message || (newState ? "Reminder set!" : "Reminder cancelled"));
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      console.error("Failed to toggle reminder:", err);
      setToastMessage("Failed to update reminder. Try again.");
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id={`upcoming-stream-${stream.id}`}
      className="group flex flex-col bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden shadow-xs hover:shadow-md transition-all duration-200"
    >
      {/* Thumbnail Area */}
      <Link to={`/live/${stream.id}`} className="relative aspect-video w-full bg-gray-900 block overflow-hidden">
        {stream.thumbnail_url ? (
          <img
            src={stream.thumbnail_url}
            alt={stream.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-amber-600/30 to-purple-900/40 p-4 text-center">
            <Radio className="w-8 h-8 text-amber-500 mb-2 animate-pulse" />
            <span className="text-xs font-bold text-gray-300">Upcoming Live Broadcast</span>
          </div>
        )}

        {/* Live Status Badge */}
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/80 backdrop-blur-xs text-white text-[11px] font-bold border border-white/10 uppercase tracking-wide">
          <Calendar className="w-3 h-3 text-amber-400" />
          <span>Scheduled</span>
        </div>

        {/* Countdown Pill */}
        <div className="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-md bg-black/85 backdrop-blur-xs text-white text-[11px] font-semibold flex items-center gap-1.5 border border-white/10">
          <Clock className="w-3 h-3 text-amber-400" />
          <span>{getTimeRemaining(stream.scheduled_start)}</span>
        </div>

        {/* Paid Stream Badge */}
        {stream.is_paid && (
          <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-md bg-amber-500 text-black text-[11px] font-extrabold flex items-center gap-1 shadow-sm">
            <Ticket className="w-3 h-3" />
            <span>{stream.price_rwf ? `${stream.price_rwf.toLocaleString()} RWF` : "Ticketed"}</span>
          </div>
        )}
      </Link>

      {/* Card Info Area */}
      <div className="p-3.5 flex flex-col flex-1 justify-between gap-3">
        <div>
          {/* Creator & Title */}
          <div className="flex items-start gap-2.5 mb-2">
            <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200 dark:bg-neutral-800 flex-shrink-0">
              {stream.artist_avatar ? (
                <img
                  src={stream.artist_avatar}
                  alt={stream.artist_name || "Creator"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs font-bold bg-amber-500/20 text-amber-500">
                  {(stream.artist_name || "P")[0]}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <Link to={`/live/${stream.id}`}>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white line-clamp-2 hover:text-amber-500 transition-colors leading-snug">
                  {stream.title}
                </h3>
              </Link>
              <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                <span className="truncate">{stream.artist_name || "PAYTUNE Creator"}</span>
                <CheckCircle className="w-3 h-3 text-amber-500 fill-amber-500/20 flex-shrink-0" />
              </div>
            </div>
          </div>

          {/* Scheduled Date Display */}
          <div className="text-[11px] text-gray-500 dark:text-gray-400 pl-10.5">
            📅 {formatScheduledDate(stream.scheduled_start)}
          </div>
        </div>

        {/* Interactive "Notify Me" Reminder Action Button */}
        <div className="pt-2 border-t border-gray-100 dark:border-gray-800/60 flex items-center justify-between">
          <button
            id={`notify-btn-${stream.id}`}
            type="button"
            onClick={handleToggleReminder}
            disabled={isSubmitting}
            className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isReminded
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25"
                : "bg-gray-100 dark:bg-[#252525] hover:bg-amber-500 hover:text-black text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700"
            }`}
          >
            {isSubmitting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isReminded ? (
              <>
                <BellRing className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                <span>Reminder Set</span>
              </>
            ) : (
              <>
                <Bell className="w-3.5 h-3.5" />
                <span>Notify Me</span>
              </>
            )}
          </button>
        </div>

        {/* Toast confirmation feedback */}
        {toastMessage && (
          <div className="text-[11px] font-semibold text-center text-amber-500 animate-fade-in">
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  );
}
