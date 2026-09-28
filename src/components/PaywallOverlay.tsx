import React from 'react';
import { Lock, Sparkles, ShieldCheck, Play, ArrowRight, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '../hooks/useAuth';

interface PaywallOverlayProps {
  title: string;
  artistName: string;
  priceRwf: number;
  priceUsd: number;
  onBuyNow: () => void;
  onLoginClick?: () => void;
}

export const PaywallOverlay: React.FC<PaywallOverlayProps> = ({
  title,
  artistName,
  priceRwf,
  priceUsd,
  onBuyNow,
  onLoginClick
}) => {
  const { user } = useAuth();

  return (
    <div 
      id="paywall-overlay"
      className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-black/85 backdrop-blur-md text-white text-center select-none animate-fadeIn"
    >
      {/* Icon Badge */}
      <div className="w-16 h-16 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-4 shadow-lg shadow-amber-500/10">
        <Lock className="w-8 h-8 text-amber-400 animate-pulse" />
      </div>

      {/* Primary Headline */}
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 mb-3">
        <Sparkles className="w-3.5 h-3.5" /> 30-Second Free Preview Ended
      </span>

      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white max-w-xl">
        Unlock Lifetime Access to <span className="text-amber-400">"{title}"</span>
      </h2>

      <p className="text-sm text-gray-300 mt-2 max-w-md">
        By <span className="font-semibold text-white">{artistName}</span>. Pay once, own it forever in your private library.
      </p>

      {/* Pricing Card */}
      <div className="my-6 p-4 rounded-xl bg-[#1a1a1a]/90 border border-gray-800 flex items-center justify-between gap-6 max-w-sm w-full">
        <div className="text-left">
          <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">One-Time Fee</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-400">{priceRwf.toLocaleString()} RWF</span>
            <span className="text-xs text-gray-400">(${priceUsd.toFixed(2)} USD)</span>
          </div>
        </div>
        <div className="text-right">
          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            70% to Artist
          </span>
          <p className="text-[11px] text-gray-400 mt-1">Instant P2P Split</p>
        </div>
      </div>

      {/* CTA Button */}
      {user ? (
        <Button
          id="paywall-buy-now-btn"
          onClick={onBuyNow}
          className="w-full max-w-sm h-12 bg-amber-500 hover:bg-amber-400 text-black font-bold text-base rounded-xl transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer"
        >
          <Play className="w-4 h-4 fill-black" />
          Buy Now for {priceRwf.toLocaleString()} RWF
          <ArrowRight className="w-4 h-4" />
        </Button>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full max-w-sm">
          <Button
            id="paywall-login-btn"
            onClick={onLoginClick || onBuyNow}
            className="flex-1 h-12 bg-amber-500 hover:bg-amber-400 text-black font-bold text-base rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer w-full"
          >
            <UserCheck className="w-4 h-4" />
            Login to Purchase
          </Button>
        </div>
      )}

      {/* Trust & Guarantee Badges */}
      <div className="flex items-center justify-center gap-4 mt-6 text-xs text-gray-400">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" /> Lifetime access
        </span>
        <span>•</span>
        <span>MTN MoMo & Airtel</span>
        <span>•</span>
        <span>Diaspora Stripe</span>
      </div>
    </div>
  );
};
