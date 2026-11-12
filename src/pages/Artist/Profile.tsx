import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import AvatarUpload from '../../components/AvatarUpload';
import CoverBannerEditor from '../../components/CoverBannerEditor';
import { useArtistAuth } from '../../contexts/ArtistAuthContext';
import { Sparkles, ShieldCheck, Check, AlertCircle } from 'lucide-react';

export default function ArtistProfile() {
  const { refreshArtist } = useArtistAuth();
  const [artist, setArtist] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [momo, setMomo] = useState('');
  const [provider, setProvider] = useState('MTN');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    api.get('/artist/profile')
      .then((r) => {
        const a = r.data.artist;
        setArtist(a);
        setFullName(a.full_name || '');
        setBio(a.bio || '');
        setMomo(a.momo_code || a.phone || '');
        setProvider(a.momo_provider || 'MTN');
      })
      .catch((err) => {
        console.error('Failed to load profile:', err);
        setError(err.response?.data?.error || 'Failed to load profile');
      });
  };

  useEffect(() => {
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setSaving(true);
    try {
      await api.put('/artist/profile', {
        full_name: fullName.trim(),
        bio: bio.trim(),
        momo_code: momo.trim(),
        momo_provider: provider,
      });
      setMessage('Profile settings saved successfully!');
      refreshArtist();
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (!artist) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-500 bg-white rounded-2xl p-8 border border-gray-100">
        <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mr-3" />
        Loading artist profile...
      </div>
    );
  }

  const isMonetizedPartner = Boolean(
    artist.monetization_lifetime ||
    artist.monetization_status === 'approved_monetized' ||
    artist.monetization_level === 3
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Page Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
            Channel Branding & Media Studio
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure your YouTube-standard 2560 × 1440 channel cover banner, profile avatar, and instant MoMo payout destination.
          </p>
        </div>

        {isMonetizedPartner && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300 self-start sm:self-auto shadow-sm">
            <Sparkles className="w-4 h-4 text-[#FFB300]" />
            PayTune Lifetime Partner
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-sm flex items-center gap-2">
          <Check className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>{message}</span>
        </div>
      )}

      {/* 1. YouTube-Standard Interactive Channel Cover Banner Editor */}
      <div className="space-y-2">
        <CoverBannerEditor
          currentUrl={artist.banner_url || artist.banner_image}
          initialFocalX={artist.banner_focal_x ?? 50}
          initialFocalY={artist.banner_focal_y ?? 50}
          initialZoom={artist.banner_zoom ?? 1}
          artistId={artist.id}
          onSaved={(data) => {
            setArtist({
              ...artist,
              banner_url: data.url,
              banner_image: data.url,
              banner_focal_x: data.focal_x,
              banner_focal_y: data.focal_y,
              banner_zoom: data.zoom,
            });
            setMessage('Channel cover banner alignment updated and saved successfully!');
            refreshArtist();
          }}
        />
      </div>

      {/* 2. Channel Avatar Upload Card */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row items-center gap-6">
        <div className="shrink-0">
          <AvatarUpload
            currentUrl={artist.avatar_url || artist.profile_image}
            onUploaded={(url) => {
              setArtist({ ...artist, avatar_url: url, profile_image: url });
              setMessage('Avatar uploaded and saved to your profile!');
              refreshArtist();
            }}
          />
        </div>
        <div className="text-center sm:text-left flex-1">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <h2 className="text-lg font-bold text-gray-900">{artist.full_name || 'Official Avatar'}</h2>
            <span className="text-[11px] font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
              1024 × 1024 Master
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1.5 leading-relaxed">
            Your official artist picture appears on all video watch cards, live streaming chats, and subscriber lists. Square 1:1 image recommended.
          </p>
          <div className="flex items-center justify-center sm:justify-start gap-3 mt-3 text-xs text-gray-500">
            <span className="font-mono text-purple-700 font-semibold">{artist.email}</span>
            <span>•</span>
            <span className="font-mono">{artist.phone || 'No phone registered'}</span>
          </div>
        </div>
      </div>

      {/* 3. Profile Details & Payout Destination Form */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-gray-200 shadow-sm space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Stage Identity & Payout Destination</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Keep your legal and stage information up to date to guarantee automatic 70% video split and 40% ad share payouts.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Stage / Full Name <span className="text-red-500">*</span>
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Bruce Melodie"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 text-gray-900 border border-gray-200 focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 focus:outline-none transition-all text-sm font-medium"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">
              Artist Bio / Channel Description
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell your fans about your music, story, upcoming releases, and tour dates..."
              rows={4}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 text-gray-900 border border-gray-200 focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 focus:outline-none transition-all text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                Mobile Money Provider
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 text-gray-900 border border-gray-200 focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 focus:outline-none transition-all text-sm font-medium cursor-pointer"
              >
                <option value="MTN">MTN MoMo (Rwanda / Uganda / Ghana)</option>
                <option value="Airtel">Airtel Money (Rwanda / Kenya / Tanzania)</option>
                <option value="M-Pesa">Safaricom M-Pesa</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1.5">
                MoMo Payout Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                value={momo}
                onChange={(e) => setMomo(e.target.value)}
                placeholder="0788123456"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 text-gray-900 border border-gray-200 focus:bg-white focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 focus:outline-none transition-all text-sm font-mono font-medium"
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm transition-all duration-200 shadow-md shadow-purple-600/20 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{saving ? 'Saving changes...' : 'Save Profile Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
