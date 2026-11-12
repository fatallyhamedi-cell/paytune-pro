import React from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  Home, 
  Flame, 
  PlusCircle,
  Music2,
  UserCircle2
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
      label: "Create",
      path: isArtist ? "/artist/upload" : "/artist/signup",
      icon: PlusCircle,
      isSpecial: true,
    },
    {
      label: "Music",
      path: "/music",
      icon: Music2,
    },
    {
      label: "Profile",
      path: user ? (isArtist ? "/artist/dashboard" : "/dashboard") : "/auth",
      icon: UserCircle2,
    }
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 md:hidden px-2 py-1 shadow-lg">
      <nav 
        id="paytune-mobile-bottom-nav"
        className="flex items-center justify-around h-14"
      >
        {navItems.map((item) => {
          const isActive = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
          const Icon = item.icon;

          if (item.isSpecial) {
            return (
              <Link
                key={item.label}
                to={item.path}
                className="flex flex-col items-center justify-center min-w-[44px] min-h-[44px] p-1 text-gray-700 hover:text-purple-600 transition-colors"
                aria-label="Create content"
              >
                <div className="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-md active:scale-95 transition-transform">
                  <Icon className="w-5 h-5 stroke-[2.5]" />
                </div>
              </Link>
            );
          }

          return (
            <Link
              key={item.label}
              to={item.path}
              className={`flex flex-col items-center justify-center min-w-[44px] min-h-[44px] py-1 px-3 rounded-xl transition-colors ${
                isActive 
                  ? "text-purple-600 font-bold" 
                  : "text-gray-500 hover:text-gray-900 font-medium"
              }`}
            >
              <Icon className={`w-5 h-5 mb-0.5 ${isActive ? "stroke-[2.5]" : "stroke-[1.8]"}`} />
              <span className="text-[10px] tracking-tight font-semibold">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
