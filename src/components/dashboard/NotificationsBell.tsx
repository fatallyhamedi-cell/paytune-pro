import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  Check,
  Video,
  Radio,
  ShoppingBag,
  Sparkles,
  UserPlus,
  MessageSquare,
  DollarSign,
  Crown,
  ArrowDownLeft,
  ShieldAlert,
  ExternalLink,
  CheckCheck
} from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';

export const NotificationsBell: React.FC = () => {
  const { notifications, unreadCount, markAllAsRead, markAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'video_new':
      case 'release':
        return <Video className="w-4 h-4 text-[#FFB300]" />;
      case 'subscriber_new':
      case 'follower_new':
        return <UserPlus className="w-4 h-4 text-blue-400" />;
      case 'purchase_completed':
      case 'purchase':
        return <ShoppingBag className="w-4 h-4 text-emerald-400" />;
      case 'comment_new':
      case 'comment_reply':
      case 'comment':
        return <MessageSquare className="w-4 h-4 text-sky-400" />;
      case 'super_thanks':
        return <DollarSign className="w-4 h-4 text-yellow-400" />;
      case 'membership_joined':
      case 'membership':
        return <Crown className="w-4 h-4 text-amber-300" />;
      case 'live_started':
      case 'live':
        return <Radio className="w-4 h-4 text-red-500 animate-pulse" />;
      case 'withdrawal_requested':
      case 'withdrawal_completed':
      case 'withdrawal':
        return <ArrowDownLeft className="w-4 h-4 text-emerald-300" />;
      case 'copyright_claim':
      case 'copyright_strike':
      case 'copyright':
        return <ShieldAlert className="w-4 h-4 text-amber-500" />;
      default:
        return <Sparkles className="w-4 h-4 text-amber-400" />;
    }
  };

  const handleNotificationClick = (n: any) => {
    if (!n.is_read) {
      markAsRead(n.id);
    }
    if (n.link) {
      navigate(n.link);
      setIsOpen(false);
    }
  };

  const filteredNotifications = filter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications;

  return (
    <div className="relative" ref={dropdownRef} id="notifications-bell-wrapper">
      <button
        id="notifications-bell-btn"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-full bg-[#1A1A1A] hover:bg-[#252525] border border-white/5 text-gray-300 hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            id="unread-notifications-badge"
            className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[11px] font-bold text-black bg-[#FFB300] rounded-full shadow-lg animate-pulse"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          id="notifications-dropdown-menu"
          className="absolute right-0 mt-3 w-80 sm:w-96 bg-[#141414] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="p-4 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#FFB300]/10 text-[#FFB300]">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                id="mark-all-notifications-read-btn"
                onClick={markAllAsRead}
                className="text-xs text-gray-400 hover:text-[#FFB300] flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-[#181818]/60">
            <button
              id="filter-all-notifications"
              onClick={() => setFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-[#FFB300] text-black'
                  : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              id="filter-unread-notifications"
              onClick={() => setFilter('unread')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === 'unread'
                  ? 'bg-[#FFB300] text-black'
                  : 'bg-white/5 text-gray-400 hover:text-white'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-white/5">
            {filteredNotifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 text-sm">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
              </div>
            ) : (
              filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  id={`notification-item-${n.id}`}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 flex items-start gap-3 hover:bg-white/5 transition-colors cursor-pointer ${
                    !n.is_read ? 'bg-[#FFB300]/5' : ''
                  }`}
                >
                  <div className="p-2 rounded-xl bg-white/5 mt-0.5 shrink-0">
                    {getIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <p
                        className={`text-xs truncate ${
                          !n.is_read ? 'text-white font-semibold' : 'text-gray-300 font-medium'
                        }`}
                      >
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-[#FFB300] shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                    <div className="flex items-center justify-between mt-1.5 text-[10px] text-gray-500">
                      <span>
                        {new Date(n.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                      {n.link && (
                        <span className="text-[#FFB300] flex items-center gap-0.5 hover:underline">
                          View <ExternalLink className="w-2.5 h-2.5" />
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
