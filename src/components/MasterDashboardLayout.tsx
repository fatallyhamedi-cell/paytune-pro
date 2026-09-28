import React, { useState } from "react";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Video,
  CreditCard,
  ArrowDownCircle,
  Settings,
  BarChart3,
  FileText,
  Activity,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Sun,
  Moon,
  Zap,
  ExternalLink,
  ChevronRight,
  Scale,
  Megaphone
} from "lucide-react";
import Logo from "./Logo";

export type MasterTab =
  | "overview"
  | "artists"
  | "users"
  | "videos"
  | "ads"
  | "payments"
  | "withdrawals"
  | "copyright"
  | "settings"
  | "reports"
  | "logs"
  | "diagnostics";

interface MasterDashboardLayoutProps {
  activeTab: MasterTab;
  onTabChange: (tab: MasterTab) => void;
  pendingApprovals?: number;
  pendingWithdrawals?: number;
  autoApproveActive?: boolean;
  onToggleAutoApprove?: () => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const MasterDashboardLayout: React.FC<MasterDashboardLayoutProps> = ({
  activeTab,
  onTabChange,
  pendingApprovals = 0,
  pendingWithdrawals = 0,
  autoApproveActive = false,
  onToggleAutoApprove,
  onLogout,
  children
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const navItems = [
    { id: "overview" as MasterTab, label: "Overview", icon: LayoutDashboard },
    {
      id: "artists" as MasterTab,
      label: "Artists",
      icon: Users,
      badge: pendingApprovals > 0 ? pendingApprovals : undefined
    },
    { id: "users" as MasterTab, label: "Users", icon: UserCheck },
    { id: "videos" as MasterTab, label: "Videos", icon: Video },
    { id: "ads" as MasterTab, label: "Ads & Monetization", icon: Megaphone },
    { id: "payments" as MasterTab, label: "Payments", icon: CreditCard },
    {
      id: "withdrawals" as MasterTab,
      label: "Withdrawals",
      icon: ArrowDownCircle,
      badge: pendingWithdrawals > 0 ? pendingWithdrawals : undefined,
      badgeColor: "bg-amber-500 text-neutral-950 font-bold"
    },
    { id: "copyright" as MasterTab, label: "Copyright & DMCA", icon: Scale },
    { id: "settings" as MasterTab, label: "Platform Settings", icon: Settings },
    { id: "reports" as MasterTab, label: "Reports & Analytics", icon: BarChart3 },
    { id: "logs" as MasterTab, label: "Audit Logs", icon: FileText },
    { id: "diagnostics" as MasterTab, label: "System Diagnostics", icon: Activity }
  ];

  const handleTabSelect = (tab: MasterTab) => {
    onTabChange(tab);
    setMobileMenuOpen(false);
  };

  const getPageTitle = (tab: MasterTab) => {
    switch (tab) {
      case "overview": return "Master Dashboard Overview";
      case "artists": return "Artist Management & Verification";
      case "users": return "User Management & Consumer Accounts";
      case "videos": return "Video Catalog & Visibility Control";
      case "ads": return "Video Ads & Monetization Center";
      case "payments": return "Revenue & Financial Transactions";
      case "withdrawals": return "Mobile Money Payout Requests";
      case "copyright": return "Copyright Protection & DMCA Center";
      case "settings": return "Global Platform Configuration";
      case "reports": return "Analytical Reports & Growth";
      case "logs": return "Administrative Audit Logs";
      case "diagnostics": return "System Diagnostics & Telemetry";
      default: return "Master Control Center";
    }
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-[#0F0F0F] text-neutral-100' : 'bg-neutral-50 text-neutral-900'} flex flex-col`}>
      {/* Mobile Top Header */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-[#1A1A1A] border-b border-neutral-800">
        <div className="flex items-center space-x-2">
          <Logo size="sm" />
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono font-bold">
            MASTER
          </span>
        </div>
        <button
          id="btn-toggle-mobile-menu"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar for Desktop & Mobile Overlay */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#141414] border-r border-neutral-800/80 flex flex-col justify-between transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:h-screen ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Sidebar Top: Branding */}
          <div className="p-4 border-b border-neutral-800/80">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Logo size="sm" />
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500 text-neutral-950 font-black tracking-widest uppercase">
                  MASTER
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 flex items-center gap-1 font-medium pl-1">
                <ShieldCheck className="w-3 h-3 text-amber-400 inline" /> Master Admin Console
              </p>
            </div>

            {/* Quick Auto-Approve Toggle in Sidebar */}
            {onToggleAutoApprove && (
              <div className="mt-4 pt-3 border-t border-neutral-800/60 flex items-center justify-between text-xs">
                <span className="text-neutral-400 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Auto-Approval
                </span>
                <button
                  id="btn-sidebar-toggle-auto-approve"
                  onClick={onToggleAutoApprove}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    autoApproveActive
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-neutral-800 text-neutral-400 hover:text-neutral-200 border border-neutral-700"
                  }`}
                >
                  {autoApproveActive ? "ENABLED" : "DISABLED"}
                </button>
              </div>
            )}
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-master-${item.id}`}
                  onClick={() => handleTabSelect(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-amber-500 text-neutral-950 font-bold shadow-md shadow-amber-500/15"
                      : "text-neutral-300 hover:bg-neutral-800/70 hover:text-white"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-4 h-4 ${isActive ? "text-neutral-950" : "text-neutral-400"}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded-full ${
                        item.badgeColor || (isActive ? "bg-neutral-950 text-amber-400" : "bg-amber-500/20 text-amber-400")
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar Bottom: Admin Profile & Logout */}
          <div className="p-4 border-t border-neutral-800/80 bg-neutral-950/40">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-neutral-800 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xs">
                  MA
                </div>
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold text-white truncate">master@paytune.com</p>
                  <p className="text-[10px] text-amber-400/80 truncate">Super Administrator</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="flex-1 flex items-center justify-center space-x-1.5 py-2 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs transition-colors"
              >
                <span>Live App</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <button
                id="btn-master-logout"
                onClick={onLogout}
                className="flex items-center justify-center p-2 rounded-lg bg-neutral-800/80 hover:bg-red-500/20 hover:text-red-400 text-neutral-400 text-xs transition-colors cursor-pointer"
                title="Log out of Master Console"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Backdrop for mobile */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/70 backdrop-blur-xs lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* Top Bar Header */}
          <header className={`px-6 py-4 border-b flex items-center justify-between ${
            isDarkMode ? "bg-[#141414]/90 border-neutral-800 backdrop-blur-md" : "bg-white border-neutral-200"
          }`}>
            <div>
              <div className="flex items-center text-xs text-neutral-400 space-x-1 mb-1">
                <span>PAYTUNE Platform</span>
                <ChevronRight className="w-3 h-3" />
                <span className="text-amber-400 font-medium">Master Dashboard</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight">{getPageTitle(activeTab)}</h1>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center space-x-3">
              {/* Auto Approval Status Badge */}
              <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-neutral-800/60 border border-neutral-700/60 text-xs">
                <span className="text-neutral-400 font-medium">Artist Auto-Approval:</span>
                <span className={`font-bold flex items-center gap-1 ${autoApproveActive ? "text-emerald-400" : "text-neutral-400"}`}>
                  <span className={`w-2 h-2 rounded-full ${autoApproveActive ? "bg-emerald-400 animate-pulse" : "bg-neutral-500"}`} />
                  {autoApproveActive ? "ON" : "OFF"}
                </span>
              </div>

              {/* Theme toggle */}
              <button
                id="btn-toggle-theme"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                title="Toggle Theme"
              >
                {isDarkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-neutral-700" />}
              </button>

              {/* Status Alert Pills */}
              {(pendingApprovals > 0 || pendingWithdrawals > 0) && (
                <div className="hidden md:flex items-center space-x-2">
                  {pendingApprovals > 0 && (
                    <button
                      onClick={() => onTabChange("artists")}
                      className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-semibold hover:bg-amber-500/30 transition-colors cursor-pointer"
                    >
                      {pendingApprovals} Pending Approval
                    </button>
                  )}
                  {pendingWithdrawals > 0 && (
                    <button
                      onClick={() => onTabChange("withdrawals")}
                      className="px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/30 transition-colors cursor-pointer"
                    >
                      {pendingWithdrawals} Pending Payouts
                    </button>
                  )}
                </div>
              )}
            </div>
          </header>

          {/* Tab Body */}
          <div className="p-6 flex-1">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
