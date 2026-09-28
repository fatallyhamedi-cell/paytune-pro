import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Film, 
  BarChart3, 
  Wallet, 
  Radio, 
  Settings, 
  Upload, 
  Menu, 
  X, 
  ExternalLink, 
  ChevronRight,
  Sparkles,
  LogOut,
  Users,
  Scale
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Logo from '../Logo';

interface ArtistDashboardLayoutProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  artist: any;
  onOpenUpload: () => void;
  onSignOut: () => void;
  children: React.ReactNode;
}

export const ArtistDashboardLayout: React.FC<ArtistDashboardLayoutProps> = ({
  activeTab,
  onTabChange,
  artist,
  onOpenUpload,
  onSignOut,
  children
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  const navItems = [
    { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard, badge: null },
    { id: 'videos', label: 'Content Library', icon: Film, badge: null },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, badge: null },
    { id: 'earnings', label: 'Earnings & Payouts', icon: Wallet, badge: '70%' },
    { id: 'copyright', label: 'Copyright & DMCA', icon: Scale, badge: null },
    { id: 'subscribers', label: 'Followers & Fans', icon: Users, badge: null },
    { id: 'live', label: 'Live Studio', icon: Radio, badge: 'Live' },
    { id: 'settings', label: 'Studio Settings', icon: Settings, badge: null }
  ];

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-white flex flex-col font-sans selection:bg-[#FFB300] selection:text-black">
      {/* 1. Studio Header */}
      <header className="sticky top-0 z-40 bg-[#161616]/95 backdrop-blur-md border-b border-white/10 px-4 lg:px-6 h-16 flex items-center justify-between">
        {/* Left: Hamburger & Logo */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 lg:hidden transition-colors"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div 
            onClick={() => { onTabChange('overview'); navigate('/artist/dashboard'); }}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <Logo size="sm" />
            <span className="text-[10px] font-black tracking-widest text-[#FFB300] uppercase bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 shrink-0">
              Studio
            </span>
          </div>
        </div>

        {/* Right: Quick Actions & Artist Identity */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenUpload}
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl bg-[#FFB300] text-black font-black text-xs hover:bg-[#ffc107] transition-all shadow-md shadow-amber-500/20 active:scale-95"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Release</span>
          </button>

          <button
            onClick={() => onTabChange('live')}
            className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 font-bold text-xs hover:bg-rose-500/25 transition-all"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Go Live</span>
          </button>

          <div className="h-6 w-px bg-white/10 hidden sm:block" />

          {/* Artist Channel Avatar */}
          <div className="flex items-center gap-2.5 pl-1">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-amber-500/40 bg-neutral-900 flex items-center justify-center">
              {artist?.avatar_url ? (
                <img
                  src={artist.avatar_url}
                  alt={artist?.full_name || 'Artist'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs font-black text-[#FFB300]">
                  {(artist?.full_name || 'A').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="hidden md:block text-left">
              <div className="text-xs font-bold text-white leading-tight">
                {artist?.full_name || 'Artist Studio'}
              </div>
              <div className="text-[10px] text-[#FFB300] font-medium">
                Verified Artist Channel
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/')}
            title="Switch to Viewer Mode"
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 2. Main Content & Sidebar */}
      <div className="flex-1 flex">
        {/* Desktop Sidebar */}
        <aside className="w-64 bg-[#161616] border-r border-white/10 hidden lg:flex flex-col shrink-0">
          {/* Artist Channel Header Card */}
          <div className="p-4 border-b border-white/5">
            <div className="p-3 rounded-2xl bg-[#1F1F1F] border border-white/5 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-neutral-900 flex items-center justify-center">
                {artist?.avatar_url ? (
                  <img
                    src={artist.avatar_url}
                    alt={artist?.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-base font-black text-[#FFB300]">
                    {(artist?.full_name || 'A').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-white truncate">
                  {artist?.full_name || 'Artist Studio'}
                </h4>
                <p className="text-[10px] text-gray-400 truncate">
                  {(artist?.subscriber_count || 0).toLocaleString()} Followers
                </p>
                <div className="flex items-center gap-1 mt-1 text-[10px] text-[#FFB300] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Monetized Partner</span>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-[#FFB300] text-black shadow-lg shadow-amber-500/10'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-black' : 'text-gray-400'}`} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-black text-[#FFB300]'
                        : item.id === 'live'
                        ? 'bg-rose-500/20 text-rose-400'
                        : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-white/5 space-y-3">
            <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-transparent border border-amber-500/20">
              <span className="text-[10px] font-bold text-[#FFB300] uppercase tracking-wider block">
                Creator Royalty
              </span>
              <p className="text-xs font-bold text-white mt-0.5">
                70% Artist Share Guarantee
              </p>
              <span className="text-[10px] text-gray-400 block mt-1">
                Direct to MTN MoMo & Airtel
              </span>
            </div>

            <button
              onClick={onSignOut}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Log out</span>
            </button>
          </div>
        </aside>

        {/* Mobile Slide-over Drawer */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            />
            <div className="relative w-72 max-w-full bg-[#161616] border-r border-white/10 flex flex-col z-10">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#FFB300] flex items-center justify-center text-black font-black text-xs">
                    P
                  </div>
                  <span className="font-black text-sm text-white">Creator Studio</span>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onTabChange(item.id);
                        setSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-bold transition-all ${
                        isActive
                          ? 'bg-[#FFB300] text-black font-black'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                          isActive ? 'bg-black text-[#FFB300]' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-white/10 space-y-2">
                <button
                  onClick={onOpenUpload}
                  className="w-full py-2.5 bg-[#FFB300] text-black font-black text-xs rounded-xl flex items-center justify-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload Release</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Stage */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#161616]/95 backdrop-blur-md border-t border-white/10 px-2 py-1.5 flex items-center justify-around safe-area-bottom">
        {[
          { id: 'overview', label: 'Home', icon: LayoutDashboard },
          { id: 'videos', label: 'Content', icon: Film },
          { id: 'earnings', label: 'Earnings', icon: Wallet },
          { id: 'subscribers', label: 'Fans', icon: Users },
          { id: 'live', label: 'Live', icon: Radio },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center min-w-[56px] py-1 px-2 rounded-xl transition-colors ${
                isActive ? 'text-[#FFB300]' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-bold">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
