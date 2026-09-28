import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { uploadDirect } from '../../services/uploadDirect';

export default function ArtistUpload() {
  const navigate = useNavigate();

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

  const [ownershipDeclared, setOwnershipDeclared] = useState(false);
  const [noAiDeclared, setNoAiDeclared] = useState(false);
  const [noCopyrightDeclared, setNoCopyrightDeclared] = useState(false);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const allDeclared = ownershipDeclared && noAiDeclared && noCopyrightDeclared;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!videoFile) return setError('Please select a video file.');
    if (!title.trim()) return setError('Title is required.');
    if (!allDeclared) return setError('You must confirm all three originality declarations.');
    if (!isFree && !isShort) {
      if (!priceRwf || Number(priceRwf) < 200) return setError('Price RWF must be at least 200.');
      if (!priceUsd || Number(priceUsd) < 1) return setError('Price USD must be at least 1.');
    }

    setLoading(true);
    setProgress(0);

    try {
      // Step 1: Upload video directly to Supabase Storage (Bypasses Cloud Run 32 MB cap)
      setSuccess('Uploading video directly to storage...');
      const videoUrl = await uploadDirect('videos', videoFile, (p) => setProgress(Math.round(p * 0.8)));

      // Step 2: Optional thumbnail
      let thumbnailUrl: string | null = null;
      if (thumbFile) {
        setSuccess('Uploading thumbnail...');
        thumbnailUrl = await uploadDirect('thumbnails', thumbFile);
      }

      setProgress(90);
      setSuccess('Finalizing release registration...');

      // Step 3: Tell backend to create the video row
      const res = await api.post('/artist/video/complete', {
        videoUrl,
        thumbnailUrl,
        title: title.trim(),
        description,
        category,
        price_rwf: priceRwf ? Number(priceRwf) : null,
        price_usd: priceUsd ? Number(priceUsd) : null,
        is_free: isFree || isShort,
        is_short: isShort,
        visibility,
        media_type: 'video',
        ownership_declared: ownershipDeclared,
        no_ai_declared: noAiDeclared,
        no_copyright_declared: noCopyrightDeclared,
      });

      setProgress(100);
      setSuccess(res.data?.message || 'Video uploaded successfully! It is now being reviewed by our team.');

      // Redirect after 2.5 seconds
      setTimeout(() => navigate('/artist/dashboard/videos'), 2500);
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.message ||
        'Upload failed. Please try again.';
      setError(msg);
      setSuccess('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-white">Upload Original Video</h1>

      <div className="bg-yellow-500/10 border border-yellow-500/40 text-yellow-300 p-4 rounded-xl mb-4 text-sm">
        Only original videos created by you are allowed. AI-generated videos and copyrighted content are prohibited.
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500 text-red-400 p-3 rounded-xl mb-4 text-sm">
          {error}
        </div>
      )}

      {success && !error && (
        <div className="bg-green-500/20 border border-green-500 text-green-300 p-3 rounded-xl mb-4 text-sm font-semibold">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-gray-300 text-sm mb-2 font-medium">Video file (from your device)</label>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
            className="w-full text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-amber-500 file:text-black hover:file:bg-amber-400 cursor-pointer"
            required
          />
          {videoFile && (
            <p className="text-xs text-gray-400 mt-1 font-mono">
              {videoFile.name} — {(videoFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          )}
        </div>

        <div>
          <label className="block text-gray-300 text-sm mb-2 font-medium">Thumbnail (optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setThumbFile(e.target.files?.[0] || null)}
            className="w-full text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-700 file:text-white hover:file:bg-gray-600 cursor-pointer"
          />
          {thumbFile && (
            <p className="text-xs text-gray-400 mt-1 font-mono">
              {thumbFile.name} — {(thumbFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
          )}
        </div>

        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700 focus:border-amber-500 focus:outline-none"
          required
        />

        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700 focus:border-amber-500 focus:outline-none resize-none"
        />

        <input
          type="text"
          placeholder="Category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700 focus:border-amber-500 focus:outline-none"
        />

        <label className="flex items-center gap-2 text-white cursor-pointer select-none">
          <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} className="rounded" />
          Free
        </label>

        {!isFree && !isShort && (
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              placeholder="Price RWF (min 200)"
              value={priceRwf}
              onChange={(e) => setPriceRwf(e.target.value)}
              className="p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700 focus:border-amber-500 focus:outline-none"
            />
            <input
              type="number"
              step="0.01"
              placeholder="Price USD (min 1)"
              value={priceUsd}
              onChange={(e) => setPriceUsd(e.target.value)}
              className="p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700 focus:border-amber-500 focus:outline-none"
            />
          </div>
        )}

        <label className="flex items-center gap-2 text-white cursor-pointer select-none">
          <input type="checkbox" checked={isShort} onChange={(e) => setIsShort(e.target.checked)} className="rounded" />
          This is a Short (vertical 9:16, ≤50s, always free)
        </label>

        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
          className="w-full p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700 focus:border-amber-500 focus:outline-none"
        >
          <option value="public">Public</option>
          <option value="unlisted">Unlisted</option>
          <option value="private">Private</option>
        </select>

        <div className="bg-[#1A1A1A] p-4 rounded-lg space-y-3 border border-gray-800">
          <p className="text-white font-semibold">Original Content Declaration</p>

          <label className="flex items-start gap-2 text-gray-300 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={ownershipDeclared}
              onChange={(e) => setOwnershipDeclared(e.target.checked)}
              className="mt-1 rounded"
            />
            <span>I created this video myself and own all rights to it.</span>
          </label>

          <label className="flex items-start gap-2 text-gray-300 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={noCopyrightDeclared}
              onChange={(e) => setNoCopyrightDeclared(e.target.checked)}
              className="mt-1 rounded"
            />
            <span>This video does not contain copyrighted music, movies, or stolen content.</span>
          </label>

          <label className="flex items-start gap-2 text-gray-300 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={noAiDeclared}
              onChange={(e) => setNoAiDeclared(e.target.checked)}
              className="mt-1 rounded"
            />
            <span>This video was not created with AI video generators.</span>
          </label>
        </div>

        {loading && (
          <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
            <div
              className="bg-amber-500 h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !allDeclared}
          className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-lg disabled:opacity-50 transition-colors cursor-pointer shadow-lg"
        >
          {loading ? `Uploading ${progress}%...` : 'Upload for Review'}
        </button>

        <p className="text-gray-500 text-xs text-center">
          Your video will be scanned for originality before becoming public.
        </p>
      </form>
    </div>
  );
}
