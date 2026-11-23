import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, Loader2, CheckCircle2 } from 'lucide-react';
import api from '../../../services/api';
import CoverBannerEditor, { BannerPreset } from '../../CoverBannerEditor';
import AvatarUpload from '../../AvatarUpload';
import { useArtistAuth } from '../../../contexts/ArtistAuthContext';

export default function BannersUploadTab() {
  const { refreshArtist } = useArtistAuth();
  const [artist, setArtist] = useState<any>(null);
  const [preset, setPreset] = useState<BannerPreset>('channel_cover');
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get('/artist/profile')
      .then((res) => setArtist(res.data?.artist || null))
      .catch(() => setArtist(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center gap-2 text-xs text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
        <span>Loading channel artwork studio...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-purple-600" />
            Channel Cover, Promotional Banners & Avatar Studio
          </h3>
          <p className="text-xs text-gray-500 dark:text-neutral-400">
            Configure responsive TV, desktop, tablet, and mobile framing before saving live to Supabase Storage.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(['channel_cover', 'promo_banner', 'avatar'] as BannerPreset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                preset === p
                  ? 'bg-purple-600 text-white border-purple-600'
                  : 'bg-gray-50 dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 border-gray-200 dark:border-neutral-800'
              }`}
            >
              {p === 'channel_cover' ? 'Channel Cover' : p === 'promo_banner' ? 'Promo Banner' : 'Avatar'}
            </button>
          ))}
        </div>
      </div>

      <CoverBannerEditor
        preset={preset}
        currentUrl={
          preset === 'avatar'
            ? artist?.avatar_url || artist?.profile_image
            : artist?.banner_url || artist?.banner_image
        }
        initialFocalX={artist?.banner_focal_x ?? 50}
        initialFocalY={artist?.banner_focal_y ?? 50}
        initialZoom={artist?.banner_zoom ?? 1}
        artistId={artist?.id}
        onSaved={(data) => {
          setArtist((prev: any) =>
            prev
              ? {
                  ...prev,
                  ...(data.preset === 'avatar'
                    ? { avatar_url: data.url, profile_image: data.url }
                    : data.preset === 'channel_cover'
                    ? {
                        banner_url: data.url,
                        banner_image: data.url,
                        banner_focal_x: data.focal_x,
                        banner_focal_y: data.focal_y,
                        banner_zoom: data.zoom,
                      }
                    : {}),
                }
              : prev
          );
          setNotice(
            data.preset === 'promo_banner'
              ? `Promotional banner uploaded and archived (${data.url}).`
              : `${data.preset === 'avatar' ? 'Channel avatar' : 'Channel cover banner'} updated live.`
          );
          refreshArtist();
        }}
      />

      <div className="p-5 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#141418] flex flex-col sm:flex-row items-center gap-5">
        <AvatarUpload
          currentUrl={artist?.avatar_url || artist?.profile_image}
          onUploaded={(url) => {
            setArtist((prev: any) => (prev ? { ...prev, avatar_url: url, profile_image: url } : prev));
            setNotice('Channel avatar updated across watch cards and livestreams.');
            refreshArtist();
          }}
        />
        <div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-white">Quick Avatar Sync</h4>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
            Immediately updates your artist badge on public music releases, video cards, and chat comments.
          </p>
        </div>
      </div>
    </div>
  );
}
