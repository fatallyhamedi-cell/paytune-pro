import { useEffect, useState } from 'react';
import api from '../../services/api';

export default function ArtistFollowers() {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    api.get('/artist/followers')
      .then(r => setCount(r.data.count || 0))
      .catch(err => console.error('Failed to load followers:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Community & Followers</h1>
        <p className="text-xs text-gray-400">Fans and music listeners who follow your PAYTUNE channel</p>
      </div>

      <div className="bg-[#161616] p-12 rounded-2xl border border-gray-800 text-center max-w-lg mx-auto shadow-xl">
        <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4 text-amber-500 text-3xl">
          👥
        </div>
        {loading ? (
          <div className="text-gray-400">Counting followers...</div>
        ) : (
          <>
            <p className="text-6xl font-black text-amber-400 tracking-tight">
              {count.toLocaleString()}
            </p>
            <p className="text-gray-400 font-medium text-base mt-2">
              {count === 1 ? 'person follows you' : 'people follow you'} on PAYTUNE
            </p>
            <p className="text-xs text-gray-500 mt-4 max-w-xs mx-auto">
              Followers get instant notifications whenever you release new music or start a live pay-per-view session.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
