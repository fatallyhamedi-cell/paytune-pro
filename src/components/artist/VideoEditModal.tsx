import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, AlertCircle, Eye, DollarSign, Tag, Film, Clock } from 'lucide-react';
import axios from 'axios';

interface VideoEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: any;
  onSuccess: () => void;
}

export const VideoEditModal: React.FC<VideoEditModalProps> = ({
  isOpen,
  onClose,
  video,
  onSuccess
}) => {
  const [title, setTitle] = useState(video?.title || '');
  const [description, setDescription] = useState(video?.description || '');
  const [category, setCategory] = useState(video?.category || 'Afrobeat');
  const [isFree, setIsFree] = useState(!!video?.is_free);
  const [priceRwf, setPriceRwf] = useState<number>(video?.price_rwf || 1000);
  const [visibility, setVisibility] = useState(video?.visibility || 'public');
  const [previewDuration, setPreviewDuration] = useState<number>(video?.preview_duration || 30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !video) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await axios.put(`/api/artist/video/${video.id}`, {
        title,
        description,
        category,
        is_free: isFree,
        price_rwf: isFree ? 0 : priceRwf,
        visibility,
        preview_duration: previewDuration
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'Failed to update video.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-xl bg-[#161616] border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-white flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#1A1A1A]">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-[#FFB300]">
                <Film className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Edit Video Details</h3>
                <p className="text-xs text-gray-400">Modify metadata, pricing, and visibility</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
            {/* Thumbnail Preview */}
            <div className="flex gap-4 items-center p-3 rounded-xl bg-[#1F1F1F] border border-white/5">
              {video.thumbnail_url ? (
                <img
                  src={video.thumbnail_url}
                  alt={video.title}
                  className="w-24 h-16 object-cover rounded-lg border border-white/10 shrink-0"
                />
              ) : (
                <div className="w-24 h-16 rounded-lg bg-white/5 border border-white/10 shrink-0 flex items-center justify-center text-amber-400 font-bold text-xs">
                  ▶
                </div>
              )}
              <div className="min-w-0 flex-1">
                <span className="text-[10px] uppercase font-bold text-[#FFB300] tracking-wider block">Currently Editing</span>
                <h4 className="text-sm font-semibold text-white truncate">{video.title}</h4>
                <p className="text-xs text-gray-400 mt-0.5">{video.views?.toLocaleString() || 0} views • {video.category}</p>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                Video Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFB300]"
                placeholder="e.g. Sawa Sawa Official Video"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFB300] resize-none"
                placeholder="Tell fans about this track or video..."
              />
            </div>

            {/* Category & Visibility */}
            <div className="grid grid-cols-2 gap-4">
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
                  <option value="Traditional">Traditional (Gakondo)</option>
                  <option value="Hip Hop">Hip Hop / Trap</option>
                  <option value="R&B">R&B / Soul</option>
                  <option value="Live Concert">Live Concert</option>
                  <option value="Shorts">Shorts</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 uppercase tracking-wider mb-1.5">
                  Visibility
                </label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value)}
                  className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFB300]"
                >
                  <option value="public">Public (Everyone)</option>
                  <option value="unlisted">Unlisted (Direct link)</option>
                  <option value="private">Private (Only you)</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>

            {/* Pricing Model */}
            <div className="p-4 rounded-xl bg-[#1F1F1F] border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">
                    Access Type
                  </span>
                  <span className="text-xs text-gray-400">
                    Choose free access or Pay-Per-View pricing
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsFree(true)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isFree
                        ? 'bg-emerald-500 text-black shadow-md shadow-emerald-500/20'
                        : 'bg-[#161616] text-gray-400 hover:text-white border border-white/10'
                    }`}
                  >
                    Free Access
                  </button>
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
                </div>
              </div>

              {!isFree && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">
                      Price in RWF
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={100}
                        step={100}
                        value={priceRwf}
                        onChange={(e) => setPriceRwf(Number(e.target.value))}
                        className="w-full bg-[#161616] border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-[#FFB300]"
                      />
                      <span className="absolute right-3 top-2 text-xs text-gray-400 font-bold">
                        RWF
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">
                      Free Preview (Seconds)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={5}
                        max={120}
                        value={previewDuration}
                        onChange={(e) => setPreviewDuration(Number(e.target.value))}
                        className="w-full bg-[#161616] border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-bold focus:outline-none focus:border-[#FFB300]"
                      />
                      <span className="absolute right-3 top-2 text-xs text-gray-400 font-bold">
                        Sec
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-white/10 text-gray-300 text-xs font-bold hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 rounded-xl bg-[#FFB300] text-black text-xs font-black hover:bg-[#ffc107] transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20"
              >
                <Save className="w-4 h-4" />
                {loading ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
