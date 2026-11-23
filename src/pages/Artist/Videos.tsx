import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Play,
  Edit3,
  Trash2,
  Share2,
  Check,
  ExternalLink,
  Search,
  Plus,
  X,
  Save,
  Music,
  Video as VideoIcon,
  Smartphone,
  Megaphone,
  Eye,
  AlertCircle,
  RefreshCw,
  Subtitles,
  Upload,
  Calendar,
  Ban,
} from 'lucide-react';
import api from '../../services/api';
import { inspectFileSignature, uploadWithProgress } from '../../services/mediaUploadEngine';

interface ArtistVideo {
  id: string;
  title: string;
  description?: string;
  thumbnail_url?: string;
  video_url?: string;
  audio_url?: string;
  media_type?: string;
  is_short?: boolean;
  category?: string;
  price_rwf?: number;
  price_usd?: number;
  is_free?: boolean;
  visibility?: string;
  publication_status?: string;
  scheduled_at?: string | null;
  views?: number;
  likes?: number;
  uploaded_at?: string;
  created_at?: string;
}

interface CreatorTrack {
  id: string;
  title: string;
  genre?: string;
  audio_url?: string;
  artwork_url?: string;
  album_title?: string;
  audio_category?: string;
  duration_seconds?: number;
  track_status?: string;
  publication_status?: string;
  scheduled_at?: string | null;
  visibility?: string;
  is_free?: boolean;
  price_rwf?: number;
  plays_count?: number;
}

interface CreatorAd {
  id: string;
  title: string;
  primary_text?: string;
  image_url?: string;
  video_url?: string;
  media_type?: string;
  placement_type?: string;
  budget_rwf?: number;
  status: string;
  rejection_reason?: string | null;
  metrics?: { impressions: number; clicks: number };
}

interface VideoCaption {
  id: string;
  language_code: string;
  label: string;
  kind: string;
  url: string;
  is_default: boolean;
}

const LANGUAGES = [
  { code: 'en', label: 'English (EN)' },
  { code: 'rw', label: 'Kinyarwanda (RW)' },
  { code: 'fr', label: 'Français (FR)' },
  { code: 'sw', label: 'Kiswahili (SW)' },
  { code: 'lg', label: 'Luganda (LG)' },
];

