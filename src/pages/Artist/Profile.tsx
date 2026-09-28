import { useEffect, useState } from 'react';
import api from '../../services/api';
import AvatarUpload from '../../components/AvatarUpload';
import BannerUpload from '../../components/BannerUpload';
import { useArtistAuth } from '../../contexts/ArtistAuthContext';

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
      <div className="flex items-center justify-center min-h-[40vh] text-gray-400">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-3" />
        Loading artist profile...
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Channel Profile & Media Branding</h1>
        <p className="text-xs text-gray-400">
          Upload your official artist avatar, banner header, and customize your payout details.
        </p>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-400 p-4 rounded-xl text-sm">
          {error}
        </div>
      )}

      {message && (
        <div className="bg-emerald-500/20 border border-emerald-500 text-emerald-300 p-4 rounded-xl text-sm">
          {message}
        </div>
      )}

      {/* Channel Banner Upload */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-gray-400">Channel Header Banner</label>
        <BannerUpload
          currentUrl={artist.banner_url || artist.banner_image}
          onUploaded={(url) => {
            setArtist({ ...artist, banner_url: url, banner_image: url });
            setMessage('Banner uploaded and saved to your channel!');
            refreshArtist();
          }}
        />
      </div>

      {/* Channel Avatar Upload */}
      <div className="bg-[#161616] p-6 rounded-2xl border border-gray-800 flex items-center gap-6">
        <AvatarUpload
          currentUrl={artist.avatar_url || artist.profile_image}
          onUploaded={(url) => {
            setArtist({ ...artist, avatar_url: url, profile_image: url });
            setMessage('Avatar uploaded and saved to your profile!');
            refreshArtist();
          }}
        />
        <div>
          <h2 className="text-base font-bold text-white">{artist.full_name || 'Artist Avatar'}</h2>
          <p className="text-xs text-gray-400 mt-1">
            Your avatar and banner are uploaded directly from your device and are publicly visible across your video watch pages and channel.
          </p>
          <p className="text-[11px] text-amber-500/90 mt-2 font-mono">
            {artist.email} • {artist.phone || 'No phone'}
          </p>
        </div>
      </div>

      {/* Profile Details Form */}
      <div className="bg-[#161616] p-6 md:p-8 rounded-2xl border border-gray-800 space-y-4">
        <h2 className="text-base font-bold text-white">Artist Information & Payout Destination</h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Stage / Full Name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Bruce Melodie"
              className="w-full p-3.5 rounded-xl bg-[#222] text-white border border-gray-700 focus:border-amber-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1">Artist Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Write your story, musical influences, and upcoming projects for your fans..."
              rows={4}
              className="w-full p-3.5 rounded-xl bg-[#222] text-white border border-gray-700 focus:border-amber-500 focus:outline-none text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">MoMo Provider</label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-[#222] text-white border border-gray-700 focus:border-amber-500 focus:outline-none"
              >
                <option value="MTN">MTN MoMo</option>
                <option value="Airtel">Airtel Money</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">MoMo Payout Number</label>
              <input
                value={momo}
                onChange={(e) => setMomo(e.target.value)}
                placeholder="0788123456"
                className="w-full p-3.5 rounded-xl bg-[#222] text-white border border-gray-700 focus:border-amber-500 focus:outline-none font-mono"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3.5 rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50 text-sm"
          >
            {saving ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
