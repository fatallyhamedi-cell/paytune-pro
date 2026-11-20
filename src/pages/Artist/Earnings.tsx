import { useEffect, useState } from 'react';
import api from '../../services/api';

export default function ArtistEarnings() {
  const [data, setData] = useState<any>(null);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get('/artist/earnings')
      .then((r) => setData(r.data))
      .catch((err) => {
        console.error('Failed to load earnings:', err);
        setError(err.response?.data?.message || err.response?.data?.error || 'Failed to load earnings');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    const available = Number(data?.balance ?? data?.current_balance ?? 0);
    const val = Number(amount);
    if (!val || val < 5000) {
      return setError('Minimum withdrawal amount is 5,000 RWF');
    }

    if (val > available) {
      return setError('Withdrawal amount cannot exceed your available balance');
    }

    setSubmitting(true);
    try {
      await api.post('/artist/withdraw/request', { amount: val });
      setMessage(`Successfully requested withdrawal of ${val.toLocaleString()} RWF via MoMo.`);
      setAmount('');
      load();
    } catch (err: any) {
      setError(err.response?.data?.message || err.response?.data?.error || err.message || 'Withdrawal request failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-500 dark:text-gray-400">
        <div className="w-8 h-8 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mr-3" />
        Loading earnings...
      </div>
    );
  }

  const currency = data?.currency || 'RWF';
  const availableBalance = Number(data?.balance ?? data?.current_balance ?? 0);
  const pendingBalance = Number(data?.pending_balance ?? 0);
  const totalEarned = Number(data?.total_earned ?? data?.total_earnings ?? 0);
  const withdrawals = Array.isArray(data?.withdrawals) ? data.withdrawals : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Earnings & MoMo Payouts</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Manage your pay-per-view revenues and submit withdrawal requests
        </p>
      </div>

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          label="AVAILABLE FOR WITHDRAWAL"
          value={`${availableBalance.toLocaleString()} ${currency}`}
          highlight
        />
        <Card
          label="PENDING DISBURSEMENTS"
          value={`${pendingBalance.toLocaleString()} ${currency}`}
        />
        <Card
          label="LIFETIME TOTAL EARNED"
          value={`${totalEarned.toLocaleString()} ${currency}`}
        />
      </div>

      {/* Request Withdrawal Section */}
      <div className="bg-white dark:bg-[#161616] p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Request MoMo Payout</h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Funds will be transferred directly to your registered Mobile Money number (MTN / Airtel).
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-500/20 border border-red-200 dark:border-red-500 text-red-700 dark:text-red-400 p-3 rounded-xl text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-emerald-50 dark:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500 text-emerald-700 dark:text-emerald-300 p-3 rounded-xl text-sm">
            {message}
          </div>
        )}

        <form onSubmit={handleWithdraw} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <input
              type="number"
              placeholder="Amount (min 5,000 RWF)"
              min={5000}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-3.5 rounded-xl bg-gray-50 dark:bg-[#222] text-gray-900 dark:text-white border border-gray-300 dark:border-gray-700 focus:border-purple-500 focus:outline-none font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !amount || Number(amount) < 5000}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3.5 rounded-xl font-bold transition-colors disabled:opacity-50 cursor-pointer shadow-sm"
          >
            {submitting ? 'Submitting...' : 'Request Payout'}
          </button>
        </form>
      </div>

      {/* Withdrawal History */}
      <div className="bg-white dark:bg-[#161616] p-6 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Withdrawal History</h2>
        {withdrawals.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">No withdrawals submitted yet.</p>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {withdrawals.map((w: any) => (
              <div key={w.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {Number(w.amount).toLocaleString()} {w.currency || currency}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {w.requested_at ? new Date(w.requested_at).toLocaleString() : 'Recent'} • {w.provider || 'MTN'} ({w.phone_number || 'Registered MoMo'})
                  </p>
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    w.status === 'completed' || w.status === 'paid'
                      ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/40'
                      : w.status === 'failed' || w.status === 'rejected'
                      ? 'bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/40'
                      : 'bg-purple-50 dark:bg-purple-600/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-600/40'
                  }`}
                >
                  {w.status?.toUpperCase() || 'PENDING'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-5 border shadow-sm ${
        highlight
          ? 'bg-purple-50 dark:bg-purple-600/15 border-purple-200 dark:border-purple-600/40'
          : 'bg-white dark:bg-[#161616] border-gray-200 dark:border-gray-800'
      }`}
    >
      <p className="text-gray-600 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-black mt-2 ${highlight ? 'text-purple-700 dark:text-purple-400' : 'text-gray-900 dark:text-white'}`}>
        {value}
      </p>
    </div>
  );
}
