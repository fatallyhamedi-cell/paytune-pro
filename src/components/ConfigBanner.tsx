import React from 'react';
import { AlertCircle } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabase';

export function ConfigBanner() {
  const [closed, setClosed] = React.useState(false);

  if (isSupabaseConfigured() || closed) return null;

  return (
    <div className="bg-red-600 text-white px-4 py-2 flex items-center justify-between text-sm font-medium">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-4 h-4" />
        <span>
          Supabase is not configured. Please add <code className="bg-red-700 px-1 rounded text-xs">VITE_SUPABASE_URL</code> and <code className="bg-red-700 px-1 rounded text-xs">VITE_SUPABASE_ANON_KEY</code> in the <b>Settings</b> menu.
        </span>
      </div>
      <button 
        onClick={() => setClosed(true)}
        className="text-red-100 hover:text-white transition-colors"
      >
        Dismiss
      </button>
    </div>
  );
}

export default ConfigBanner;
