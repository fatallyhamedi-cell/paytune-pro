import React, { useState, useEffect, useRef } from "react";
import {
  Settings,
  DollarSign,
  Shield,
  Bell,
  Mail,
  Save,
  CheckCircle2,
  AlertTriangle,
  Zap,
  Smartphone,
  Layers,
  User,
  Camera,
  Upload,
  Loader2
} from "lucide-react";
import axios from "axios";
import { MasterPlatformSettings } from "../hooks/useMasterSettings";

interface MasterSettingsProps {
  settings: MasterPlatformSettings | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  saveSuccess: boolean;
  onUpdateSettings: (updated: Partial<MasterPlatformSettings>) => Promise<any>;
  onUpdateTemplates: (templates: any) => Promise<any>;
}

export const MasterSettings: React.FC<MasterSettingsProps> = ({
  settings,
  loading,
  saving,
  error,
  saveSuccess,
  onUpdateSettings,
  onUpdateTemplates
}) => {
  const [form, setForm] = useState<MasterPlatformSettings>({
    platform_name: "PAYTUNE",
    tagline: "The Home of Rwandan Music & Creative Culture",
    logo_url: "/logo.png",
    vat_percentage: 5,
    commission_percentage: 30,
    min_withdrawal: 5000,
    momo_number: "0788192233",
    trending_days: 7,
    maintenance_mode: false,
    maintenance_message: "PAYTUNE is undergoing scheduled maintenance. Please check back shortly.",
    auto_approve_artists: false,
    welcome_template: "Welcome to PAYTUNE! Enjoy unlimited streaming of Rwandan music.",
    receipt_template: "Murakoze! Your payment for {{video_title}} was successful.",
    gift_template: "You have received a video gift from {{sender_name}}!",
    withdrawal_template: "Your withdrawal of {{amount}} RWF has been processed."
  });

  const [activeSettingsTab, setActiveSettingsTab] = useState<"profile" | "general" | "financial" | "templates">("profile");

  // Master Admin Profile State
  const [masterName, setMasterName] = useState("PAYTUNE Master Administrator");
  const [masterAvatar, setMasterAvatar] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load current master profile
    axios.get("/api/master/profile")
      .then(res => {
        if (res.data?.profile) {
          setMasterName(res.data.profile.full_name || "PAYTUNE Master Administrator");
          setMasterAvatar(res.data.profile.avatar_url || res.data.profile.profile_image || "");
        }
      })
      .catch(err => console.debug("Master profile load note:", err));
  }, []);

  const handleDeviceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    setProfileError(null);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      formData.append("file", file);

      const res = await axios.post("/api/upload/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      if (res.data?.url) {
        setMasterAvatar(res.data.url);
        // Automatically persist to master profile
        await axios.put("/api/master/profile", {
          full_name: masterName,
          avatar_url: res.data.url
        });
        setProfileSuccess(true);
        setTimeout(() => setProfileSuccess(false), 3500);
      } else {
        throw new Error("No image URL returned from upload");
      }
    } catch (err: any) {
      console.error("Device avatar upload error:", err);
      setProfileError(err.response?.data?.error || err.message || "Failed to upload avatar from device.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    try {
      await axios.put("/api/master/profile", {
        full_name: masterName,
        avatar_url: masterAvatar
      });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3500);
    } catch (err: any) {
      console.error("Save master profile error:", err);
      setProfileError(err.response?.data?.error || err.message || "Failed to update master profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  useEffect(() => {
    if (settings) {
      setForm({
        platform_name: settings.platform_name || "PAYTUNE",
        tagline: settings.tagline || "The Home of Rwandan Music & Creative Culture",
        logo_url: settings.logo_url || "/logo.png",
        vat_percentage: settings.vat_percentage ?? 5,
        commission_percentage: settings.owner_commission_percentage ?? settings.commission_percentage ?? 30,
        min_withdrawal: settings.min_withdrawal_amount ?? settings.min_withdrawal ?? 5000,
        momo_number: settings.owner_momo_number ?? settings.momo_number ?? "0788192233",
        trending_days: settings.trending_days ?? 7,
        maintenance_mode: !!settings.maintenance_mode,
        maintenance_message: settings.maintenance_message || "PAYTUNE is undergoing maintenance.",
        auto_approve_artists: !!settings.auto_approve_artists,
        welcome_template: settings.welcome_template || "",
        receipt_template: settings.receipt_template || "",
        gift_template: settings.gift_template || "",
        withdrawal_template: settings.withdrawal_template || ""
      });
    }
  }, [settings]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateSettings(form);
  };

  return (
    <div id="master-settings-module" className="max-w-4xl space-y-6">
      {/* Settings Navigation Tabs */}
      <div className="flex items-center space-x-2 p-1 rounded-2xl bg-[#161616] border border-neutral-800 text-xs w-fit">
        <button
          type="button"
          onClick={() => setActiveSettingsTab("profile")}
          className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            activeSettingsTab === "profile"
              ? "bg-amber-500 text-neutral-950 shadow"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Master Profile</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSettingsTab("general")}
          className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            activeSettingsTab === "general"
              ? "bg-amber-500 text-neutral-950 shadow"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          General & Algorithm
        </button>
        <button
          type="button"
          onClick={() => setActiveSettingsTab("financial")}
          className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            activeSettingsTab === "financial"
              ? "bg-amber-500 text-neutral-950 shadow"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Financials & MoMo
        </button>
        <button
          type="button"
          onClick={() => setActiveSettingsTab("templates")}
          className={`px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
            activeSettingsTab === "templates"
              ? "bg-amber-500 text-neutral-950 shadow"
              : "text-neutral-400 hover:text-white"
          }`}
        >
          Notification Templates
        </button>
      </div>

      {profileSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Master Administrator profile updated successfully.</span>
        </div>
      )}

      {profileError && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{profileError}</span>
        </div>
      )}

      {/* Hidden File Input for Master Avatar Upload from Device */}
      <input
        type="file"
        ref={avatarInputRef}
        accept="image/png, image/jpeg, image/gif, image/webp"
        className="hidden"
        onChange={handleDeviceUpload}
      />

      {activeSettingsTab === "profile" && (
        <form onSubmit={handleSaveProfile} className="p-6 rounded-2xl bg-[#161616] border border-neutral-800 space-y-6 text-xs">
          <h3 className="text-sm font-bold text-white border-b border-neutral-800 pb-3 flex items-center gap-2">
            <User className="w-4 h-4 text-amber-400" />
            Master Administrator Profile
          </h3>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-4 rounded-xl bg-neutral-900/60 border border-neutral-800">
            <div 
              onClick={() => avatarInputRef.current?.click()}
              className="relative w-24 h-24 rounded-full border-2 border-amber-500 shadow-xl overflow-hidden cursor-pointer group bg-neutral-950 flex items-center justify-center shrink-0"
              title="Click to upload profile photo from your device"
            >
              {masterAvatar ? (
                <img src={masterAvatar} alt="Master Admin" className="w-full h-full object-cover" />
              ) : (
                <span className="text-2xl font-black text-amber-400">
                  {masterName.charAt(0).toUpperCase()}
                </span>
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                {uploadingAvatar ? (
                  <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
                ) : (
                  <Camera className="w-6 h-6 text-white" />
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-bold border border-amber-500/30 flex items-center gap-2 cursor-pointer"
                >
                  {uploadingAvatar ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Uploading from device...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Upload Avatar from Device</span>
                    </>
                  )}
                </button>
                {masterAvatar && (
                  <button
                    type="button"
                    onClick={() => setMasterAvatar("")}
                    className="px-3 py-2 text-neutral-400 hover:text-red-400 font-medium"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="text-[11px] text-neutral-400">
                Supports PNG, JPEG, GIF, WEBP from your local device. Uploaded to secure storage.
              </p>
            </div>
          </div>

          <div className="space-y-4 max-w-lg">
            <div>
              <label className="block text-neutral-400 mb-1.5 font-medium">Administrator Full Name</label>
              <input
                type="text"
                value={masterName}
                onChange={(e) => setMasterName(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                placeholder="PAYTUNE Master Administrator"
              />
            </div>
          </div>

          <div className="flex justify-start pt-2">
            <button
              type="submit"
              disabled={savingProfile}
              className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-500/10 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{savingProfile ? "Saving Profile..." : "Save Master Profile"}</span>
            </button>
          </div>
        </form>
      )}

      {activeSettingsTab !== "profile" && (
        <form onSubmit={handleSubmit} className="space-y-6 text-xs">
          {saveSuccess && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Platform settings updated and synchronized across all active instances.</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        {activeSettingsTab === "general" && (
          <div className="p-6 rounded-2xl bg-[#161616] border border-neutral-800 space-y-5">
            <h3 className="text-sm font-bold text-white border-b border-neutral-800 pb-3 flex items-center gap-2">
              <Settings className="w-4 h-4 text-amber-400" />
              General Platform Settings
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-neutral-400 mb-1.5 font-medium">Platform Name</label>
                <input
                  type="text"
                  value={form.platform_name}
                  onChange={e => setForm({ ...form, platform_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-neutral-400 mb-1.5 font-medium">Platform Tagline</label>
                <input
                  type="text"
                  value={form.tagline || ""}
                  onChange={e => setForm({ ...form, tagline: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Automatic Artist Approval Feature */}
            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2 text-white font-bold">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Automatic Artist Approval</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    form.auto_approve_artists ? "bg-emerald-500/20 text-emerald-400 font-bold" : "bg-neutral-800 text-neutral-400"
                  }`}>
                    {form.auto_approve_artists ? "ACTIVE" : "OFF"}
                  </span>
                </div>
                <p className="text-neutral-400 text-[11px] mt-1">
                  When enabled, newly registered Rwandan artists are automatically approved without requiring manual review.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.auto_approve_artists}
                  onChange={e => setForm({ ...form, auto_approve_artists: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {/* Trending Window */}
            <div>
              <label className="block text-neutral-400 mb-1.5 font-medium">
                Trending Videos Calculation Window (Days)
              </label>
              <input
                type="number"
                value={form.trending_days}
                onChange={e => setForm({ ...form, trending_days: Number(e.target.value) })}
                className="w-full max-w-xs px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
              />
              <p className="text-[11px] text-neutral-500 mt-1">
                Number of days considered to compute velocity of views and sales for the Trending tab.
              </p>
            </div>

            {/* Maintenance Mode */}
            <div className="p-4 rounded-xl bg-neutral-900/80 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-white font-bold block">Maintenance Mode</span>
                  <span className="text-neutral-400 text-[11px]">
                    Display maintenance splash screen to all non-admin visitors
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.maintenance_mode}
                    onChange={e => setForm({ ...form, maintenance_mode: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {form.maintenance_mode && (
                <div>
                  <label className="block text-neutral-400 mb-1">Maintenance Notice Message</label>
                  <input
                    type="text"
                    value={form.maintenance_message || ""}
                    onChange={e => setForm({ ...form, maintenance_message: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {activeSettingsTab === "financial" && (
          <div className="p-6 rounded-2xl bg-[#161616] border border-neutral-800 space-y-5">
            <h3 className="text-sm font-bold text-white border-b border-neutral-800 pb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-400" />
              Financial & Revenue Split Parameters
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-neutral-400 mb-1.5 font-medium">
                  Owner Commission Percentage (%)
                </label>
                <input
                  type="number"
                  value={form.commission_percentage}
                  onChange={e => setForm({ ...form, commission_percentage: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  Platform owner retained share (default: 30%). Artists receive remaining amount minus VAT.
                </p>
              </div>

              <div>
                <label className="block text-neutral-400 mb-1.5 font-medium">
                  Rwanda VAT Percentage (%)
                </label>
                <input
                  type="number"
                  value={form.vat_percentage}
                  onChange={e => setForm({ ...form, vat_percentage: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  Tax automatically deducted from gross sales (default: 5%).
                </p>
              </div>

              <div>
                <label className="block text-neutral-400 mb-1.5 font-medium">
                  Minimum Withdrawal Amount (RWF)
                </label>
                <input
                  type="number"
                  value={form.min_withdrawal}
                  onChange={e => setForm({ ...form, min_withdrawal: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  Minimum creator threshold for initiating a payout request (default: 5,000 RWF).
                </p>
              </div>

              <div>
                <label className="block text-neutral-400 mb-1.5 font-medium">
                  Platform Owner MTN MoMo Number
                </label>
                <input
                  type="text"
                  value={form.momo_number}
                  onChange={e => setForm({ ...form, momo_number: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-amber-500"
                />
                <p className="text-[11px] text-neutral-500 mt-1">
                  Destination wallet where the 30% platform fee is deposited.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeSettingsTab === "templates" && (
          <div className="p-6 rounded-2xl bg-[#161616] border border-neutral-800 space-y-5">
            <h3 className="text-sm font-bold text-white border-b border-neutral-800 pb-3 flex items-center gap-2">
              <Mail className="w-4 h-4 text-amber-400" />
              Automated Messaging & Email Templates
            </h3>

            <div>
              <label className="block text-neutral-400 mb-1.5 font-medium">Welcome Email Template</label>
              <textarea
                rows={3}
                value={form.welcome_template}
                onChange={e => setForm({ ...form, welcome_template: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-amber-500 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block text-neutral-400 mb-1.5 font-medium">Purchase Receipt Template</label>
              <textarea
                rows={3}
                value={form.receipt_template}
                onChange={e => setForm({ ...form, receipt_template: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-amber-500 font-mono text-xs"
              />
              <span className="text-[11px] text-neutral-500">Available variables: {"{{video_title}}"}, {"{{amount}}"}, {"{{artist_name}}"}</span>
            </div>

            <div>
              <label className="block text-neutral-400 mb-1.5 font-medium">Withdrawal Disbursement Template</label>
              <textarea
                rows={2}
                value={form.withdrawal_template || ""}
                onChange={e => setForm({ ...form, withdrawal_template: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white focus:outline-none focus:border-amber-500 font-mono text-xs"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            id="btn-save-master-settings"
            type="submit"
            disabled={saving}
            className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-500/10 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Saving Changes..." : "Save Platform Settings"}</span>
          </button>
        </div>
      </form>
      )}
    </div>
  );
};
