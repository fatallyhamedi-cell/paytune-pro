import React, { useState, useEffect } from 'react';
import { 
  X, 
  Smartphone, 
  CreditCard, 
  ShieldCheck, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  Lock,
  ArrowRight,
  Info
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { PaymentSuccess } from './PaymentSuccess';
import { invokeEdgeFunction } from '../lib/supabase';

export interface PaymentModalProps {
  isOpen?: boolean;
  onClose: () => void;
  video?: {
    id: string;
    title: string;
    artist_name?: string;
    artist_id?: string;
    thumbnail_url?: string;
    price_rwf: number;
    price_usd?: number;
  };
  videoId?: string;
  artistId?: string;
  amount?: number;
  currency?: string;
  paymentType?: 'purchase' | 'super_thanks' | 'membership' | 'live_donation';
  onSuccess?: (purchaseData?: any) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen = true,
  onClose,
  video,
  videoId: propVideoId,
  artistId: propArtistId,
  amount: propAmount,
  currency: propCurrency = 'RWF',
  paymentType = 'purchase',
  onSuccess
}) => {
  const { user } = useAuth();

  // Resolved parameters
  const resolvedVideoId = propVideoId || video?.id || '';
  const resolvedArtistId = propArtistId || (video as any)?.artist_id || '';
  const resolvedAmount = propAmount !== undefined ? propAmount : (Number(video?.price_rwf) || 1000);
  const resolvedCurrency = propCurrency || 'RWF';

  // Provider state: MTN MoMo, Airtel Money, Stripe
  const [provider, setProvider] = useState<'mtn_momo' | 'airtel_money' | 'stripe'>('mtn_momo');
  const [phoneNumber, setPhoneNumber] = useState('078');
  const [message, setMessage] = useState('');
  
  // Processing & Polling states
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);
  const [confirmedPayment, setConfirmedPayment] = useState<any | null>(null);

  useEffect(() => {
    if (provider === 'airtel_money' && phoneNumber.startsWith('078')) {
      setPhoneNumber('073');
    } else if (provider === 'mtn_momo' && phoneNumber.startsWith('073')) {
      setPhoneNumber('078');
    }
  }, [provider]);

  // Clean up polling interval when component unmounts
  useEffect(() => {
    let intervalId: any = null;

    if (activePaymentId && processing) {
      intervalId = setInterval(async () => {
        try {
          const res = await api.get(`/api/payments/${activePaymentId}/status`);

          if (res.data?.status === 'paid') {
            clearInterval(intervalId);
            setProcessing(false);
            setConfirmedPayment(res.data.payment || res.data);
            if (onSuccess) {
              onSuccess(res.data.payment || res.data);
            }
          } else if (res.data?.status === 'failed' || res.data?.status === 'cancelled') {
            clearInterval(intervalId);
            setProcessing(false);
            setError('Payment was declined or cancelled by the provider. Please try again.');
          }
        } catch (err: any) {
          console.warn('[PaymentModal] Polling error:', err.message);
        }
      }, 2500);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [activePaymentId, processing, onSuccess]);

  if (!isOpen) return null;

  const handleApproveSimulated = async () => {
    if (!activePaymentId) return;
    try {
      setStatusMessage('Authorizing via Supabase Edge Function...');
      
      // Execute 5% VAT & 70/30 split via Edge Function
      const edgeResult = await invokeEdgeFunction('process-payment', {
        videoId: resolvedVideoId,
        userId: user?.id || 'guest_user',
        amount: resolvedAmount,
        paymentPhone: phoneNumber,
        paymentMethod: provider === 'mtn_momo' ? 'MTN MoMo' : provider === 'airtel_money' ? 'Airtel Money' : 'Stripe Card',
        transactionId: `tx_${Date.now()}`
      });

      const res = await api.post(`/api/payments/${activePaymentId}/approve`);
      if (res.data?.status === 'paid' || res.data?.success || edgeResult.data?.success) {
        setProcessing(false);
        const finalPayment = res.data?.payment || edgeResult.data?.purchase || res.data;
        setConfirmedPayment(finalPayment);
        if (onSuccess) {
          onSuccess(finalPayment);
        }
      }
    } catch (err: any) {
      setError('Approval error: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleInitiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMessage('');

    if (provider !== 'stripe' && (!phoneNumber || phoneNumber.length < 9)) {
      setError('Please enter a valid mobile money phone number (e.g., 078xxxxxxx).');
      return;
    }

    setProcessing(true);
    setStatusMessage('Initiating transaction with payment gateway...');

    try {
      const payload = {
        videoId: resolvedVideoId,
        artistId: resolvedArtistId,
        paymentType,
        amount: resolvedAmount,
        currency: resolvedCurrency,
        provider,
        phoneNumber: provider !== 'stripe' ? phoneNumber : undefined,
        message: paymentType === 'super_thanks' ? message : undefined
      };

      const res = await api.post('/api/payments/initiate', payload);

      const data = res.data;
      if (!data.paymentId) {
        throw new Error(data.message || 'Payment initiation did not return a valid payment ID');
      }

      setActivePaymentId(data.paymentId);

      if (provider === 'mtn_momo') {
        setStatusMessage('USSD prompt sent to your phone! Please enter your MTN MoMo PIN to authorize.');
      } else if (provider === 'airtel_money') {
        setStatusMessage('Prompt sent to your Airtel Money phone! Please approve with your PIN.');
      } else if (provider === 'stripe') {
        setStatusMessage('Securing payment with Stripe. Verifying card...');
        setTimeout(async () => {
          try {
            const statusRes = await api.get(`/api/payments/${data.paymentId}/status`);
            if (statusRes.data?.status === 'paid') {
              setProcessing(false);
              setConfirmedPayment(statusRes.data.payment || statusRes.data);
              if (onSuccess) onSuccess(statusRes.data.payment || statusRes.data);
            }
          } catch {
            // continue polling
          }
        }, 3000);
      }
    } catch (err: any) {
      setProcessing(false);
      const msg = err.response?.data?.message || err.response?.data?.error || err.message || 'Payment initiation failed';
      setError(msg);
    }
  };

  const handleFinish = () => {
    setConfirmedPayment(null);
    onClose();
  };

  return (
    <>
      {confirmedPayment ? (
        <PaymentSuccess
          message={
            paymentType === 'purchase'
              ? `You now have full, lifetime access to ${video?.title || 'this video'}. Enjoy playback!`
              : `Your Super Thanks donation of ${resolvedAmount} ${resolvedCurrency} was successfully sent to the artist!`
          }
          amount={resolvedAmount}
          currency={resolvedCurrency}
          receiptNumber={confirmedPayment.provider_transaction_id || confirmedPayment.id}
          onClose={handleFinish}
        />
      ) : (
        <div 
          id="payment-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn"
        >
          <div 
            id="payment-modal-card"
            className="relative w-full max-w-md bg-[#1A1A1A] border border-amber-500/20 rounded-2xl shadow-2xl p-6 text-white overflow-hidden"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              id="close-payment-modal"
              disabled={processing}
              className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-white hover:bg-gray-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Title & Product Info */}
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified PAYTUNE Checkout</span>
              </div>
              <h3 className="text-xl font-bold text-white">
                {paymentType === 'purchase' ? 'Buy Video Access' : 'Send Super Thanks'}
              </h3>
              {video?.title && (
                <p className="text-gray-400 text-xs mt-1 truncate">
                  {video.title} {video.artist_name ? `• ${video.artist_name}` : ''}
                </p>
              )}
            </div>

            {/* Price Banner with Edge Function 5% VAT & 70/30 Split Breakdown */}
            <div className="bg-[#242424] border border-gray-800 rounded-xl p-4 mb-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider block font-bold">Total Amount</span>
                  <span className="text-2xl font-black text-amber-400">
                    {resolvedAmount.toLocaleString()} {resolvedCurrency}
                  </span>
                </div>
                <div className="text-right text-xs">
                  <span className="text-emerald-400 font-bold block">Instant Lifetime Unlock</span>
                  <span className="text-gray-400 text-[10px]">No monthly fees</span>
                </div>
              </div>

              {/* Edge Function VAT & Split Transparency */}
              <div className="pt-2 border-t border-gray-800/80 text-[10px] grid grid-cols-3 gap-1.5 bg-[#1a1a1a] p-2 rounded-lg text-center">
                <div className="border-r border-gray-800/80 pr-1">
                  <span className="text-gray-400 block uppercase text-[9px]">RRA VAT (5%)</span>
                  <span className="text-gray-300 font-bold">{Math.round(resolvedAmount * 0.05).toLocaleString()} {resolvedCurrency}</span>
                </div>
                <div className="border-r border-gray-800/80 px-1">
                  <span className="text-amber-400/90 block uppercase text-[9px] font-bold">Artist (70%)</span>
                  <span className="text-amber-400 font-extrabold">{Math.round(resolvedAmount * 0.95 * 0.70).toLocaleString()} {resolvedCurrency}</span>
                </div>
                <div className="pl-1">
                  <span className="text-gray-400 block uppercase text-[9px]">Platform (30%)</span>
                  <span className="text-gray-300 font-semibold">{Math.round(resolvedAmount * 0.95 * 0.30).toLocaleString()} {resolvedCurrency}</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 mb-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Payment Method Selector */}
            <form onSubmit={handleInitiatePayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2">
                  Select Payment Gateway
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setProvider('mtn_momo')}
                    disabled={processing}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-semibold transition cursor-pointer ${
                      provider === 'mtn_momo'
                        ? 'bg-amber-500/15 border-amber-500 text-amber-400'
                        : 'bg-[#242424] border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                    }`}
                  >
                    <Smartphone className="w-5 h-5 text-yellow-400" />
                    <span>MTN MoMo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProvider('airtel_money')}
                    disabled={processing}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-semibold transition cursor-pointer ${
                      provider === 'airtel_money'
                        ? 'bg-red-500/15 border-red-500 text-red-400'
                        : 'bg-[#242424] border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                    }`}
                  >
                    <Smartphone className="w-5 h-5 text-red-500" />
                    <span>Airtel Money</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setProvider('stripe')}
                    disabled={processing}
                    className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-semibold transition cursor-pointer ${
                      provider === 'stripe'
                        ? 'bg-blue-500/15 border-blue-500 text-blue-400'
                        : 'bg-[#242424] border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-blue-400" />
                    <span>Card / Stripe</span>
                  </button>
                </div>
              </div>

              {/* Phone Input for Mobile Money */}
              {provider !== 'stripe' ? (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    {provider === 'mtn_momo' ? 'MTN Mobile Money Phone Number' : 'Airtel Money Phone Number'}
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="e.g., 0788123456"
                      disabled={processing}
                      className="w-full bg-[#242424] border border-gray-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-4 py-3 text-white placeholder-gray-500 text-sm outline-none transition"
                      required
                    />
                  </div>
                  <span className="text-[11px] text-gray-400 mt-1 block">
                    You will receive a USSD payment prompt on this handset to enter your PIN.
                  </span>
                </div>
              ) : (
                <div className="bg-[#242424] border border-gray-800 rounded-xl p-3.5 text-xs text-gray-300 flex items-center gap-3">
                  <Lock className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>Secure 256-bit encrypted checkout powered by Stripe for international cards.</span>
                </div>
              )}

              {/* Super Thanks Message */}
              {paymentType === 'super_thanks' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                    Your Donation Message (Optional)
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Say something inspiring to the artist..."
                    rows={2}
                    disabled={processing}
                    className="w-full bg-[#242424] border border-gray-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-4 py-2.5 text-white placeholder-gray-500 text-sm outline-none transition"
                  />
                </div>
              )}

              {/* Status Message during Polling */}
              {processing && statusMessage && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-300 flex items-center gap-2.5 animate-pulse">
                  <Loader2 className="w-4 h-4 shrink-0 animate-spin text-amber-400" />
                  <span>{statusMessage}</span>
                </div>
              )}

              {/* Instant Sandbox PIN Simulation Approval Button */}
              {processing && activePaymentId && (
                <button
                  type="button"
                  onClick={handleApproveSimulated}
                  className="w-full py-2.5 px-3 rounded-xl border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Approve USSD PIN Prompt (Instant Demo)</span>
                </button>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={processing}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold py-3.5 rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Waiting for Phone Approval...</span>
                  </>
                ) : (
                  <>
                    <span>Pay {resolvedAmount.toLocaleString()} {resolvedCurrency}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClose}
                disabled={processing}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-200 py-1 transition cursor-pointer"
              >
                Cancel Checkout
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default PaymentModal;
