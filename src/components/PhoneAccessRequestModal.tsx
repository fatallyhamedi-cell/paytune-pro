import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Phone, ShieldCheck, Clock, X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface PhoneAccessRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoId: string;
  videoTitle: string;
  onAccessGranted?: () => void;
}

export const PhoneAccessRequestModal: React.FC<PhoneAccessRequestModalProps> = ({
  isOpen,
  onClose,
  videoId,
  videoTitle,
  onAccessGranted
}) => {
  const [phone, setPhone] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('paytune_viewer_phone') || '';
    }
    return '';
  });
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<'none' | 'pending' | 'approved' | 'rejected'>('none');

  // Check existing status on open or phone change
  useEffect(() => {
    if (!isOpen || !phone || phone.length < 8) return;

    const timer = setTimeout(() => {
      setCheckingStatus(true);
      axios
        .get(`/api/access-requests/status?phone=${encodeURIComponent(phone)}&videoId=${encodeURIComponent(videoId)}`)
        .then((res) => {
          if (res.data?.status && res.data.status !== 'none') {
            setRequestStatus(res.data.status);
            if (res.data.status === 'approved') {
              setSuccessMessage(`Phone number ${phone} is approved for this video! Playback privilege is granted.`);
              if (onAccessGranted) onAccessGranted();
            } else if (res.data.status === 'pending') {
              setSuccessMessage(`Your request for ${phone} is currently pending administrator review.`);
            } else if (res.data.status === 'rejected') {
              setError(`The access request for ${phone} was declined by administrators.`);
            }
          } else {
            setRequestStatus('none');
          }
        })
        .catch(() => {})
        .finally(() => setCheckingStatus(false));
    }, 600);

    return () => clearTimeout(timer);
  }, [phone, videoId, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.trim().length < 8) {
      setError('Please enter a valid phone number (e.g. 078xxxxxxx or +250 78xxxxxxx).');
      return;
    }

    const cleanPhone = phone.trim().replace(/\s+/g, '');
    if (typeof window !== 'undefined') {
      localStorage.setItem('paytune_viewer_phone', cleanPhone);
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await axios.post('/api/access-requests/submit', {
        phone: cleanPhone,
        videoId,
        name: name.trim(),
        note: note.trim()
      });

      setRequestStatus(res.data?.status || 'pending');
      setSuccessMessage(
        res.data?.message ||
          `Access request submitted for ${cleanPhone}! Your request is pending review by platform administrators. Once approved, you will automatically receive playback privilege to watch this video.`
      );

      if (res.data?.status === 'approved' && onAccessGranted) {
        setTimeout(() => {
          onAccessGranted();
          onClose();
        }, 1500);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit access request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#141414] border border-amber-500/30 rounded-2xl p-6 md:p-8 text-white shadow-2xl space-y-5">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            Special Access Request
          </div>
          <h2 className="text-xl md:text-2xl font-black text-white">Request Phone Approval to Watch</h2>
          <p className="text-sm text-gray-400 line-clamp-1">
            Release: <span className="text-amber-400 font-semibold">{videoTitle}</span>
          </p>
        </div>

        {/* Status Notification Banners */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-sm font-medium flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-400" />
            <div className="space-y-1">
              <p className="font-bold text-white">Status Update</p>
              <p>{successMessage}</p>
            </div>
          </div>
        )}

        {/* Form Body */}
        {requestStatus !== 'approved' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                Phone Number <span className="text-amber-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="tel"
                  placeholder="e.g. 0780000000 or +250 788 123 456"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-[#1e1e1e] border border-gray-800 focus:border-amber-500 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 outline-none transition-colors pl-11"
                  required
                />
                <Phone className="w-4 h-4 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2" />
                {checkingStatus && (
                  <Loader2 className="w-4 h-4 text-amber-500 animate-spin absolute right-4 top-1/2 -translate-y-1/2" />
                )}
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                Enter your mobile number. Once approved by our team, playback privileges will be unlocked for this phone.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                Your Name <span className="text-gray-500 text-[10px] lowercase">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="Full name or alias"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-gray-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-300 mb-1.5">
                Justification / Note <span className="text-gray-500 text-[10px] lowercase">(optional)</span>
              </label>
              <textarea
                placeholder="e.g. VIP reviewer, media partner, press pass..."
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-[#1e1e1e] border border-gray-800 focus:border-amber-500 rounded-xl px-4 py-2.5 text-white text-sm placeholder-gray-500 outline-none transition-colors resize-none"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-gray-400 hover:text-white text-sm font-semibold hover:bg-gray-800/40 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !phone.trim()}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting Request...
                  </>
                ) : (
                  <>
                    <Phone className="w-4 h-4 fill-current" />
                    Submit Access Request
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {requestStatus === 'approved' && (
          <div className="pt-2 flex justify-end">
            <button
              onClick={() => {
                if (onAccessGranted) onAccessGranted();
                onClose();
              }}
              className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-sm transition-all"
            >
              Start Watching Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
