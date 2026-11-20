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

    setLoading(true);
    setProgress(0);

    try {
      const res = await api.post('/artist/video/upload', fd, {
        onUploadProgress: (ev) => {
          if (ev.total) setProgress(Math.round((ev.loaded / ev.total) * 100));
        },
      });

      setSuccess(res.data.message || 'Video uploaded successfully! It is now being reviewed by our team.');

      queryClient.invalidateQueries({ queryKey: ['artist-videos'] });
      queryClient.invalidateQueries({ queryKey: ['videos'] });

      setTimeout(() => navigate('/artist/dashboard/videos'), 2000);
    } catch (err: any) {
      console.error('[Upload] Error:', err.response?.data || err.message);
      setError(err.response?.data?.message || err.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6 sm:p-8 bg-white dark:bg-[#141417] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Upload Video</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Publish original music videos or 9:16 shorts directly to your PAYTUNE channel.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-500 text-red-700 dark:text-red-400 p-3 rounded-xl mb-4 text-sm font-medium">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 dark:bg-green-500/20 border border-emerald-200 dark:border-green-500 text-emerald-700 dark:text-green-300 p-3 rounded-xl mb-4 text-sm font-medium">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-[#1f1f24]">
          <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Video file
          </label>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-gray-700 dark:text-gray-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200 cursor-pointer"
            required
          />
          {videoFile && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 font-medium">
              {videoFile.name} — {(videoFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          )}
        </div>

        <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-4 bg-gray-50 dark:bg-[#1f1f24]">
          <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
            Thumbnail (optional)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setThumbFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-gray-700 dark:text-gray-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-100 file:text-purple-700 hover:file:bg-purple-200 cursor-pointer"
          />
          {thumbFile && (
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 font-medium">
              {thumbFile.name}
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Title
          </label>
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-3 rounded-xl bg-gray-50 dark:bg-[#1f1f24] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Description
          </label>
          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full p-3 rounded-xl bg-gray-50 dark:bg-[#1f1f24] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Category / Genre
          </label>
          <input
            type="text"
            placeholder="Category (e.g. Afrobeat, Gospel, R&B)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full p-3 rounded-xl bg-gray-50 dark:bg-[#1f1f24] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="space-y-2.5 pt-1">
          <label className="flex items-center gap-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer">
            <input
              type="checkbox"
              checked={isFree}
              onChange={(e) => setIsFree(e.target.checked)}
              className="w-4 h-4 accent-purple-600 rounded"
            />
            <span>Free</span>
          </label>

          {!isFree && !isShort && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <input
                type="number"
                placeholder="Price RWF (min 200)"
                value={priceRwf}
                onChange={(e) => setPriceRwf(e.target.value)}
                className="p-3 rounded-xl bg-gray-50 dark:bg-[#1f1f24] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Price USD (min 1)"
                value={priceUsd}
                onChange={(e) => setPriceUsd(e.target.value)}
                className="p-3 rounded-xl bg-gray-50 dark:bg-[#1f1f24] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          )}

          <label className="flex items-center gap-2.5 text-sm font-medium text-gray-900 dark:text-gray-100 cursor-pointer">
            <input
              type="checkbox"
              checked={isShort}
              onChange={(e) => setIsShort(e.target.checked)}
              className="w-4 h-4 accent-purple-600 rounded"
            />
            <span>Short (9:16, ≤50s, always free)</span>
          </label>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
            Visibility
          </label>
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="w-full p-3 rounded-xl bg-gray-50 dark:bg-[#1f1f24] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>
        </div>

        <div className="bg-gray-50 dark:bg-[#1a1a1f] border border-gray-200 dark:border-gray-800 p-4 rounded-xl space-y-3">
          <p className="text-gray-900 dark:text-white font-semibold text-sm">
            Original Content Declaration
          </p>
          <label className="flex items-start gap-2.5 text-gray-700 dark:text-gray-300 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={ownership}
              onChange={(e) => setOwnership(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-purple-600 rounded"
            />
            <span>I created this video and own all rights.</span>
          </label>
          <label className="flex items-start gap-2.5 text-gray-700 dark:text-gray-300 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={noCopyright}
              onChange={(e) => setNoCopyright(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-purple-600 rounded"
            />
            <span>No copyrighted content.</span>
          </label>
          <label className="flex items-start gap-2.5 text-gray-700 dark:text-gray-300 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={noAi}
              onChange={(e) => setNoAi(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-purple-600 rounded"
            />
            <span>Not AI-generated.</span>
          </label>
        </div>

        {loading && (
          <progress
            value={progress}
            max={100}
            className="w-full h-2 rounded-full overflow-hidden appearance-none [&::-webkit-progress-bar]:bg-gray-200 dark:[&::-webkit-progress-bar]:bg-gray-700 [&::-webkit-progress-value]:bg-purple-600 [&::-moz-progress-bar]:bg-purple-600"
          />
        )}

        <button
          type="submit"
          disabled={loading || !allDeclared}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
        >
          {loading ? `Uploading ${progress}%...` : 'Upload Video'}
        </button>
      </form>
    </div>
  );
}
