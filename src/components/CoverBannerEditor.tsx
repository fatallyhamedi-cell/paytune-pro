import React, { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  ZoomIn,
  ZoomOut,
  Move,
  RotateCcw,
  Check,
  Smartphone,
  Tablet,
  Monitor,
  Eye,
  Info,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import api from '../services/api';
import { inspectFileSignature } from '../services/mediaUploadEngine';

export type BannerPreset = 'channel_cover' | 'avatar' | 'promo_banner';

interface CoverBannerEditorProps {
  currentUrl?: string | null;
  initialFocalX?: number;
  initialFocalY?: number;
  initialZoom?: number;
  artistId?: string;
  preset?: BannerPreset;
  onSaved?: (data: { url: string; focal_x: number; focal_y: number; zoom: number; preset: BannerPreset }) => void;
}

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

const PRESET_SPECS: Record<BannerPreset, { label: string; badge: string; endpoint: string; fieldName: string; hint: string }> = {
  channel_cover: {
    label: 'Channel Cover Banner',
    badge: '2560 × 1440 Canvas',
    endpoint: '/upload/banner',
    fieldName: 'banner',
    hint: 'Optimal resolution: 2560 × 1440 (16:9). Safe text & logo margin: 1546 × 423 centered.',
  },
  avatar: {
    label: 'Creator Avatar (1:1)',
    badge: '1024 × 1024 Square',
    endpoint: '/upload/avatar',
    fieldName: 'avatar',
    hint: 'Circular safe-mask crop preview (1:1 aspect ratio). Minimum 512 × 512 px recommended.',
  },
  promo_banner: {
    label: 'Promotional Feature Banner',
    badge: '1920 × 1080 Widescreen',
    endpoint: '/upload/banner',
    fieldName: 'banner',
    hint: 'Used for featured campaign banners and hero promos across desktop and mobile.',
  },
};

export default function CoverBannerEditor({
  currentUrl,
  initialFocalX = 50,
  initialFocalY = 50,
  initialZoom = 1,
  artistId,
  preset: initialPreset = 'channel_cover',
  onSaved,
}: CoverBannerEditorProps) {
  const queryClient = useQueryClient();
  const [preset, setPreset] = useState<BannerPreset>(initialPreset);
  const [imageUrl, setImageUrl] = useState<string | null>(currentUrl || null);
  const [focalX, setFocalX] = useState<number>(initialFocalX);
  const [focalY, setFocalY] = useState<number>(initialFocalY);
  const [zoom, setZoom] = useState<number>(initialZoom);
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [showSafeArea, setShowSafeArea] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const dragStartRef = useRef<{ x: number; y: number; startFocalX: number; startFocalY: number }>({
    x: 0,
    y: 0,
    startFocalX: 50,
    startFocalY: 50,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setImageUrl(currentUrl || null);
  }, [currentUrl]);

  useEffect(() => {
    setFocalX(initialFocalX ?? 50);
    setFocalY(initialFocalY ?? 50);
    setZoom(initialZoom ?? 1);
  }, [initialFocalX, initialFocalY, initialZoom]);

  const activeSpec = PRESET_SPECS[preset];

  const invalidateChannelCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['artist'] });
    queryClient.invalidateQueries({ queryKey: ['artist-settings'] });
    if (artistId) {
      queryClient.invalidateQueries({ queryKey: ['artist', artistId] });
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const sigCheck = await inspectFileSignature(file, 'image');
    if (!sigCheck.valid) {
      setErrorMsg(sigCheck.error || 'Please select a valid image file (PNG, JPG, or WebP).');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setUploading(true);

    const formData = new FormData();
    formData.append(activeSpec.fieldName, file);
    formData.append('focal_x', String(focalX));
    formData.append('focal_y', String(focalY));
    formData.append('zoom', String(zoom));
    formData.append('placement', preset);
    if (artistId) formData.append('artist_id', artistId);

    try {
      const res = await api.post(activeSpec.endpoint, formData);

      if (res.data?.url) {
        setImageUrl(res.data.url);
        setSuccessMsg(`${activeSpec.label} uploaded to Supabase Storage! Fine-tune framing and click Save.`);
        invalidateChannelCaches();
        if (onSaved) {
          onSaved({
            url: res.data.url,
            focal_x: focalX,
            focal_y: focalY,
            zoom,
            preset,
          });
        }
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message || 'Failed to upload image.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageUrl) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startFocalX: focalX,
      startFocalY: focalY,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const deltaX = (e.clientX - dragStartRef.current.x) / rect.width;
    const deltaY = (e.clientY - dragStartRef.current.y) / rect.height;

    const newX = Math.max(0, Math.min(100, dragStartRef.current.startFocalX - deltaX * 100));
    const newY = Math.max(0, Math.min(100, dragStartRef.current.startFocalY - deltaY * 100));

    setFocalX(Math.round(newX * 10) / 10);
    setFocalY(Math.round(newY * 10) / 10);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setFocalX(50);
    setFocalY(50);
    setZoom(1);
    setSuccessMsg('Coordinates reset to center (50%, 50%, 1.00x).');
  };

  const handleSaveCoordinates = async () => {
    if (!imageUrl) return;
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await api.post('/upload/banner-coordinates', {
        artist_id: artistId,
        focal_x: focalX,
        focal_y: focalY,
        zoom,
      });

      if (res.data?.success) {
        setSuccessMsg('Alignment saved permanently!');
        invalidateChannelCaches();
        if (onSaved) {
          onSaved({
            url: imageUrl,
            focal_x: focalX,
            focal_y: focalY,
            zoom,
            preset,
          });
        }
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to save coordinates.');
    } finally {
      setSaving(false);
    }
  };

  const deviceContainerClasses: Record<DeviceMode, string> =
    preset === 'avatar'
      ? {
          desktop: 'w-64 h-64 mx-auto',
          tablet: 'w-56 h-56 mx-auto',
          mobile: 'w-44 h-44 mx-auto',
        }
      : {
          desktop: 'w-full h-64 sm:h-72 md:h-80',
          tablet: 'w-full max-w-2xl h-52 sm:h-60 mx-auto',
          mobile: 'w-full max-w-sm h-40 sm:h-48 mx-auto',
        };

  return (
    <div className="bg-white dark:bg-[#141418] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">{activeSpec.label}</h2>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 px-2.5 py-0.5 rounded-md border border-purple-200 dark:border-purple-700/50 tabular-nums">
                <ShieldCheck className="w-3.5 h-3.5" /> {activeSpec.badge}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Drag image inside the viewport to align focal point across desktop, tablet, and mobile screens.
            </p>
          </div>

          {/* Preset switcher */}
          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-neutral-900 p-1 rounded-xl self-start">
            {(['channel_cover', 'promo_banner', 'avatar'] as BannerPreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  preset === p
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {p === 'channel_cover' ? 'Channel Cover' : p === 'promo_banner' ? 'Promo Banner' : 'Avatar'}
              </button>
            ))}
          </div>
        </div>

        {/* Device preview tabs */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center bg-gray-100 dark:bg-neutral-900 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setDeviceMode('desktop')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                deviceMode === 'desktop'
                  ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5 text-purple-600" /> Desktop (1920)
            </button>
            <button
              type="button"
              onClick={() => setDeviceMode('tablet')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                deviceMode === 'tablet'
                  ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Tablet className="w-3.5 h-3.5 text-purple-600" /> Tablet (1024)
            </button>
            <button
              type="button"
              onClick={() => setDeviceMode('mobile')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                deviceMode === 'mobile'
                  ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-purple-600" /> Mobile (430)
            </button>
          </div>
          <span className="text-[11px] font-mono text-gray-500 tabular-nums">
            Focal ({focalX.toFixed(1)}%, {focalY.toFixed(1)}%) • {zoom.toFixed(2)}x
          </span>
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="mx-5 mt-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="mx-5 mt-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Interactive Canvas */}
      <div className="p-5 bg-gray-50 dark:bg-[#0d0d10] flex flex-col items-center justify-center">
        <div
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`relative overflow-hidden shadow-md select-none touch-none bg-neutral-900 transition-all ${
            preset === 'avatar' ? 'rounded-full' : 'rounded-xl'
          } ${deviceContainerClasses[deviceMode]} ${
            imageUrl ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-pointer'
          }`}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Channel Media Preview"
              referrerPolicy="no-referrer"
              style={{
                objectPosition: `${focalX}% ${focalY}%`,
                transform: `scale(${zoom})`,
              }}
              className="w-full h-full object-cover pointer-events-none transition-transform duration-75"
            />
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2 p-6 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-purple-400 mb-1">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-white">Click to upload {activeSpec.label}</p>
              <p className="text-xs text-gray-400 max-w-sm">{activeSpec.hint}</p>
            </div>
          )}

          {/* Safe Area Overlay Guide */}
          {imageUrl && showSafeArea && preset !== 'avatar' && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-[60.4%] h-[29.4%] border-2 border-dashed border-[#FFB300] bg-[#FFB300]/10 rounded-md relative flex items-center justify-center shadow-lg">
                <span className="bg-black/85 text-[#FFB300] text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow tabular-nums">
                  Safe Zone (1546 × 423 px)
                </span>
              </div>
            </div>
          )}

          {/* Drag instruction overlay badge */}
          {imageUrl && (
            <div className="absolute bottom-2 left-2 pointer-events-none bg-black/75 backdrop-blur text-white text-[10px] font-medium px-2 py-1 rounded-md flex items-center gap-1.5 border border-white/10 tabular-nums">
              <Move className="w-3 h-3 text-[#FFB300]" />
              <span>Drag to position • ({focalX}%, {focalY}%)</span>
            </div>
          )}
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="p-5 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-[#141418] flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center flex-wrap gap-4 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <ZoomOut className="w-4 h-4 text-gray-400" />
            <input
              type="range"
              min="1"
              max="2.5"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-24 sm:w-32 accent-purple-600 cursor-pointer"
              title="Banner zoom multiplier"
            />
            <ZoomIn className="w-4 h-4 text-gray-400" />
            <span className="text-xs font-mono text-gray-600 dark:text-gray-300 min-w-[40px] tabular-nums">{zoom.toFixed(2)}x</span>
          </div>

          <div className="h-5 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />

          {preset !== 'avatar' && (
            <button
              type="button"
              onClick={() => setShowSafeArea(!showSafeArea)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                showSafeArea
                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                  : 'bg-white dark:bg-neutral-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-[#FFB300]" />
              <span>{showSafeArea ? 'Hide Safe Zone' : 'Show Safe Zone'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-200 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
          >
            <Upload className="w-3.5 h-3.5 text-gray-500" />
            <span>{uploading ? 'Uploading...' : imageUrl ? 'Replace Image' : 'Upload Image'}</span>
          </button>

          {preset !== 'avatar' && (
            <button
              type="button"
              onClick={handleSaveCoordinates}
              disabled={saving || !imageUrl}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Alignment'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Specifications Footer */}
      <div className="px-5 py-3.5 bg-gray-50 dark:bg-neutral-900/50 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          <span>{activeSpec.hint}</span>
        </div>
        <span className="font-mono text-gray-400 hidden sm:inline">Max 15MB • JPG, PNG, WebP</span>
      </div>
    </div>
  );
}

