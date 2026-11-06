import React, { useState, useEffect } from "react";
import { X, Sparkles, Check, Loader2, Compass } from "lucide-react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";

const AVAILABLE_GENRES = [
  "Rwandan Hits",
  "Afrobeat",
  "Gospel",
  "Hip Hop",
  "R&B",
  "Traditional",
  "Live",
  "Podcasts",
  "Comedy",
  "Sports",
  "Gaming",
  "Technology",
  "Education",
  "Fashion",
  "Fitness"
];

const AVAILABLE_LANGUAGES = [
  { code: "rw", label: "Kinyarwanda" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "sw", label: "Kiswahili" }
];

interface UserPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPreferencesUpdated: () => void;
}

export default function UserPreferencesModal({
  isOpen,
  onClose,
  onPreferencesUpdated
}: UserPreferencesModalProps) {
  const { user } = useAuth();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["rw", "en"]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing preferences
  useEffect(() => {
    if (!isOpen) return;

    if (!user) {
      // Load from local storage for guests
      try {
        const local = localStorage.getItem("paytune_guest_interests");
        if (local) {
          setSelectedInterests(JSON.parse(local));
        }
      } catch {}
      return;
    }

    setIsLoading(true);
    axios
      .get("/api/user/preferences")
      .then((res) => {
        if (res.data?.preferences) {
          setSelectedInterests(res.data.preferences.interests || []);
          setSelectedLanguages(res.data.preferences.preferred_languages || ["rw", "en"]);
        }
      })
      .catch((err) => {
        console.warn("Could not load user preferences:", err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, user]);

  const toggleInterest = (genre: string) => {
    setSelectedInterests((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const toggleLanguage = (code: string) => {
    setSelectedLanguages((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (user) {
        await axios.put("/api/user/preferences", {
          interests: selectedInterests,
          preferred_languages: selectedLanguages
        });
      } else {
        localStorage.setItem("paytune_guest_interests", JSON.stringify(selectedInterests));
      }
      onPreferencesUpdated();
      onClose();
    } catch (err) {
      console.error("Failed to save preferences:", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden text-gray-900 dark:text-white">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 text-purple-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold">Personalize Your Feed</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Choose topics and genres to tune your "For You" recommendations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {isLoading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
            </div>
          ) : (
            <>
              {/* Category Pills */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2.5 block">
                  Favorite Genres & Categories
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_GENRES.map((genre) => {
                    const isSelected = selectedInterests.includes(genre);
                    return (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => toggleInterest(genre)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-purple-600 text-black font-bold shadow-xs"
                            : "bg-gray-100 dark:bg-[#252525] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#303030] border border-gray-200 dark:border-gray-800"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        <span>{genre}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preferred Languages */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2.5 block">
                  Preferred Languages
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_LANGUAGES.map((lang) => {
                    const isSelected = selectedLanguages.includes(lang.code);
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => toggleLanguage(lang.code)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isSelected
                            ? "bg-purple-600/20 text-purple-700 dark:text-purple-400 border border-purple-600/40 font-bold"
                            : "bg-gray-100 dark:bg-[#252525] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#303030] border border-gray-200 dark:border-gray-800"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-purple-600 stroke-[3]" />}
                        <span>{lang.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-[#151515]">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {selectedInterests.length} {selectedInterests.length === 1 ? "genre" : "genres"} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#252525] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2 rounded-lg text-xs font-extrabold bg-purple-600 hover:bg-purple-400 text-black shadow-sm flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              <span>Save & Update Feed</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
