import React, { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Sparkles, Plus, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  display_order?: number;
  is_visible?: boolean;
  is_featured?: boolean;
}

interface DynamicCategoryBarProps {
  activeCategory: string;
  onSelectCategory: (categoryName: string) => void;
  onOpenPreferences?: () => void;
}

export default function DynamicCategoryBar({
  activeCategory,
  onSelectCategory,
  onOpenPreferences
}: DynamicCategoryBarProps) {
  const { user } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  // Fetch categories from backend API
  const { data: categories = [], isLoading } = useQuery<CategoryItem[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      try {
        const res = await axios.get("/api/categories");
        const list = Array.isArray(res.data) ? res.data : (res.data?.categories || []);
        return list;
      } catch (err) {
        console.warn("Failed to fetch dynamic categories, falling back:", err);
        return [
          { id: "all", name: "All", slug: "all" },
          { id: "rwandan", name: "Rwandan Hits", slug: "rwandan-hits" },
          { id: "afrobeat", name: "Afrobeat", slug: "afrobeat" },
          { id: "gospel", name: "Gospel", slug: "gospel" },
          { id: "hiphop", name: "Hip Hop", slug: "hip-hop" },
          { id: "rnb", name: "R&B", slug: "rnb" },
          { id: "traditional", name: "Traditional", slug: "traditional" },
          { id: "live", name: "Live", slug: "live" },
          { id: "podcasts", name: "Podcasts", slug: "podcasts" },
          { id: "comedy", name: "Comedy", slug: "comedy" },
          { id: "sports", name: "Sports", slug: "sports" },
          { id: "gaming", name: "Gaming", slug: "gaming" },
          { id: "tech", name: "Technology", slug: "technology" }
        ];
      }
    },
    staleTime: 60 * 1000
  });

  // Check scroll boundary visibility
  const checkScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const hasLeft = el.scrollLeft > 4;
    const hasRight = el.scrollLeft < el.scrollWidth - el.clientWidth - 4;
    setCanScrollLeft(hasLeft);
    setCanScrollRight(hasRight);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener("resize", checkScroll);
    return () => window.removeEventListener("resize", checkScroll);
  }, [categories]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const scrollAmount = 300;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth"
    });
  };

  // Mouse drag-to-scroll support
  const handleMouseDown = (e: React.MouseEvent) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setIsDragging(true);
    setStartX(e.pageX - el.offsetLeft);
    setScrollLeftState(el.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const el = scrollContainerRef.current;
    if (!el) return;
    const x = e.pageX - el.offsetLeft;
    const walk = (x - startX) * 1.5;
    el.scrollLeft = scrollLeftState - walk;
    checkScroll();
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      id="dynamic-category-bar-wrapper"
      className="sticky top-14 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100 transition-colors"
    >
      <div className="relative max-w-[1920px] mx-auto px-2 sm:px-4 py-2.5 flex items-center">
        {/* Left Arrow Button */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center pl-2 pr-4 bg-gradient-to-r from-white via-white/80 to-transparent">
            <button
              id="category-scroll-left"
              type="button"
              onClick={() => scroll("left")}
              className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-700 shadow-md hover:bg-gray-100 transition-all cursor-pointer"
              aria-label="Scroll categories left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Categories Chips Container */}
        <div
          ref={scrollContainerRef}
          onScroll={checkScroll}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="flex items-center gap-3 overflow-x-auto scrollbar-hide scroll-smooth w-full select-none py-0.5 px-2"
          style={{ cursor: isDragging ? "grabbing" : "default" }}
        >
          {/* Always have 'All' category first */}
          <button
            id="category-chip-all"
            type="button"
            onClick={() => onSelectCategory("All")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 cursor-pointer ${
              activeCategory === "All"
                ? "bg-[#8B5CF6] text-white shadow-xs font-semibold"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            All
          </button>

          {/* Dynamically Loaded Categories */}
          {categories
            .filter((cat) => cat.name !== "All")
            .map((cat) => {
              const isActive = activeCategory.toLowerCase() === cat.name.toLowerCase();
              return (
                <button
                  id={`category-chip-${cat.slug || cat.name.toLowerCase().replace(/\s+/g, "-")}`}
                  key={cat.id || cat.slug}
                  type="button"
                  onClick={() => onSelectCategory(cat.name)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    isActive
                      ? "bg-[#8B5CF6] text-white shadow-xs font-semibold"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {cat.icon && <span className="text-sm">{cat.icon}</span>}
                  <span>{cat.name}</span>
                </button>
              );
            })}

          {/* User Customize Interests Trigger */}
          {onOpenPreferences && (
            <button
              id="category-customize-interests-btn"
              type="button"
              onClick={onOpenPreferences}
              className="px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors flex-shrink-0 cursor-pointer flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-[#8B5CF6] border border-purple-200"
              title="Personalize your discovery feed"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
              <span>For You</span>
            </button>
          )}
        </div>

        {/* Right Arrow Button & Gradient */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center pr-2 pl-4 bg-gradient-to-l from-white via-white/80 to-transparent">
            <button
              id="category-scroll-right"
              type="button"
              onClick={() => scroll("right")}
              className="p-1.5 rounded-full bg-white border border-gray-200 text-gray-700 shadow-md hover:bg-gray-100 transition-all cursor-pointer"
              aria-label="Scroll categories right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Right Fade Gradient */}
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
