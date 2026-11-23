import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Smartphone,
  Upload,
  Camera,
  Subtitles,
  CheckCircle2,
  AlertCircle,
  X,
  RotateCcw,
  Calendar,
  FileCheck,
  Loader2,
} from 'lucide-react';
import api from '../../../services/api';
import { useMediaUpload } from '../../../hooks/useMediaUpload';
import { extractVideoMetadataAndFrame, inspectFileSignature, VideoProbeResult } from '../../../services/mediaUploadEngine';

const GENRES = ['Shorts', 'Afrobeat', 'Amapiano', 'Hip Hop', 'R&B', 'Gospel', 'Traditional', 'Comedy', 'Dance'];
const LANGUAGES = [
  { code: 'rw', label: 'Kinyarwanda (RW)' },
  { code: 'en', label: 'English (EN)' },
  { code: 'fr', label: 'Français (FR)' },
  { code: 'sw', label: 'Kiswahili (SW)' },
  { code: 'lg', label: 'Luganda (LG)' },
];

export default function ShortsUploadTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const uploadHook = useMediaUpload();
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null);
  const [probe, setProbe] = useState<VideoProbeResult | null>(null);
  const [probing, setProbing] = useState(false);

  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreviewUrl, setThumbPreviewUrl] = useState<string | null>(null);

  const [captionFile, setCaptionFile] = useState<File | null>(null);
  const [captionLang, setCaptionLang] = useState('en');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Afrobeat');
  const [tags, setTags] = useState('');
  const [languageCode, setLanguageCode] = useState('rw');
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [pubStatus, setPubStatus] = useState<'published' | 'draft' | 'scheduled'>('published');
  const [scheduledAt, setScheduledAt] = useState('');

  const [ownership, setOwnership] = useState(false);
  const [noCopyright, setNoCopyright] = useState(false);
  const [noAi, setNoAi] = useState(false);

  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (videoPreviewUrl) URL.revokeObjectURL(videoPreviewUrl);
      if (thumbPreviewUrl && thumbPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(thumbPreviewUrl);
    };
  }, [videoPreviewUrl, thumbPreviewUrl]);

  const handleVideoSelected = async (file: File | null) => {
    setValidationError(null);
    setSuccessMsg(null);
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
      setVideoPreviewUrl(null);
    }
    setProbe(null);
    setVideoFile(null);

    if (!file) return;

    setProbing(true);
    try {
      const sig = await inspectFileSignature(file, 'video');
      if (!sig.valid) {
        setValidationError(sig.error || 'Unsupported vertical video file.');
        return;
      }

      const info = await extractVideoMetadataAndFrame(file, 0.8);
      if (info.durationSeconds > 50) {
        setValidationError(
          `Shorts must be 50 seconds or less (detected ${info.durationSeconds}s). Trim this clip or use the Full Video tab.`
        );
        return;
      }
      if (info.width > 0 && info.height > 0 && info.aspectRatio > 0.78) {
        setValidationError(
          `Shorts require vertical portrait framing (${info.width}×${info.height}, ratio ${info.aspectRatio.toFixed(2)}). Please upload a 9:16 portrait clip or switch to Full Video.`
        );
        return;
      }

      setVideoFile(file);
      setVideoPreviewUrl(URL.createObjectURL(file));
      setProbe(info);

      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim());
      }

      if (info.frameBlob && !thumbFile) {
        const autoThumb = new File([info.frameBlob], 'short-poster.jpg', { type: 'image/jpeg' });
        setThumbFile(autoThumb);
        if (thumbPreviewUrl && thumbPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(thumbPreviewUrl);
        setThumbPreviewUrl(URL.createObjectURL(autoThumb));
      }
    } catch (err: any) {
      setValidationError(err?.message || 'Unable to inspect video dimensions or duration.');
    } finally {
      setProbing(false);
    }
  };

  const handleCaptureCurrentFrame = async () => {
    const vid = videoPreviewRef.current;
    if (!vid || !vid.videoWidth || !vid.videoHeight) return;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1080 / Math.max(vid.videoWidth, vid.videoHeight));
    canvas.width = Math.max(1, Math.round(vid.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(vid.videoHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
    if (!blob) return;
    const captured = new File([blob], `short-frame-${Math.round(vid.currentTime)}s.jpg`, { type: 'image/jpeg' });
    setThumbFile(captured);
    if (thumbPreviewUrl && thumbPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(thumbPreviewUrl);
    setThumbPreviewUrl(URL.createObjectURL(captured));
  };

  const handleThumbSelected = async (file: File | null) => {
    setValidationError(null);
    if (!file) return;
    const sig = await inspectFileSignature(file, 'image');
    if (!sig.valid) {
      setValidationError(sig.error || 'Invalid thumbnail image file.');
      return;
    }
    setThumbFile(file);
    if (thumbPreviewUrl && thumbPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(thumbPreviewUrl);
    setThumbPreviewUrl(URL.createObjectURL(file));
  };

  const handleCaptionSelected = async (file: File | null) => {
    setValidationError(null);
    if (!file) {
      setCaptionFile(null);
      return;
    }
    const sig = await inspectFileSignature(file, 'caption');
    if (!sig.valid) {
      setValidationError(sig.error || 'Invalid subtitle file.');
      return;
    }
    setCaptionFile(file);
  };

  const allDeclared = ownership && noCopyright && noAi;
  const isBusy = uploadHook.status === 'uploading' || uploadHook.status === 'processing';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setSuccessMsg(null);

    if (!videoFile) return setValidationError('Select a vertical 9:16 video clip (max 50s).');
    if (!title.trim()) return setValidationError('Short title is required.');
    if (!allDeclared) return setValidationError('Accept all three original content declarations.');
    if (pubStatus === 'scheduled') {
      if (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now()) {
        return setValidationError('Choose a future date and time for a scheduled Short.');
      }
    }

    const fd = new FormData();
    fd.append('video', videoFile);
    if (thumbFile) fd.append('thumbnail', thumbFile);
    fd.append('title', title.trim());
    fd.append('description', description.trim());
    fd.append('category', category || 'Shorts');
    fd.append('tags', tags);
    fd.append('language_code', languageCode);
    fd.append('is_free', 'true');
    fd.append('is_short', 'true');
    fd.append('media_type', 'short');
    fd.append('visibility', visibility);
    fd.append('publication_status', pubStatus);
    if (pubStatus === 'scheduled' && scheduledAt) {
      fd.append('scheduled_at', new Date(scheduledAt).toISOString());
    }
    fd.append('ownership_declared', 'true');
    fd.append('no_copyright_declared', 'true');
    fd.append('no_ai_declared', 'true');

    try {
      const res = await uploadHook.upload({ url: '/artist/short/upload', formData: fd });
      const createdId = res?.video?.id;

      if (createdId && captionFile) {
        const capFd = new FormData();
        capFd.append('caption', captionFile);
        capFd.append('language_code', captionLang);
        capFd.append('is_default', 'true');
        await api.post(`/artist/videos/${createdId}/captions`, capFd).catch(() => {});
      }

      setSuccessMsg(
        pubStatus === 'draft'
          ? 'Short saved as private draft.'
          : pubStatus === 'scheduled'
          ? `Short scheduled for ${new Date(scheduledAt).toLocaleString()}.`
          : 'Short uploaded and published live to PAYTUNE Shorts!'
      );
      queryClient.invalidateQueries({ queryKey: ['artist-videos'] });
      queryClient.invalidateQueries({ queryKey: ['shortsFeed'] });
      queryClient.invalidateQueries({ queryKey: ['videos'] });

      setTimeout(() => navigate('/artist/dashboard/videos'), 1600);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setValidationError(err?.message || 'Short upload failed.');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Vertical Preview & Frame Capture */}
      <div className="lg:col-span-5 space-y-4">
        <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-[#121216] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-neutral-300 flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-purple-600" />
              9:16 Vertical Preview
            </span>
            {probe && (
              <span className="text-[11px] font-mono font-semibold text-gray-500 dark:text-neutral-400 tabular-nums">
                {probe.width}×{probe.height} • {probe.durationSeconds}s / 50s
              </span>
            )}
          </div>

          <div className="relative aspect-[9/16] max-h-[460px] mx-auto w-full max-w-[260px] rounded-2xl overflow-hidden bg-black border border-gray-200 dark:border-neutral-800 flex items-center justify-center">
            {probing ? (
              <div className="flex flex-col items-center gap-2 text-xs text-neutral-400">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                <span>Inspecting clip...</span>
              </div>
            ) : videoPreviewUrl ? (
              <video
                ref={videoPreviewRef}
                src={videoPreviewUrl}
                controls
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <label className="w-full h-full flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:bg-white/[0.03] transition-colors">
                <Upload className="w-9 h-9 text-purple-500 mb-3" />
                <span className="text-xs font-bold text-white">Drop 9:16 Vertical Video</span>
                <span className="text-[11px] text-neutral-400 mt-1">MP4, MOV, WebM • Max 50s</span>
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                  onChange={(e) => handleVideoSelected(e.target.files?.[0] || null)}
                />
              </label>
            )}
          </div>

          {videoFile && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <button
                type="button"
                onClick={handleCaptureCurrentFrame}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                Capture Frame Poster
              </button>
              <label className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer">
                Change clip
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                  onChange={(e) => handleVideoSelected(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          )}

          {thumbPreviewUrl && (
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800">
              <img src={thumbPreviewUrl} alt="Short poster" className="w-10 h-16 rounded-lg object-cover shrink-0 border border-gray-200 dark:border-neutral-700" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-900 dark:text-white truncate">Active Poster Cover</p>
                <label className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold cursor-pointer hover:underline">
                  Upload custom cover instead
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleThumbSelected(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: Metadata, Captions, Schedule & Declarations */}
      <div className="lg:col-span-7 space-y-5">
        {validationError && (
          <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-300 text-xs font-semibold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{validationError}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">
            Short Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Kigali Studio Freestyle #Afrobeat"
            maxLength={140}
            className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-600"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">
            Caption / Description & Hashtags
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your clip, shout out producers, or link it to a track..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-600"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">Genre / Mood</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:border-purple-600"
            >
              {GENRES.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">Language</label>
            <select
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:border-purple-600"
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">Visibility</label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as any)}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none focus:border-purple-600"
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted (Direct link)</option>
              <option value="private">Private</option>
            </select>
          </div>
        </div>

        {/* Tags + Optional Subtitles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">Tags (comma separated)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="kigali, freestyle, newmusic"
              className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-purple-600"
            />
          </div>

          <div className="p-3 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-800 dark:text-neutral-200 flex items-center gap-1.5">
                <Subtitles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span className="truncate">{captionFile ? captionFile.name : 'Subtitles (.vtt / .srt)'}</span>
              </p>
              <div className="flex items-center gap-2 mt-1">
                <select
                  value={captionLang}
                  onChange={(e) => setCaptionLang(e.target.value)}
                  className="text-[11px] bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 rounded px-1.5 py-0.5 text-gray-800 dark:text-neutral-200"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.code.toUpperCase()}</option>
                  ))}
                </select>
                <label className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 cursor-pointer hover:underline">
                  {captionFile ? 'Replace' : 'Attach file'}
                  <input
                    type="file"
                    accept=".vtt,.srt,text/vtt"
                    className="hidden"
                    onChange={(e) => handleCaptionSelected(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
            </div>
            {captionFile && (
              <button type="button" onClick={() => setCaptionFile(null)} className="text-gray-400 hover:text-red-500">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Publication Lifecycle */}
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 space-y-3">
          <p className="text-xs font-bold text-gray-800 dark:text-neutral-200 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-purple-600" />
            Release Timing (Ad-free & always free for fans)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(['published', 'draft', 'scheduled'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPubStatus(mode)}
                className={`py-2 px-3 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  pubStatus === mode
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 border-gray-200 dark:border-neutral-700'
                }`}
              >
                {mode === 'published' ? 'Publish Now' : mode === 'draft' ? 'Save Draft' : 'Schedule'}
              </button>
            ))}
          </div>
          {pubStatus === 'scheduled' && (
            <input
              type="datetime-local"
              value={scheduledAt}
              min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white"
              required
            />
          )}
        </div>

        {/* Declarations */}
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 space-y-2.5">
          <p className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            <FileCheck className="w-4 h-4 text-purple-600" />
            Original Content Declarations
          </p>
          <label className="flex items-start gap-2 text-xs text-gray-700 dark:text-neutral-300 cursor-pointer">
            <input type="checkbox" checked={ownership} onChange={(e) => setOwnership(e.target.checked)} className="mt-0.5 accent-purple-600" />
            <span>I created this Short and own or control all rights to distribute it on PAYTUNE.</span>
          </label>
          <label className="flex items-start gap-2 text-xs text-gray-700 dark:text-neutral-300 cursor-pointer">
            <input type="checkbox" checked={noCopyright} onChange={(e) => setNoCopyright(e.target.checked)} className="mt-0.5 accent-purple-600" />
            <span>This upload contains no unauthorized copyrighted audio or video clips.</span>
          </label>
          <label className="flex items-start gap-2 text-xs text-gray-700 dark:text-neutral-300 cursor-pointer">
            <input type="checkbox" checked={noAi} onChange={(e) => setNoAi(e.target.checked)} className="mt-0.5 accent-purple-600" />
            <span>This performance is authentic human work (not undisclosed AI-generated synthesis).</span>
          </label>
        </div>

        {/* Upload Progress & Controls */}
        {(isBusy || uploadHook.status === 'error' || uploadHook.status === 'cancelled') && (
          <div className="p-3.5 rounded-xl bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-gray-700 dark:text-neutral-200 tabular-nums">
                {uploadHook.status === 'processing'
                  ? 'Finalizing in cloud storage...'
                  : uploadHook.status === 'uploading'
                  ? `Uploading Short... ${uploadHook.progress}%`
                  : uploadHook.status === 'cancelled'
                  ? 'Upload cancelled'
                  : uploadHook.error || 'Upload error'}
              </span>
              {isBusy && (
                <button
                  type="button"
                  onClick={uploadHook.cancel}
                  className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
                >
                  Cancel
                </button>
              )}
            </div>
            <progress
              value={uploadHook.progress}
              max={100}
              className="w-full h-2 rounded-full overflow-hidden appearance-none [&::-webkit-progress-bar]:bg-gray-200 dark:[&::-webkit-progress-bar]:bg-neutral-800 [&::-webkit-progress-value]:bg-purple-600"
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isBusy || probing || !videoFile || !allDeclared}
            className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-sm shadow-sm transition-colors cursor-pointer"
          >
            {isBusy
              ? `Uploading (${uploadHook.progress}%)`
              : pubStatus === 'draft'
              ? 'Save Short Draft'
              : pubStatus === 'scheduled'
              ? 'Schedule Short'
              : 'Publish Short'}
          </button>
          {(uploadHook.status === 'error' || uploadHook.status === 'cancelled') && (
            <button
              type="submit"
              className="px-4 py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-black text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
