import React, { useEffect, useState } from 'react';
import {
  Megaphone,
  Monitor,
  Smartphone,
  Upload,
  Send,
  Save,
  Trash2,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  Ban,
} from 'lucide-react';
import api from '../../../services/api';
import { inspectFileSignature, uploadWithProgress } from '../../../services/mediaUploadEngine';

interface CreatorAdCampaign {
  id: string;
  title: string;
  description?: string;
  primary_text?: string;
  media_type: 'image' | 'video';
  image_url?: string;
  mobile_image_url?: string;
  video_url?: string;
  click_url?: string;
  cta_label?: string;
  placement_type: string;
  budget_rwf: number;
  status: string;
  creative_status: string;
  rejection_reason?: string | null;
  created_at: string;
}

export default function AdsUploadTab() {
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [placement, setPlacement] = useState<'feed' | 'video_preroll' | 'livestream'>('feed');
  const [title, setTitle] = useState('');
  const [primaryText, setPrimaryText] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Listen Now');
  const [clickUrl, setClickUrl] = useState('');
  const [budgetRwf, setBudgetRwf] = useState('50000');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');

  const [desktopFile, setDesktopFile] = useState<File | null>(null);
  const [desktopPreviewUrl, setDesktopPreviewUrl] = useState<string | null>(null);
  const [mobileFile, setMobileFile] = useState<File | null>(null);
  const [mobilePreviewUrl, setMobilePreviewUrl] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');

  const [campaigns, setCampaigns] = useState<CreatorAdCampaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const res = await api.get('/ads/creator/campaigns');
      setCampaigns(res.data?.ads || []);
    } catch {
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
    return () => {
      if (desktopPreviewUrl) URL.revokeObjectURL(desktopPreviewUrl);
      if (mobilePreviewUrl) URL.revokeObjectURL(mobilePreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDesktopSelect = async (file: File | null) => {
    setError(null);
    if (!file) return;
    const category = mediaType === 'video' ? 'video' : 'image';
    const sig = await inspectFileSignature(file, category);
    if (!sig.valid) {
      setError(sig.error || `Invalid ${category} creative file.`);
      return;
    }
    if (desktopPreviewUrl) URL.revokeObjectURL(desktopPreviewUrl);
    setDesktopFile(file);
    setDesktopPreviewUrl(URL.createObjectURL(file));
  };

  const handleMobileSelect = async (file: File | null) => {
    setError(null);
    if (!file) return;
    const sig = await inspectFileSignature(file, 'image');
    if (!sig.valid) {
      setError(sig.error || 'Invalid mobile banner image.');
      return;
    }
    if (mobilePreviewUrl) URL.revokeObjectURL(mobilePreviewUrl);
    setMobileFile(file);
    setMobilePreviewUrl(URL.createObjectURL(file));
  };

  const handleCreateCampaign = async (saveAsDraft: boolean) => {
    setError(null);
    setSuccess(null);

    if (!title.trim()) return setError('Campaign headline is required.');
    if (!desktopFile) return setError(`Select a ${mediaType === 'video' ? 'video' : 'banner image'} creative first.`);

    setSubmitting(true);
    setUploadPercent(0);
    try {
      let uploadedDesktopUrl = '';
      let uploadedMobileUrl = '';

      if (mediaType === 'video') {
        const vFd = new FormData();
        vFd.append('file', desktopFile);
        const vRes = await uploadWithProgress({
          url: '/upload',
          formData: vFd,
          onProgress: (info) => setUploadPercent(info.percent),
        });
        uploadedDesktopUrl = vRes?.url || vRes?.publicUrl || '';
      } else {
        const iFd = new FormData();
        iFd.append('image', desktopFile);
        const iRes = await uploadWithProgress({
          url: '/upload/image',
          formData: iFd,
          onProgress: (info) => setUploadPercent(info.percent),
        });
        uploadedDesktopUrl = iRes?.url || '';
      }

      if (mobileFile) {
        const mFd = new FormData();
        mFd.append('image', mobileFile);
        const mRes = await uploadWithProgress({ url: '/upload/image', formData: mFd });
        uploadedMobileUrl = mRes?.url || '';
      }

      await api.post('/ads/creator/campaigns', {
        title: title.trim(),
        primary_text: primaryText.trim(),
        description: primaryText.trim(),
        media_type: mediaType,
        placement_type: mediaType === 'video' ? 'video_preroll' : placement,
        image_url: mediaType === 'image' ? uploadedDesktopUrl : '',
        mobile_image_url: uploadedMobileUrl || (mediaType === 'image' ? uploadedDesktopUrl : ''),
        video_url: mediaType === 'video' ? uploadedDesktopUrl : '',
        cta_label: ctaLabel,
        click_url: clickUrl.trim(),
        budget_rwf: Math.max(5000, Number(budgetRwf) || 50000),
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        save_as_draft: saveAsDraft,
      });

      setSuccess(
        saveAsDraft
          ? 'Ad campaign saved as draft.'
          : 'Campaign submitted for Master Admin moderation! It remains hidden until approved.'
      );
      setTitle('');
      setPrimaryText('');
      setClickUrl('');
      setDesktopFile(null);
      setDesktopPreviewUrl(null);
      setMobileFile(null);
      setMobilePreviewUrl(null);
      fetchCampaigns();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to submit campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitDraft = async (id: string) => {
    try {
      await api.put(`/ads/creator/campaigns/${id}`, { action: 'submit_review' });
      fetchCampaigns();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to submit draft.');
    }
  };

  const handleDeleteCampaign = async (id: string) => {
    try {
      await api.delete(`/ads/creator/campaigns/${id}`);
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to delete campaign.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form */}
        <div className="lg:col-span-7 space-y-4">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">Creative Format</label>
              <select
                value={mediaType}
                onChange={(e) => {
                  const next = e.target.value as 'image' | 'video';
                  setMediaType(next);
                  setDesktopFile(null);
                  setDesktopPreviewUrl(null);
                  if (next === 'video') setPlacement('video_preroll');
                }}
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-xs font-semibold text-gray-900 dark:text-white"
              >
                <option value="image">Image Banner / Promo Card</option>
                <option value="video">Video Pre-Roll Stream</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">Target Placement</label>
              <select
                value={placement}
                onChange={(e) => setPlacement(e.target.value as any)}
                className="w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-xs font-semibold text-gray-900 dark:text-white"
              >
                <option value="feed">Home / Explore Feed Card</option>
                <option value="video_preroll">Free Video Pre-Roll</option>
                <option value="livestream">Livestream Overlay</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">
              Campaign Headline <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Kigali Arena Album Listening Tour"
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-sm text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">Primary Ad Copy</label>
            <textarea
              rows={2}
              value={primaryText}
              onChange={(e) => setPrimaryText(e.target.value)}
              placeholder="Short promotional copy shown beside your creative..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-xs text-gray-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="p-3.5 rounded-xl border-2 border-dashed border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-[#141418] cursor-pointer hover:border-purple-500 transition-colors">
              <p className="text-xs font-bold text-gray-800 dark:text-neutral-200 flex items-center gap-1.5">
                <Upload className="w-4 h-4 text-purple-600" />
                <span>{mediaType === 'video' ? 'Primary Video File' : 'Desktop Creative (16:9 / 1200×628)'}</span>
              </p>
              <p className="text-[11px] text-gray-500 mt-1 truncate">
                {desktopFile ? desktopFile.name : 'Choose media file...'}
              </p>
              <input
                type="file"
                accept={mediaType === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'image/*'}
                className="hidden"
                onChange={(e) => handleDesktopSelect(e.target.files?.[0] || null)}
              />
            </label>

            <label className="p-3.5 rounded-xl border-2 border-dashed border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-[#141418] cursor-pointer hover:border-purple-500 transition-colors">
              <p className="text-xs font-bold text-gray-800 dark:text-neutral-200 flex items-center gap-1.5">
                <Smartphone className="w-4 h-4 text-purple-600" />
                <span>Mobile Override Image (Optional)</span>
              </p>
              <p className="text-[11px] text-gray-500 mt-1 truncate">
                {mobileFile ? mobileFile.name : 'Fallback uses primary banner'}
              </p>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleMobileSelect(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">CTA Button</label>
              <select
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-xs font-semibold text-gray-900 dark:text-white"
              >
                <option value="Listen Now">Listen Now</option>
                <option value="Watch Now">Watch Now</option>
                <option value="Buy Tickets">Buy Tickets</option>
                <option value="Learn More">Learn More</option>
                <option value="Visit Store">Visit Store</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">Destination URL</label>
              <input
                type="url"
                value={clickUrl}
                onChange={(e) => setClickUrl(e.target.value)}
                placeholder="https://paytune.rw/tickets"
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-xs text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">Budget (RWF)</label>
              <input
                type="number"
                min={5000}
                step={5000}
                value={budgetRwf}
                onChange={(e) => setBudgetRwf(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-xs font-bold text-gray-900 dark:text-white tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-xs text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 dark:text-neutral-300 mb-1.5">End Date</label>
              <input
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#1a1a20] border border-gray-200 dark:border-neutral-800 text-xs text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {submitting && uploadPercent > 0 && (
            <progress
              value={uploadPercent}
              max={100}
              className="w-full h-2 rounded-full overflow-hidden appearance-none [&::-webkit-progress-bar]:bg-gray-200 dark:[&::-webkit-progress-bar]:bg-neutral-800 [&::-webkit-progress-value]:bg-purple-600"
            />
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleCreateCampaign(true)}
              className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-900 dark:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              Save as Draft
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleCreateCampaign(false)}
              className="flex-1 py-2.5 px-5 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Submitting Campaign...' : 'Submit for Master Approval'}</span>
            </button>
          </div>
        </div>

        {/* Live Responsive Desktop / Mobile Preview */}
        <div className="lg:col-span-5">
          <div className="p-4 rounded-2xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-[#121216] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-neutral-300 flex items-center gap-1.5">
                <Megaphone className="w-4 h-4 text-purple-600" />
                Live Placement Preview
              </span>
              <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`px-2.5 py-1 text-xs font-semibold flex items-center gap-1 cursor-pointer ${previewDevice === 'desktop' ? 'bg-purple-600 text-white' : 'bg-white dark:bg-neutral-900 text-gray-600 dark:text-neutral-300'}`}
                >
                  <Monitor className="w-3.5 h-3.5" /> Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`px-2.5 py-1 text-xs font-semibold flex items-center gap-1 cursor-pointer ${previewDevice === 'mobile' ? 'bg-purple-600 text-white' : 'bg-white dark:bg-neutral-900 text-gray-600 dark:text-neutral-300'}`}
                >
                  <Smartphone className="w-3.5 h-3.5" /> Mobile
                </button>
              </div>
            </div>

            <div className={`mx-auto rounded-2xl overflow-hidden border border-gray-200 dark:border-neutral-800 bg-white dark:bg-[#18181f] shadow-sm transition-all ${previewDevice === 'mobile' ? 'max-w-[290px]' : 'w-full'}`}>
              <div className="aspect-video bg-neutral-950 flex items-center justify-center overflow-hidden">
                {mediaType === 'video' && desktopPreviewUrl ? (
                  <video src={desktopPreviewUrl} controls className="w-full h-full object-cover" />
                ) : (previewDevice === 'mobile' ? (mobilePreviewUrl || desktopPreviewUrl) : desktopPreviewUrl) ? (
                  <img
                    src={(previewDevice === 'mobile' ? (mobilePreviewUrl || desktopPreviewUrl) : desktopPreviewUrl) || ''}
                    alt="Ad Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-neutral-500">Ad Creative Preview Area</span>
                )}
              </div>
              <div className="p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    Sponsored • {placement.replace('_', ' ')}
                  </span>
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate">
                    {title || 'Your Campaign Headline'}
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-neutral-400 line-clamp-1">
                    {primaryText || 'Promotional subtitle appears cleanly on feed & watch pages.'}
                  </p>
                </div>
                <span className="shrink-0 px-3 py-1.5 rounded-lg bg-purple-600 text-white text-[11px] font-bold flex items-center gap-1">
                  {ctaLabel}
                  <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Creator Ad Campaigns Ledger */}
      <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-neutral-800">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Your Submitted Ad Campaigns</h3>
        {loadingCampaigns ? (
          <div className="py-6 text-xs text-gray-500 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-purple-600" /> Loading campaigns...
          </div>
        ) : campaigns.length === 0 ? (
          <p className="text-xs text-gray-500 dark:text-neutral-400 py-4">No ad campaigns created yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {campaigns.map((camp) => (
              <div
                key={camp.id}
                className="p-4 rounded-xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-[#141418] flex items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-900 dark:text-white truncate">{camp.title}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        camp.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : camp.status === 'pending_review'
                          ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          : camp.status === 'rejected'
                          ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                          : 'bg-gray-200 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400'
                      }`}
                    >
                      {camp.status.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-neutral-400 tabular-nums">
                    {camp.placement_type} • Budget {Number(camp.budget_rwf || 0).toLocaleString()} RWF
                  </p>
                  {camp.rejection_reason && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1">
                      <Ban className="w-3 h-3 shrink-0" /> {camp.rejection_reason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {camp.status === 'draft' && (
                    <button
                      type="button"
                      onClick={() => handleSubmitDraft(camp.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold cursor-pointer flex items-center gap-1"
                    >
                      <Clock className="w-3 h-3" /> Submit
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteCampaign(camp.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 cursor-pointer"
                    title="Delete Campaign"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
