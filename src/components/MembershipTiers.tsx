import React from 'react';
import { Crown, Check, Sparkles, ShieldCheck, Zap } from 'lucide-react';

interface MembershipTier {
  id: string;
  artist_id?: string;
  name: string;
  price_rwf: number;
  price_usd?: number;
  billing_period?: string;
  description: string;
  perks: string[];
  badge_color?: string;
  color?: string;
  is_popular?: boolean;
  subscribers_count?: number;
}

interface MembershipTiersProps {
  tiers: MembershipTier[];
  artistName: string;
  onSelectTier: (tier: MembershipTier) => void;
  activeTierId?: string | null;
}

export default function MembershipTiers({
  tiers,
  artistName,
  onSelectTier,
  activeTierId
}: MembershipTiersProps) {
  return (
    <div id="channel-membership-section" className="space-y-8 max-w-6xl mx-auto py-2">
      {/* Intro Banner */}
      <div className="text-center space-y-2 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFB300]/10 border border-[#FFB300]/30 text-[#FFB300] text-xs font-bold uppercase tracking-wider">
          <Crown className="w-3.5 h-3.5" />
          Channel Memberships
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-white">
          Become a VIP Member of {artistName}
        </h2>
        <p className="text-sm text-neutral-400">
          Unlock exclusive unreleased songs, backstage access, custom badges, and directly fund the artist's musical journey.
        </p>
      </div>

      {/* Tiers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {tiers.map((tier) => {
          const isCurrentActive = activeTierId === tier.id;
          const isGold = tier.name.toLowerCase().includes('gold') || tier.badge_color === '#FFB300';
          const isPopular = tier.is_popular;

          return (
            <div
              key={tier.id}
              id={`tier-card-${tier.id}`}
              className={`relative flex flex-col justify-between bg-[#181818] rounded-2xl p-6 border transition-all duration-300 hover:scale-[1.02] ${
                isCurrentActive
                  ? "border-emerald-500 shadow-xl shadow-emerald-500/10"
                  : isPopular || isGold
                    ? "border-[#FFB300] shadow-xl shadow-[#FFB300]/10"
                    : "border-neutral-800 hover:border-neutral-700"
              }`}
            >
              {/* Most Popular Flag */}
              {isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-[#FFB300] text-black text-[11px] font-extrabold px-3 py-0.5 rounded-full shadow-md uppercase tracking-wider">
                  Most Popular
                </div>
              )}

              {/* Current Member Flag */}
              {isCurrentActive && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-black text-[11px] font-extrabold px-3 py-0.5 rounded-full shadow-md uppercase tracking-wider">
                  Active Tier
                </div>
              )}

              <div className="space-y-4">
                {/* Header: Name and Badge */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    {tier.name}
                  </h3>
                  <div 
                    className="w-7 h-7 rounded-full flex items-center justify-center border shadow"
                    style={{ 
                      backgroundColor: `${tier.badge_color || '#CD7F32'}20`, 
                      borderColor: tier.badge_color || '#CD7F32' 
                    }}
                  >
                    <Crown 
                      className="w-4 h-4" 
                      style={{ color: tier.badge_color || '#CD7F32' }} 
                    />
                  </div>
                </div>

                <p className="text-xs text-neutral-400 min-h-[32px]">
                  {tier.description}
                </p>

                {/* Price Display */}
                <div className="pt-2 pb-1 border-b border-neutral-800">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl sm:text-3xl font-black text-white">
                      {tier.price_rwf.toLocaleString()} RWF
                    </span>
                    <span className="text-xs text-neutral-400">/month</span>
                  </div>
                  {tier.price_usd && (
                    <span className="text-xs text-neutral-500">
                      Approx. ${tier.price_usd.toFixed(2)} USD
                    </span>
                  )}
                </div>

                {/* Perks Checklist */}
                <div className="space-y-2.5 pt-2">
                  <p className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                    Included Benefits:
                  </p>
                  <ul className="space-y-2">
                    {tier.perks.map((perk, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-neutral-300 leading-relaxed">
                        <div className="rounded-full p-0.5 bg-[#FFB300]/20 text-[#FFB300] shrink-0 mt-0.5">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span>{perk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button */}
              <div className="pt-6 mt-6 border-t border-neutral-800">
                <button
                  onClick={() => onSelectTier(tier)}
                  disabled={isCurrentActive}
                  className={`w-full py-3 px-4 rounded-xl text-xs sm:text-sm font-bold tracking-wide transition-all shadow-md active:scale-98 ${
                    isCurrentActive
                      ? "bg-neutral-800 text-neutral-400 cursor-default"
                      : isGold || isPopular
                        ? "bg-[#FFB300] hover:bg-[#FFA000] text-black hover:shadow-[#FFB300]/20"
                        : "bg-white hover:bg-neutral-200 text-black"
                  }`}
                >
                  {isCurrentActive ? "Active Member" : `Join ${tier.name}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
