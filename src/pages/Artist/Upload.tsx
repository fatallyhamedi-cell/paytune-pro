import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';

export default function ArtistUpload() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isFree, setIsFree] = useState(true);
  const [isShort, setIsShort] = useState(false);
  const [priceRwf, setPriceRwf] = useState('');
  const [priceUsd, setPriceUsd] = useState('');
  const [visibility, setVisibility] = useState('public');

  const [ownership, setOwnership] = useState(false);
  const [noAi, setNoAi] = useState(false);
  const [noCopyright, setNoCopyright] = useState(false);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const allDeclared = ownership && noAi && noCopyright;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!videoFile) return setError('Select a video file');
    if (!title.trim()) return setError('Title required');
    if (!allDeclared) return setError('Accept all 3 declarations');
    if (!isFree && !isShort) {
      if (!priceRwf || Number(priceRwf) < 200) return setError('RWF price must be ≥ 200');
      if (!priceUsd || Number(priceUsd) < 1) return setError('USD price must be ≥ 1');
    }

    const fd = new FormData();
    fd.append('video', videoFile);
    if (thumbFile) fd.append('thumbnail', thumbFile);
    fd.append('title', title.trim());
    fd.append('description', description);
    fd.append('category', category || 'Afrobeat');
    fd.append('is_free', String(isFree || isShort));
    fd.append('is_short', String(isShort));
    fd.append('visibility', visibility);
    fd.append('media_type', 'video');
    fd.append('ownership_declared', String(ownership));
    fd.append('no_ai_declared', String(noAi));
    fd.append('no_copyright_declared', String(noCopyright));
    if (!isFree && !isShort) {
      fd.append('price_rwf', priceRwf);
      fd.append('price_usd', priceUsd);
    }

    console.log('[Upload] Starting, file:', videoFile.name, videoFile.size);

    setLoading(true);
    setProgress(0);

    try {
      const res = await api.post('/artist/video/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (ev) => {
          if (ev.total) setProgress(Math.round((ev.loaded / ev.total) * 100));
        },
      });

      console.log('[Upload] ✅ Success:', res.data);
      setSuccess(res.data.message || 'Video uploaded successfully! It is now being reviewed by our team.');

      queryClient.invalidateQueries({ queryKey: ['artist-videos'] });
      queryClient.invalidateQueries({ queryKey: ['videos'] });

      setTimeout(() => navigate('/artist/dashboard/videos'), 2000);
    } catch (err: any) {
      console.error('[Upload] ❌ Error:', err.response?.data || err.message);
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Upload Video</h1>

      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-400 p-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/20 border border-green-500 text-green-300 p-3 rounded mb-4 text-sm">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-gray-300 text-sm mb-2">Video file</label>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
            className="w-full text-white"
            required
          />
          {videoFile && (
            <p className="text-xs text-gray-500 mt-1">
              {videoFile.name} — {(videoFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          )}
        </div>

        <div>
          <label className="block text-gray-300 text-sm mb-2">Thumbnail (optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setThumbFile(e.target.files?.[0] || null)}
            className="w-full text-white"
          />
        </div>

        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700"
          required
        />

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700"
        />

        <input
          type="text"
          placeholder="Category (e.g. Afrobeat, Gospel, R&B)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700"
        />

        <label className="flex items-center gap-2 text-white">
          <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} />
          Free
        </label>

        {!isFree && !isShort && (
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              placeholder="Price RWF (min 200)"
              value={priceRwf}
              onChange={(e) => setPriceRwf(e.target.value)}
              className="p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Price USD (min 1)"
              value={priceUsd}
              onChange={(e) => setPriceUsd(e.target.value)}
              className="p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700"
            />
          </div>
        )}

        <label className="flex items-center gap-2 text-white">
          <input type="checkbox" checked={isShort} onChange={(e) => setIsShort(e.target.checked)} />
          Short (9:16, ≤50s, always free)
        </label>

        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
          className="w-full p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700"
        >
          <option value="public">Public</option>
          <option value="unlisted">Unlisted</option>
          <option value="private">Private</option>
        </select>

        <div className="bg-[#1A1A1A] p-4 rounded-lg space-y-3">
          <p className="text-white font-semibold">Original Content Declaration</p>
          <label className="flex items-start gap-2 text-gray-300 text-sm">
            <input
              type="checkbox"
              checked={ownership}
              onChange={(e) => setOwnership(e.target.checked)}
              className="mt-1"
            />
            <span>I created this video and own all rights.</span>
          </label>
          <label className="flex items-start gap-2 text-gray-300 text-sm">
            <input
              type="checkbox"
              checked={noCopyright}
              onChange={(e) => setNoCopyright(e.target.checked)}
              className="mt-1"
            />
            <span>No copyrighted content.</span>
          </label>
          <label className="flex items-start gap-2 text-gray-300 text-sm">
            <input
              type="checkbox"
              checked={noAi}
              onChange={(e) => setNoAi(e.target.checked)}
              className="mt-1"
            />
            <span>Not AI-generated.</span>
          </label>
        </div>

        {loading && (
          <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
            <div className="bg-amber-500 h-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !allDeclared}
          className="w-full bg-amber-500 text-black font-semibold py-3 rounded-lg disabled:opacity-50 cursor-pointer"
        >
          {loading ? `Uploading ${progress}%...` : 'Upload Video'}
        </button>
      </form>
    </div>
  );
}
