import React, { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { BookOpen, User, Music, ShieldAlert, Sparkles, HelpCircle, ArrowRight, Zap, RefreshCw, Key } from "lucide-react";

export default function Guides() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentCategory = searchParams.get("category") || "user";

  const categories = [
    { id: "user", label: "User Manual", icon: User },
    { id: "artist", label: "Artist Guide", icon: Music },
    { id: "master", label: "Master Manual", icon: ShieldAlert }
  ];

  const handleCategoryChange = (catId: string) => {
    setSearchParams({ category: catId });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#090909] text-gray-900 dark:text-gray-100 py-10 px-4 md:px-8 transition-colors duration-200">
      <div className="max-w-4xl mx-auto">
        
        {/* Header section styled with ambient border */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 text-xs font-black uppercase tracking-wider mb-4 border border-amber-500/10">
            <Sparkles className="w-3.5 h-3.5" /> Direct Support Manuals
          </div>
          <h1 className="text-4xl font-black text-gray-900 dark:text-white uppercase tracking-tight mb-2">
            PAYTUNE Help Center & Guides
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-xl mx-auto font-medium">
            Learn how to make the most of the platform. Select an interactive manual below to find detailed answers instantly.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex justify-center gap-2 mb-8 bg-white dark:bg-[#111] p-1.5 rounded-2xl border border-gray-100 dark:border-[#222] shadow-sm max-w-md mx-auto">
          {categories.map((cat) => {
            const isActive = currentCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleCategoryChange(cat.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${
                  isActive
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-[#181818]"
                }`}
              >
                <cat.icon className="w-4 h-4" />
                <span className="hidden sm:inline">{cat.label}</span>
                <span className="sm:hidden">{cat.label.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>

        {/* Guides layout */}
        <div className="bg-white dark:bg-[#111] border border-gray-100 dark:border-[#222] rounded-[32px] p-6 md:p-10 shadow-sm transition-colors">
          
          {currentCategory === "user" && (
            <div className="space-y-8 text-sm text-gray-650 dark:text-gray-300">
              <div className="border-b border-gray-100 dark:border-[#222] pb-4">
                <span className="text-lg font-black text-gray-950 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <User className="text-amber-500 w-5 h-5" /> Fan User Manual
                </span>
                <p className="text-xs text-gray-400 mt-1">Everything a fan needs to purchase, stream, and support local artists.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 bg-gray-50 dark:bg-black/30 border border-gray-200/55 dark:border-[#222] rounded-2xl">
                  <h4 className="font-extrabold text-gray-900 dark:text-white uppercase tracking-wider text-xs mb-2">1. Browsing & Watching</h4>
                  <p className="text-xs leading-relaxed">
                    Access high quality local releases. Click any music card to play it. Standard releases have a 30-second free public preview, 
                    after which the paywall activates. Enjoy horizontal full music experiences or explore vertical free musical feed on Shorts menu.
                  </p>
                </div>

                <div className="p-5 bg-gray-50 dark:bg-black/30 border border-gray-200/55 dark:border-[#222] rounded-2xl">
                  <h4 className="font-extrabold text-gray-900 dark:text-white uppercase tracking-wider text-xs mb-2">2. Single-Payment Purchase</h4>
                  <p className="text-xs leading-relaxed">
                    Trigger payment using your MTN Mobile Money number or Airtel details. Enter your phone number during the checkout popups, 
                    confirm payment, and gain lifetime access to stream the music as premium and high definition coordinates. No monthly subscription fees.
                  </p>
                </div>

                <div className="p-5 bg-gray-50 dark:bg-black/30 border border-gray-200/55 dark:border-[#222] rounded-2xl">
                  <h4 className="font-extrabold text-gray-900 dark:text-white uppercase tracking-wider text-xs mb-2">3. Library, Playlist & History</h4>
                  <p className="text-xs leading-relaxed">
                    Every purchased video is synced permanently to your secure Library. Organize releases using the custom Playlist creator, 
                    like favorite songs, or access your History tab to continue watching exactly where you left off.
                  </p>
                </div>

                <div className="p-5 bg-gray-50 dark:bg-black/30 border border-gray-200/55 dark:border-[#222] rounded-2xl">
                  <h4 className="font-extrabold text-gray-900 dark:text-white uppercase tracking-wider text-xs mb-2">4. Subscriptions & Memberships</h4>
                  <p className="text-xs leading-wider">
                    Follow artists to secure notifications on fresh uploads. Additionally, join an artist's premium Channel Membership 
                    tier (if enabled) to unlock exclusive behind-the-scenes content in exchange for recurring support.
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentCategory === "artist" && (
            <div className="space-y-8 text-sm text-gray-650 dark:text-gray-300">
              <div className="border-b border-gray-100 dark:border-[#222] pb-4">
                <span className="text-lg font-black text-gray-950 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <Music className="text-amber-500 w-5 h-5" /> Creator Studio Guide
                </span>
                <p className="text-xs text-gray-400 mt-1">Unlock monetization, upload configurations, analytics, and live broadcasts.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-5 bg-gray-50 dark:bg-black/30 border border-gray-200/55 dark:border-[#222] rounded-2xl">
                  <h4 className="font-extrabold text-gray-900 dark:text-white uppercase tracking-wider text-xs mb-2">1. Uploading Audio-Visual Releases</h4>
                  <p className="text-xs leading-relaxed">
                    Upload horizontal standard music tracks or vertical shorts (under 50 seconds). Drag and drop your files or browse them. 
                    Configure custom pricing (e.g. 100 RWF for single releases or free). The platform converts files into reliable streaming paths otomatis.
                  </p>
                </div>

                <div className="p-5 bg-gray-50 dark:bg-black/30 border border-gray-200/55 dark:border-[#222] rounded-2xl">
                  <h4 className="font-extrabold text-gray-900 dark:text-white uppercase tracking-wider text-xs mb-2">2. Live Streaming Core</h4>
                  <p className="text-xs leading-relaxed">
                    Access your Creator Go-Live dashboard node. Initiate stream credentials to receive your custom RTMP stream key and server endpoint. 
                    Configure OBS to stream directly to viewers, communicate with live chat fans, and accept simulated "Super Thanks" cash gifts.
                  </p>
                </div>

                <div className="p-5 bg-gray-50 dark:bg-black/30 border border-gray-200/55 dark:border-[#222] rounded-2xl">
                  <h4 className="font-extrabold text-gray-900 dark:text-white uppercase tracking-wider text-xs mb-2">3. Studio Analytics Suite</h4>
                  <p className="text-xs leading-relaxed">
                    Inspect complete views, watch-times, subscriber metrics, and device demographic variables on YouTube-style charts. 
                    Deduce your top-earning tracks and track geographic viewer concentrations instantly.
                  </p>
                </div>

                <div className="p-5 bg-gray-50 dark:bg-black/30 border border-gray-200/55 dark:border-[#222] rounded-2xl">
                  <h4 className="font-extrabold text-gray-900 dark:text-white uppercase tracking-wider text-xs mb-2">4. Disbursals & Earnings</h4>
                  <p className="text-xs leading-relaxed">
                    View net payouts allocated from the 70/30 split logic immediately. Request manual mobile money payouts via the balance 
                    withdrawal tab when triggering values are &gt;= 5,000 RWF. Confirm your phone is registered correctly beforehand.
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentCategory === "master" && (
            <div className="space-y-8 text-sm text-gray-650 dark:text-gray-300">
              <div className="border-b border-gray-100 dark:border-[#222] pb-4">
                <span className="text-lg font-black text-gray-950 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <ShieldAlert className="text-rose-500 w-5 h-5" /> Platform Master Manual
                </span>
                <p className="text-xs text-gray-400 mt-1">Administrator instructions for handling finances, diagnostics, test suites, and compliance logs.</p>
              </div>

              <div className="space-y-4">
                <div className="p-5 bg-rose-500/5 border border-rose-500/10 rounded-2xl">
                  <h4 className="font-black text-rose-500 uppercase tracking-widest text-[10px] mb-2 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" /> Core Administrator Mandates
                  </h4>
                  <ul className="list-decimal pl-5 space-y-2 text-xs leading-relaxed font-bold">
                    <li>
                      <span className="text-gray-900 dark:text-white">Content Compliance Moderation:</span> Review and check uploaded videos. Remove or restrict contents breach of copyrighted guidelines.
                    </li>
                    <li>
                      <span className="text-gray-900 dark:text-white">Withdrawal Approval Audits:</span> Oversee incoming cash disbursements. Authorize payout settlements using Mobile Money transaction details safely.
                    </li>
                    <li>
                      <span className="text-gray-900 dark:text-white">Safe Impersonation Sessions:</span> Log in to any registered creator's session using the "Eye" button to identify issues and assist them with settings.
                    </li>
                  </ul>
                </div>

                <div className="p-5 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                  <h4 className="font-black text-amber-500 uppercase tracking-widest text-[10px] mb-2 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" /> System Diagnostics Console Manual
                  </h4>
                  <p className="text-xs leading-relaxed mb-3">
                    A newly designed Diagnostics system is available for Master owners to trace database layers, inspect environmental variables, 
                    and verify system status.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] leading-relaxed">
                    <div>
                      <p className="font-extrabold text-gray-900 dark:text-white flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin text-amber-500" /> E2E Automated Verification Test</p>
                      <p className="text-gray-400 mt-0.5">Launches programmatical sandbox scenarios verifying credentials, transcoding media, ledger calculus splits, and websocket chat handshakes with visual log stream outputs.</p>
                    </div>
                    <div>
                      <p className="font-extrabold text-gray-900 dark:text-white flex items-center gap-1"><Key className="w-3 h-3 text-amber-500" /> Database Backup & Restorer</p>
                      <p className="text-gray-400 mt-0.5">Allows manual downloading of the mock JSON database layer, syncing state updates, or drag-and-dropping json files to restore historical registries safely.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Back navigation */}
        <div className="mt-8 text-center flex items-center justify-center gap-4 text-xs font-black uppercase tracking-wider">
          <Link to="/" className="text-gray-400 hover:text-amber-500 flex items-center gap-1">
            Home Core
          </Link>
        </div>

      </div>
    </div>
  );
}
