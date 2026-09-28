import React from 'react';
import { Sparkles, Trash2, Ban } from 'lucide-react';

export interface ChatMessageData {
  id: string;
  stream_id: string;
  user_id?: string | null;
  user_name: string;
  message: string;
  is_super_chat?: boolean;
  super_chat_amount?: number;
  payment_id?: string;
  created_at?: string;
}

interface LiveChatMessageProps {
  message: ChatMessageData;
  isModerator?: boolean;
  onDelete?: (id: string) => void;
  onBlock?: (userId: string, userName: string) => void;
}

export const LiveChatMessage: React.FC<LiveChatMessageProps> = ({
  message,
  isModerator = false,
  onDelete,
  onBlock
}) => {
  const isSuper = message.is_super_chat && (message.super_chat_amount || 0) > 0;

  if (isSuper) {
    return (
      <div 
        id={`chat-super-thanks-${message.id}`}
        className="p-3.5 rounded-2xl relative overflow-hidden transition-all shadow-md group border border-[#FFC107]"
        style={{
          background: 'linear-gradient(135deg, rgba(255, 179, 0, 0.22) 0%, rgba(255, 143, 0, 0.15) 100%)'
        }}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-amber-900 dark:text-amber-300 truncate max-w-[140px]">
              {message.user_name || 'Supporter'}
            </span>
            <span 
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wider text-black uppercase shadow-xs"
              style={{ background: 'linear-gradient(135deg, #FFB300 0%, #FF8F00 100%)' }}
            >
              <Sparkles className="w-3 h-3 fill-black text-black animate-spin" style={{ animationDuration: '4s' }} />
              RWF {Number(message.super_chat_amount).toLocaleString()}
            </span>
          </div>

          {isModerator && (
            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
              {onDelete && (
                <button
                  onClick={() => onDelete(message.id)}
                  className="p-1 hover:bg-black/10 rounded text-red-600 transition-colors"
                  title="Delete message"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
              {onBlock && message.user_id && (
                <button
                  onClick={() => onBlock(message.user_id!, message.user_name)}
                  className="p-1 hover:bg-black/10 rounded text-amber-700 transition-colors"
                  title="Block user"
                >
                  <Ban className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>

        <p className="text-xs font-semibold text-gray-900 dark:text-amber-100 leading-relaxed break-words">
          {message.message}
        </p>
      </div>
    );
  }

  // Standard regular chat message
  return (
    <div 
      id={`chat-msg-${message.id}`}
      className="p-2.5 rounded-xl bg-gray-50 dark:bg-zinc-900/60 hover:bg-gray-100 dark:hover:bg-zinc-800/60 transition-colors text-xs flex items-start justify-between gap-2 group"
    >
      <div className="space-y-0.5 min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[11px] text-gray-700 dark:text-gray-300 truncate max-w-[150px]">
            {message.user_name || 'Viewer'}
          </span>
          <span className="text-[10px] text-gray-400">
            {message.created_at ? new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
        </div>
        <p className="text-gray-900 dark:text-gray-200 text-xs break-words font-medium">
          {message.message}
        </p>
      </div>

      {isModerator && (
        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity shrink-0">
          {onDelete && (
            <button
              onClick={() => onDelete(message.id)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded text-gray-400 hover:text-red-500 transition-colors"
              title="Delete message"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
          {onBlock && message.user_id && (
            <button
              onClick={() => onBlock(message.user_id!, message.user_name)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded text-gray-400 hover:text-amber-500 transition-colors"
              title="Block user"
            >
              <Ban className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
