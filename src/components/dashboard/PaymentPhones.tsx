import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Smartphone, Plus, Trash2, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { PaymentPhone } from '../../types/dashboard';

export const PaymentPhones: React.FC = () => {
  const [phones, setPhones] = useState<PaymentPhone[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [providerInput, setProviderInput] = useState<'MTN' | 'Airtel'>('MTN');
  const [isDefaultInput, setIsDefaultInput] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchPhones = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/user/payment-phones');
      setPhones(res.data || []);
    } catch (err: any) {
      console.error('Failed to fetch payment phones:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPhones();
  }, []);

  // Detect provider automatically on phone type
  const handlePhoneChange = (val: string) => {
    setPhoneInput(val);
    const clean = val.replace(/\s+/g, '');
    if (clean.startsWith('078') || clean.startsWith('079') || clean.startsWith('25078') || clean.startsWith('25079')) {
      setProviderInput('MTN');
    } else if (clean.startsWith('072') || clean.startsWith('073') || clean.startsWith('25072') || clean.startsWith('25073')) {
      setProviderInput('Airtel');
    }
  };

  const handleAddPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await axios.post('/api/user/payment-phones', {
        phone: phoneInput,
        provider: providerInput,
        is_default: isDefaultInput
      });

      setFeedback('Payment phone added successfully!');
      setTimeout(() => setFeedback(null), 3500);
      setIsModalOpen(false);
      setPhoneInput('');
      setIsDefaultInput(false);
      await fetchPhones();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add payment phone number.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetDefault = async (phone: PaymentPhone) => {
    try {
      await axios.post('/api/user/payment-phones', {
        phone: phone.phone,
        provider: phone.provider,
        is_default: true
      });
      setFeedback(`Set ${phone.phone} as default payment phone.`);
      setTimeout(() => setFeedback(null), 3000);
      await fetchPhones();
    } catch (err: any) {
      console.error('Failed to set default phone:', err);
    }
  };

  const handleDeletePhone = async (id: string) => {
    if (!confirm('Are you sure you want to remove this payment phone?')) return;
    try {
      await axios.delete(`/api/user/payment-phones/${id}`);
      setPhones(prev => prev.filter(p => p.id !== id));
      setFeedback('Payment phone removed.');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      console.error('Failed to delete payment phone:', err);
    }
  };

  return (
    <div className="space-y-6" id="payment-phones-section">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Smartphone className="w-6 h-6 text-[#FFB300]" />
            Saved Mobile Money Numbers
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Manage your MTN MoMo & Airtel Money numbers for instant 1-click video purchases & tips.
          </p>
        </div>
        <button
          id="add-payment-phone-btn"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#FFB300] hover:bg-[#ffc107] text-black font-semibold text-sm rounded-xl transition-all shadow-md active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Phone Number
        </button>
      </div>

      {feedback && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {feedback}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2].map(n => (
            <div key={n} className="h-32 bg-[#1A1A1A] rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : phones.length === 0 ? (
        <div className="p-8 text-center bg-[#141414] border border-white/5 rounded-2xl">
          <Smartphone className="w-12 h-12 mx-auto text-gray-600 mb-3" />
          <h3 className="text-base font-semibold text-white">No payment numbers saved yet</h3>
          <p className="text-sm text-gray-400 max-w-sm mx-auto mt-1 mb-4">
            Add your Rwandan mobile money number to unlock frictionless purchases with zero manual typing at checkout.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFB300] text-black font-medium text-sm rounded-xl"
          >
            <Plus className="w-4 h-4" />
            Add MTN / Airtel Number
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {phones.map(phone => (
            <div
              key={phone.id}
              id={`phone-card-${phone.id}`}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                phone.is_default
                  ? 'bg-[#1C1A14] border-[#FFB300]/40 shadow-lg shadow-[#FFB300]/5'
                  : 'bg-[#161616] border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                    phone.provider === 'MTN'
                      ? 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
                  }`}>
                    {phone.provider}
                  </div>
                  <div>
                    <span className="font-mono text-base font-bold text-white tracking-wider">
                      {phone.phone}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{phone.provider} Mobile Money</span>
                      {phone.is_default && (
                        <span className="px-2 py-0.5 bg-[#FFB300] text-black text-[10px] font-bold rounded-full">
                          PRIMARY
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  id={`delete-phone-${phone.id}`}
                  onClick={() => handleDeletePhone(phone.id)}
                  className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-xl transition-colors"
                  title="Remove phone"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                <span className="text-gray-500 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Secured & verified
                </span>
                {!phone.is_default ? (
                  <button
                    id={`set-default-phone-${phone.id}`}
                    onClick={() => handleSetDefault(phone)}
                    className="text-[#FFB300] hover:underline font-medium"
                  >
                    Set as Default
                  </button>
                ) : (
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Default for checkout
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Phone Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#181818] border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Add Mobile Money Phone</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleAddPhone} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Rwandan Phone Number
                </label>
                <input
                  type="tel"
                  id="new-payment-phone-input"
                  value={phoneInput}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="078XXXXXXX or 072XXXXXXX"
                  required
                  className="w-full px-4 py-3 bg-[#111111] border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-[#FFB300]"
                />
                <span className="text-[11px] text-gray-400 mt-1 block">
                  Supported prefixes: 078, 079 (MTN) & 072, 073 (Airtel)
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-300 mb-1">
                  Network Provider
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setProviderInput('MTN')}
                    className={`py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all ${
                      providerInput === 'MTN'
                        ? 'bg-yellow-400/20 border-yellow-400 text-yellow-400'
                        : 'bg-[#111111] border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    MTN MoMo
                  </button>
                  <button
                    type="button"
                    onClick={() => setProviderInput('Airtel')}
                    className={`py-2.5 px-4 rounded-xl border text-sm font-semibold transition-all ${
                      providerInput === 'Airtel'
                        ? 'bg-red-500/20 border-red-500 text-red-400'
                        : 'bg-[#111111] border-white/10 text-gray-400 hover:text-white'
                    }`}
                  >
                    Airtel Money
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="set-as-default-checkbox"
                  checked={isDefaultInput}
                  onChange={(e) => setIsDefaultInput(e.target.checked)}
                  className="w-4 h-4 rounded text-[#FFB300] focus:ring-[#FFB300] bg-black border-white/20"
                />
                <label htmlFor="set-as-default-checkbox" className="text-xs text-gray-300 cursor-pointer">
                  Set as my default payment number for checkout
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-sm text-gray-400 hover:text-white rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="save-payment-phone-submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-[#FFB300] text-black font-semibold text-sm rounded-xl hover:bg-[#ffc107] disabled:opacity-50 transition-all shadow-md"
                >
                  {submitting ? 'Saving...' : 'Save Number'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
