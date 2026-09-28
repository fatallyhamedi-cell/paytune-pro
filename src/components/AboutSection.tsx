import React from 'react';
import { 
  Globe, 
  Instagram, 
  Twitter, 
  Youtube, 
  Music2, 
  Calendar, 
  Eye, 
  Video, 
  Users, 
  ShieldCheck, 
  Flag,
  ExternalLink
} from 'lucide-react';
import { ArtistProfile } from '../hooks/useArtist';

interface AboutSectionProps {
  artist: ArtistProfile;
  onOpenReportModal: () => void;
}

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return 'March 2024';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return 'March 2024';
  }
}

export default function AboutSection({ artist, onOpenReportModal }: AboutSectionProps) {
  const socials = artist.social_links || {};

  return (
    <div id="channel-about-section" className="grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto py-4">
      {/* Bio and Description (2 cols on large screen) */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-[#161616] p-6 rounded-2xl border border-neutral-800 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Description
          </h2>
          <div className="text-neutral-300 text-sm leading-relaxed whitespace-pre-line">
            {artist.bio || "No description provided for this artist."}
          </div>
        </div>

        {/* Links & Socials */}
        <div className="bg-[#161616] p-6 rounded-2xl border border-neutral-800 space-y-4">
          <h2 className="text-lg font-bold text-white">
            Official Links
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {socials.website && (
              <a
                href={socials.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 text-sm text-neutral-200 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <Globe className="w-4 h-4 text-[#FFB300]" />
                  <span>Official Website</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white" />
              </a>
            )}

            {socials.instagram && (
              <a
                href={socials.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 text-sm text-neutral-200 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <Instagram className="w-4 h-4 text-pink-500" />
                  <span>Instagram</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white" />
              </a>
            )}

            {socials.twitter && (
              <a
                href={socials.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 text-sm text-neutral-200 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <Twitter className="w-4 h-4 text-sky-400" />
                  <span>Twitter / X</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white" />
              </a>
            )}

            {socials.youtube && (
              <a
                href={socials.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 text-sm text-neutral-200 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <Youtube className="w-4 h-4 text-red-500" />
                  <span>YouTube</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white" />
              </a>
            )}

            {socials.spotify && (
              <a
                href={socials.spotify}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 text-sm text-neutral-200 transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <Music2 className="w-4 h-4 text-emerald-400" />
                  <span>Spotify</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-neutral-500 group-hover:text-white" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Channel Stats Sidebar */}
      <div className="space-y-6">
        <div className="bg-[#161616] p-6 rounded-2xl border border-neutral-800 space-y-5">
          <h2 className="text-lg font-bold text-white border-b border-neutral-800 pb-3">
            Stats
          </h2>

          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm">
              <Calendar className="w-4 h-4 text-[#FFB300] shrink-0" />
              <div>
                <p className="text-xs text-neutral-400">Joined</p>
                <p className="font-semibold text-white">{formatDate(artist.join_date)}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Eye className="w-4 h-4 text-[#FFB300] shrink-0" />
              <div>
                <p className="text-xs text-neutral-400">Total Views</p>
                <p className="font-semibold text-white">{(artist.total_views || 0).toLocaleString()} views</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Users className="w-4 h-4 text-[#FFB300] shrink-0" />
              <div>
                <p className="text-xs text-neutral-400">Followers</p>
                <p className="font-semibold text-white">{(artist.subscriber_count || 0).toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <Video className="w-4 h-4 text-[#FFB300] shrink-0" />
              <div>
                <p className="text-xs text-neutral-400">Videos Published</p>
                <p className="font-semibold text-white">{artist.video_count || 0} videos</p>
              </div>
            </div>

            {artist.is_verified && (
              <div className="flex items-center gap-3 text-sm pt-2 border-t border-neutral-800/80">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-semibold text-white">Verified Channel</p>
                  <p className="text-xs text-neutral-400">Verified PAYTUNE Partner Artist</p>
                </div>
              </div>
            )}
          </div>

          {/* Report Channel Action */}
          <div className="pt-4 border-t border-neutral-800">
            <button
              onClick={onOpenReportModal}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-xs font-semibold text-neutral-400 hover:text-red-400 border border-neutral-800 transition-colors"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Report Channel</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
