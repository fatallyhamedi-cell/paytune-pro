import React, { useState } from 'react';

interface CategoryBarProps {
  activeCategory?: string;
  onSelectCategory?: (category: string) => void;
}

export default function CategoryBar({
  activeCategory: propActive,
  onSelectCategory,
}: CategoryBarProps) {
  const [localActive, setLocalActive] = useState('All');
  const activeCategory = propActive !== undefined ? propActive : localActive;

  const categories = [
    'All',
    'Trending',
    'Live & Upcoming',
    'Rwandan Hits',
    'Afrobeat',
    'Gospel & Worship',
    'Hip Hop',
    'News',
    'Gaming',
  ];

  const handleSelect = (cat: string) => {
    if (onSelectCategory) {
      onSelectCategory(cat);
    } else {
      setLocalActive(cat);
    }
  };

  return (
    <div className="bg-white border-b border-gray-100 transition-colors">
      {/* Scrollable Container */}
      <div className="flex gap-3 overflow-x-auto px-4 py-3 scrollbar-hide w-full">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => handleSelect(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
              activeCategory === cat
                ? 'bg-[#8B5CF6] text-white shadow-xs font-semibold'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Right Fade Gradient to indicate more content */}
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white to-transparent pointer-events-none" />
    </div>
  );
}
