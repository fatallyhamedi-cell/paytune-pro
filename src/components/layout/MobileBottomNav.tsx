import React from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Home, 
  Flame, 
  PlusCircle,
  Users,
  Library
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

export default function MobileBottomNav() {
  const location = useLocation();
  const { user, roleData } = useAuth();

  const isArtist = Boolean(roleData?.momo_code || roleData?.role === "artist");

  const navItems = [
    {
      label: "Home",
      path: "/",
      icon: Home,
    },
    {
      label: "Shorts",
      path: "/shorts",
      icon: Flame,
    },
    {
      label: "Upload",
      path: isArtist ? "/artist/upload" : "/artist/signup",
      icon: PlusCircle,
      isSpecial: true,
    },
    {
      label: "Subscriptions",
      path: user ? "/dashboard/following" : "/auth",
      icon: Users,
    },
    {
      label: "Library",
      path: user ? "/dashboard" : "/auth",
      icon: Library,
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0F0F0F]/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-800 md:hidden px-2 py-1 shadow-lg">
      <nav 
        id="paytune-mobile-bottom-nav"
        className="flex items-center justify-around"
      >
        {navItems.map((item) => {
          const isActive = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
          const Icon = item.icon;

          if (item.isSpecial) {
            return (
              <Link
                key={item.label}
                to={item.path}
                className="flex flex-col items-center justify-center p-1 text-gray-700 dark:text-gray-300 hover:text-amber-500 transition-colors"
                aria-label="Upload video"
              >
                <div className="w-9 h-9 rounded-full bg-amber-500 text-black flex items-center justify-center shadow-md">
                  <Icon className="w-5 h-5 stroke-[2.5]" />
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={item.label}
              to={item.path}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors ${
                isActive 
                  ? "text-amber-500 font-bold" 
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white font-medium"
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? "stroke-[2.5]" : "stroke-[1.8]"}`} />
              <span className="text-[10px] tracking-tight">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
