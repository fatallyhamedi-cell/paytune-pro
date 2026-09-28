import React, { useState } from 'react';
import { Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface SearchBarProps {
  initialQuery?: string;
  onSearch?: (query: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  initialQuery = '',
  onSearch,
  placeholder = 'Search videos, artists, music...',
  className = ''
}) => {
  const [query, setQuery] = useState(initialQuery);
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch) {
      onSearch(query);
    } else if (query.trim()) {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleClear = () => {
    setQuery('');
    if (onSearch) onSearch('');
  };

  return (
    <form onSubmit={handleSubmit} className={`relative flex items-center w-full ${className}`}>
      <Search className="absolute left-3.5 w-4 h-4 text-zinc-400 pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-zinc-100 dark:bg-zinc-800/80 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 focus:bg-white dark:focus:bg-zinc-900 border border-transparent focus:border-amber-500 rounded-full pl-10 pr-9 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-zinc-400 transition-all outline-none"
      />
      {query && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3 text-zinc-400 hover:text-zinc-200"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </form>
  );
};

export default SearchBar;
