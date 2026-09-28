import React from "react";
import { AlertTriangle, LogOut, ShieldAlert } from "lucide-react";

interface MasterImpersonateBannerProps {
  artistName: string;
  artistEmail?: string;
  onExit: () => void;
}

export const MasterImpersonateBanner: React.FC<MasterImpersonateBannerProps> = ({
  artistName,
  artistEmail,
  onExit
}) => {
  return (
    <div
      id="master-impersonate-banner"
      className="sticky top-0 z-50 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-neutral-950 font-medium px-4 py-2.5 shadow-lg flex items-center justify-between transition-all"
    >
      <div className="flex items-center space-x-3 text-sm">
        <div className="p-1 bg-neutral-950/15 rounded">
          <ShieldAlert className="w-5 h-5 text-neutral-950 animate-pulse" />
        </div>
        <div>
          <span className="font-bold uppercase tracking-wider text-xs bg-neutral-950 text-amber-400 px-2 py-0.5 rounded mr-2">
            Master Impersonation Active
          </span>
          <span>
            Viewing artist portal as <strong className="underline">{artistName}</strong>
            {artistEmail && <span className="opacity-85 text-xs ml-1">({artistEmail})</span>}
          </span>
        </div>
      </div>
      <button
        id="btn-exit-impersonation"
        onClick={onExit}
        className="flex items-center space-x-1.5 bg-neutral-950 hover:bg-neutral-900 text-amber-400 font-semibold px-3 py-1.5 rounded-lg text-xs shadow transition-colors cursor-pointer"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>Exit Impersonation</span>
      </button>
    </div>
  );
};
