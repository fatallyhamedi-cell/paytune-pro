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
      .then(r => setData(r.data))
      .catch(err => {
        console.error('Failed to load earnings:', err);
        setError(err.response?.data?.error || 'Failed to load earnings');
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

    const val = Number(amount);
    if (!val || val < 5000) {
      return setError('Minimum withdrawal amount is 5,000 RWF');
    }

    if (data?.balance && val > Number(data.balance)) {
      return setError('Withdrawal amount cannot exceed your available balance');
    }

    setSubmitting(true);
    try {
      await api.post('/artist/withdraw/request', { amount: val });
      setMessage(`Successfully requested withdrawal of ${val.toLocaleString()} RWF via MoMo.`);
      setAmount('');
      load();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Withdrawal request failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-gray-400">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mr-3" />
        Loading earnings...
      </div>
    );
  }

  const currency = data?.currency || 'RWF';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Earnings & MoMo Payouts</h1>
        <p className="text-xs text-gray-400">Manage your pay-per-view revenues and submit withdrawal requests</p>
      </div>

      {/* Balance Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card
          label="AVAILABLE FOR WITHDRAWAL"
          value={`${Number(data?.balance || 0).toLocaleString()} ${currency}`}
          highlight
        />
        <Card
          label="PENDING DISBURSEMENTS"
          value={`${Number(data?.pending_balance || 0).toLocaleString()} ${currency}`}
        />
        <Card
          label="LIFETIME TOTAL EARNED"
          value={`${Number(data?.total_earned || 0).toLocaleString()} ${currency}`}
        />
      </div>

      {/* Request Withdrawal Section */}
      <div className="bg-[#161616] p-6 rounded-2xl border border-gray-800 space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white">Request MoMo Payout</h2>
          <p className="text-xs text-gray-400">
            Funds will be transferred directly to your registered Mobile Money number (MTN / Airtel).
          </p>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-emerald-500/20 border border-emerald-500 text-emerald-300 p-3 rounded-lg text-sm">
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
              className="w-full p-3.5 rounded-xl bg-[#222] text-white border border-gray-700 focus:border-amber-500 focus:outline-none font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !amount || Number(amount) < 5000}
            className="bg-amber-500 hover:bg-amber-400 text-black px-6 py-3.5 rounded-xl font-bold transition-colors disabled:opacity-50 cursor-pointer shadow-md"
          >
            {submitting ? 'Submitting...' : 'Request Payout'}
          </button>
        </form>
      </div>

      {/* Withdrawal History */}
      <div className="bg-[#161616] p-6 rounded-2xl border border-gray-800 space-y-4">
        <h2 className="text-lg font-bold text-white">Withdrawal History</h2>
        {(data?.withdrawals || []).length === 0 ? (
          <p className="text-gray-500 text-sm">No withdrawals submitted yet.</p>
        ) : (
          <div className="divide-y divide-gray-800">
            {data.withdrawals.map((w: any) => (
              <div key={w.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">
                    {Number(w.amount).toLocaleString()} {currency}
                  </p>
                  <p className="text-xs text-gray-500">
                    {w.requested_at ? new Date(w.requested_at).toLocaleString() : 'Recent'} • {w.provider || 'MTN'} ({w.phone_number || 'Registered MoMo'})
                  </p>
                </div>
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    w.status === 'completed'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : w.status === 'failed'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
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
      className={`rounded-2xl p-5 border ${
        highlight
          ? 'bg-amber-500/15 border-amber-500/40 shadow-lg'
          : 'bg-[#161616] border-gray-800'
      }`}
    >
      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-black mt-2 ${highlight ? 'text-amber-400' : 'text-white'}`}>
        {value}
      </p>
    </div>
  );
}