export default function ArtistVideos() {
  const [section, setSection] = useState<'videos' | 'shorts' | 'audio' | 'ads'>('videos');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'scheduled' | 'draft' | 'archived'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [videos, setVideos] = useState<ArtistVideo[]>([]);
  const [tracks, setTracks] = useState<CreatorTrack[]>([]);
  const [ads, setAds] = useState<CreatorAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit Video / Track Modal
  const [editingVideo, setEditingVideo] = useState<ArtistVideo | null>(null);
  const [editingTrack, setEditingTrack] = useState<CreatorTrack | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('Afrobeat');
  const [editIsFree, setEditIsFree] = useState(true);
  const [editPriceRwf, setEditPriceRwf] = useState('500');
  const [editPriceUsd, setEditPriceUsd] = useState('1.00');
  const [editVisibility, setEditVisibility] = useState('public');
  const [editPubStatus, setEditPubStatus] = useState('published');
  const [editScheduledAt, setEditScheduledAt] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Replace Media Modal
  const [replacingTarget, setReplacingTarget] = useState<{ kind: 'video' | 'audio'; id: string; title: string } | null>(null);
  const [replaceFile, setReplaceFile] = useState<File | null>(null);
  const [replaceThumb, setReplaceThumb] = useState<File | null>(null);
  const [replacePercent, setReplacePercent] = useState(0);
  const [replacing, setReplacing] = useState(false);
  const [replaceError, setReplaceError] = useState('');

  // Captions Manager Modal
  const [captionVideo, setCaptionVideo] = useState<ArtistVideo | null>(null);
  const [captions, setCaptions] = useState<VideoCaption[]>([]);
  const [captionsLoading, setCaptionsLoading] = useState(false);
  const [newCapFile, setNewCapFile] = useState<File | null>(null);
  const [newCapLang, setNewCapLang] = useState('en');
  const [newCapDefault, setNewCapDefault] = useState(true);
  const [uploadingCaption, setUploadingCaption] = useState(false);
  const [captionError, setCaptionError] = useState('');

  // Delete Modal
  const [deletingTarget, setDeletingTarget] = useState<{ kind: 'video' | 'audio' | 'ad'; id: string; title: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadCatalog = async () => {
    setLoading(true);
    setError('');
    try {
      const [vidRes, audRes, adRes] = await Promise.all([
        api.get('/artist/videos').catch(() => ({ data: { videos: [] } })),
        api.get('/music/creator/tracks').catch(() => ({ data: { tracks: [] } })),
        api.get('/ads/creator/campaigns').catch(() => ({ data: { ads: [] } })),
      ]);

      const loadedVideos = Array.isArray(vidRes.data) ? vidRes.data : vidRes.data?.videos || [];
      setVideos(loadedVideos);
      setTracks(audRes.data?.tracks || []);
      setAds(adRes.data?.ads || []);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to load creator catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const openEditVideo = (v: ArtistVideo) => {
    setEditingTrack(null);
    setEditingVideo(v);
    setEditTitle(v.title || '');
    setEditDescription(v.description || '');
    setEditCategory(v.category || 'Afrobeat');
    setEditIsFree(Boolean(v.is_free));
    setEditPriceRwf(String(v.price_rwf ?? 500));
    setEditPriceUsd(String(v.price_usd ?? 1));
    setEditVisibility(v.visibility || 'public');
    setEditPubStatus(v.publication_status || 'published');
    setEditScheduledAt(v.scheduled_at ? new Date(v.scheduled_at).toISOString().slice(0, 16) : '');
    setEditError('');
  };

  const openEditTrack = (t: CreatorTrack) => {
    setEditingVideo(null);
    setEditingTrack(t);
    setEditTitle(t.title || '');
    setEditDescription('');
    setEditCategory(t.genre || 'Afrobeat');
    setEditIsFree(t.is_free !== false);
    setEditPriceRwf(String(t.price_rwf ?? 500));
    setEditVisibility(t.visibility || 'public');
    setEditPubStatus(t.publication_status || (t.track_status === 'published' ? 'published' : 'draft'));
    setEditScheduledAt(t.scheduled_at ? new Date(t.scheduled_at).toISOString().slice(0, 16) : '');
    setEditError('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitle.trim()) return setEditError('Title is required');
    if (editPubStatus === 'scheduled' && (!editScheduledAt || Number.isNaN(new Date(editScheduledAt).getTime()))) {
      return setEditError('Select a valid scheduled release date & time');
    }

    setSavingEdit(true);
    setEditError('');
    try {
      if (editingVideo) {
        const res = await api.put(`/artist/videos/${editingVideo.id}`, {
          title: editTitle.trim(),
          description: editDescription.trim(),
          category: editCategory,
          is_free: editingVideo.is_short ? true : editIsFree,
          price_rwf: editIsFree || editingVideo.is_short ? 0 : Number(editPriceRwf) || 500,
          price_usd: editIsFree || editingVideo.is_short ? 0 : Number(editPriceUsd) || 1,
          visibility: editVisibility,
          publication_status: editPubStatus,
          scheduled_at: editPubStatus === 'scheduled' ? new Date(editScheduledAt).toISOString() : null,
        });
        if (res.data?.video) {
          setVideos((prev) => prev.map((item) => (item.id === editingVideo.id ? { ...item, ...res.data.video } : item)));
        }
        setEditingVideo(null);
      } else if (editingTrack) {
        await api.put(`/music/creator/tracks/${editingTrack.id}`, {
          title: editTitle.trim(),
          genre: editCategory,
          is_free: editIsFree,
          price_rwf: editIsFree ? 0 : Number(editPriceRwf) || 500,
          visibility: editVisibility,
          publication_status: editPubStatus,
          scheduled_at: editPubStatus === 'scheduled' ? new Date(editScheduledAt).toISOString() : null,
        });
        await loadCatalog();
        setEditingTrack(null);
      }
    } catch (err: any) {
      setEditError(err?.response?.data?.error || err?.message || 'Failed to update release');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleQuickPublish = async (kind: 'video' | 'audio', id: string) => {
    try {
      if (kind === 'video') {
        await api.put(`/artist/videos/${id}`, { publication_status: 'published' });
      } else {
        await api.put(`/music/creator/tracks/${id}`, { publication_status: 'published' });
      }
      await loadCatalog();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to publish release');
    }
  };

  const handleReplaceMediaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replacingTarget || !replaceFile) {
      return setReplaceError('Choose a replacement media file first.');
    }
    setReplaceError('');
    const sig = await inspectFileSignature(replaceFile, replacingTarget.kind === 'audio' ? 'audio' : 'video');
    if (!sig.valid) {
      return setReplaceError(sig.error || 'Invalid replacement media file');
    }
    if (replaceThumb) {
      const thumbSig = await inspectFileSignature(replaceThumb, 'image');
      if (!thumbSig.valid) return setReplaceError(thumbSig.error || 'Invalid thumbnail image');
    }

    setReplacing(true);
    setReplacePercent(0);
    try {
      const fd = new FormData();
      fd.append(replacingTarget.kind === 'audio' ? 'audio' : 'video', replaceFile);
      if (replaceThumb && replacingTarget.kind === 'video') {
        fd.append('thumbnail', replaceThumb);
      }
      const endpoint =
        replacingTarget.kind === 'audio'
          ? `/music/creator/tracks/${replacingTarget.id}/replace-media`
          : `/artist/videos/${replacingTarget.id}/replace-media`;

      await uploadWithProgress({
        url: endpoint,
        formData: fd,
        method: 'PUT',
        onProgress: (info) => setReplacePercent(info.percent),
      });

      setReplacingTarget(null);
      setReplaceFile(null);
      setReplaceThumb(null);
      await loadCatalog();
    } catch (err: any) {
      setReplaceError(err?.message || 'Media replacement failed');
    } finally {
      setReplacing(false);
    }
  };

  const openCaptionsModal = async (v: ArtistVideo) => {
    setCaptionVideo(v);
    setCaptionError('');
    setNewCapFile(null);
    setCaptionsLoading(true);
    try {
      const res = await api.get(`/artist/videos/${v.id}/captions`);
      setCaptions(res.data?.captions || []);
    } catch (err: any) {
      setCaptionError(err?.response?.data?.error || 'Failed to load subtitle tracks');
      setCaptions([]);
    } finally {
      setCaptionsLoading(false);
    }
  };

  const handleUploadCaption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captionVideo || !newCapFile) return setCaptionError('Choose a .vtt or .srt subtitle file.');
    const sig = await inspectFileSignature(newCapFile, 'caption');
    if (!sig.valid) return setCaptionError(sig.error || 'Invalid subtitle file.');

    setUploadingCaption(true);
    setCaptionError('');
    try {
      const fd = new FormData();
      fd.append('caption', newCapFile);
      fd.append('language_code', newCapLang);
      fd.append('is_default', String(newCapDefault));
      const res = await api.post(`/artist/videos/${captionVideo.id}/captions`, fd);
      if (res.data?.caption) {
        setCaptions((prev) => [...prev, res.data.caption]);
        setNewCapFile(null);
      }
    } catch (err: any) {
      setCaptionError(err?.response?.data?.error || 'Failed to attach subtitle track.');
    } finally {
      setUploadingCaption(false);
    }
  };

  const handleDeleteCaption = async (captionId: string) => {
    if (!captionVideo) return;
    try {
      await api.delete(`/artist/videos/${captionVideo.id}/captions/${captionId}`);
      setCaptions((prev) => prev.filter((c) => c.id !== captionId));
    } catch (err: any) {
      setCaptionError(err?.response?.data?.error || 'Failed to remove subtitle track');
    }
  };

  const confirmDelete = async () => {
    if (!deletingTarget) return;
    setDeleteLoading(true);
    try {
      if (deletingTarget.kind === 'video') {
        await api.delete(`/artist/videos/${deletingTarget.id}`);
        setVideos((prev) => prev.filter((v) => v.id !== deletingTarget.id));
      } else if (deletingTarget.kind === 'audio') {
        await api.delete(`/music/creator/tracks/${deletingTarget.id}`);
        setTracks((prev) => prev.filter((t) => t.id !== deletingTarget.id));
      } else {
        await api.delete(`/ads/creator/campaigns/${deletingTarget.id}`);
        setAds((prev) => prev.filter((a) => a.id !== deletingTarget.id));
      }
      setDeletingTarget(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to delete release');
      setDeletingTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCopyLink = (id: string, pathPrefix: string) => {
    navigator.clipboard.writeText(`${window.location.origin}${pathPrefix}/${id}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const regularVideos = videos.filter((v) => !v.is_short && v.media_type !== 'audio');
  const shortVideos = videos.filter((v) => Boolean(v.is_short));

  const filterBySearchAndStatus = <T extends { title?: string; publication_status?: string; track_status?: string; status?: string }>(items: T[]) => {
    return items.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (item.title || '').toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (statusFilter === 'all') return true;
      const st = item.publication_status || item.track_status || item.status || 'published';
      return st === statusFilter;
    });
  };

  const visibleVideos = filterBySearchAndStatus(section === 'shorts' ? shortVideos : regularVideos);
  const visibleTracks = filterBySearchAndStatus(tracks);
  const visibleAds = ads.filter((a) => !searchQuery.trim() || a.title.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-500">
        <div className="w-7 h-7 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mr-3" />
        <span className="text-sm font-medium">Loading creator catalog...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">Media Catalog & Releases</h1>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Manage published, scheduled, draft, and archived uploads across Videos, Shorts, Audio, and Ads.
          </p>
        </div>

        <Link
          to={`/artist/dashboard/upload?tab=${section === 'videos' ? 'video' : section}`}
          className="inline-flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Upload</span>
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/40 text-red-700 dark:text-red-300 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Format Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 dark:border-neutral-800 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'videos', label: `Videos (${regularVideos.length})`, icon: VideoIcon },
            { id: 'shorts', label: `Shorts (${shortVideos.length})`, icon: Smartphone },
            { id: 'audio', label: `Audio & Podcasts (${tracks.length})`, icon: Music },
            { id: 'ads', label: `Ads (${ads.length})`, icon: Megaphone },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = section === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSection(tab.id as any)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-white dark:bg-[#16161b] text-gray-700 dark:text-neutral-300 border border-gray-200 dark:border-neutral-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search & Status Filter */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search catalog..."
              className="w-full pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-[#16161b] border border-gray-200 dark:border-neutral-800 text-xs text-gray-900 dark:text-white outline-none focus:border-purple-600"
            />
          </div>
          {section !== 'ads' && (
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 rounded-xl bg-white dark:bg-[#16161b] border border-gray-200 dark:border-neutral-800 text-xs font-semibold text-gray-800 dark:text-neutral-200 cursor-pointer"
            >
              <option value="all">All States</option>
              <option value="published">Published</option>
              <option value="scheduled">Scheduled</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          )}
        </div>
      </div>

      {/* SECTION: VIDEOS & SHORTS */}
      {(section === 'videos' || section === 'shorts') && (
        visibleVideos.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#141418] space-y-3">
            <p className="text-sm font-bold text-gray-900 dark:text-white">
              No {section === 'shorts' ? 'Shorts' : 'Videos'} in this view
            </p>
            <Link
              to={`/artist/dashboard/upload?tab=${section === 'shorts' ? 'shorts' : 'video'}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"
            >
              <Plus className="w-4 h-4" />
              Upload {section === 'shorts' ? 'Short' : 'Video'}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleVideos.map((v) => {
              const pubState = v.publication_status || 'published';
              return (
                <div
                  key={v.id}
                  className="bg-[#16161b] border border-neutral-800 rounded-2xl overflow-hidden flex flex-col justify-between group"
                >
                  <div className="relative aspect-video bg-black overflow-hidden">
                    {v.thumbnail_url ? (
                      <img src={v.thumbnail_url} alt={v.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-500">
                        <VideoIcon className="w-8 h-8" />
                      </div>
                    )}

                    <div className="absolute top-2 left-2 flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          pubState === 'published'
                            ? 'bg-emerald-500/90 text-white'
                            : pubState === 'scheduled'
                            ? 'bg-amber-500/90 text-black'
                            : pubState === 'draft'
                            ? 'bg-neutral-800/90 text-neutral-200 border border-neutral-600'
                            : 'bg-red-500/90 text-white'
                        }`}
                      >
                        {pubState}
                      </span>
                      {v.visibility && v.visibility !== 'public' && (
                        <span className="px-2 py-0.5 rounded bg-black/80 text-neutral-200 text-[10px] font-bold uppercase">
                          {v.visibility}
                        </span>
                      )}
                    </div>

                    <div className="absolute top-2 right-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold tabular-nums ${
                          v.is_free ? 'bg-emerald-500/90 text-white' : 'bg-purple-600 text-white'
                        }`}
                      >
                        {v.is_free ? 'FREE' : `${Number(v.price_rwf || 0).toLocaleString()} RWF`}
                      </span>
                    </div>

                    <Link
                      to={v.is_short ? `/shorts/${v.id}` : `/watch/${v.id}`}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <div className="w-11 h-11 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </div>
                    </Link>
                  </div>

                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-white text-sm line-clamp-1">{v.title}</h3>
                      <div className="flex items-center justify-between text-[11px] text-neutral-400 mt-1 tabular-nums">
                        <span>{v.category || 'Music'}</span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" /> {(v.views || 0).toLocaleString()}
                        </span>
                      </div>
                      {pubState === 'scheduled' && v.scheduled_at && (
                        <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3 shrink-0" />
                          {new Date(v.scheduled_at).toLocaleString()}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-neutral-800">
                      {(pubState === 'draft' || pubState === 'scheduled') && (
                        <button
                          type="button"
                          onClick={() => handleQuickPublish('video', v.id)}
                          className="w-full py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold cursor-pointer"
                        >
                          Publish Now
                        </button>
                      )}
                      <div className="flex items-center justify-between text-neutral-400">
                        <button
                          type="button"
                          onClick={() => handleCopyLink(v.id, v.is_short ? '/shorts' : '/watch')}
                          title="Copy Share Link"
                          className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-white cursor-pointer"
                        >
                          {copiedId === v.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReplacingTarget({ kind: 'video', id: v.id, title: v.title });
                            setReplaceFile(null);
                            setReplaceThumb(null);
                            setReplaceError('');
                          }}
                          title="Replace Video / Thumbnail File"
                          className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-purple-400 cursor-pointer"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openCaptionsModal(v)}
                          title="Manage Subtitles (.vtt / .srt)"
                          className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-purple-400 cursor-pointer"
                        >
                          <Subtitles className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditVideo(v)}
                          title="Edit Details & Schedule"
                          className="p-1.5 rounded-lg hover:bg-neutral-800 hover:text-purple-400 cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingTarget({ kind: 'video', id: v.id, title: v.title })}
                          title="Delete Permanently"
                          className="p-1.5 rounded-lg hover:bg-red-500/20 hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* SECTION: AUDIO & PODCASTS */}
      {section === 'audio' && (
        visibleTracks.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#141418] space-y-3">
            <p className="text-sm font-bold text-gray-900 dark:text-white">No audio releases found</p>
            <Link
              to="/artist/dashboard/upload?tab=audio"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"
            >
              <Plus className="w-4 h-4" /> Upload Audio
            </Link>
          </div>
        ) : (
          <div className="bg-[#16161b] border border-neutral-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-neutral-300">
                <thead className="bg-neutral-950 text-neutral-400 uppercase text-[10px] font-bold border-b border-neutral-800">
                  <tr>
                    <th className="p-4">Track</th>
                    <th className="p-4">Format</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Plays</th>
                    <th className="p-4">Duration</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {visibleTracks.map((t) => {
                    const st = t.publication_status || (t.track_status === 'published' ? 'published' : 'draft');
                    const dur = Number(t.duration_seconds || 0);
                    return (
                      <tr key={t.id} className="hover:bg-white/[0.02]">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-neutral-900 overflow-hidden shrink-0 flex items-center justify-center">
                              {t.artwork_url ? (
                                <img src={t.artwork_url} alt={t.title} className="w-full h-full object-cover" />
                              ) : (
                                <Music className="w-4 h-4 text-purple-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-white">{t.title}</p>
                              <p className="text-[11px] text-neutral-400">
                                {t.album_title ? `${t.album_title} • ` : ''}{t.genre || 'Afrobeat'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 uppercase text-[10px] font-bold text-neutral-400">
                          {t.audio_category || 'single'}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              st === 'published'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : st === 'scheduled'
                                ? 'bg-amber-500/15 text-amber-400'
                                : 'bg-neutral-800 text-neutral-300'
                            }`}
                          >
                            {st}
                          </span>
                        </td>
                        <td className="p-4 font-mono tabular-nums">{(t.plays_count || 0).toLocaleString()}</td>
                        <td className="p-4 font-mono tabular-nums">
                          {dur > 0 ? `${Math.floor(dur / 60)}:${String(dur % 60).padStart(2, '0')}` : '—'}
                        </td>
                        <td className="p-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {st !== 'published' && (
                              <button
                                type="button"
                                onClick={() => handleQuickPublish('audio', t.id)}
                                className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold cursor-pointer"
                              >
                                Publish
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setReplacingTarget({ kind: 'audio', id: t.id, title: t.title });
                                setReplaceFile(null);
                                setReplaceError('');
                              }}
                              title="Replace Audio File"
                              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-300 hover:text-purple-400 cursor-pointer"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditTrack(t)}
                              title="Edit Track"
                              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-300 hover:text-purple-400 cursor-pointer"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingTarget({ kind: 'audio', id: t.id, title: t.title })}
                              title="Delete Track"
                              className="p-1.5 rounded-lg hover:bg-red-500/20 text-neutral-300 hover:text-red-400 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* SECTION: CREATOR ADS */}
      {section === 'ads' && (
        visibleAds.length === 0 ? (
          <div className="p-12 text-center rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#141418] space-y-3">
            <p className="text-sm font-bold text-gray-900 dark:text-white">No submitted ad campaigns yet</p>
            <Link
              to="/artist/dashboard/upload?tab=ads"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold"
            >
              <Plus className="w-4 h-4" /> Create Ad Campaign
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleAds.map((ad) => (
              <div key={ad.id} className="bg-[#16161b] border border-neutral-800 rounded-2xl overflow-hidden flex flex-col justify-between">
                <div className="aspect-video bg-black flex items-center justify-center overflow-hidden">
                  {ad.image_url ? (
                    <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover" />
                  ) : ad.video_url ? (
                    <video src={ad.video_url} controls className="w-full h-full object-cover" />
                  ) : (
                    <Megaphone className="w-8 h-8 text-neutral-600" />
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-white truncate">{ad.title}</h3>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-neutral-800 text-neutral-200">
                      {ad.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 tabular-nums">
                    {ad.placement_type || 'feed'} • Budget {Number(ad.budget_rwf || 0).toLocaleString()} RWF • {ad.metrics?.impressions || 0} imps
                  </p>
                  {ad.rejection_reason && (
                    <p className="text-[11px] text-red-400 flex items-center gap-1">
                      <Ban className="w-3 h-3 shrink-0" /> {ad.rejection_reason}
                    </p>
                  )}
                  <div className="flex justify-end pt-2 border-t border-neutral-800">
                    <button
                      type="button"
                      onClick={() => setDeletingTarget({ kind: 'ad', id: ad.id, title: ad.title })}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/15 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* MODAL: EDIT METADATA & SCHEDULE */}
      {(editingVideo || editingTrack) && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16161b] border border-neutral-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Edit Release & Schedule</h2>
              <button
                type="button"
                onClick={() => {
                  setEditingVideo(null);
                  setEditingTrack(null);
                }}
                className="text-neutral-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="bg-red-500/15 border border-red-500/40 text-red-300 p-3 rounded-xl text-xs">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 text-white rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-purple-500"
                  required
                />
              </div>

              {editingVideo && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">Description</label>
                  <textarea
                    rows={3}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 text-white rounded-xl px-3.5 py-2 text-xs outline-none focus:border-purple-500"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">Genre / Category</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 text-white rounded-xl px-3 py-2 text-xs outline-none"
                  >
                    <option value="Afrobeat">Afrobeat</option>
                    <option value="Amapiano">Amapiano</option>
                    <option value="Hip Hop">Hip Hop</option>
                    <option value="R&B">R&B</option>
                    <option value="Gospel">Gospel</option>
                    <option value="Traditional">Traditional</option>
                    <option value="Shorts">Shorts</option>
                    <option value="Podcast">Podcast</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">Visibility</label>
                  <select
                    value={editVisibility}
                    onChange={(e) => setEditVisibility(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 text-white rounded-xl px-3 py-2 text-xs outline-none"
                  >
                    <option value="public">Public</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1">Publication Status</label>
                  <select
                    value={editPubStatus}
                    onChange={(e) => setEditPubStatus(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 text-white rounded-xl px-3 py-2 text-xs outline-none"
                  >
                    <option value="published">Published (Live)</option>
                    <option value="draft">Draft (Hidden)</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                {editPubStatus === 'scheduled' && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-300 mb-1">Release Date</label>
                    <input
                      type="datetime-local"
                      value={editScheduledAt}
                      onChange={(e) => setEditScheduledAt(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 text-white rounded-xl px-3 py-2 text-xs outline-none"
                      required
                    />
                  </div>
                )}
              </div>

              {!editingVideo?.is_short && (
                <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-800 space-y-2.5">
                  <label className="flex items-center justify-between text-xs font-semibold text-white cursor-pointer">
                    <span>Free Access</span>
                    <input
                      type="checkbox"
                      checked={editIsFree}
                      onChange={(e) => setEditIsFree(e.target.checked)}
                      className="accent-purple-600"
                    />
                  </label>
                  {!editIsFree && (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        min={200}
                        value={editPriceRwf}
                        onChange={(e) => setEditPriceRwf(e.target.value)}
                        placeholder="Price RWF"
                        className="bg-neutral-950 border border-neutral-700 text-white rounded-lg px-3 py-2 text-xs tabular-nums"
                      />
                      {editingVideo && (
                        <input
                          type="number"
                          min={1}
                          step="0.5"
                          value={editPriceUsd}
                          onChange={(e) => setEditPriceUsd(e.target.value)}
                          placeholder="Price USD"
                          className="bg-neutral-950 border border-neutral-700 text-white rounded-lg px-3 py-2 text-xs tabular-nums"
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingVideo(null);
                    setEditingTrack(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: REPLACE MEDIA FILE */}
      {replacingTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16161b] border border-neutral-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white">Replace {replacingTarget.kind === 'audio' ? 'Audio' : 'Video'} File</h2>
              <button type="button" onClick={() => setReplacingTarget(null)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-neutral-400">
              Updating <span className="text-white font-semibold">{replacingTarget.title}</span> safely removes the previous file from Supabase Storage.
            </p>
            {replaceError && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs">{replaceError}</div>
            )}
            <form onSubmit={handleReplaceMediaSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                  New {replacingTarget.kind === 'audio' ? 'Audio Master' : 'Video File'}
                </label>
                <input
                  type="file"
                  accept={replacingTarget.kind === 'audio' ? 'audio/*' : 'video/*'}
                  onChange={(e) => setReplaceFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-neutral-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white file:font-bold"
                  required
                />
              </div>
              {replacingTarget.kind === 'video' && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                    Replace Thumbnail (optional)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setReplaceThumb(e.target.files?.[0] || null)}
                    className="w-full text-xs text-neutral-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-neutral-800 file:text-white file:font-semibold"
                  />
                </div>
              )}
              {replacing && (
                <progress
                  value={replacePercent}
                  max={100}
                  className="w-full h-2 rounded-full overflow-hidden appearance-none [&::-webkit-progress-bar]:bg-neutral-800 [&::-webkit-progress-value]:bg-purple-600"
                />
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReplacingTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={replacing || !replaceFile}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold cursor-pointer"
                >
                  {replacing ? `Uploading ${replacePercent}%` : 'Replace Media'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CAPTIONS / SUBTITLES MANAGER */}
      {captionVideo && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16161b] border border-neutral-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Subtitles className="w-4 h-4 text-purple-400" />
                Subtitles for {captionVideo.title}
              </h2>
              <button type="button" onClick={() => setCaptionVideo(null)} className="text-neutral-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {captionError && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs">{captionError}</div>
            )}

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {captionsLoading ? (
                <p className="text-xs text-neutral-400">Loading subtitle tracks...</p>
              ) : captions.length === 0 ? (
                <p className="text-xs text-neutral-400">No subtitles attached yet.</p>
              ) : (
                captions.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs">
                    <div>
                      <span className="font-bold text-white">{c.label}</span>
                      <span className="ml-2 uppercase text-[10px] font-mono text-purple-400">{c.language_code}</span>
                      {c.is_default && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">Default</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCaption(c.id)}
                      className="p-1 text-neutral-400 hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleUploadCaption} className="space-y-3 pt-3 border-t border-neutral-800">
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={newCapLang}
                  onChange={(e) => setNewCapLang(e.target.value)}
                  className="bg-neutral-900 border border-neutral-800 text-white rounded-xl px-3 py-2 text-xs"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newCapDefault}
                    onChange={(e) => setNewCapDefault(e.target.checked)}
                    className="accent-purple-600"
                  />
                  Default track
                </label>
              </div>
              <input
                type="file"
                accept=".vtt,.srt,text/vtt"
                onChange={(e) => setNewCapFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-neutral-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-purple-600 file:text-white file:font-bold"
                required
              />
              <button
                type="submit"
                disabled={uploadingCaption || !newCapFile}
                className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                {uploadingCaption ? 'Attaching Subtitles...' : 'Upload Subtitle File'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DELETE CONFIRMATION */}
      {deletingTarget && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#16161b] border border-neutral-800 rounded-2xl max-w-sm w-full p-6 space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-500/15 text-red-500 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-white font-bold text-base">Delete "{deletingTarget.title}"?</h3>
              <p className="text-xs text-neutral-400 mt-1">
                This permanently removes the record and its files from Supabase Storage.
              </p>
            </div>
            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingTarget(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-300 hover:bg-neutral-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={confirmDelete}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
              >
                {deleteLoading ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
