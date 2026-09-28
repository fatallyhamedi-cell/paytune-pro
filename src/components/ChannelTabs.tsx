import React from 'react';
import { 
  PlaySquare, 
  Flame, 
  ListMusic, 
  Radio, 
  Crown, 
  Info 
} from 'lucide-react';
import { ChannelTabType } from '../hooks/useChannelTabs';

interface ChannelTabsProps {
  activeTab: ChannelTabType;
  onTabChange: (tab: ChannelTabType) => void;
  videoCount?: number;
  shortsCount?: number;
  playlistCount?: number;
  tierCount?: number;
}

interface TabConfig {
  id: ChannelTabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | null;
}

export default function ChannelTabs({
  activeTab,
  onTabChange,
  videoCount,
  shortsCount,
  playlistCount,
  tierCount
}: ChannelTabsProps) {
  const tabs: TabConfig[] = [
    { id: 'videos', label: 'Videos', icon: PlaySquare, badge: videoCount },
    { id: 'shorts', label: 'Shorts', icon: Flame, badge: shortsCount },
    { id: 'playlists', label: 'Playlists', icon: ListMusic, badge: playlistCount },
    { id: 'live', label: 'Live', icon: Radio },
    { id: 'membership', label: 'Membership', icon: Crown, badge: tierCount },
    { id: 'about', label: 'About', icon: Info }
  ];

  return (
    <div id="channel-tabs-bar" className="w-full bg-[#0F0F0F] border-b border-neutral-800 sticky top-14 z-30 backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center space-x-1 sm:space-x-2 overflow-x-auto scrollbar-none py-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                id={`channel-tab-${tab.id}`}
                onClick={() => onTabChange(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-semibold tracking-wide whitespace-nowrap transition-colors duration-200 outline-none select-none ${
                  isActive 
                    ? 'text-[#FFB300]' 
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#FFB300]' : 'text-neutral-500'}`} />
                <span>{tab.label}</span>

                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive 
                      ? 'bg-[#FFB300]/20 text-[#FFB300]' 
                      : 'bg-neutral-800 text-neutral-400'
                  }`}>
                    {tab.badge}
                  </span>
                )}

                {/* Amber underline for active tab */}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FFB300] rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
