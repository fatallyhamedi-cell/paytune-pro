import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Video, Smartphone, Music, Megaphone, Image as ImageIcon, FolderKanban } from 'lucide-react';
import VideoUploadTab from '../../components/artist/upload/VideoUploadTab';
import ShortsUploadTab from '../../components/artist/upload/ShortsUploadTab';
import AudioUploadTab from '../../components/artist/upload/AudioUploadTab';
import AdsUploadTab from '../../components/artist/upload/AdsUploadTab';
import BannersUploadTab from '../../components/artist/upload/BannersUploadTab';

type UploadTabId = 'video' | 'shorts' | 'audio' | 'ads' | 'banners';

const TABS: Array<{ id: UploadTabId; label: string; subtitle: string; icon: React.ComponentType<any> }> = [
  { id: 'shorts', label: 'Shorts', subtitle: '9:16 • ≤50s', icon: Smartphone },
  { id: 'audio', label: 'Audio & Podcasts', subtitle: 'Single / EP / Podcast', icon: Music },
  { id: 'video', label: 'Videos', subtitle: 'Full Video & PPV', icon: Video },
  { id: 'ads', label: 'Advertisements', subtitle: 'Campaigns & Creatives', icon: Megaphone },
  { id: 'banners', label: 'Banners & Covers', subtitle: 'Channel Branding', icon: ImageIcon },
];

export default function ArtistUpload() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab') as UploadTabId | null;
  const activeTab: UploadTabId = TABS.some((t) => t.id === rawTab) ? (rawTab as UploadTabId) : 'video';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Studio Upload Center Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
            PAYTUNE Upload Center
          </h1>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-neutral-400 mt-1">
            Upload vertical Shorts, master audio tracks, full-length videos, ad creatives, and responsive channel banners directly to Supabase.
          </p>
        </div>

        <Link
          to="/artist/dashboard/videos"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-900 hover:bg-gray-200 dark:hover:bg-neutral-800 border border-gray-200 dark:border-neutral-800 text-xs font-bold text-gray-900 dark:text-white shrink-0"
        >
          <FolderKanban className="w-4 h-4 text-purple-600" />
          <span>Manage Catalog</span>
        </Link>
      </div>

      {/* 5-Section Format Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSearchParams({ tab: tab.id })}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                isActive
                  ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                  : 'bg-white dark:bg-[#141417] text-gray-700 dark:text-neutral-300 border-gray-200 dark:border-neutral-800 hover:border-purple-400'
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isActive ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-neutral-900 text-purple-600 dark:text-purple-400'
                }`}
              >
                <Icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold truncate">{tab.label}</p>
                <p className={`text-[10px] truncate ${isActive ? 'text-purple-100' : 'text-gray-500 dark:text-neutral-500'}`}>
                  {tab.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Upload Workspace */}
      <div className="p-5 sm:p-6 bg-white dark:bg-[#141417] rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm">
        {activeTab === 'shorts' && <ShortsUploadTab />}
        {activeTab === 'audio' && <AudioUploadTab />}
        {activeTab === 'video' && <VideoUploadTab />}
        {activeTab === 'ads' && <AdsUploadTab />}
        {activeTab === 'banners' && <BannersUploadTab />}
      </div>
    </div>
  );
}
