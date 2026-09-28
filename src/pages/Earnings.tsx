import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Earnings() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/artist/dashboard?tab=earnings', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#0F0F0F] flex items-center justify-center text-gray-400 text-xs">
      Redirecting to Creator Studio Earnings...
    </div>
  );
}
