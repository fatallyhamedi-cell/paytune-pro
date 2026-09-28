import React, { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import MobileBottomNav from "./MobileBottomNav";
import { AnimatePresence, motion } from "motion/react";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const isMasterRoute = location.pathname.startsWith("/master");

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0F0F0F] text-gray-900 dark:text-white transition-colors duration-200 antialiased selection:bg-amber-500 selection:text-black">
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex h-screen pt-14 overflow-hidden relative">
        {/* Desktop Sidebar (Hidden for mobile and master route layouts) */}
        {!isMasterRoute && (
          <div className="hidden md:flex flex-shrink-0 h-full">
            <Sidebar />
          </div>
        )}

        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {sidebarOpen && !isMasterRoute && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden"
              />
              <motion.div
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed inset-y-0 left-0 w-72 max-w-[85vw] z-50 md:hidden shadow-2xl bg-white dark:bg-[#121212] border-r border-gray-200 dark:border-gray-800"
              >
                <Sidebar mobile onClose={() => setSidebarOpen(false)} />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <main className="flex-1 min-w-0 overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-[#0F0F0F] pb-16 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* PayTune Mobile Bottom Navigation */}
      {!isMasterRoute && <MobileBottomNav />}
    </div>
  );
}

