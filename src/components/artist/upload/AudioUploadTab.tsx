import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Music,
  Disc3,
  Mic2,
  Upload,
  Plus,
  Trash2,
  Image as ImageIcon,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Calendar,
} from 'lucide-react';
import api from '../../../services/api';
import { analyzeAudioFile, inspectFileSignature, uploadWithProgress } from '../../../services/mediaUploadEngine';

type AudioMode = 'single' | 'album' | 'podcast';

interface DraftTrackItem {
  localId: string;
  file: File;
  previewUrl: string;
  title: string;
  durationSeconds: number;
  waveformPeaks: number[];
  bpm: string;
  isrc: string;
  explicit: boolean;
  lyrics: string;
  uploadPercent: number;
  uploadedUrl?: string;
  assetId?: string | null;
}

const GENRES = ['Afrobeat', 'Amapiano', 'R&B', 'Gospel', 'Hip Hop', 'Traditional', 'Pop', 'Afropop', 'Podcast'];
const LANGUAGES = [
  { code: 'rw', label: 'Kinyarwanda (RW)' },
  { code: 'en', label: 'English (EN)' },
  { code: 'fr', label: 'Français (FR)' },
  { code: 'sw', label: 'Kiswahili (SW)' },
];

function formatDuration(sec: number) {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? '0' : ''}${rem}`;
}

export default function AudioUploadTab() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<AudioMode>('single');
  const [albumTitle, setAlbumTitle] = useState('');
  const [showName, setShowName] = useState('');
  const [episodeNumber, setEpisodeNumber] = useState('1');
  const [genre, setGenre] = useState('Afrobeat');
  const [languageCode, setLanguageCode] = useState('rw');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [pubStatus, setPubStatus] = useState<'published' | 'draft' | 'scheduled'>('published');
  const [scheduledAt, setScheduledAt] = useState('');
  const [isFree, setIsFree] = useState(true);
  const [priceRwf, setPriceRwf] = useState('500');

  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [artworkPreviewUrl, setArtworkPreviewUrl] = useState<string | null>(null);

  const [tracks, setTracks] = useState<DraftTrackItem[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (artworkPreviewUrl) URL.revokeObjectURL(artworkPreviewUrl);
      tracks.forEach((t) => URL.revokeObjectURL(t.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleArtworkSelect = async (file: File | null) => {
    setError(null);
    if (!file) return;
    const sig = await inspectFileSignature(file, 'image');
    if (!sig.valid) {
      setError(sig.error || 'Invalid cover artwork image.');
      return;
    }
    if (artworkPreviewUrl) URL.revokeObjectURL(artworkPreviewUrl);
    setArtworkFile(file);
    setArtworkPreviewUrl(URL.createObjectURL(file));
  };

  const handleAudioFilesSelect = async (fileList: FileList | null) => {
    setError(null);
    setSuccess(null);
    if (!fileList || fileList.length === 0) return;

    const filesArray = mode === 'album' ? Array.from(fileList) : [fileList[0]];
    setAnalyzing(true);
    try {
      const parsed: DraftTrackItem[] = [];
      for (const file of filesArray) {
        const sig = await inspectFileSignature(file, 'audio');
        if (!sig.valid) {
          setError(`${file.name}: ${sig.error || 'Unsupported audio signature'}`);
          continue;
        }
        const analysis = await analyzeAudioFile(file);
        parsed.push({
          localId: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          previewUrl: URL.createObjectURL(file),
          title: file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim(),
          durationSeconds: analysis.durationSeconds,
          waveformPeaks: analysis.waveformPeaks,
          bpm: '',
          isrc: '',
          explicit: false,
          lyrics: '',
          uploadPercent: 0,
        });
      }

      if (mode === 'album') {
        setTracks((prev) => [...prev, ...parsed]);
      } else if (parsed.length > 0) {
        tracks.forEach((t) => URL.revokeObjectURL(t.previewUrl));
        setTracks([parsed[0]]);
      }
    } finally {
      setAnalyzing(false);
    }
  };

  const removeTrack = (localId: string) => {
    setTracks((prev) => {
      const target = prev.find((t) => t.localId === localId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((t) => t.localId !== localId);
    });
  };

  const updateTrackField = (localId: string, patch: Partial<DraftTrackItem>) => {
    setTracks((prev) => prev.map((t) => (t.localId === localId ? { ...t, ...patch } : t)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (tracks.length === 0) return setError('Add at least one valid audio file (MP3, WAV, FLAC, M4A, OGG).');
    if (mode === 'album' && !albumTitle.trim()) return setError('Album or EP title is required.');
    if (pubStatus === 'scheduled' && (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now())) {
      return setError('Choose a future date and time for a scheduled audio release.');
    }

    setSubmitting(true);
    try {
      let artworkUrl = '';
      if (artworkFile) {
        const artFd = new FormData();
        artFd.append('artwork', artworkFile);
        const artRes = await uploadWithProgress({ url: '/upload/artwork', formData: artFd });
        artworkUrl = artRes?.url || '';
      }

      const uploadedTracksPayload = [];
      for (const item of tracks) {
        let audioUrl = item.uploadedUrl;
        let assetId = item.assetId;

        if (!audioUrl) {
          const audFd = new FormData();
          audFd.append('audio', item.file);
          audFd.append('title', item.title.trim() || item.file.name);
          const audRes = await uploadWithProgress({
            url: '/upload/audio',
            formData: audFd,
            onProgress: (info) => updateTrackField(item.localId, { uploadPercent: info.percent }),
          });
          audioUrl = audRes?.url;
          assetId = audRes?.mediaAssetId || null;
          updateTrackField(item.localId, { uploadedUrl: audioUrl, assetId, uploadPercent: 100 });
        }

        uploadedTracksPayload.push({
          title: item.title.trim() || item.file.name,
          audio_url: audioUrl,
          audio_media_asset_id: assetId,
          duration_seconds: item.durationSeconds,
          bpm: item.bpm ? Number(item.bpm) : undefined,
          isrc: item.isrc.trim() || undefined,
          explicit_content: item.explicit,
          lyrics: item.lyrics.trim() || undefined,
        });
      }

      await api.post('/music/creator/tracks', {
        audio_category: mode,
        release_type: mode === 'album' ? (uploadedTracksPayload.length > 5 ? 'album' : 'ep') : 'single',
        album_title: mode === 'album' ? albumTitle.trim() : undefined,
        show_name: mode === 'podcast' ? showName.trim() : undefined,
        episode_number: mode === 'podcast' ? Number(episodeNumber || 1) : undefined,
        genre: mode === 'podcast' ? 'Podcast' : genre,
        language_code: languageCode,
        description: description.trim(),
        artwork_url: artworkUrl,
        visibility,
        publication_status: pubStatus,
        scheduled_at: pubStatus === 'scheduled' ? new Date(scheduledAt).toISOString() : undefined,
        is_free: isFree,
        price_rwf: isFree ? 0 : Math.max(200, Number(priceRwf) || 500),
        tracks: uploadedTracksPayload,
      });

      queryClient.invalidateQueries({ queryKey: ['music'] });
      queryClient.invalidateQueries({ queryKey: ['artist-videos'] });

      setSuccess(
        pubStatus === 'draft'
          ? 'Audio saved to your catalog as a draft.'
          : pubStatus === 'scheduled'
          ? `Release scheduled for ${new Date(scheduledAt).toLocaleString()}.`
          : `${uploadedTracksPayload.length} audio track(s) published live to PAYTUNE Music!`
      );

      setTimeout(() => navigate('/artist/dashboard/videos'), 1600);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to publish audio.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Mode Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { id: 'single', label: 'Single Track', desc: 'Standalone song or remix', icon: Music },
          { id: 'album', label: 'EP / Album', desc: 'Multi-track release queue', icon: Disc3 },
          { id: 'podcast', label: 'Podcast Episode', desc: 'Shows, interviews & sessions', icon: Mic2 },
        ].map((item) => {
          const Icon = item.icon;
          const active = mode === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setMode(item.id as AudioMode);
                if (item.id === 'podcast') setGenre('Podcast');
                else if (genre === 'Podcast') setGenre('Afrobeat');
              }}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                active
                  ? 'bg-purple-600/10 border-purple-600 text-gray-900 dark:text-white'
                  : 'bg-gray-50 dark:bg-[#1a1a20] border-gray-200 dark:border-neutral-800 text-gray-600 dark:text-neutral-400 hover:border-gray-300 dark:hover:border-neutral-700'
              }`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${active ? 'bg-purple-600 text-white' : 'bg-white dark:bg-neutral-900 text-gray-500'}`}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold">{item.label}</p>
                <p className="text-[11px] opacity-80">{item.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-300 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 border border-emerald-200 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Square Cover Artwork + Release Metadata */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-[#141418] space-y-3">
            <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300">
              Square Cover Artwork (1:1 • Recommended 1400×1400)
            </label>
            <label className="relative aspect-square max-w-[240px] mx-auto rounded-2xl border-2 border-dashed border-gray-300 dark:border-neutral-700 overflow-hidden bg-white dark:bg-neutral-900 flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 transition-colors">
              {artworkPreviewUrl ? (
                <img src={artworkPreviewUrl} alt="Release cover" className="w-full h-full object-cover" />
              ) : (
                <div className="p-6 text-center space-y-2">
                  <ImageIcon className="w-8 h-8 text-purple-500 mx-auto" />
                  <p className="text-xs font-bold text-gray-800 dark:text-neutral-200">Upload Artwork</p>
                  <p className="text-[11px] text-gray-500">JPG, PNG, or WebP</p>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleArtworkSelect(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          {mode === 'album' && (
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">
                Album / EP Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={albumTitle}
                onChange={(e) => setAlbumTitle(e.target.value)}
                placeholder="e.g. Kigali Nights Vol. 1"
                className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-sm text-gray-900 dark:text-white"
                required
              />
            </div>
          )}

          {mode === 'podcast' && (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">Show Name</label>
                <input
                  type="text"
                  value={showName}
                  onChange={(e) => setShowName(e.target.value)}
                  placeholder="e.g. Behind the Beat"
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-xs text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">Ep #</label>
                <input
                  type="number"
                  min={1}
                  value={episodeNumber}
                  onChange={(e) => setEpisodeNumber(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-xs text-gray-900 dark:text-white tabular-nums"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">Genre</label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
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
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">Release Notes / Credits</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Producer credits, featured artists, or episode summary..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-xs text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Right Column: Waveform Audio Files & Publishing */}
        <div className="lg:col-span-7 space-y-4">
          <div className="p-4 rounded-2xl border-2 border-dashed border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-[#141418] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                {mode === 'album' ? 'Add Audio Tracks (MP3, WAV, FLAC, M4A)' : 'Select Audio Master (MP3, WAV, FLAC, M4A)'}
              </p>
              <p className="text-xs text-gray-500 dark:text-neutral-400">
                Real waveform amplitude & duration decoded automatically before upload
              </p>
            </div>
            <label className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer shrink-0">
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span>{mode === 'album' ? 'Add Tracks' : tracks.length ? 'Replace Audio' : 'Choose Audio'}</span>
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.flac,.m4a,.ogg"
                multiple={mode === 'album'}
                className="hidden"
                onChange={(e) => handleAudioFilesSelect(e.target.files)}
              />
            </label>
          </div>

          {tracks.length > 0 && (
            <div className="space-y-3">
              {tracks.map((track, idx) => (
                <div
                  key={track.localId}
                  className="p-4 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#16161b] space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                      <span className="sm:col-span-1 text-xs font-mono font-bold text-gray-400 tabular-nums">
                        #{idx + 1}
                      </span>
                      <input
                        type="text"
                        value={track.title}
                        onChange={(e) => updateTrackField(track.localId, { title: e.target.value })}
                        placeholder="Track Title"
                        className="sm:col-span-8 px-3 py-2 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-xs font-bold text-gray-900 dark:text-white"
                        required
                      />
                      <span className="sm:col-span-3 text-right text-xs font-mono font-bold text-purple-600 dark:text-purple-400 tabular-nums">
                        {formatDuration(track.durationSeconds)} • {(track.file.size / 1024 / 1024).toFixed(1)} MB
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTrack(track.localId)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Decoded 48-bar Waveform Preview + HTML Audio Player */}
                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-neutral-900/80 border border-gray-200/80 dark:border-neutral-800 space-y-2">
                    <div className="flex items-end gap-[2px] h-10 px-1" aria-label="Decoded audio waveform">
                      {track.waveformPeaks.map((amp, barIdx) => (
                        <div
                          key={barIdx}
                          className="flex-1 rounded-full bg-purple-600/80 dark:bg-purple-500/85"
                          style={{ height: `${Math.round(amp * 100)}%` }}
                        />
                      ))}
                    </div>
                    <audio controls src={track.previewUrl} className="w-full h-8" />
                  </div>

                  {/* BPM, ISRC, Explicit */}
                  <div className="grid grid-cols-3 gap-2.5 items-center">
                    <input
                      type="number"
                      min={30}
                      max={260}
                      value={track.bpm}
                      onChange={(e) => updateTrackField(track.localId, { bpm: e.target.value })}
                      placeholder="BPM (e.g. 112)"
                      className="px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-xs text-gray-900 dark:text-white tabular-nums"
                    />
                    <input
                      type="text"
                      value={track.isrc}
                      onChange={(e) => updateTrackField(track.localId, { isrc: e.target.value })}
                      placeholder="ISRC (optional)"
                      className="px-2.5 py-1.5 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 text-xs text-gray-900 dark:text-white font-mono"
                    />
                    <label className="flex items-center justify-end gap-1.5 text-xs font-semibold text-gray-700 dark:text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={track.explicit}
                        onChange={(e) => updateTrackField(track.localId, { explicit: e.target.checked })}
                        className="accent-purple-600"
                      />
                      <span>Explicit</span>
                    </label>
                  </div>

                  {submitting && track.uploadPercent > 0 && (
                    <progress
                      value={track.uploadPercent}
                      max={100}
                      className="w-full h-1.5 rounded-full overflow-hidden appearance-none [&::-webkit-progress-bar]:bg-gray-200 dark:[&::-webkit-progress-bar]:bg-neutral-800 [&::-webkit-progress-value]:bg-purple-600"
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pricing, Visibility & Schedule */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-800 dark:text-neutral-200">Streaming Access</span>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-neutral-300 cursor-pointer">
                  <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} className="accent-purple-600" />
                  <span>Free Stream</span>
                </label>
              </div>
              {!isFree && (
                <input
                  type="number"
                  min={200}
                  step={50}
                  value={priceRwf}
                  onChange={(e) => setPriceRwf(e.target.value)}
                  placeholder="Unlock Price (RWF)"
                  className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs font-bold text-gray-900 dark:text-white tabular-nums"
                />
              )}
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs font-semibold text-gray-900 dark:text-white"
              >
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 space-y-2.5">
              <span className="text-xs font-bold text-gray-800 dark:text-neutral-200 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-600" />
                Release Status
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

          <button
            type="submit"
            disabled={submitting || analyzing || tracks.length === 0}
            className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>
              {submitting
                ? 'Uploading Master Audio...'
                : pubStatus === 'draft'
                ? 'Save Audio Draft'
                : pubStatus === 'scheduled'
                ? 'Schedule Audio Release'
                : mode === 'album'
                ? `Publish Release (${tracks.length} tracks)`
                : 'Publish Audio'}
            </span>
          </button>
        </div>
      </div>
    </form>
  );
}
