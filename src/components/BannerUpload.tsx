import { useRef, useState, useEffect } from 'react';
import api from '../services/api';

export default function BannerUpload({
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
    if (file.size > 10 * 1024 * 1024) {
      return setError('Banner file size must be less than 10MB');
    }

    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    const fd = new FormData();
    fd.append('banner', file);

    setLoading(true);
    try {
      const res = await api.post('/artist/upload/banner', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.url) {
        onUploaded(res.data.url);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Banner upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div
        onClick={pick}
        className="relative w-full h-44 bg-[#1e1e1e] border-2 border-dashed border-gray-700 hover:border-amber-500 rounded-2xl overflow-hidden cursor-pointer group transition-all"
        title="Click to change channel banner"
      >
        {preview ? (
          <img src={preview} className="w-full h-full object-cover" alt="Channel Banner" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-1">
            <span className="text-2xl">🖼️</span>
            <span className="text-xs font-semibold text-gray-300">Click to upload channel banner</span>
            <span className="text-[10px] text-gray-500">Recommended 1920x400 (max 10MB)</span>
          </div>
        )}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-semibold text-white transition-opacity">
          Click to replace banner
        </div>
        {loading && (
          <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-amber-400 font-semibold">Uploading banner...</span>
          </div>
        )}
      </div>
      {error && <p className="text-red-400 text-xs mt-1.5">{error}</p>}
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
