import { useRef, useState, useEffect } from 'react';
import api from '../services/api';

export default function AvatarUpload({
  currentUrl,
  onUploaded,
}: {
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (currentUrl) {
      setPreview(currentUrl);
    }
  }, [currentUrl]);

  const pick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    setError('');
    if (!file.type.startsWith('image/')) {
      return setError('Please select an image file (JPG, PNG, WebP)');
    }
    if (file.size > 5 * 1024 * 1024) {
      return setError('Avatar file size must be less than 5MB');
    }

    // Local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    const fd = new FormData();
    fd.append('avatar', file);

    setLoading(true);
    try {
      const res = await api.post('/artist/upload/avatar', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.url) {
        onUploaded(res.data.url);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Avatar upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        onClick={pick}
        className="w-24 h-24 rounded-full bg-[#2A2A2A] border-2 border-amber-500 overflow-hidden cursor-pointer relative group hover:border-amber-400 transition-colors shadow-lg"
        title="Click to change avatar"
      >
        {preview ? (
          <img src={preview} className="w-full h-full object-cover" alt="Avatar" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl text-amber-400 font-bold bg-[#1f1f1f]">
            +
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-semibold transition-opacity">
          Change
        </div>
        {loading && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={pick}
        className="text-amber-500 hover:text-amber-400 text-xs font-semibold cursor-pointer"
      >
        {loading ? 'Uploading...' : 'Change Avatar'}
      </button>
      {error && <p className="text-red-400 text-xs text-center max-w-xs">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  );
}
