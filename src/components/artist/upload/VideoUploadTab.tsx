import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Video as VideoIcon,
  Camera,
  Subtitles,
  Calendar,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  X,
  RotateCcw,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import api from '../../../services/api';
import { useMediaUpload } from '../../../hooks/useMediaUpload';
import { extractVideoMetadataAndFrame, inspectFileSignature, VideoProbeResult } from '../../../services/mediaUploadEngine';

const GENRES = ['Afrobeat', 'Amapiano', 'R&B', 'Gospel', 'Hip Hop', 'Traditional', 'Live Concert', 'Pop', 'Documentary'];
const LANGUAGES = [
  { code: 'rw', label: 'Kinyarwanda (RW)' },
  { code: 'en', label: 'English (EN)' },
  { code: 'fr', label: 'Français (FR)' },
  { code: 'sw', label: 'Kiswahili (SW)' },
  { code: 'lg', label: 'Luganda (LG)' },
];

export default function VideoUploadTab() {
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
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private' | 'members_only'>('public');
  const [pubStatus, setPubStatus] = useState<'published' | 'draft' | 'scheduled'>('published');
  const [scheduledAt, setScheduledAt] = useState('');

  const [isFree, setIsFree] = useState(true);
  const [priceRwf, setPriceRwf] = useState('500');
  const [priceUsd, setPriceUsd] = useState('1.00');

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
        setValidationError(sig.error || 'Unsupported video file container.');
        return;
      }

      const info = await extractVideoMetadataAndFrame(file, 2.0);
      setVideoFile(file);
      setVideoPreviewUrl(URL.createObjectURL(file));
      setProbe(info);

      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim());
      }

      if (info.frameBlob && !thumbFile) {
        const autoPoster = new File([info.frameBlob], 'video-poster.jpg', { type: 'image/jpeg' });
        setThumbFile(autoPoster);
        if (thumbPreviewUrl && thumbPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(thumbPreviewUrl);
        setThumbPreviewUrl(URL.createObjectURL(autoPoster));
      }
    } catch (err: any) {
      setValidationError(err?.message || 'Unable to decode selected video.');
    } finally {
      setProbing(false);
    }
  };

  const handleCaptureCurrentFrame = async () => {
    const vid = videoPreviewRef.current;
    if (!vid || !vid.videoWidth || !vid.videoHeight) return;
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1280 / Math.max(vid.videoWidth, vid.videoHeight));
    canvas.width = Math.max(1, Math.round(vid.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(vid.videoHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.9));
    if (!blob) return;
    const captured = new File([blob], `frame-${Math.round(vid.currentTime)}s.jpg`, { type: 'image/jpeg' });
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
      setValidationError(sig.error || 'Subtitles must be valid .vtt or .srt files.');
      return;
    }
    setCaptionFile(file);
  };

  const handlePriceRwfChange = (val: string) => {
    setPriceRwf(val);
    const num = Number(val);
    if (Number.isFinite(num) && num >= 200) {
      setPriceUsd(Math.max(1, Number((num / 1400).toFixed(2))).toString());
    }
  };

  const allDeclared = ownership && noCopyright && noAi;
  const isBusy = uploadHook.status === 'uploading' || uploadHook.status === 'processing';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setSuccessMsg(null);

    if (!videoFile) return setValidationError('Select a video file to upload.');
    if (!title.trim()) return setValidationError('Video title is required.');
    if (!allDeclared) return setValidationError('Accept all three original content declarations.');
    if (!isFree) {
      if (!priceRwf || Number(priceRwf) < 200) return setValidationError('PPV price must be at least 200 RWF.');
      if (!priceUsd || Number(priceUsd) < 1) return setValidationError('USD price must be at least $1.');
    }
    if (pubStatus === 'scheduled' && (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now())) {
      return setValidationError('Select a future date and time to schedule this video.');
    }

    const fd = new FormData();
    fd.append('video', videoFile);
    if (thumbFile) fd.append('thumbnail', thumbFile);
    fd.append('title', title.trim());
    fd.append('description', description.trim());
    fd.append('category', category);
    fd.append('tags', tags);
    fd.append('language_code', languageCode);
    fd.append('is_free', String(isFree));
    fd.append('is_short', 'false');
    fd.append('media_type', 'video');
    fd.append('visibility', visibility);
    fd.append('publication_status', pubStatus);
    if (pubStatus === 'scheduled' && scheduledAt) {
      fd.append('scheduled_at', new Date(scheduledAt).toISOString());
    }
    if (!isFree) {
      fd.append('price_rwf', priceRwf);
      fd.append('price_usd', priceUsd);
    }
    fd.append('ownership_declared', 'true');
    fd.append('no_copyright_declared', 'true');
    fd.append('no_ai_declared', 'true');

    try {
      const res = await uploadHook.upload({ url: '/artist/video/upload', formData: fd });
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
          ? 'Video saved to your catalog as a draft.'
          : pubStatus === 'scheduled'
          ? `Video scheduled for ${new Date(scheduledAt).toLocaleString()}.`
          : 'Video uploaded and published live!'
      );
      queryClient.invalidateQueries({ queryKey: ['artist-videos'] });
      queryClient.invalidateQueries({ queryKey: ['videos'] });

      setTimeout(() => navigate('/artist/dashboard/videos'), 1600);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setValidationError(err?.message || 'Video upload failed.');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left: Video Player & Frame Capture */}
      <div className="lg:col-span-5 space-y-4">
        <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-[#121216] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-neutral-300 flex items-center gap-1.5">
              <VideoIcon className="w-4 h-4 text-purple-600" />
              16:9 Stream Preview
            </span>
            {probe && (
              <span className="text-[11px] font-mono font-semibold text-gray-500 dark:text-neutral-400 tabular-nums">
                {probe.width}×{probe.height} • {Math.floor(probe.durationSeconds / 60)}:{String(probe.durationSeconds % 60).padStart(2, '0')}
              </span>
            )}
          </div>

          <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-gray-200 dark:border-neutral-800 flex items-center justify-center">
            {probing ? (
              <div className="flex flex-col items-center gap-2 text-xs text-neutral-400">
                <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
                <span>Analyzing video stream...</span>
              </div>
            ) : videoPreviewUrl ? (
              <video
                ref={videoPreviewRef}
                src={videoPreviewUrl}
                controls
                playsInline
                className="w-full h-full object-contain"
              />
            ) : (
              <label className="w-full h-full flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:bg-white/[0.03] transition-colors">
                <VideoIcon className="w-9 h-9 text-purple-500 mb-3" />
                <span className="text-xs font-bold text-white">Drop or Choose Full Video</span>
                <span className="text-[11px] text-neutral-400 mt-1">MP4, MOV, WebM • Up to 500 MB</span>
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
                Capture Frame Thumbnail
              </button>
              <label className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline cursor-pointer">
                Change video file
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                  onChange={(e) => handleVideoSelected(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          )}

          {/* Custom Thumbnail Box */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800">
            {thumbPreviewUrl ? (
              <img src={thumbPreviewUrl} alt="Thumbnail" className="w-24 h-14 rounded-lg object-cover shrink-0 border border-gray-200 dark:border-neutral-700" />
            ) : (
              <div className="w-24 h-14 rounded-lg bg-gray-100 dark:bg-neutral-900 flex items-center justify-center shrink-0">
                <ImageIcon className="w-5 h-5 text-gray-400" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                {thumbFile ? thumbFile.name : 'Video Thumbnail (16:9)'}
              </p>
              <label className="text-[11px] font-semibold text-purple-600 dark:text-purple-400 cursor-pointer hover:underline">
                Upload custom JPG / PNG / WebP
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleThumbSelected(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Right: Metadata, Monetization, Subtitles, Schedule */}
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
            Video Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Official Music Video (4K Master)"
            className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-600"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">Description</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell viewers about the story, director, featured artists, or concert setlist..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-purple-600"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-xs font-semibold text-gray-900 dark:text-white"
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
              className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-xs font-semibold text-gray-900 dark:text-white"
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
              className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-xs font-semibold text-gray-900 dark:text-white"
            >
              <option value="public">Public</option>
              <option value="unlisted">Unlisted (Direct Link)</option>
              <option value="private">Private</option>
              <option value="members_only">Members Only</option>
            </select>
          </div>
        </div>

        {/* Tags & Captions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">Tags</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="afrobeat, kigali, officialvideo"
              className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-xs text-gray-900 dark:text-white"
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
                  {captionFile ? 'Replace' : 'Attach track'}
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

        {/* Access Model & Schedule */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-800 dark:text-neutral-200">Monetization</span>
              <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700">
                <button
                  type="button"
                  onClick={() => setIsFree(true)}
                  className={`px-2.5 py-1 text-xs font-bold cursor-pointer ${isFree ? 'bg-purple-600 text-white' : 'bg-white dark:bg-neutral-900 text-gray-600 dark:text-neutral-400'}`}
                >
                  Free
                </button>
                <button
                  type="button"
                  onClick={() => setIsFree(false)}
                  className={`px-2.5 py-1 text-xs font-bold cursor-pointer ${!isFree ? 'bg-purple-600 text-white' : 'bg-white dark:bg-neutral-900 text-gray-600 dark:text-neutral-400'}`}
                >
                  Pay-Per-View
                </button>
              </div>
            </div>
            {!isFree && (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Price (RWF ≥ 200)</label>
                  <input
                    type="number"
                    min={200}
                    step={50}
                    value={priceRwf}
                    onChange={(e) => handlePriceRwfChange(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs font-bold text-gray-900 dark:text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">Price (USD ≥ $1)</label>
                  <input
                    type="number"
                    min={1}
                    step="0.5"
                    value={priceUsd}
                    onChange={(e) => setPriceUsd(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs font-bold text-gray-900 dark:text-white tabular-nums"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 space-y-2.5">
            <span className="text-xs font-bold text-gray-800 dark:text-neutral-200 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              Publication Timing
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {(['published', 'draft', 'scheduled'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setPubStatus(status)}
                  className={`py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                    pubStatus === status
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-white dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 border-gray-200 dark:border-neutral-700'
                  }`}
                >
                  {status === 'published' ? 'Live' : status === 'draft' ? 'Draft' : 'Schedule'}
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
        </div>

        {/* Declarations */}
        <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 space-y-2.5">
          <p className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
            <FileCheck className="w-4 h-4 text-purple-600" />
            Original Content Declarations
          </p>
          <label className="flex items-start gap-2 text-xs text-gray-700 dark:text-neutral-300 cursor-pointer">
            <input type="checkbox" checked={ownership} onChange={(e) => setOwnership(e.target.checked)} className="mt-0.5 accent-purple-600" />
            <span>I created this video and hold all publishing and distribution rights.</span>
          </label>
          <label className="flex items-start gap-2 text-xs text-gray-700 dark:text-neutral-300 cursor-pointer">
            <input type="checkbox" checked={noCopyright} onChange={(e) => setNoCopyright(e.target.checked)} className="mt-0.5 accent-purple-600" />
            <span>This upload contains no unlicensed third-party copyrighted material.</span>
          </label>
          <label className="flex items-start gap-2 text-xs text-gray-700 dark:text-neutral-300 cursor-pointer">
            <input type="checkbox" checked={noAi} onChange={(e) => setNoAi(e.target.checked)} className="mt-0.5 accent-purple-600" />
            <span>This upload is genuine artist-created media (not undisclosed synthetic AI output).</span>
          </label>
        </div>

        {(isBusy || uploadHook.status === 'error' || uploadHook.status === 'cancelled') && (
          <div className="p-3.5 rounded-xl bg-gray-100 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-gray-700 dark:text-neutral-200 tabular-nums">
                {uploadHook.status === 'processing'
                  ? 'Finalizing in cloud storage...'
                  : uploadHook.status === 'uploading'
                  ? `Uploading Video... ${uploadHook.progress}%`
                  : uploadHook.status === 'cancelled'
                  ? 'Upload cancelled'
                  : uploadHook.error || 'Upload failed'}
              </span>
              {isBusy && (
                <button type="button" onClick={uploadHook.cancel} className="text-xs font-bold text-red-600 hover:underline cursor-pointer">
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
              ? 'Save Video Draft'
              : pubStatus === 'scheduled'
              ? 'Schedule Video'
              : 'Publish Video'}
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
