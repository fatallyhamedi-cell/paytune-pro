import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Film,
  History as HistoryIcon,
  ListMusic,
  Users,
  Bookmark,
  Smartphone,
  Settings as SettingsIcon,
  ChevronLeft,
  ChevronRight,
  Home,
  LogOut,
  UserCircle2,
  Compass,
  Menu
} from 'lucide-react';
import { NotificationsBell } from './NotificationsBell';
import { useAuth } from '../../hooks/useAuth';
import { useUser } from '../../hooks/useUser';
import Logo from '../Logo';

export type DashboardTab =
  | 'profile'
  | 'history'
  | 'playlists'
  | 'following'
  | 'wishlist'
  | 'phones'
  | 'settings';

interface DashboardLayoutProps {
  currentTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  currentTab,
  onTabChange,
  children
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, logout } = useAuth();
  const { profile } = useUser();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const navItems = [
    { id: 'profile' as DashboardTab, label: 'Profile', icon: UserCircle2 },
    { id: 'history' as DashboardTab, label: 'History', icon: HistoryIcon },
    { id: 'playlists' as DashboardTab, label: 'Playlists', icon: ListMusic },
    { id: 'following' as DashboardTab, label: 'Following', icon: Users },
    { id: 'wishlist' as DashboardTab, label: 'Watch Later', icon: Bookmark },
    { id: 'phones' as DashboardTab, label: 'Payment Phones', icon: Smartphone },
    { id: 'settings' as DashboardTab, label: 'Settings', icon: SettingsIcon },
  ];

  const handleLogout = async () => {
    if (signOut) await signOut();
    else if (logout) await logout();
    navigate('/');
  };

  const getTabTitle = (tab: DashboardTab) => {
    switch (tab) {
      case 'profile': return 'User Profile';
      case 'history': return 'Watch History';
      case 'playlists': return 'Your Playlists';
      case 'following': return 'Followed Artists';
      case 'wishlist': return 'Watch Later';
      case 'phones': return 'Payment Numbers';
      case 'settings': return 'Account Settings';
      default: return 'User Dashboard';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col" id="dashboard-root-layout">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Logo & Platform link */}
          <div className="shrink-0">
            <Logo size="sm" />
          </div>

          <div className="hidden sm:block h-5 w-[1px] bg-gray-200" />

          {/* Active section title */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900 tracking-tight">
              {getTabTitle(currentTab)}
            </span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Catalog Link */}
          <button
            onClick={() => navigate('/')}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl transition-all cursor-pointer"
          >
            <Compass className="w-3.5 h-3.5 text-[#8B5CF6]" />
            Browse Catalog
          </button>

          {/* Notifications Bell */}
          <NotificationsBell />

          {/* User Profile Mini badge */}
          <div
            onClick={() => onTabChange('settings')}
            className="flex items-center gap-2.5 pl-2 pr-1 py-1 rounded-full bg-gray-100 hover:bg-gray-200 border border-gray-200 cursor-pointer transition-colors"
            title="Profile Settings"
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile?.full_name || 'User'}
                className="w-7 h-7 rounded-full object-cover border border-[#8B5CF6]"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[#8B5CF6] text-white font-bold text-xs flex items-center justify-center border border-[#8B5CF6]">
                {(profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-xs font-semibold text-gray-900 hidden lg:inline max-w-[120px] truncate">
              {profile?.full_name || user?.email?.split('@')[0] || 'User'}
            </span>
          </div>

          {/* Logout button */}
          <button
            id="dashboard-logout-btn"
            onClick={handleLogout}
            className="p-2 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
            title="Log out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Body Container: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop / Tablet Sidebar */}
        <aside
          id="dashboard-sidebar"
          className={`hidden md:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 select-none ${
            sidebarCollapsed ? 'w-20' : 'w-64'
          }`}
        >
          {/* Navigation links */}
          <div className="p-3 space-y-1 flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`dashboard-nav-tab-${item.id}`}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-2xl text-[14px] font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#F3E8FF] text-[#8B5CF6]'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-[#8B5CF6]' : 'text-gray-600'}`} />
                  {!sidebarCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick links & Collapse toggle */}
          <div className="p-3 border-t border-gray-100 space-y-1">
            <button
              onClick={() => navigate('/')}
              className="w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-xs font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              <Home className="w-4 h-4 shrink-0 text-gray-600" />
              {!sidebarCollapsed && <span>Home Feed</span>}
            </button>

            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full flex items-center justify-center p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors cursor-pointer"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <div className="flex items-center gap-2 text-[11px]">
                  <ChevronLeft className="w-4 h-4" />
                  <span>Collapse Sidebar</span>
                </div>
              )}
            </button>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        id="dashboard-mobile-bottom-nav"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-gray-200 px-2 py-2 flex items-center justify-around"
      >
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl text-[10px] font-medium transition-all cursor-pointer ${
                isActive
                  ? 'text-[#8B5CF6] font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
        {/* Settings button on mobile */}
        <button
          onClick={() => onTabChange('settings')}
          className={`flex flex-col items-center gap-1 py-1 px-2 rounded-xl text-[10px] font-medium transition-all ${
            currentTab === 'settings'
              ? 'text-[#FFB300] font-bold'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <SettingsIcon className="w-5 h-5" />
          <span>Settings</span>
        </button>
      </nav>
    </div>
  );
};
