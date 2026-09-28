import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Wallet, 
  ArrowDownCircle, 
  AlertCircle, 
  CheckCircle2, 
  Phone, 
  Building2, 
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import axios from 'axios';

interface WithdrawalModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
  artistId: string;
  defaultPhone?: string;
  onSuccess: () => void;
}

export const WithdrawalModal: React.FC<WithdrawalModalProps> = ({
  isOpen,
  onClose,
  availableBalance,
  artistId,
  defaultPhone = '',
  onSuccess
}) => {
  const [amount, setAmount] = useState<number>(Math.min(availableBalance, 10000));
  const [paymentMethod, setPaymentMethod] = useState<'MTN Mobile Money' | 'Airtel Money' | 'Bank Transfer'>('MTN Mobile Money');
  const [phone, setPhone] = useState(defaultPhone || '0788112233');
  const [bankName, setBankName] = useState('Bank of Kigali (BK)');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<any | null>(null);

  if (!isOpen) return null;

  const minWithdrawal = 5000;
  const canWithdraw = availableBalance >= minWithdrawal;
  const isValidAmount = amount >= minWithdrawal && amount <= availableBalance;

  // Fee is transparently 0% on PAYTUNE
  const platformFee = 0;
  const netAmount = amount - platformFee;

  const handleQuickAmount = (val: number) => {
    setAmount(Math.min(val, availableBalance));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidAmount) return;

    setLoading(true);
    setError(null);

    try {
      const payload: any = {
        artistId,
        amount,
        payment_method: paymentMethod,
        account_name: accountName
      };

      if (paymentMethod === 'Bank Transfer') {
        payload.account_number = `${bankName} - ${accountNumber}`;
        payload.phone = phone;
      } else {
        payload.phone = phone;
      }

      const res = await axios.post('/api/artist/withdraw', payload);
      setSuccessData(res.data);
      onSuccess();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'Withdrawal request failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    setSuccessData(null);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="w-full max-w-lg bg-[#161616] border border-white/10 rounded-2xl shadow-2xl overflow-hidden text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#1A1A1A]">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-[#FFB300]">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Request Payout</h3>
                <p className="text-xs text-gray-400">Withdraw your 70% content earnings</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {successData ? (
            /* Success State */
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h4 className="text-2xl font-black text-white mb-2">Payout Requested!</h4>
              <p className="text-gray-300 text-sm max-w-sm mx-auto mb-6">
                {successData.message || `Your payout of ${amount.toLocaleString()} RWF is being processed.`}
              </p>
              <div className="bg-[#1F1F1F] p-4 rounded-xl border border-white/5 text-left mb-6 space-y-2">
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Reference:</span>
                  <span className="font-mono text-white">{successData.withdrawal?.reference_code || 'PAYTUNE-WD-2026'}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Amount:</span>
                  <span className="font-bold text-[#FFB300]">{amount.toLocaleString()} RWF</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Destination:</span>
                  <span className="text-white">{phone || accountNumber} ({paymentMethod})</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Status:</span>
                  <span className="text-amber-400 font-bold uppercase text-[10px] bg-amber-500/10 px-2 py-0.5 rounded">
                    Pending Processing
                  </span>
                </div>
              </div>
              <button
                onClick={handleDone}
                className="w-full py-3 bg-[#FFB300] text-black font-extrabold rounded-xl hover:bg-[#ffc107] transition-all shadow-lg shadow-amber-500/20"
              >
                Done
              </button>
            </div>
          ) : (
            /* Withdrawal Form */
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {/* Available Balance Box */}
              <div className="flex items-center justify-between p-4 rounded-xl bg-[#1F1F1F] border border-white/5">
                <div>
                  <span className="text-xs text-gray-400">Available to Withdraw</span>
                  <p className="text-2xl font-black text-[#FFB300]">
                    {availableBalance.toLocaleString()} <span className="text-sm font-semibold text-gray-300">RWF</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-gray-500 block">Min Threshold</span>
                  <span className="text-xs font-semibold text-gray-300">5,000 RWF</span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-2 uppercase tracking-wider">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('MTN Mobile Money')}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-bold ${
                      paymentMethod === 'MTN Mobile Money'
                        ? 'border-[#FFB300] bg-amber-500/10 text-[#FFB300]'
                        : 'border-white/10 bg-[#1A1A1A] text-gray-400 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <Smartphone className="w-5 h-5" />
                    <span>MTN MoMo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Airtel Money')}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-bold ${
                      paymentMethod === 'Airtel Money'
                        ? 'border-[#FFB300] bg-amber-500/10 text-[#FFB300]'
                        : 'border-white/10 bg-[#1A1A1A] text-gray-400 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <Phone className="w-5 h-5" />
                    <span>Airtel Money</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('Bank Transfer')}
                    className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-xs font-bold ${
                      paymentMethod === 'Bank Transfer'
                        ? 'border-[#FFB300] bg-amber-500/10 text-[#FFB300]'
                        : 'border-white/10 bg-[#1A1A1A] text-gray-400 hover:text-white hover:border-white/20'
                    }`}
                  >
                    <Building2 className="w-5 h-5" />
                    <span>Bank Transfer</span>
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                    Amount (RWF)
                  </label>
                  <span className="text-xs text-gray-400">
                    Max: {availableBalance.toLocaleString()} RWF
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={minWithdrawal}
                    max={availableBalance}
                    step={500}
                    value={amount || ''}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white font-bold text-lg focus:outline-none focus:border-[#FFB300]"
                    placeholder="Enter amount"
                    required
                  />
                  <div className="absolute right-3 top-3.5 text-xs font-bold text-gray-400">
                    RWF
                  </div>
                </div>

                {/* Quick amount chips */}
                <div className="flex gap-2 mt-2">
                  {[5000, 10000, 25000, 50000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      disabled={val > availableBalance}
                      onClick={() => handleQuickAmount(val)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        amount === val
                          ? 'bg-[#FFB300] text-black border-[#FFB300]'
                          : val > availableBalance
                          ? 'opacity-30 border-white/5 text-gray-500 cursor-not-allowed'
                          : 'border-white/10 text-gray-300 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      {val.toLocaleString()}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={!canWithdraw}
                    onClick={() => handleQuickAmount(availableBalance)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold border border-amber-500/30 text-[#FFB300] hover:bg-amber-500/10 transition-all ml-auto"
                  >
                    All Available
                  </button>
                </div>
              </div>

              {/* Destination Details */}
              {paymentMethod === 'Bank Transfer' ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1.5">Bank Name</label>
                    <select
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFB300]"
                    >
                      <option value="Bank of Kigali (BK)">Bank of Kigali (BK)</option>
                      <option value="I&M Bank Rwanda">I&M Bank Rwanda</option>
                      <option value="Equity Bank Rwanda">Equity Bank Rwanda</option>
                      <option value="BPR Bank Rwanda">BPR Bank Rwanda</option>
                      <option value="Cogebanque">Cogebanque</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1.5">Account Number</label>
                    <input
                      type="text"
                      placeholder="e.g. 00040-0692233-12"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      required
                      className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFB300]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1.5">Account Holder Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Bruce Melodie"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      required
                      className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#FFB300]"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1.5">
                    {paymentMethod === 'MTN Mobile Money' ? 'MTN MoMo Number' : 'Airtel Money Number'}
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      placeholder="078XXXXXXX or 072XXXXXXX"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      className="w-full bg-[#1A1A1A] border border-white/10 rounded-xl px-4 py-3 text-white font-medium text-sm focus:outline-none focus:border-[#FFB300]"
                    />
                    <div className="absolute right-3 top-3 text-xs text-gray-400 font-bold">
                      RW (+250)
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">
                    Funds will be deposited directly to your registered SIM wallet.
                  </p>
                </div>
              )}

              {/* Fee & Net Calculation */}
              <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-400">
                  <span>Gross Payout:</span>
                  <span>{amount.toLocaleString()} RWF</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Platform Fee (0% promotional):</span>
                  <span className="text-emerald-400 font-bold">0 RWF</span>
                </div>
                <div className="border-t border-white/5 pt-1.5 flex justify-between font-bold text-white">
                  <span>Total Amount Received:</span>
                  <span className="text-[#FFB300] font-black text-sm">{netAmount.toLocaleString()} RWF</span>
                </div>
              </div>

              {error && (
                <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{error}</span>
                  </div>
                  {error.includes("Phone verification is required") && (
                    <div className="pt-1">
                      <a
                        href="/artist/verify-phone"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Verify Phone via SMS Now</span>
                      </a>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!canWithdraw || !isValidAmount || loading}
                  className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
                    !canWithdraw || !isValidAmount
                      ? 'bg-white/10 text-gray-500 cursor-not-allowed'
                      : 'bg-[#FFB300] text-black hover:bg-[#ffc107] shadow-lg shadow-amber-500/20 active:scale-[0.99]'
                  }`}
                >
                  {loading ? (
                    'Processing Payout...'
                  ) : (
                    <>
                      <ArrowDownCircle className="w-5 h-5" />
                      Withdraw {amount > 0 ? `${amount.toLocaleString()} RWF` : ''}
                    </>
                  )}
                </button>

                {!canWithdraw && (
                  <p className="text-center text-xs text-amber-500/80 mt-2 font-medium">
                    Minimum withdrawal is 5,000 RWF. Keep sharing your music!
                  </p>
                )}
              </div>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
