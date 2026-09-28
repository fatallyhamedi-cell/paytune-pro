import React, { useState, useRef } from 'react';
import { 
  User, 
  Phone, 
  Smartphone, 
  Globe, 
  Bell, 
  Save, 
  CheckCircle2, 
  Camera, 
  Image as ImageIcon,
  ShieldCheck,
  Upload,
  Loader2
} from 'lucide-react';
import axios from 'axios';

interface SettingsTabProps {
  artist: any;
  onUpdateSuccess: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ artist, onUpdateSuccess }) => {
  const [fullName, setFullName] = useState(artist?.full_name || artist?.name || '');
  const [stageName, setStageName] = useState(artist?.username || '');
  const [bio, setBio] = useState(artist?.bio || '');
  const [category, setCategory] = useState(artist?.genre || artist?.category || 'Afrobeat');
  const [avatarUrl, setAvatarUrl] = useState(artist?.avatar_url || artist?.profile_image || '');
  const [bannerUrl, setBannerUrl] = useState(artist?.banner_url || artist?.banner_image || '');

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const handleDeviceUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'banner') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append(type, file);
    formData.append('file', file);

    try {
      if (type === 'avatar') setUploadingAvatar(true);
      else setUploadingBanner(true);

      const endpoint = type === 'banner' ? '/api/upload/banner' : '/api/upload/avatar';
      const res = await axios.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.url) {
        if (type === 'avatar') {
          setAvatarUrl(res.data.url);
        } else {
          setBannerUrl(res.data.url);
        }
      }
    } catch (err) {
      console.error(`Failed to upload ${type}:`, err);
    } finally {
      if (type === 'avatar') setUploadingAvatar(false);
      else setUploadingBanner(false);
    }
  };

  // Mobile Money Numbers
  const [mtnMomo, setMtnMomo] = useState(artist?.momo_code || artist?.phone || '');
  const [airtelMoney, setAirtelMoney] = useState(artist?.airtel_money || '');
  const [primaryPayout, setPrimaryPayout] = useState<'mtn' | 'airtel'>(artist?.momo_provider === 'Airtel' ? 'airtel' : 'mtn');

  // Social Links
  const [youtube, setYoutube] = useState(artist?.social_links?.youtube || '');
  const [instagram, setInstagram] = useState(artist?.social_links?.instagram || '');
  const [twitter, setTwitter] = useState(artist?.social_links?.twitter || '');
  const [spotify, setSpotify] = useState(artist?.social_links?.spotify || '');

  // Notifications
  const [smsPurchaseAlerts, setSmsPurchaseAlerts] = useState(true);
  const [payoutConfirmations, setPayoutConfirmations] = useState(true);
  const [fanCommentAlerts, setFanCommentAlerts] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  React.useEffect(() => {
    if (artist) {
      if (artist.full_name || artist.name) setFullName(artist.full_name || artist.name);
      if (artist.username) setStageName(artist.username);
      if (artist.bio) setBio(artist.bio);
      if (artist.genre || artist.category) setCategory(artist.genre || artist.category);
      if (artist.avatar_url || artist.profile_image) setAvatarUrl(artist.avatar_url || artist.profile_image);
      if (artist.banner_url || artist.banner_image) setBannerUrl(artist.banner_url || artist.banner_image);
      if (artist.momo_code || artist.phone) setMtnMomo(artist.momo_code || artist.phone);
      if (artist.airtel_money) setAirtelMoney(artist.airtel_money);
      if (artist.social_links?.youtube) setYoutube(artist.social_links.youtube);
      if (artist.social_links?.instagram) setInstagram(artist.social_links.instagram);
      if (artist.social_links?.twitter) setTwitter(artist.social_links.twitter);
      if (artist.social_links?.spotify) setSpotify(artist.social_links.spotify);
    }
  }, [artist]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    try {
      await Promise.allSettled([
        axios.put('/api/artist/profile', {
          full_name: fullName,
          bio,
          avatar_url: avatarUrl,
          banner_url: bannerUrl,
          momo_code: primaryPayout === 'mtn' ? mtnMomo : airtelMoney,
          payout_provider: primaryPayout === 'mtn' ? 'MTN Mobile Money' : 'Airtel Money',
          youtube,
          instagram,
          twitter,
          spotify
        }),
        axios.put('/api/artist/settings/notifications', {
          notify_purchases: smsPurchaseAlerts,
          notify_withdrawals: payoutConfirmations,
          notify_comments: fanCommentAlerts,
          notify_subscribers: true
        })
      ]);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onUpdateSuccess();
    } catch (err) {
      console.error("Failed to save settings:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-white">Studio Profile & Payout Settings</h2>
          <p className="text-xs text-gray-400">
            Configure your public artist presence, Rwandan mobile money payout routing, and notification alerts
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-xl bg-[#FFB300] text-black font-black text-xs hover:bg-[#ffc107] transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 self-start sm:self-auto"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Saving Settings...' : 'Save Settings'}</span>
        </button>
      </div>

      {saved && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 font-bold">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Studio settings updated successfully.</span>
        </div>
      )}

      {/* 1. Artist Branding & Profile */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <User className="w-4 h-4 text-[#FFB300]" />
          <span>Artist Profile & Visual Identity</span>
        </h3>

        {/* Hidden File Inputs for Device Upload */}
        <input 
          type="file" 
          ref={avatarInputRef} 
          accept="image/png, image/jpeg, image/gif, image/webp" 
          className="hidden" 
          onChange={(e) => handleDeviceUpload(e, 'avatar')} 
        />
        <input 
          type="file" 
          ref={bannerInputRef} 
          accept="image/png, image/jpeg, image/gif, image/webp" 
          className="hidden" 
          onChange={(e) => handleDeviceUpload(e, 'banner')} 
        />

        {/* Banner and Avatar preview with device upload */}
        <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#121212] h-44 group">
          {bannerUrl ? (
            <img
              src={bannerUrl}
              alt="Channel banner"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-neutral-900 via-neutral-800 to-amber-950/40 flex items-center justify-center text-neutral-600">
              <ImageIcon className="w-8 h-8 opacity-40" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
          
          {/* Change Banner Button */}
          <button
            type="button"
            onClick={() => bannerInputRef.current?.click()}
            disabled={uploadingBanner}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/75 hover:bg-black text-white text-xs font-semibold border border-white/20 flex items-center gap-1.5 backdrop-blur-sm transition-all cursor-pointer shadow-lg"
          >
            {uploadingBanner ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FFB300]" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Camera className="w-3.5 h-3.5 text-[#FFB300]" />
                <span>Change Banner</span>
              </>
            )}
          </button>

          <div className="absolute bottom-4 left-4 flex items-center gap-4">
            <div 
              onClick={() => avatarInputRef.current?.click()}
              className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-[#FFB300] shadow-xl bg-neutral-900 cursor-pointer group/avatar shrink-0"
              title="Click to upload profile photo from device"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-black font-black text-xl">
                  {fullName ? fullName.charAt(0).toUpperCase() : 'A'}
                </div>
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity">
                {uploadingAvatar ? (
                  <Loader2 className="w-5 h-5 text-[#FFB300] animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-lg font-black text-white">{fullName}</h4>
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="text-[11px] text-[#FFB300] hover:underline font-bold"
                >
                  Change Avatar
                </button>
              </div>
              <p className="text-xs text-neutral-400 font-semibold">@{stageName}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
              Stage Name / Brand
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#FFB300]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
              Handle / Username
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-xs text-gray-500 font-bold">@</span>
              <input
                type="text"
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl pl-8 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#FFB300]"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
            Artist Biography
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#FFB300] resize-none"
          />
        </div>
      </div>

      {/* 2. Rwandan Mobile Money Payout Routing */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-[#FFB300]" />
            <span>Mobile Money Payout Configuration (Rwanda)</span>
          </h3>
          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded uppercase">
            Direct SIM Settlement
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={`p-4 rounded-xl border transition-all ${
            primaryPayout === 'mtn' ? 'border-[#FFB300] bg-amber-500/5' : 'border-white/10 bg-[#1A1A1A]'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-[#FFB300]" />
                MTN Mobile Money
              </span>
              <button
                type="button"
                onClick={() => setPrimaryPayout('mtn')}
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  primaryPayout === 'mtn'
                    ? 'bg-[#FFB300] text-black'
                    : 'bg-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {primaryPayout === 'mtn' ? 'Primary' : 'Set Primary'}
              </button>
            </div>
            <input
              type="tel"
              value={mtnMomo}
              onChange={(e) => setMtnMomo(e.target.value)}
              placeholder="078XXXXXXX"
              className="w-full bg-[#161616] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFB300]"
            />
          </div>

          <div className={`p-4 rounded-xl border transition-all ${
            primaryPayout === 'airtel' ? 'border-[#FFB300] bg-amber-500/5' : 'border-white/10 bg-[#1A1A1A]'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-white flex items-center gap-2">
                <Phone className="w-4 h-4 text-red-400" />
                Airtel Money
              </span>
              <button
                type="button"
                onClick={() => setPrimaryPayout('airtel')}
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  primaryPayout === 'airtel'
                    ? 'bg-[#FFB300] text-black'
                    : 'bg-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {primaryPayout === 'airtel' ? 'Primary' : 'Set Primary'}
              </button>
            </div>
            <input
              type="tel"
              value={airtelMoney}
              onChange={(e) => setAirtelMoney(e.target.value)}
              placeholder="073XXXXXXX"
              className="w-full bg-[#161616] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFB300]"
            />
          </div>
        </div>
      </div>

      {/* 3. Social Media & External Channels */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#FFB300]" />
          <span>Social Media & Digital Streaming Profiles</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">YouTube Channel URL</label>
            <input
              type="url"
              value={youtube}
              onChange={(e) => setYoutube(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFB300]"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Instagram Profile</label>
            <input
              type="url"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFB300]"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Twitter / X</label>
            <input
              type="url"
              value={twitter}
              onChange={(e) => setTwitter(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFB300]"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Spotify Artist Link</label>
            <input
              type="url"
              value={spotify}
              onChange={(e) => setSpotify(e.target.value)}
              className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#FFB300]"
            />
          </div>
        </div>
      </div>

      {/* 4. Notification Preferences */}
      <div className="bg-[#161616] border border-white/5 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#FFB300]" />
          <span>Real-time Alerts & Notifications</span>
        </h3>

        <div className="space-y-3 divide-y divide-white/5">
          <div className="pt-2 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">SMS Purchase Alerts</span>
              <span className="text-[11px] text-gray-400">Receive instant SMS notification on each paid video unlock</span>
            </div>
            <input
              type="checkbox"
              checked={smsPurchaseAlerts}
              onChange={(e) => setSmsPurchaseAlerts(e.target.checked)}
              className="w-4 h-4 accent-[#FFB300]"
            />
          </div>

          <div className="pt-3 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">Payout Confirmation Emails</span>
              <span className="text-[11px] text-gray-400">Receive digital receipts when withdrawals are completed</span>
            </div>
            <input
              type="checkbox"
              checked={payoutConfirmations}
              onChange={(e) => setPayoutConfirmations(e.target.checked)}
              className="w-4 h-4 accent-[#FFB300]"
            />
          </div>

          <div className="pt-3 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-white block">Fan Comments & Reactions</span>
              <span className="text-[11px] text-gray-400">Notify me when fans comment on my releases</span>
            </div>
            <input
              type="checkbox"
              checked={fanCommentAlerts}
              onChange={(e) => setFanCommentAlerts(e.target.checked)}
              className="w-4 h-4 accent-[#FFB300]"
            />
          </div>
        </div>
      </div>
    </form>
  );
};
