import React, { useState, useRef, useEffect } from 'react';
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
  AlertCircle
} from 'lucide-react';
import api from '../services/api';

interface CoverBannerEditorProps {
  currentUrl?: string | null;
  initialFocalX?: number;
  initialFocalY?: number;
  initialZoom?: number;
  artistId?: string;
  onSaved?: (data: { url: string; focal_x: number; focal_y: number; zoom: number }) => void;
}

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

export default function CoverBannerEditor({
  currentUrl,
  initialFocalX = 50,
  initialFocalY = 50,
  initialZoom = 1,
  artistId,
  onSaved,
}: CoverBannerEditorProps) {
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
    if (currentUrl) setImageUrl(currentUrl);
  }, [currentUrl]);

  useEffect(() => {
    if (initialFocalX !== undefined) setFocalX(initialFocalX);
    if (initialFocalY !== undefined) setFocalY(initialFocalY);
    if (initialZoom !== undefined) setZoom(initialZoom);
  }, [initialFocalX, initialFocalY, initialZoom]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, or WebP).');
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setErrorMsg('Image size exceeds 15 MB. Please upload a smaller banner.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setUploading(true);

    const formData = new FormData();
    formData.append('banner', file);
    formData.append('focal_x', String(focalX));
    formData.append('focal_y', String(focalY));
    formData.append('zoom', String(zoom));
    if (artistId) formData.append('artist_id', artistId);

    try {
      const res = await api.post('/upload/banner', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data?.url) {
        setImageUrl(res.data.url);
        setSuccessMsg('Banner uploaded successfully! Adjust the focal point and click Save.');
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.error || err.message || 'Failed to upload channel cover.');
    } finally {
      setUploading(false);
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

    // Invert delta because moving mouse right shifts the focal point left
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
    setSuccessMsg('Coordinates reset to center (50%, 50%, 1.0x).');
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
        zoom: zoom,
      });

      if (res.data?.success) {
        setSuccessMsg('Channel cover banner alignment saved permanently!');
        if (onSaved) {
          onSaved({
            url: imageUrl,
            focal_x: focalX,
            focal_y: focalY,
            zoom: zoom,
          });
        }
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to save coordinates.');
    } finally {
      setSaving(false);
    }
  };

  // Dimensions for device preview container
  const deviceContainerClasses: Record<DeviceMode, string> = {
    desktop: 'w-full h-64 sm:h-72 md:h-80',
    tablet: 'w-full max-w-2xl h-52 sm:h-60 mx-auto',
    mobile: 'w-full max-w-sm h-40 sm:h-48 mx-auto',
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header bar */}
      <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">YouTube-Standard Channel Cover Banner</h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full border border-purple-200">
              <ShieldCheck className="w-3.5 h-3.5" /> 2560 × 1440 Canvas
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Drag image to set focal center. Text & branding within the safe area remain sharp on every screen.
          </p>
        </div>

        {/* Device preview tabs */}
        <div className="flex items-center bg-gray-100 p-1 rounded-xl self-start md:self-auto">
          <button
            type="button"
            onClick={() => setDeviceMode('desktop')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              deviceMode === 'desktop'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Monitor className="w-3.5 h-3.5 text-purple-600" /> Desktop (1920)
          </button>
          <button
            type="button"
            onClick={() => setDeviceMode('tablet')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              deviceMode === 'tablet'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Tablet className="w-3.5 h-3.5 text-purple-600" /> Tablet (1024)
          </button>
          <button
            type="button"
            onClick={() => setDeviceMode('mobile')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              deviceMode === 'mobile'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5 text-purple-600" /> Mobile (430)
          </button>
        </div>
      </div>

      {/* Messages */}
      {errorMsg && (
        <div className="mx-5 mt-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="mx-5 mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Interactive Canvas */}
      <div className="p-5 bg-gray-50 flex flex-col items-center justify-center">
        <div
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`relative rounded-xl overflow-hidden shadow-md select-none bg-neutral-900 transition-all ${
            deviceContainerClasses[deviceMode]
          } ${imageUrl ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-pointer'}`}
          style={{ touchAction: 'none' }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Channel Banner Preview"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover pointer-events-none transition-transform duration-75"
              style={{
                objectPosition: `${focalX}% ${focalY}%`,
                transform: `scale(${zoom})`,
              }}
            />
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-2 p-6 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center text-purple-400 mb-1">
                <Upload className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-white">Click or drag banner image here</p>
              <p className="text-xs text-gray-400 max-w-sm">
                Standard 2560 × 1440 pixels (16:9). Safe area 1546 × 423 px guarantees text is never cropped.
              </p>
            </div>
          )}

          {/* Safe Area Overlay Guide */}
          {imageUrl && showSafeArea && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* YouTube Safe Zone: 1546 / 2560 = ~60.4% width, 423 / 1440 = ~29.4% height */}
              <div className="w-[60.4%] h-[29.4%] border-2 border-dashed border-[#FFB300] bg-[#FFB300]/10 rounded-md relative flex items-center justify-center shadow-lg">
                <span className="bg-black/80 text-[#FFB300] text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow">
                  Central Safe Zone (1546 × 423 px)
                </span>
                <span className="absolute -top-5 text-[10px] text-[#FFB300] font-semibold bg-black/60 px-1.5 py-0.5 rounded">
                  Visible on All Devices
                </span>
              </div>
            </div>
          )}

          {/* Drag instruction overlay badge */}
          {imageUrl && (
            <div className="absolute bottom-2 left-2 pointer-events-none bg-black/75 backdrop-blur text-white text-[10px] font-medium px-2 py-1 rounded-md flex items-center gap-1.5 border border-white/10">
              <Move className="w-3 h-3 text-[#FFB300]" />
              <span>Drag to position focal point • ({focalX}%, {focalY}%)</span>
            </div>
          )}
        </div>
      </div>

      {/* Control Toolbar */}
      <div className="p-5 border-t border-gray-100 bg-white flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Zoom & Safe Area Controls */}
        <div className="flex items-center flex-wrap gap-4 w-full md:w-auto">
          {/* Zoom Slider */}
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
            <span className="text-xs font-mono text-gray-600 min-w-[36px]">{zoom.toFixed(2)}x</span>
          </div>

          <div className="h-5 w-px bg-gray-200 hidden sm:block" />

          {/* Toggle Safe Area Overlay */}
          <button
            type="button"
            onClick={() => setShowSafeArea(!showSafeArea)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showSafeArea
                ? 'bg-amber-50 text-amber-900 border-amber-300'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-[#FFB300]" />
            <span>{showSafeArea ? 'Hide Safe Zone' : 'Show Safe Zone'}</span>
          </button>

          {/* Reset button */}
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
          >
            <Upload className="w-3.5 h-3.5 text-gray-500" />
            <span>{uploading ? 'Uploading...' : 'Replace Image'}</span>
          </button>

          <button
            type="button"
            onClick={handleSaveCoordinates}
            disabled={saving || !imageUrl}
            className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{saving ? 'Saving...' : 'Save Alignment'}</span>
          </button>
        </div>
      </div>

      {/* Specifications Footer Card */}
      <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          <span>Optimal resolution: 2560 × 1440 (16:9). Safe text & logo margin: 1546 × 423 centered.</span>
        </div>
        <span className="font-mono text-gray-400 hidden sm:inline">Max 15MB • JPG, PNG, WebP</span>
      </div>
    </div>
  );
}
