import React, { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import MobileBottomNav from "./MobileBottomNav";
import { AnimatePresence, motion } from "motion/react";

const SIDEBAR_COLLAPSED_KEY = "paytune_sidebar_collapsed";

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const location = useLocation();
  const isMasterRoute = location.pathname.startsWith("/master");

  // Lock background scroll when mobile drawer is open
  useEffect(() => {
    if (sidebarOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [sidebarOpen]);

  // Auto-close mobile drawer on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleToggleDesktopCollapse = () => {
    setDesktopCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {}
      return next;
    });
  };

  const handleHeaderMenuClick = () => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      handleToggleDesktopCollapse();
    } else {
      setSidebarOpen((prev) => !prev);
    }
  };

  if (isMasterRoute) {
    return <Outlet />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0F0F0F] text-gray-900 dark:text-white transition-colors duration-200 antialiased selection:bg-purple-600 selection:text-white">
      <Navbar
        onMenuClick={handleHeaderMenuClick}
        sidebarCollapsed={desktopCollapsed}
        mobileMenuOpen={sidebarOpen}
      />
      <div className="flex h-screen pt-14 overflow-hidden relative">
        {/* Desktop Sidebar */}
        <div className="hidden md:flex flex-shrink-0 h-full">
          <Sidebar
            collapsed={desktopCollapsed}
            onToggleCollapse={handleToggleDesktopCollapse}
          />
        </div>

        {/* Mobile Drawer Overlay (hidden by default) */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
                aria-hidden="true"
              />
              <motion.div
                initial={{ x: -260 }}
                animate={{ x: 0 }}
                exit={{ x: -260 }}
                transition={{ type: "spring", damping: 26, stiffness: 260 }}
                className="fixed inset-y-0 left-0 w-60 max-w-[82vw] z-50 md:hidden shadow-2xl bg-white dark:bg-[#121212] border-r border-gray-200 dark:border-gray-800"
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

      <MobileBottomNav />
    </div>
  );
}
