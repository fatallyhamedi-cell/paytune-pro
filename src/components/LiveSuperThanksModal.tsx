import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Smartphone, CreditCard, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

interface LiveSuperThanksModalProps {
  isOpen: boolean;
  onClose: () => void;
  streamId: string;
  artistId?: string | null;
  artistName?: string;
  onSuccess?: (donation: any) => void;
}

const PRESET_AMOUNTS = [1000, 2000, 5000, 10000];

export const LiveSuperThanksModal: React.FC<LiveSuperThanksModalProps> = ({
  isOpen,
  onClose,
  streamId,
  artistId,
  artistName = 'the artist',
  onSuccess
}) => {
  const [amount, setAmount] = useState<number>(2000);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [message, setMessage] = useState<string>('');
  const [provider, setProvider] = useState<'mtn_momo' | 'airtel_money' | 'stripe'>('mtn_momo');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'awaiting_prompt' | 'success'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');

  if (!isOpen) return null;

  const currentAmount = isCustom ? Number(customAmount) || 0 : amount;

  const handlePresetClick = (val: number) => {
    setIsCustom(false);
    setAmount(val);
    setError(null);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsCustom(true);
    setCustomAmount(e.target.value);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (currentAmount < 500) {
      setError('Minimum Super Thanks amount is 500 RWF');
      return;
    }

    if ((provider === 'mtn_momo' || provider === 'airtel_money') && !phoneNumber.trim()) {
      setError('Please enter your mobile money phone number');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('paytune_auth_token') || localStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const payload = {
        paymentType: 'live_donation',
        live_stream_id: streamId,
        streamId,
        artistId: artistId || null,
        amount: currentAmount,
        currency: 'RWF',
        provider,
        phoneNumber: phoneNumber.trim(),
        message: message.trim() || 'Sent Super Thanks!'
      };

      const res = await axios.post('/api/payments/initiate', payload, { headers });
      const data = res.data;

      if (data.success && data.paymentId) {
        setPaymentStatus('awaiting_prompt');
        setStatusMessage(data.message || 'Payment initiated! Please confirm the prompt on your phone.');

        // Poll for confirmation
        const paymentId = data.paymentId;
        const interval = setInterval(async () => {
          try {
            const statusRes = await axios.get(`/api/payments/${paymentId}/status`, { headers });
            if (statusRes.data?.status === 'paid') {
              clearInterval(interval);
              setPaymentStatus('success');
              setStatusMessage('Super Thanks sent successfully! Your message will now shine in live chat.');
              if (onSuccess) onSuccess({ amount: currentAmount, message, paymentId });
              setTimeout(() => {
                onClose();
                setPaymentStatus('idle');
              }, 2500);
            } else if (statusRes.data?.status === 'failed') {
              clearInterval(interval);
              setError('Payment was declined or timed out. Please try again.');
              setPaymentStatus('idle');
            }
          } catch (pollErr) {
            console.warn('Poll error:', pollErr);
          }
        }, 3000);

        // Timeout polling after 60s
        setTimeout(() => clearInterval(interval), 60000);
      } else {
        setError(data.error || 'Failed to initiate payment');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to send Super Thanks');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div 
        id="live-super-thanks-modal"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md bg-white dark:bg-[#121214] border border-gray-100 dark:border-[#262626] rounded-3xl p-6 shadow-2xl space-y-5 text-gray-900 dark:text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div 
                className="w-9 h-9 rounded-2xl flex items-center justify-center text-black font-bold shadow-xs"
                style={{ background: 'linear-gradient(135deg, #FFB300 0%, #FF8F00 100%)' }}
              >
                <Sparkles className="w-5 h-5 fill-black" />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight">Super Thanks</h3>
                <p className="text-xs text-gray-500">Support {artistName} with a highlighted chat badge</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {paymentStatus === 'success' ? (
            <div className="py-8 text-center space-y-3">
              <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto animate-bounce" />
              <h4 className="text-lg font-black text-gray-900 dark:text-white">Thank You!</h4>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">{statusMessage}</p>
            </div>
          ) : paymentStatus === 'awaiting_prompt' ? (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="w-12 h-12 text-amber-500 animate-spin mx-auto" />
              <h4 className="text-base font-black text-gray-900 dark:text-white">Awaiting PIN Approval</h4>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">{statusMessage}</p>
              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs text-amber-900 dark:text-amber-300 font-medium">
                Check your mobile phone ({phoneNumber}) and authorize the transaction with your Mobile Money PIN.
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-2xl flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Amount Presets */}
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-gray-500">
                  Select Amount (RWF)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_AMOUNTS.map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handlePresetClick(val)}
                      className={`py-2 px-1 rounded-xl text-xs font-black transition-all ${
                        !isCustom && amount === val
                          ? 'bg-[#FFB300] text-black shadow-md shadow-amber-500/20'
                          : 'bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-zinc-700'
                      }`}
                    >
                      {val.toLocaleString()}
                    </button>
                  ))}
                </div>

                {/* Custom Amount */}
                <div className="pt-1">
                  <input
                    type="number"
                    min="500"
                    placeholder="Or enter custom amount in RWF..."
                    value={customAmount}
                    onChange={handleCustomChange}
                    className={`w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border bg-gray-50 dark:bg-zinc-900 transition-colors focus:outline-none ${
                      isCustom
                        ? 'border-[#FFB300] ring-1 ring-[#FFB300]'
                        : 'border-gray-200 dark:border-zinc-800'
                    }`}
                  />
                </div>
              </div>

              {/* Message */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase tracking-wider text-gray-500">
                  Super Chat Message
                </label>
                <textarea
                  rows={2}
                  maxLength={160}
                  placeholder="Say something inspiring to the artist..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full text-xs font-medium px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 focus:outline-none focus:border-[#FFB300] transition-colors"
                />
              </div>

              {/* Provider Selection */}
              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-gray-500">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setProvider('mtn_momo')}
                    className={`py-2 px-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 transition-all ${
                      provider === 'mtn_momo'
                        ? 'bg-[#FFB300] text-black shadow-xs'
                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    MTN MoMo
                  </button>

                  <button
                    type="button"
                    onClick={() => setProvider('airtel_money')}
                    className={`py-2 px-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 transition-all ${
                      provider === 'airtel_money'
                        ? 'bg-[#FFB300] text-black shadow-xs'
                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    Airtel
                  </button>

                  <button
                    type="button"
                    onClick={() => setProvider('stripe')}
                    className={`py-2 px-2 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 transition-all ${
                      provider === 'stripe'
                        ? 'bg-[#FFB300] text-black shadow-xs'
                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Card
                  </button>
                </div>
              </div>

              {/* Mobile Money Phone Input */}
              {(provider === 'mtn_momo' || provider === 'airtel_money') && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black uppercase tracking-wider text-gray-500">
                    Phone Number (Rwanda)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g., 0788123456 or 250788123456"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full text-xs font-bold px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900 focus:outline-none focus:border-[#FFB300]"
                  />
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 rounded-2xl font-black text-xs text-black uppercase tracking-wider transition-all shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #FFB300 0%, #FF8F00 100%)' }}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 fill-black" />
                    Send RWF {currentAmount.toLocaleString()} Super Thanks
                  </>
                )}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
