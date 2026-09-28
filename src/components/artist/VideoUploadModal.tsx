import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  UploadCloud, 
  Film, 
  Image as ImageIcon, 
  DollarSign, 
  CheckCircle2, 
  AlertCircle,
  Clock,
  Sparkles,
  Smartphone,
  Monitor
} from 'lucide-react';
import axios from 'axios';
import { uploadDirect } from '../../services/uploadDirect';
import api from '../../services/api';

interface VideoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const VideoUploadModal: React.FC<VideoUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [isShort, setIsShort] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Afrobeat');
  const [isFree, setIsFree] = useState(false);
  const [priceRwf, setPriceRwf] = useState<number>(1000);
  const [visibility, setVisibility] = useState('public');
  const [previewDuration, setPreviewDuration] = useState<number>(30);
  
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [detectedDuration, setDetectedDuration] = useState<number | null>(null);
  const [detectedAspectRatio, setDetectedAspectRatio] = useState<'9:16' | '16:9' | 'custom' | null>(null);
  const [aspectRatioWarning, setAspectRatioWarning] = useState<string | null>(null);
  const [durationError, setDurationError] = useState<string | null>(null);

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string>('');

  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  if (!isOpen) return null;

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setVideoFile(file);
      setDurationError(null);
      setAspectRatioWarning(null);

      if (!title) {
        // Auto-fill title from filename without extension
        const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        setTitle(cleanName);
      }

      // Detect video duration and aspect ratio
      const videoElement = document.createElement('video');
      videoElement.preload = 'metadata';
      const objUrl = URL.createObjectURL(file);
      videoElement.src = objUrl;

      videoElement.onloadedmetadata = () => {
        URL.revokeObjectURL(objUrl);
        const durationSec = Math.round(videoElement.duration);
        const w = videoElement.videoWidth;
        const h = videoElement.videoHeight;
        setDetectedDuration(durationSec);

        const isVertical = h > w;
        const ratioType = isVertical ? '9:16' : '16:9';
        setDetectedAspectRatio(ratioType);

        if (isShort) {
          if (durationSec > 50) {
            setDurationError(`Video duration is ${durationSec}s. PAYTUNE Shorts must be 50 seconds or less.`);
          }
          if (!isVertical) {
            setAspectRatioWarning('Video is horizontal. Shorts recommend a vertical 9:16 aspect ratio for the mobile feed.');
          }
        }
      };
    }
  };

  const handleFormatChange = (shortMode: boolean) => {
    setIsShort(shortMode);
    setDurationError(null);
    setAspectRatioWarning(null);
    if (shortMode) {
      setCategory('Shorts');
      setIsFree(true);
      if (detectedDuration && detectedDuration > 50) {
        setDurationError(`Video duration is ${detectedDuration}s. Shorts must be 50 seconds or less.`);
      }
      if (detectedAspectRatio === '16:9') {
        setAspectRatioWarning('Video is horizontal. Shorts recommend a vertical 9:16 aspect ratio for the mobile feed.');
      }
    } else {
      if (category === 'Shorts') setCategory('Afrobeat');
    }
  };

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setThumbnailFile(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      setError('Please provide a title for your release.');
      return;
    }

    if (isShort && detectedDuration && detectedDuration > 50) {
      setError(`Shorts must be 50 seconds or less in duration. Current video is ${detectedDuration}s.`);
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(15);

    try {
      let videoUrl = '';
      if (videoFile) {
        setUploadProgress(25);
        videoUrl = await uploadDirect(isShort ? 'videos' : 'videos', videoFile, (p) => {
          setUploadProgress(20 + Math.round(p * 0.65));
        });
      }

      setUploadProgress(90);

      const payload = {
        videoUrl,
        thumbnailUrl: null,
        title,
        description,
        category: isShort ? 'Shorts' : category,
        is_free: isShort ? true : isFree,
        price_rwf: isShort ? 0 : (isFree ? 0 : priceRwf),
        price_usd: isShort ? 0 : Math.round(priceRwf / 1400),
        visibility,
        duration: detectedDuration || (isShort ? 45 : 240),
        media_type: isShort ? 'short' : 'video',
        ownership_declared: true,
        no_ai_declared: true,
        no_copyright_declared: true,
      };

      await api.post('/artist/video/complete', payload);
      
      setUploadProgress(100);
      setCompleted(true);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'Upload failed.');
      setUploading(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setDescription('');
    setVideoFile(null);
    setCompleted(false);
    setUploadProgress(0);
    setUploading(false);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="w-full max-w-2xl bg-[#161616] border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#1A1A1A]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-[#FFB300]">
                <UploadCloud className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Upload New Video</h3>
                <p className="text-xs text-gray-400">Publish music videos, concert streams, or singles</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {completed ? (
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-2xl font-black text-white">Release Published!</h4>
              <p className="text-sm text-gray-300 max-w-md mx-auto">
                "{title}" has been successfully uploaded and is now live on your PAYTUNE channel. Fans can stream and purchase via MTN MoMo and Airtel Money.
              </p>
              <div className="pt-4 flex justify-center gap-3">
                <button
                  onClick={handleClose}
                  className="px-6 py-3 bg-[#FFB300] text-black font-extrabold rounded-xl hover:bg-[#ffc107] transition-all shadow-lg shadow-amber-500/20"
                >
                  View in Content Manager
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
              {/* Release Format Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">
                  Release Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleFormatChange(false)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      !isShort
                        ? 'border-[#FFB300] bg-amber-500/10 text-white'
                        : 'border-white/10 bg-[#1A1A1A] text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${!isShort ? 'bg-[#FFB300] text-black' : 'bg-white/5 text-gray-400'}`}>
                      <Monitor className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-black">Standard Video</span>
                      <span className="text-[11px] text-gray-400">16:9 Landscape • Full length • Monetizable</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFormatChange(true)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      isShort
                        ? 'border-[#FFB300] bg-amber-500/10 text-white'
                        : 'border-white/10 bg-[#1A1A1A] text-gray-400 hover:text-white'
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${isShort ? 'bg-[#FFB300] text-black' : 'bg-white/5 text-gray-400'}`}>
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black">PAYTUNE Short</span>
                        <span className="px-1.5 py-0.2 text-[9px] font-black bg-amber-500/20 text-[#FFB300] rounded">≤50s</span>
                      </div>
                      <span className="text-[11px] text-gray-400">9:16 Vertical • Max 50s • Shorts Feed</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* File Dropzone / Select */}
              <div className="border-2 border-dashed border-white/15 rounded-2xl p-6 text-center hover:border-amber-500/50 transition-colors bg-[#1A1A1A]/40 relative group">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoSelect}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="flex flex-col items-center">
                  <div className="p-3.5 rounded-full bg-amber-500/10 text-[#FFB300] mb-3 group-hover:scale-110 transition-transform">
                    {isShort ? <Smartphone className="w-6 h-6" /> : <Film className="w-6 h-6" />}
                  </div>
                  <h4 className="font-bold text-sm text-white mb-1">
                    {videoFile ? videoFile.name : `Select or drag your ${isShort ? 'Short' : 'video'} file here`}
                  </h4>
                  <p className="text-xs text-gray-400">
                    {isShort 
                      ? 'MP4 or WebM • 9:16 vertical • Maximum 50 seconds duration' 
                      : 'MP4, MOV, or WebM up to 4K resolution. High bitrate recommended.'}
                  </p>
                  {videoFile && (
                    <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
                      <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                        {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                      </span>
                      {detectedDuration !== null && (
                        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                          isShort && detectedDuration > 50 
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                            : 'bg-white/10 text-gray-300'
                        }`}>
                          <Clock className="w-3 h-3 inline mr-1" />
                          {detectedDuration}s duration {isShort && detectedDuration > 50 && '(exceeds 50s limit)'}
                        </span>
                      )}
                      {detectedAspectRatio && (
                        <span className="text-[11px] font-bold bg-white/10 text-gray-300 px-2.5 py-1 rounded-full">
                          Ratio: {detectedAspectRatio}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Shorts Duration Error */}
              {durationError && (
                <div className="flex items-center gap-2 p-3 bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{durationError}</span>
                </div>
              )}

              {/* Aspect Ratio Warning */}
              {aspectRatioWarning && (
                <div className="flex items-center gap-2 p-3 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{aspectRatioWarning}</span>
                </div>
              )}

              {/* Title & Category */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                    Release Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Nyash (Official Music Video)"
                    className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFB300]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFB300]"
                  >
                    <option value="Afrobeat">Afrobeat</option>
                    <option value="Gospel">Gospel</option>
                    <option value="Traditional">Traditional</option>
                    <option value="Hip Hop">Hip Hop</option>
                    <option value="R&B">R&B</option>
                    <option value="Live Concert">Live Concert</option>
                    <option value="Shorts">Shorts</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  Description & Credits
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Song producer, director, lyrics, social links..."
                  className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[#FFB300] resize-none"
                />
              </div>

              {/* Thumbnail & Preview */}
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  Video Thumbnail
                </label>
                <div className="flex items-center gap-4 p-3 rounded-xl bg-[#1A1A1A] border border-white/10">
                  {thumbnailPreview ? (
                    <img
                      src={thumbnailPreview}
                      alt="Thumbnail preview"
                      className="w-24 h-16 object-cover rounded-lg border border-white/10 shrink-0"
                    />
                  ) : (
                    <div className="w-24 h-16 rounded-lg bg-white/5 border border-white/10 shrink-0 flex items-center justify-center text-gray-500 text-xs">
                      No cover
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-bold text-white hover:bg-white/10 cursor-pointer transition-colors">
                      <ImageIcon className="w-4 h-4 text-[#FFB300]" />
                      <span>Choose Custom Cover</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleThumbnailSelect}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[11px] text-gray-400 mt-1">
                      1280x720 (16:9) recommended. JPG or PNG.
                    </p>
                  </div>
                </div>
              </div>

              {/* Pay-Per-View Pricing Section */}
              <div className="p-4 rounded-xl bg-[#1F1F1F] border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider block">
                      Monetization Model
                    </span>
                    <span className="text-xs text-gray-400">
                      You retain 70% of all after-VAT purchases
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsFree(false)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        !isFree
                          ? 'bg-[#FFB300] text-black shadow-md shadow-amber-500/20'
                          : 'bg-[#161616] text-gray-400 hover:text-white border border-white/10'
                      }`}
                    >
                      Pay-Per-View
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFree(true)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        isFree
                          ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                          : 'bg-[#161616] text-gray-400 hover:text-white border border-white/10'
                      }`}
                    >
                      Free Release
                    </button>
                  </div>
                </div>

                {!isFree && (
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1">
                        Price (RWF)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={200}
                          step={100}
                          value={priceRwf}
                          onChange={(e) => setPriceRwf(Number(e.target.value))}
                          className="w-full bg-[#161616] border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-[#FFB300]"
                        />
                        <span className="absolute right-3 top-2 text-xs text-gray-400 font-bold">
                          RWF
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1 block">
                        Your cut: ~{Math.round(priceRwf * 0.95 * 0.70).toLocaleString()} RWF per view
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-300 mb-1">
                        Free Preview Teaser
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={10}
                          max={120}
                          value={previewDuration}
                          onChange={(e) => setPreviewDuration(Number(e.target.value))}
                          className="w-full bg-[#161616] border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-[#FFB300]"
                        />
                        <span className="absolute right-3 top-2 text-xs text-gray-400 font-bold">
                          Sec
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1 block">
                        Fans watch this preview before unlocking
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Visibility Setting */}
              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  Publish Visibility
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 'public', label: 'Public', desc: 'Instant discoverability' },
                    { val: 'unlisted', label: 'Unlisted', desc: 'Anyone with link' },
                    { val: 'private', label: 'Private', desc: 'Only you can view' }
                  ].map((v) => (
                    <button
                      key={v.val}
                      type="button"
                      onClick={() => setVisibility(v.val)}
                      className={`p-2.5 rounded-xl border text-left transition-all ${
                        visibility === v.val
                          ? 'border-[#FFB300] bg-amber-500/10 text-[#FFB300]'
                          : 'border-white/10 bg-[#1A1A1A] text-gray-400 hover:text-white'
                      }`}
                    >
                      <span className="block text-xs font-bold">{v.label}</span>
                      <span className="text-[10px] opacity-75">{v.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Progress bar if uploading */}
              {uploading && (
                <div className="p-3 bg-[#1F1F1F] rounded-xl border border-white/5 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-[#FFB300]">Uploading & Transcoding...</span>
                    <span className="font-mono text-gray-300">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-black/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300 rounded-full"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="pt-2 flex justify-end gap-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={uploading}
                  className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-xs font-bold hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-6 py-2.5 rounded-xl bg-[#FFB300] text-black text-xs font-black hover:bg-[#ffc107] transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  {uploading ? `Publishing (${uploadProgress}%)` : 'Publish Release'}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
