import React, { useState, useRef, useEffect } from "react";
import { 
  Upload, 
  X, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Music, 
  DollarSign, 
  Image as ImageIcon, 
  Globe, 
  Lock, 
  EyeOff,
  ChevronRight,
  Plus,
  HelpCircle,
  Bell,
  Sparkles,
  PlaySquare,
  LayoutDashboard,
  BarChart3,
  Settings,
  Calendar,
  Clock
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { uploadDirect } from "../services/uploadDirect";
import api from "../services/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { invokeEdgeFunction } from "../lib/supabase";

export default function VideoUpload() {
  const { user, roleData } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [successLink, setSuccessLink] = useState("");
  const [error, setError] = useState("");
  const [isShort, setIsShort] = useState(false);

  // Form State
  const [title, setTitle] = useState("My Afrobeat Single 2024");
  const [description, setDescription] = useState("Check out my new track! New album coming soon...");
  const [category, setCategory] = useState("Afrobeat");
  const [isFreeVideo, setIsFreeVideo] = useState(false);
  const [priceRwf, setPriceRwf] = useState("2500");
  const [priceUsd, setPriceUsd] = useState("5.00");
  const [visibility, setVisibility] = useState("public");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);

  const handleGenerateAiDescription = async () => {
    if (!title) {
      setError("Please enter a video title first so Gemini can generate a tailored description.");
      return;
    }
    setAiGenerating(true);
    setError("");
    try {
      const { data, error: edgeErr } = await invokeEdgeFunction('gemini-generate', {
        task: 'describe',
        videoTitle: title,
        artistName: roleData?.full_name || roleData?.artist_name || 'Rwandan Artist',
        genre: category
      });

      if (edgeErr || !data?.text) {
        throw new Error(edgeErr?.error || edgeErr?.message || 'AI generation failed');
      }

      setDescription(data.text);
    } catch (err: any) {
      setError(err.message || 'Could not generate AI description. Ensure GEMINI_API_KEY is configured.');
    } finally {
      setAiGenerating(false);
    }
  };

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  // Drag and drop states
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleVideoFile(e.dataTransfer.files[0]);
    }
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleVideoFile(file);
  };

  const handleVideoFile = (file: File) => {
    if (isShort) {
      const videoElement = document.createElement("video");
      videoElement.preload = "metadata";
      videoElement.onloadedmetadata = () => {
        window.URL.revokeObjectURL(videoElement.src);
        const duration = videoElement.duration;
        const width = videoElement.videoWidth;
        const height = videoElement.videoHeight;

        if (duration > 50) {
          setError("Shorts must be 50 seconds or less! Try another vertical video.");
          setVideoFile(null);
          return;
        }

        if (width >= height) {
          setError("Shorts must be vertical! Choose a portrait video (height > width).");
          setVideoFile(null);
          return;
        }

        setError("");
        setVideoFile(file);
      };
      videoElement.src = URL.createObjectURL(file);
    } else {
      setError("");
      setVideoFile(file);
    }
  };

  // Simulating the extract frame button inside mock layout
  const [extracting, setExtracting] = useState(false);
  const handleExtractFrame = () => {
    if (!videoFile) return;
    setExtracting(true);
    setTimeout(() => {
      setExtracting(false);
      alert("Frame extracted successfully as thumbnail replacement.");
    }, 1200);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) return setError("Please select or drag a video file first");
    
    setLoading(true);
    setError("");
    
    // Create payload matching strict existing backend constraints
    const data = new FormData();
    data.append("video", videoFile);
    if (thumbnailFile) data.append("thumbnail", thumbnailFile);
    data.append("title", title);
    data.append("description", description);
    
    if (isShort) {
      data.append("category", "Shorts");
      data.append("is_short", "true");
      data.append("is_free", "true");
    } else if (isFreeVideo) {
      data.append("category", category);
      data.append("is_short", "false");
      data.append("is_free", "true");
      data.append("price_rwf", "0");
      data.append("price_usd", "0");
    } else {
      data.append("category", category);
      data.append("is_short", "false");
      data.append("is_free", "false"); // Paid track
      data.append("price_rwf", String(priceRwf));
      data.append("price_usd", String(priceUsd));
    }
    data.append("visibility", visibility);

    try {
      setUploadProgress(10);
      const bucket = isShort ? "videos" : (videoFile.type?.startsWith("audio") ? "audio" : "videos");
      const videoUrl = await uploadDirect(bucket, videoFile, (p) => {
        setUploadProgress(10 + Math.round(p * 0.7));
      });

      let thumbnailUrl: string | null = null;
      if (thumbnailFile) {
        thumbnailUrl = await uploadDirect("thumbnails", thumbnailFile);
      }

      setUploadProgress(90);

      const response = await api.post("/artist/video/complete", {
        videoUrl,
        thumbnailUrl,
        title,
        description,
        category: isShort ? "Shorts" : category,
        price_rwf: isShort || isFreeVideo ? 0 : Number(priceRwf),
        price_usd: isShort || isFreeVideo ? 0 : Number(priceUsd),
        is_free: isShort || isFreeVideo,
        is_short: isShort,
        visibility,
        media_type: isShort ? "short" : (videoFile.type?.startsWith("audio") ? "audio" : "video"),
        ownership_declared: true,
        no_ai_declared: true,
        no_copyright_declared: true,
      });

      setUploadProgress(100);
      const videoId = response.data?.video?.id || "unique_link";
      setSuccessLink(`paytune.com/v/${videoId}`);
      setSuccess(true);
      setTimeout(() => navigate("/artist/dashboard"), 3000);
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message || "Upload failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#080d19] min-h-screen text-slate-100 font-sans pb-16">
      
      {/* Studio Header bar - Visual clone of the mockup */}
      <header className="bg-[#0b1326] border-b border-[#18233c] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold uppercase tracking-wider">
          <span className="text-[#f59e0b] font-black tracking-widest">Artist</span>
          <span>/artist/upload</span>
        </div>
        <div className="flex items-center gap-4 text-slate-300">
          <HelpCircle className="w-5 h-5 cursor-pointer hover:text-white transition-colors" />
          <div className="relative cursor-pointer hover:text-white">
            <Bell className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#ec4899] rounded-full"></span>
          </div>
          <div className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-amber-500 to-amber-700 border border-[#18233c] flex items-center justify-center">
            <span className="text-black text-xs font-black">A</span>
          </div>
        </div>
      </header>

      {/* Main Inner Content Body */}
      <div className="p-4 md:p-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row gap-8">
          
          {/* Custom Side Control Nav from Mockup - exactly matches layout */}
          <aside className="w-full md:w-56 shrink-0 space-y-2">
            <Link to="/artist/dashboard" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-[#111a30] transition-colors">
              <LayoutDashboard className="w-5 h-5 text-slate-400" />
              <span className="text-xs font-black uppercase tracking-wider">Dashboard</span>
            </Link>
            <Link to="/artist/videos" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-[#111a30] transition-colors">
              <PlaySquare className="w-5 h-5 text-slate-400" />
              <span className="text-xs font-black uppercase tracking-wider">My Videos</span>
            </Link>
            <Link to="/artist/analytics" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-[#111a30] transition-colors">
              <BarChart3 className="w-5 h-5 text-slate-400" />
              <span className="text-xs font-black uppercase tracking-wider">Analytics</span>
            </Link>
            <Link to="/artist/upload" className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#f59e0b]/10 text-[#f59e0b] border border-[#f59e0b]/20 transition-all font-black">
              <Upload className="w-5 h-5 text-[#f59e0b]" />
              <span className="text-xs font-black uppercase tracking-wider">Upload Video</span>
            </Link>
            <Link to="/artist/settings" className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-300 hover:bg-[#111a30] transition-colors">
              <Settings className="w-5 h-5 text-slate-400" />
              <span className="text-xs font-black uppercase tracking-wider">Settings</span>
            </Link>
          </aside>

          {/* Core Upload Action Fields Grid */}
          <div className="flex-1 space-y-6">
            
            {/* Header Title with Upload Progress Banner */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#18233c] pb-6">
              <div>
                <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-white font-sans">
                  Upload Video
                </h1>
                <p className="text-xs text-slate-400 font-semibold mt-1">
                  Ingest horizontal movies or portrait shorts onto the PayTune network.
                </p>
              </div>

              {/* LIVE ENCODING STATUS INDICATOR BAR */}
              <div className="flex-1 max-w-sm self-end">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 font-semibold mb-1 w-full truncate">
                  <span className="text-[#f59e0b] font-bold">Upload Progress: {videoFile ? `${loading ? uploadProgress : "100"}%` : "0%"}</span>
                  <span>{videoFile ? `Uploading '${videoFile.name}' • Processing` : "Waiting for ingestion..."}</span>
                </div>
                <div className="w-full bg-[#111a30] rounded-full h-2.5 overflow-hidden border border-[#18233c]">
                  <div 
                    className="bg-[#f59e0b] h-full rounded-full transition-all duration-300 shadow-sm"
                    style={{ width: videoFile ? `${loading ? uploadProgress : "100"}%` : "0%" }}
                  />
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Form Column (Drag & Drop Sector) - Occupies 5 Columns */}
              <div className="lg:col-span-5 space-y-6">
                
                <div className="text-xs font-black uppercase tracking-widest text-[#f59e0b] ml-1">
                  Drag & Drop Video File
                </div>

                <div 
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => videoInputRef.current?.click()}
                  className={`aspect-square md:aspect-auto md:min-h-[460px] rounded-[32px] border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all duration-300 relative group p-6 overflow-hidden ${
                    dragActive 
                      ? "border-[#f59e0b] bg-[#f59e0b]/5 shadow-inner" 
                      : videoFile 
                      ? "border-[#2dd4bf] bg-[#0e152a]/60 shadow-lg" 
                      : "border-[#18233c] bg-[#0a0f1d] hover:border-[#f59e0b]/60 hover:bg-[#0d1428]"
                  }`}
                >
                  <input 
                    type="file" 
                    ref={videoInputRef} 
                    className="hidden" 
                    accept="video/*" 
                    onChange={handleVideoFileChange} 
                  />

                  {videoFile ? (
                    <div className="text-center space-y-4 animate-in fade-in duration-300">
                      <div className="relative w-20 h-20 bg-[#2dd4bf]/10 rounded-2xl flex items-center justify-center mx-auto border border-[#2dd4bf]/20 shadow-xl group-hover:scale-105 transition-transform duration-200">
                        <div className="absolute inset-0 bg-[#2dd4bf]/20 blur-md rounded-2xl animate-pulse"></div>
                        <Music className="relative w-8 h-8 text-[#2dd4bf]" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-black text-white truncate max-w-[280px] mx-auto">{videoFile.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                          {(videoFile.size / (1024 * 1024)).toFixed(1)} MB • Detected Format
                        </p>
                      </div>
                      <span className="inline-block px-3 py-1.5 rounded-full bg-[#111a30] border border-[#18233c] text-[10px] font-black text-rose-500 hover:bg-[#1c294d] uppercase tracking-wider">
                        Tap to change video file
                      </span>
                    </div>
                  ) : (
                    <div className="text-center space-y-4">
                      <div className="w-16 h-16 rounded-2xl bg-[#0e152a] flex items-center justify-center mx-auto border border-[#18233c] group-hover:scale-110 transition-transform shadow-md duration-300">
                        <Upload className="w-6 h-6 text-slate-400 group-hover:text-[#f59e0b] transition-colors" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-extrabold text-white">Drag and drop video files to upload</h3>
                        <p className="text-[10px] text-slate-400 font-semibold px-4">
                          Your videos will be private until you publish them. Max file size: 2GB.
                        </p>
                      </div>
                      <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); videoInputRef.current?.click(); }}
                        className="px-6 py-2.5 bg-[#111a30] hover:bg-[#1a2748] border border-[#18233c] hover:border-slate-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-colors"
                      >
                        SELECT FILES
                      </button>
                    </div>
                  )}
                </div>

              </div>

              {/* Right Form Column (Video Details) - Occupies 7 Columns */}
              <div className="lg:col-span-7 space-y-6">
                
                <div className="p-6 md:p-8 bg-[#0e152a] rounded-[32px] border border-[#18233c] space-y-6 shadow-md">
                  <h3 className="text-sm font-black uppercase tracking-wider text-white border-b border-[#18233c] pb-3">
                    Video Details
                  </h3>

                  {/* Title field matching screenshot character counts */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase text-slate-400">Title <span className="text-slate-500 font-semibold">(required)</span></label>
                    <input 
                      type="text"
                      className="w-full bg-[#080d19] border border-[#18233c] hover:border-[#1c294d] focus:border-[#f59e0b] px-4 py-3 rounded-xl font-bold text-sm text-white focus:outline-none placeholder:text-slate-600 transition-colors"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={300}
                    />
                    <div className="text-[9px] text-slate-500 font-bold text-right tracking-wider">
                      {title.length}/300
                    </div>
                  </div>

                  {/* Description input with AI generator */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase text-slate-400">Description <span className="text-slate-500 font-semibold">(optional)</span></label>
                      <button
                        type="button"
                        onClick={handleGenerateAiDescription}
                        disabled={aiGenerating}
                        className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-md transition-colors cursor-pointer disabled:opacity-50"
                      >
                        {aiGenerating ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Crafting with Gemini...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3" />
                            <span>AI Generate</span>
                          </>
                        )}
                      </button>
                    </div>
                    <textarea 
                      className="w-full bg-[#080d19] border border-[#18233c] focus:border-[#f59e0b] px-4 py-3 rounded-xl font-semibold text-xs text-slate-300 focus:outline-none placeholder:text-slate-600 min-h-[100px] transition-colors"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Write or generate a description for your fans..."
                    />
                  </div>

                  {/* Thumbnail Row & Category Selector side space wrapper */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[11px] font-black uppercase text-slate-400">Thumbnail</label>
                      <div className="flex items-center gap-3">
                        <div 
                          onClick={() => thumbInputRef.current?.click()}
                          className="w-[84px] h-[58px] bg-[#080d19] hover:bg-[#111a30] transition-colors border border-dashed border-[#18233c] hover:border-[#f59e0b]/50 rounded-xl flex flex-col items-center justify-center cursor-pointer relative overflow-hidden group shadow-md"
                        >
                          <input 
                            type="file" 
                            ref={thumbInputRef} 
                            className="hidden" 
                            accept="image/*" 
                            onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)} 
                          />
                          {thumbnailFile ? (
                            <img src={URL.createObjectURL(thumbnailFile)} className="w-full h-full object-cover rounded-xl" alt="" />
                          ) : (
                            <div className="flex flex-col items-center">
                              <ImageIcon className="w-4 h-4 text-slate-500 group-hover:text-amber-500" />
                              <span className="text-[7px] text-slate-500 font-black tracking-tighter mt-1 uppercase">PICK ARTWORK</span>
                            </div>
                          )}
                        </div>

                        <div className="flex-1 space-y-1">
                          <div className="flex flex-wrap gap-2">
                            <button 
                              type="button"
                              onClick={() => thumbInputRef.current?.click()}
                              className="px-2.5 py-1.5 bg-[#111a30] hover:bg-[#1a2748] border border-[#18233c] rounded-lg text-[9px] font-black uppercase text-white shadow-sm"
                            >
                              Upload Thumbnail
                            </button>
                            <button 
                              type="button"
                              onClick={handleExtractFrame}
                              disabled={!videoFile || extracting}
                              className="px-2.5 py-1.5 bg-[#111a30] hover:bg-[#1a2748] border border-[#18233c] disabled:opacity-40 rounded-lg text-[9px] font-black uppercase text-slate-400 hover:text-white shadow-sm flex items-center justify-center min-w-[70px]"
                            >
                              {extracting ? "Extracting..." : "Extract Frame"}
                            </button>
                          </div>
                          <p className="text-[8px] text-slate-500 font-extrabold max-w-[160px] leading-tight">
                            Recommendations: 1280x720, JPG or PNG.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Styled Category Dropdown exactly from the screenshot dropdown layout */}
                    <div className="space-y-2">
                      <label className="text-[11px] font-black uppercase text-slate-400">Category</label>
                      <div className="relative">
                        <select 
                          className="w-full bg-[#080d19] border border-[#18233c] focus:border-[#f59e0b] px-4 py-3 rounded-xl font-bold text-xs text-white uppercase tracking-wider focus:outline-none appearance-none cursor-pointer"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                          disabled={isShort}
                        >
                          <option value="Afrobeat">Afrobeat (Suggested)</option>
                          <option value="Gospel">Gospel</option>
                          <option value="R&B">R&B</option>
                          <option value="Traditional">Traditional</option>
                          <option value="Hip Hop">Hip Hop</option>
                          <option value="Other">Other</option>
                        </select>
                        <div className="absolute inset-y-0 right-3.5 flex items-center pointer-events-none text-slate-500">
                          <svg width="10" height="6" viewBox="0 0 10 6" fill="currentColor">
                            <path d="M0 0l5 5 5-5z"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Video Type Toggle Panel (Bento columns) */}
                  <div className="space-y-3">
                    <label className="text-[11px] font-black uppercase text-slate-400">Video Type & Monetization</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      
                      {/* Option 1: Standard Video (Paid - Never shows ads) */}
                      <div 
                        onClick={() => {
                          setIsShort(false);
                          setIsFreeVideo(false);
                          setCategory("Afrobeat");
                        }}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                          !isShort && !isFreeVideo
                            ? "border-[#f59e0b] bg-[#f59e0b]/5 shadow-sm" 
                            : "border-[#18233c] bg-[#080d19]/60 hover:bg-[#111a30]/30"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${!isShort && !isFreeVideo ? 'border-[#f59e0b]' : 'border-slate-500'}`}>
                            {!isShort && !isFreeVideo && <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />}
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-white">Paid Video</h4>
                            <p className="text-[9px] text-amber-400 font-bold mt-0.5">Pay-per-view • Ad-Free</p>
                          </div>
                        </div>

                        {/* Price Input Block */}
                        <div className="mt-4 grid grid-cols-1 gap-2">
                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Price (RWF):</span>
                            <input 
                              type="number"
                              disabled={isShort || isFreeVideo}
                              className="w-full bg-[#080d19] border border-[#18233c] focus:border-[#f59e0b] px-3 py-1.5 rounded-lg text-xs font-black text-white focus:outline-none disabled:opacity-40"
                              value={priceRwf}
                              onChange={(e) => setPriceRwf(e.target.value)}
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Price (USD):</span>
                            <div className="relative">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-extrabold">$</span>
                              <input 
                                type="text"
                                disabled={isShort || isFreeVideo}
                                className="w-full pl-6 bg-[#080d19] border border-[#18233c] focus:border-[#f59e0b] px-3 py-1.5 rounded-lg text-xs font-black text-white focus:outline-none disabled:opacity-40"
                                value={priceUsd}
                                onChange={(e) => setPriceUsd(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Option 2: Standard Free Video (Eligible for Pre-roll Ads) */}
                      <div 
                        onClick={() => {
                          setIsShort(false);
                          setIsFreeVideo(true);
                          setCategory("Afrobeat");
                        }}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                          !isShort && isFreeVideo
                            ? "border-emerald-500 bg-emerald-500/10 shadow-sm" 
                            : "border-[#18233c] bg-[#080d19]/60 hover:bg-[#111a30]/30"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${!isShort && isFreeVideo ? 'border-emerald-500' : 'border-slate-500'}`}>
                            {!isShort && isFreeVideo && <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />}
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-white">Free Video</h4>
                            <p className="text-[9px] text-emerald-400 font-bold mt-0.5">Horizontal • Shows Ads</p>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between text-[9px] text-slate-400 font-bold uppercase">
                            <span>Access:</span>
                            <span className="text-emerald-400 font-black">100% Free</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-[9px] text-slate-300 leading-relaxed">
                            Pre-roll ads can play before video. Viewers can skip after 5s.
                          </div>
                        </div>
                      </div>

                      {/* Option 3: Short (Vertical, 9:16, Never shows ads) */}
                      <div 
                        onClick={() => {
                          setIsShort(true);
                          setIsFreeVideo(false);
                          setCategory("Shorts");
                        }}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                          isShort 
                            ? "border-[#f59e0b] bg-[#f59e0b]/5 shadow-sm" 
                            : "border-[#18233c] bg-[#080d19]/60 hover:bg-[#111a30]/30"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${isShort ? 'border-[#f59e0b]' : 'border-slate-500'}`}>
                            {isShort && <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />}
                          </div>
                          <div>
                            <h4 className="text-xs font-black text-white">Shorts (Free)</h4>
                            <p className="text-[9px] text-slate-400 font-bold mt-0.5">Vertical 9:16 • No Ads</p>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between text-[9px] text-slate-500 font-bold uppercase">
                            <span>Duration:</span>
                            <span className="text-[#f59e0b] font-black">Max 50 sec</span>
                          </div>
                          <div className="p-2.5 rounded-lg bg-[#111a30] border border-[#18233c] text-[9px] text-slate-400 leading-relaxed">
                            Quick-scroll feed content. Never plays ads.
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Visibility Sector Row */}
                  <div className="space-y-2 border-t border-[#18233c] pt-4">
                    <label className="text-[11px] font-black uppercase text-slate-400">Visibility</label>
                    <div className="flex flex-wrap items-center gap-5">
                      {["public", "unlisted", "private"].map((vis) => (
                        <div 
                          key={vis}
                          onClick={() => setVisibility(vis)}
                          className="flex items-center gap-2 cursor-pointer group"
                        >
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${visibility === vis ? 'border-[#f59e0b]' : 'border-slate-600 group-hover:border-slate-400'}`}>
                            {visibility === vis && <div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />}
                          </div>
                          <span className="text-xs font-extrabold uppercase text-slate-300 group-hover:text-white transition-colors">{vis}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Schedule Publication check sector */}
                  <div className="space-y-3.5 border-t border-[#18233c]/60 pt-4">
                    <div 
                      onClick={() => setScheduleEnabled(!scheduleEnabled)}
                      className="flex items-center gap-2.5 cursor-pointer select-none group"
                    >
                      <div className={`w-4 class h-4 rounded border flex items-center justify-center transition-colors ${scheduleEnabled ? 'border-[#f59e0b] bg-[#f59e0b]/10' : 'border-slate-600 group-hover:border-slate-400'}`}>
                        {scheduleEnabled && (
                          <svg className="w-2.5 h-2.5 text-[#f59e0b]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="text-xs font-extrabold uppercase text-slate-400 group-hover:text-slate-200 transition-colors">
                        Schedule Publication
                      </span>
                    </div>

                    {scheduleEnabled && (
                      <div className="grid grid-cols-2 gap-4 animate-in fade-in duration-300">
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-slate-500 uppercase">Date</span>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                            <input 
                              type="date"
                              className="w-full bg-[#080d19] pl-9 border border-[#18233c] focus:border-[#f59e0b] px-3 py-2 rounded-xl text-xs font-bold text-white focus:outline-none"
                              value={scheduleDate}
                              onChange={(e) => setScheduleDate(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-slate-500 uppercase">Time</span>
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                            <input 
                              type="time"
                              className="w-full bg-[#080d19] pl-9 border border-[#18233c] focus:border-[#f59e0b] px-3 py-2 rounded-xl text-xs font-bold text-white focus:outline-none"
                              value={scheduleTime}
                              onChange={(e) => setScheduleTime(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Submission Action Button Group */}
                  <div className="pt-4 flex flex-col md:flex-row items-center gap-3">
                    <button 
                      type="submit"
                      disabled={loading || !videoFile}
                      className="w-full md:flex-1 py-3 bg-[#f59e0b] hover:bg-[#d97706] disabled:opacity-40 text-[#080d19] rounded-xl font-black text-xs uppercase tracking-widest shadow-md transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Uploading {uploadProgress}%
                        </>
                      ) : (
                        "SAVE & PUBLISH"
                      )}
                    </button>
                    <button 
                      type="button"
                      onClick={() => navigate("/artist/dashboard")}
                      className="w-full md:w-36 py-3 bg-[#111a30] hover:bg-[#1a2748] border border-[#18233c] text-slate-300 hover:text-white rounded-xl font-black text-xs uppercase tracking-widest transition-colors shadow-sm"
                    >
                      CANCEL
                    </button>
                  </div>

                  {/* Error Notification banner */}
                  {error && (
                    <div className="flex items-center gap-2.5 p-3.5 bg-rose-500/10 text-rose-500 rounded-xl text-xs font-bold border border-rose-500/20 animate-pulse mt-4">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Success banner matching bottom banner in thumbnail mockup */}
                  {success && (
                    <div className="flex items-center gap-2.5 p-3.5 bg-emerald-500/10 text-emerald-400 rounded-xl text-xs font-bold border border-emerald-500/20 animate-fade-in mt-4">
                      <CheckCircle className="w-4 h-4 text-[#2dd4bf] shrink-0 animate-bounce" />
                      <span>Video uploaded successfully. View video: <span className="underline cursor-pointer text-[#2dd4bf]">{successLink || "paytune.com/v/unique_link"}</span></span>
                    </div>
                  )}

                </div>

              </div>
              
            </form>

          </div>

        </div>
      </div>

    </div>
  );
}
