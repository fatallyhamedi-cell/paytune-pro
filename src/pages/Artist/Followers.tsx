import { useEffect, useState } from 'react';
import api from '../../services/api';

export default function ArtistFollowers() {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    api.get('/artist/followers')
      .then((r) => setCount(r.data.count ?? r.data.total_subscribers ?? 0))
      .catch((err) => console.error('Failed to load followers:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Community & Followers</h1>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Fans and music listeners who follow your PAYTUNE channel
        </p>
      </div>

      <div className="bg-white dark:bg-[#161616] p-12 rounded-2xl border border-gray-200 dark:border-gray-800 text-center max-w-lg mx-auto shadow-sm">
        <div className="w-20 h-20 rounded-full bg-purple-100 dark:bg-purple-600/10 border border-purple-200 dark:border-purple-600/20 flex items-center justify-center mx-auto mb-4 text-purple-600 text-3xl">
          👥
        </div>
        {loading ? (
          <div className="text-gray-500 dark:text-gray-400">Counting followers...</div>
        ) : (
          <>
            <p className="text-6xl font-black text-purple-600 dark:text-purple-400 tracking-tight">
              {count.toLocaleString()}
            </p>
            <p className="text-gray-700 dark:text-gray-300 font-medium text-base mt-2">
              {count === 1 ? 'person follows you' : 'people follow you'} on PAYTUNE
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 max-w-xs mx-auto">
              Followers get instant notifications whenever you release new music or start a live pay-per-view session.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
