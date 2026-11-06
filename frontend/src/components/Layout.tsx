import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import Sidebar from './Sidebar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col pb-16 md:pb-0">
      {/* Header */}
      <header className="h-14 border-b border-gray-200 flex items-center justify-between px-4 sticky top-0 bg-white/95 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
          <Link to="/" className="font-extrabold text-base tracking-tight text-gray-900 uppercase">
            Pay<span className="text-[#8B5CF6]">Tune</span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/artist/dashboard"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 transition text-gray-700"
          >
            Studio
          </Link>
          <Link
            to="/dashboard"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#8B5CF6] hover:bg-purple-700 text-white transition shadow-xs"
          >
            Profile
          </Link>
        </div>
      </header>

      <div className="flex flex-1">
        <Sidebar />
        
        {/* Main Content Area */}
        <main className="flex-1 w-full bg-gray-50"> 
          <Outlet />
        </main>
      </div>
    </div>
  );
}
