import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../hooks/useAuth";
import { 
  User, 
  Settings as SettingsIcon, 
  Lock, 
  Trash2, 
  Bell, 
  CreditCard, 
  ShieldCheck, 
  Mail, 
  FileText, 
  CheckCircle, 
  Music, 
  AlertTriangle,
  Upload,
  Plus,
  Loader2,
  X,
  Smartphone,
  Info,
  Camera,
  Globe,
  Image as ImageIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "motion/react";

export default function SettingsPage() {
  const { user, roleData, refreshProfile } = useAuth();
  const [activeSegment, setActiveSegment] = useState<"user" | "artist" | "master">("user");
  
  // Loading & statuses
  const [fetching, setFetching] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMasterProf, setSavingMasterProf] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // File input refs
  const userAvatarRef = useRef<HTMLInputElement>(null);
  const artistAvatarRef = useRef<HTMLInputElement>(null);
  const artistBannerRef = useRef<HTMLInputElement>(null);
  const masterAvatarRef = useRef<HTMLInputElement>(null);

  // Uploading states
  const [uploadingUserAvatar, setUploadingUserAvatar] = useState(false);
  const [uploadingArtistAvatar, setUploadingArtistAvatar] = useState(false);
  const [uploadingArtistBanner, setUploadingArtistBanner] = useState(false);
  const [uploadingMasterAvatar, setUploadingMasterAvatar] = useState(false);

  // User form states
  const [userProfile, setUserProfile] = useState({
    full_name: "",
    username: "",
    email: "",
    phone: "",
    bio: "",
    avatar_url: "",
    saved_payment_phones: [] as string[],
    notification_pref_upload: true
  });
  const [newPaymentPhone, setNewPaymentPhone] = useState("");

  // Artist form states
  const [artistProfile, setArtistProfile] = useState({
    full_name: "",
    bio: "",
    profile_image: "",
    banner_image: "",
    phone: "",
    momo_code: "",
    momo_provider: "MTN",
    instagram: "",
    twitter: "",
    youtube: "",
    spotify: "",
    website: "",
    active_notifications: {
      purchase: true,
      subscriber: true,
      comment: true,
      payout: true
    }
  });

  // Master profile state (Master has only profile picture and full name, no bio or phone)
  const [masterProfile, setMasterProfile] = useState({
    full_name: "PAYTUNE Master Administrator",
    avatar_url: "",
    email: "master@paytune.com"
  });

  // Master form states
  const [masterSettings, setMasterSettings] = useState({
    platform_name: "PAYTUNE",
    vat_percentage: 5,
    commission_percentage: 30,
    min_withdrawal: 5000,
    momo_number: "1922331",
    maintenance_mode: false,
    welcome_template: "",
    receipt_template: ""
  });

  // Password change states
  const [passwordState, setPasswordState] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [changingPass, setChangingPass] = useState(false);

  // Delete account confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");

  const isArtist = roleData?.momo_code !== undefined;
  const isMaster = roleData?.is_master === true || roleData?.role === 'master';

  useEffect(() => {
    // Choose appropriate tab default based on role
    if (isMaster) {
      setActiveSegment("master");
    } else if (isArtist) {
      setActiveSegment("artist");
    } else {
      setActiveSegment("user");
    }
    loadAllData();
  }, [user, roleData]);

  const loadAllData = async () => {
    if (!user) return;
    setFetching(true);
    try {
      // Load User Profiles
      const userRes = await axios.get("/api/user/settings");
      if (userRes.data) {
        setUserProfile({
          full_name: userRes.data.full_name || "",
          username: userRes.data.username || "",
          email: userRes.data.email || user?.email || "",
          phone: userRes.data.phone || "",
          bio: userRes.data.bio || "",
          avatar_url: userRes.data.avatar_url || userRes.data.profile_image || "",
          saved_payment_phones: Array.isArray(userRes.data.saved_payment_phones) 
            ? userRes.data.saved_payment_phones 
            : [],
          notification_pref_upload: userRes.data.notification_pref_upload !== false
        });
      }

      // Load Artist Profiles if applicable
      if (isArtist || isMaster) {
        try {
          const artistRes = await axios.get("/api/artist/settings");
          if (artistRes.data) {
            const d = artistRes.data;
            const socials = d.social_links || d.profile?.social_links || {};
            setArtistProfile({
              full_name: d.full_name || d.profile?.stage_name || "",
              bio: d.bio || d.profile?.bio || "",
              profile_image: d.profile_image || d.avatar_url || d.profile?.avatar_url || "",
              banner_image: d.banner_image || d.banner_url || d.profile?.banner_url || "",
              phone: d.phone || d.payment?.phone || "",
              momo_code: d.momo_code || d.payment?.phone || "",
              momo_provider: d.momo_provider || d.payment?.provider || "MTN",
              instagram: socials.instagram || "",
              twitter: socials.twitter || "",
              youtube: socials.youtube || "",
              spotify: socials.spotify || "",
              website: socials.website || "",
              active_notifications: d.active_notifications || {
                purchase: true,
                subscriber: true,
                comment: true,
                payout: true
              }
            });
          }
        } catch (err) {
          console.log("No artist details found or initialized.");
        }
      }

      // Load Master Config and Master Profile
      if (isMaster) {
        try {
          const [masterRes, masterProfRes] = await Promise.allSettled([
            axios.get("/api/master/settings"),
            axios.get("/api/master/profile")
          ]);
          if (masterRes.status === "fulfilled" && masterRes.value?.data) {
            setMasterSettings(masterRes.value.data);
          }
          if (masterProfRes.status === "fulfilled" && masterProfRes.value?.data?.profile) {
            const prof = masterProfRes.value.data.profile;
            setMasterProfile({
              full_name: prof.full_name || "PAYTUNE Master Administrator",
              avatar_url: prof.avatar_url || prof.profile_image || "",
              email: prof.email || "master@paytune.com"
            });
          }
        } catch (err) {
          console.error("Master load error:", err);
        }
      }
    } catch (err: any) {
      console.error("Failed to fetch settings metadata:", err);
      setErrorMsg("Failed to synchronize preferences with server.");
    } finally {
      setFetching(false);
    }
  };

  const alertSuccess = (message: string) => {
    setSuccessMsg(message);
    setTimeout(() => setSuccessMsg(null), 5000);
  };

  const handleFileUpload = async (
    file: File, 
    type: 'avatar' | 'banner', 
    onSuccess: (url: string) => void,
    setLoading: (l: boolean) => void
  ) => {
    if (!file) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append(type === 'banner' ? 'banner' : 'avatar', file);
      const endpoint = type === 'banner' ? '/api/upload/banner' : '/api/upload/avatar';
      const res = await axios.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data?.url) {
        onSuccess(res.data.url);
        alertSuccess(`${type === 'banner' ? 'Banner image' : 'Profile picture'} uploaded successfully!`);
      } else {
        throw new Error("No URL returned from server.");
      }
    } catch (err: any) {
      console.error("File upload error:", err);
      setErrorMsg(err.response?.data?.error || err.message || "Failed to upload image.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      await axios.put("/api/user/settings", userProfile);
      await refreshProfile();
      alertSuccess("User profile & preferences saved successfully!");
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || "An error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveArtist = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      const payload = {
        ...artistProfile,
        social_links: {
          instagram: artistProfile.instagram,
          twitter: artistProfile.twitter,
          youtube: artistProfile.youtube,
          spotify: artistProfile.spotify,
          website: artistProfile.website
        }
      };
      const res = await axios.put("/api/artist/settings", payload);
      await refreshProfile();
      if (res.data?.requiresReapproval) {
        alertSuccess("Artist settings updated. Note: Mobile money credential edits require master approval.");
      } else {
        alertSuccess("Artist studio details persisted successfully!");
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || "An error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMasterProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingMasterProf(true);
    setErrorMsg(null);
    try {
      const res = await axios.put("/api/master/profile", {
        full_name: masterProfile.full_name,
        avatar_url: masterProfile.avatar_url,
        profile_image: masterProfile.avatar_url
      });
      if (res.data?.profile) {
        setMasterProfile({
          full_name: res.data.profile.full_name,
          avatar_url: res.data.profile.avatar_url || res.data.profile.profile_image,
          email: res.data.profile.email
        });
      }
      await refreshProfile();
      alertSuccess("Master Administrator profile persisted successfully!");
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || "Failed to update Master profile.");
    } finally {
      setSavingMasterProf(false);
    }
  };

  const handleSaveMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      await axios.put("/api/master/settings", masterSettings);
      alertSuccess("Master platform variables synchronized globally!");
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || "An error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPaymentPhone = () => {
    if (!newPaymentPhone.trim()) return;
    if (userProfile.saved_payment_phones.includes(newPaymentPhone)) return;
    setUserProfile({
      ...userProfile,
      saved_payment_phones: [...userProfile.saved_payment_phones, newPaymentPhone]
    });
    setNewPaymentPhone("");
  };

  const handleRemovePaymentPhone = (phone: string) => {
    setUserProfile({
      ...userProfile,
      saved_payment_phones: userProfile.saved_payment_phones.filter(p => p !== phone)
    });
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordState.newPassword !== passwordState.confirmPassword) {
      setErrorMsg("New passwords do not match.");
      return;
    }
    setChangingPass(true);
    setErrorMsg(null);
    try {
      await axios.post("/api/user/change-password", { password: passwordState.newPassword });
      setPasswordState({ currentPassword: "", newPassword: "", confirmPassword: "" });
      alertSuccess("Security parameters updated successfully.");
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || "Password change failed.");
    } finally {
      setChangingPass(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationText !== "DELETE") {
      setErrorMsg("Please enter exact confirmation keyword.");
      return;
    }
    try {
      await axios.post("/api/user/delete-account");
      setShowDeleteModal(false);
      // Log out
      window.location.href = "/auth";
    } catch (err: any) {
      setErrorMsg(err.message || "Delete account request failed.");
    }
  };

  if (fetching) {
     return (
       <div className="flex flex-col items-center justify-center p-32 space-y-4">
          <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
          <p className="text-gray-400 font-black uppercase text-xs tracking-[0.25em]">Synchronizing Settings...</p>
       </div>
     );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <div className="mb-10">
         <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 rounded-xl">
               <SettingsIcon className="w-5 h-5 text-amber-600" />
            </div>
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tighter italic">Settings & Identity</h1>
         </div>
         <p className="text-xs font-black text-gray-400 uppercase tracking-widest mt-1">Configure your PAYTUNE experience</p>
      </div>

      {/* Segment Selectors */}
      <div className="flex flex-wrap gap-2 mb-8 bg-gray-50 p-1.5 rounded-2xl w-fit">
         {/* User Settings visible to everyone */}
         <Button 
           variant="ghost" 
           onClick={() => setActiveSegment("user")}
           className={`rounded-xl font-black text-[11px] uppercase tracking-wider h-10 px-5 transition-all ${
             activeSegment === "user" 
               ? "bg-white text-gray-900 shadow-sm border border-gray-100" 
               : "text-gray-400 hover:text-gray-900"
           }`}
         >
            <User className="w-4 h-4 mr-2" />
            My Fan Profile
         </Button>

         {/* Artist segments */}
         {(isArtist || isMaster) && (
            <Button 
              variant="ghost" 
              onClick={() => setActiveSegment("artist")}
              className={`rounded-xl font-black text-[11px] uppercase tracking-wider h-10 px-5 transition-all ${
                activeSegment === "artist" 
                  ? "bg-yellow-500 text-white hover:bg-yellow-600 shadow-lg shadow-yellow-100" 
                  : "text-yellow-600 hover:text-yellow-900 bg-yellow-500/5 hover:bg-yellow-500/10"
              }`}
            >
               <Music className="w-4 h-4 mr-2" />
               Artist Studio Settings
            </Button>
         )}

         {/* Master control tab */}
         {isMaster && (
            <Button 
               variant="ghost" 
               onClick={() => setActiveSegment("master")}
               className={`rounded-xl font-black text-[11px] uppercase tracking-wider h-10 px-5 transition-all ${
                 activeSegment === "master" 
                   ? "bg-rose-500 text-white hover:bg-rose-600 shadow-lg shadow-rose-100 font-mono" 
                   : "text-rose-500 hover:text-rose-900 bg-rose-500/5 hover:bg-rose-500/10 font-mono"
               }`}
            >
               <ShieldCheck className="w-4 h-4 mr-2" />
               Master Platform Controls
            </Button>
         )}
      </div>

      {/* Success/Error Banners */}
      <AnimatePresence>
         {successMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 p-4 bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-2xl flex items-center gap-3 text-xs font-bold uppercase tracking-wider shadow-sm"
            >
               <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
               {successMsg}
            </motion.div>
         )}
         {errorMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-6 p-4 bg-rose-50 text-rose-800 border border-rose-100 rounded-2xl flex items-center gap-3 text-xs font-bold uppercase tracking-wider shadow-sm"
            >
               <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
               {errorMsg}
            </motion.div>
         )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         {/* Main Forms workspace */}
         <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
               {activeSegment === "user" && (
                  <motion.div
                     key="user"
                     initial={{ opacity: 0, x: -10 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: 10 }}
                  >
                     <Card className="bg-white border-gray-100 rounded-[32px] shadow-sm overflow-hidden">
                        <CardContent className="p-8">
                           <h2 className="text-xl font-black text-gray-900 uppercase tracking-tighter mb-6 flex items-center gap-2">
                              Account Profile Parameters
                           </h2>
                           <form onSubmit={handleSaveUser} className="space-y-6">
                              {/* Profile Picture Upload & Preview */}
                              <div className="p-5 bg-gray-50/70 border border-gray-150/70 rounded-2xl">
                                 <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
                                    Profile Picture
                                 </label>
                                 <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                                    <div className="relative group shrink-0">
                                       <div className="w-20 h-20 rounded-full overflow-hidden bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center text-amber-600 font-black text-xl shadow-inner">
                                          {userProfile.avatar_url ? (
                                             <img 
                                               src={userProfile.avatar_url} 
                                               alt="User Avatar" 
                                               className="w-full h-full object-cover"
                                               referrerPolicy="no-referrer"
                                               onError={(e) => {
                                                  (e.target as HTMLElement).style.display = "none";
                                               }}
                                             />
                                          ) : (
                                             <span>{userProfile.full_name?.charAt(0)?.toUpperCase() || "U"}</span>
                                          )}
                                       </div>
                                       <button
                                         type="button"
                                         onClick={() => userAvatarRef.current?.click()}
                                         disabled={uploadingUserAvatar}
                                         className="absolute bottom-0 right-0 p-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-full shadow-md border-2 border-white transition-all cursor-pointer"
                                         title="Upload new photo"
                                       >
                                          {uploadingUserAvatar ? (
                                             <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          ) : (
                                             <Camera className="w-3.5 h-3.5" />
                                          )}
                                       </button>
                                    </div>

                                    <div className="flex-1 w-full space-y-2">
                                       <div className="flex items-center gap-2">
                                          <input 
                                            type="file"
                                            ref={userAvatarRef}
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                               const file = e.target.files?.[0];
                                               if (file) {
                                                  handleFileUpload(
                                                     file, 
                                                     'avatar', 
                                                     (url) => setUserProfile({ ...userProfile, avatar_url: url }),
                                                     setUploadingUserAvatar
                                                  );
                                               }
                                            }}
                                          />
                                          <Button
                                            type="button"
                                            onClick={() => userAvatarRef.current?.click()}
                                            disabled={uploadingUserAvatar}
                                            variant="outline"
                                            className="rounded-xl font-black text-xs uppercase tracking-wider h-10 px-4 border-gray-200 hover:bg-gray-100 flex items-center gap-1.5"
                                          >
                                             {uploadingUserAvatar ? (
                                                <>
                                                   <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                   Uploading...
                                                </>
                                             ) : (
                                                <>
                                                   <Upload className="w-3.5 h-3.5 text-amber-500" />
                                                   Upload Avatar
                                                </>
                                             )}
                                          </Button>
                                          <span className="text-[11px] text-gray-400 font-bold">JPG, PNG or GIF up to 5MB</span>
                                       </div>
                                       <div>
                                          <input 
                                            type="url"
                                            value={userProfile.avatar_url}
                                            onChange={(e) => setUserProfile({ ...userProfile, avatar_url: e.target.value })}
                                            className="w-full h-10 px-3 rounded-xl bg-white border border-gray-200 text-xs font-medium text-gray-700 focus:outline-none focus:border-amber-500"
                                            placeholder="Or enter direct image URL (https://...)"
                                          />
                                       </div>
                                    </div>
                                 </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Display Full Name</label>
                                    <input 
                                      type="text" 
                                      value={userProfile.full_name}
                                      onChange={(e) => setUserProfile({ ...userProfile, full_name: e.target.value })}
                                      className="w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-100 text-sm font-bold text-gray-800 focus:outline-none focus:border-amber-500"
                                      placeholder="e.g. Jean Kamali"
                                      required
                                    />
                                 </div>
                                 <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Username</label>
                                    <input 
                                      type="text" 
                                      value={userProfile.username}
                                      onChange={(e) => setUserProfile({ ...userProfile, username: e.target.value })}
                                      className="w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-100 text-sm font-bold text-gray-800 focus:outline-none focus:border-amber-500"
                                      placeholder="e.g. jeankamali"
                                      required
                                    />
                                 </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Email Address</label>
                                    <input 
                                      type="email" 
                                      value={userProfile.email}
                                      disabled
                                      className="w-full h-12 px-4 rounded-xl bg-gray-100 border border-gray-100 text-sm font-bold text-gray-400 cursor-not-allowed focus:outline-none"
                                    />
                                    <span className="text-[10px] text-gray-400 font-bold mt-1 block">Authentication email is locked to system session.</span>
                                 </div>
                                 <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Contact Mobile Phone</label>
                                    <input 
                                      type="text" 
                                      value={userProfile.phone}
                                      onChange={(e) => setUserProfile({ ...userProfile, phone: e.target.value })}
                                      className="w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-100 text-sm font-bold text-gray-800 focus:outline-none focus:border-amber-500"
                                      placeholder="e.g. 078XXXXXXX"
                                    />
                                 </div>
                              </div>

                              {/* Bio field for User */}
                              <div>
                                 <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                                    Bio (Optional)
                                 </label>
                                 <textarea 
                                   value={userProfile.bio}
                                   onChange={(e) => setUserProfile({ ...userProfile, bio: e.target.value })}
                                   rows={3}
                                   className="w-full p-4 rounded-xl bg-gray-50 border border-gray-100 text-sm font-medium text-gray-800 focus:outline-none focus:border-amber-500 resize-none"
                                   placeholder="Share a short line about your musical tastes or diaspora community connection..."
                                 />
                              </div>

                              <div className="h-px bg-gray-100 my-6" />

                              <div>
                                 <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-4 flex items-center gap-2">
                                    <CreditCard className="w-4 h-4 text-amber-500" />
                                    Saved Payment Phones
                                 </h3>
                                 <p className="text-xs text-gray-400 font-bold mb-4">Register mobile money account numbers for quick one-click authorization at paywall checkout.</p>
                                 
                                 <div className="flex gap-2 max-w-md mb-4">
                                    <input 
                                      type="text" 
                                      value={newPaymentPhone}
                                      onChange={(e) => setNewPaymentPhone(e.target.value)}
                                      className="flex-1 h-11 px-4 rounded-xl bg-gray-50 border border-gray-100 text-xs font-bold text-gray-800 focus:outline-none focus:border-amber-500"
                                      placeholder="Prefix e.g. 0788000000"
                                    />
                                    <Button 
                                       type="button" 
                                       onClick={handleAddPaymentPhone}
                                       className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-black uppercase h-11 px-4 gap-1 border-none"
                                    >
                                       <Plus className="w-4 h-4" /> Add Phone
                                    </Button>
                                 </div>

                                 <div className="flex flex-wrap gap-2">
                                    {userProfile.saved_payment_phones.length > 0 ? (
                                       userProfile.saved_payment_phones.map(phone => (
                                          <div key={phone} className="flex items-center gap-2 bg-gray-50 px-4 py-2 border border-gray-100 rounded-xl text-xs font-bold text-gray-700">
                                             <Smartphone className="w-3.5 h-3.5 text-amber-500" />
                                             {phone}
                                             <button 
                                               type="button" 
                                               onClick={() => handleRemovePaymentPhone(phone)}
                                               className="text-gray-400 hover:text-rose-500 transition-colors ml-1"
                                             >
                                                <X className="w-3.5 h-3.5" />
                                             </button>
                                          </div>
                                       ))
                                    ) : (
                                       <span className="text-[11px] text-gray-400 italic">No saved quick-payment numbers available. Add a phone above.</span>
                                    )}
                                 </div>
                              </div>

                              <div className="h-px bg-gray-100 my-6" />

                              <div>
                                 <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-4 flex items-center gap-2">
                                    <Bell className="w-4 h-4 text-amber-500" />
                                    Notification Preferences
                                 </h3>
                                 <label className="flex items-center gap-3 cursor-pointer">
                                    <input 
                                      type="checkbox" 
                                      checked={userProfile.notification_pref_upload}
                                      onChange={(e) => setUserProfile({ ...userProfile, notification_pref_upload: e.target.checked })}
                                      className="rounded border-gray-100 text-amber-500 focus:ring-amber-500 w-4 h-4"
                                    />
                                    <span className="text-xs text-gray-600 font-bold uppercase tracking-wider">Email me instantly when artists I follow drop new songs</span>
                                 </label>
                              </div>

                              <div className="pt-4">
                                 <Button 
                                   type="submit" 
                                   disabled={saving}
                                   className="bg-amber-500 text-white hover:bg-amber-600 font-black text-[11px] uppercase tracking-wider py-4 px-10 h-12 rounded-xl shadow-lg shadow-amber-150 border-none flex items-center gap-2"
                                 >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Save Fan Profile Details
                                 </Button>
                              </div>
                           </form>
                        </CardContent>
                     </Card>
                  </motion.div>
               )}

               {activeSegment === "artist" && (
                  <motion.div
                     key="artist"
                     initial={{ opacity: 0, x: -10 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: 10 }}
                  >
                     <Card className="bg-white border-gray-100 rounded-[32px] shadow-sm overflow-hidden">
                        <CardContent className="p-8">
                           <h2 className="text-xl font-black text-yellow-600 uppercase tracking-tighter mb-6 flex items-center gap-2">
                              Artist Studio Customizations
                           </h2>
                           <form onSubmit={handleSaveArtist} className="space-y-6">
                              {/* Visual Branding Section: Avatar and Banner */}
                              <div className="p-6 bg-amber-500/5 border border-amber-200/50 rounded-2xl space-y-6">
                                 <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                                    <Camera className="w-4 h-4 text-amber-500" />
                                    Artist Visual Branding
                                 </h3>

                                 {/* 1. Profile Picture */}
                                 <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                                       Stage Profile Picture (Avatar)
                                    </label>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                       <div className="w-18 h-18 rounded-full overflow-hidden bg-gray-200 border-2 border-amber-500/30 shrink-0 shadow-inner flex items-center justify-center">
                                          {artistProfile.profile_image ? (
                                             <img 
                                               src={artistProfile.profile_image} 
                                               alt="Artist Avatar" 
                                               className="w-full h-full object-cover"
                                               referrerPolicy="no-referrer"
                                             />
                                          ) : (
                                             <Music className="w-6 h-6 text-gray-400" />
                                          )}
                                       </div>
                                       <div className="flex-1 w-full space-y-2">
                                          <div className="flex items-center gap-2">
                                             <input 
                                               type="file"
                                               ref={artistAvatarRef}
                                               accept="image/*"
                                               className="hidden"
                                               onChange={(e) => {
                                                  const file = e.target.files?.[0];
                                                  if (file) {
                                                     handleFileUpload(
                                                        file,
                                                        'avatar',
                                                        (url) => setArtistProfile({ ...artistProfile, profile_image: url }),
                                                        setUploadingArtistAvatar
                                                     );
                                                  }
                                               }}
                                             />
                                             <Button
                                               type="button"
                                               onClick={() => artistAvatarRef.current?.click()}
                                               disabled={uploadingArtistAvatar}
                                               variant="outline"
                                               className="rounded-xl font-black text-xs uppercase tracking-wider h-10 px-4 border-gray-200 hover:bg-gray-100 flex items-center gap-1.5"
                                             >
                                                {uploadingArtistAvatar ? (
                                                   <>
                                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                      Uploading...
                                                   </>
                                                ) : (
                                                   <>
                                                      <Upload className="w-3.5 h-3.5 text-amber-500" />
                                                      Upload Photo
                                                   </>
                                                )}
                                             </Button>
                                          </div>
                                          <input 
                                            type="url" 
                                            value={artistProfile.profile_image}
                                            onChange={(e) => setArtistProfile({ ...artistProfile, profile_image: e.target.value })}
                                            className="w-full h-10 px-3 rounded-xl bg-white border border-gray-200 text-xs font-medium text-gray-800 focus:outline-none focus:border-amber-500"
                                            placeholder="Or direct image URL (https://...)"
                                          />
                                       </div>
                                    </div>
                                 </div>

                                 {/* 2. Banner Image */}
                                 <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                                       Channel Header Banner (16:9 or panoramic)
                                    </label>
                                    <div className="space-y-3">
                                       {artistProfile.banner_image && (
                                          <div className="w-full h-32 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 relative">
                                             <img 
                                               src={artistProfile.banner_image} 
                                               alt="Artist Banner Preview" 
                                               className="w-full h-full object-cover"
                                               referrerPolicy="no-referrer"
                                             />
                                          </div>
                                       )}
                                       <div className="flex items-center gap-2">
                                          <input 
                                            type="file"
                                            ref={artistBannerRef}
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                               const file = e.target.files?.[0];
                                               if (file) {
                                                  handleFileUpload(
                                                     file,
                                                     'banner',
                                                     (url) => setArtistProfile({ ...artistProfile, banner_image: url }),
                                                     setUploadingArtistBanner
                                                  );
                                               }
                                            }}
                                          />
                                          <Button
                                            type="button"
                                            onClick={() => artistBannerRef.current?.click()}
                                            disabled={uploadingArtistBanner}
                                            variant="outline"
                                            className="rounded-xl font-black text-xs uppercase tracking-wider h-10 px-4 border-gray-200 hover:bg-gray-100 flex items-center gap-1.5"
                                          >
                                             {uploadingArtistBanner ? (
                                                <>
                                                   <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                   Uploading Banner...
                                                </>
                                             ) : (
                                                <>
                                                   <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                                                   Upload Banner
                                                </>
                                             )}
                                          </Button>
                                          <input 
                                            type="url" 
                                            value={artistProfile.banner_image}
                                            onChange={(e) => setArtistProfile({ ...artistProfile, banner_image: e.target.value })}
                                            className="flex-1 h-10 px-3 rounded-xl bg-white border border-gray-200 text-xs font-medium text-gray-800 focus:outline-none focus:border-amber-500"
                                            placeholder="Or enter banner URL (https://...)"
                                          />
                                       </div>
                                    </div>
                                 </div>
                              </div>

                              <div>
                                 <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Stage Artist Name</label>
                                 <input 
                                   type="text" 
                                   value={artistProfile.full_name}
                                   onChange={(e) => setArtistProfile({ ...artistProfile, full_name: e.target.value })}
                                   className="w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-100 text-sm font-bold text-gray-800 focus:outline-none focus:border-amber-500"
                                   placeholder="e.g. Bruce Melodie"
                                   required
                                 />
                              </div>

                              <div>
                                 <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Artist Biography</label>
                                 <textarea 
                                   value={artistProfile.bio}
                                   onChange={(e) => setArtistProfile({ ...artistProfile, bio: e.target.value })}
                                   rows={4}
                                   className="w-full p-4 rounded-xl bg-gray-50 border border-gray-100 text-sm font-bold text-gray-800 focus:outline-none focus:border-amber-500"
                                   placeholder="A short story about your music style, achievements, and messages to your diaspora community..."
                                 />
                              </div>

                              {/* Social Links Section */}
                              <div className="p-6 bg-gray-50/80 border border-gray-100 rounded-2xl space-y-4">
                                 <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-amber-500" />
                                    Social Media & Digital Profiles
                                 </h3>
                                 <p className="text-xs text-gray-400 font-medium">Link your public artist channels for fans to connect with your music worldwide.</p>
                                 
                                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                       <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Instagram URL</label>
                                       <input 
                                         type="url"
                                         value={artistProfile.instagram}
                                         onChange={(e) => setArtistProfile({ ...artistProfile, instagram: e.target.value })}
                                         className="w-full h-10 px-3 rounded-xl bg-white border border-gray-200 text-xs font-medium text-gray-800 focus:outline-none focus:border-amber-500"
                                         placeholder="https://instagram.com/artist"
                                       />
                                    </div>
                                    <div>
                                       <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Twitter / X URL</label>
                                       <input 
                                         type="url"
                                         value={artistProfile.twitter}
                                         onChange={(e) => setArtistProfile({ ...artistProfile, twitter: e.target.value })}
                                         className="w-full h-10 px-3 rounded-xl bg-white border border-gray-200 text-xs font-medium text-gray-800 focus:outline-none focus:border-amber-500"
                                         placeholder="https://x.com/artist"
                                       />
                                    </div>
                                    <div>
                                       <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">YouTube Channel URL</label>
                                       <input 
                                         type="url"
                                         value={artistProfile.youtube}
                                         onChange={(e) => setArtistProfile({ ...artistProfile, youtube: e.target.value })}
                                         className="w-full h-10 px-3 rounded-xl bg-white border border-gray-200 text-xs font-medium text-gray-800 focus:outline-none focus:border-amber-500"
                                         placeholder="https://youtube.com/@channel"
                                       />
                                    </div>
                                    <div>
                                       <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Spotify Artist URL</label>
                                       <input 
                                         type="url"
                                         value={artistProfile.spotify}
                                         onChange={(e) => setArtistProfile({ ...artistProfile, spotify: e.target.value })}
                                         className="w-full h-10 px-3 rounded-xl bg-white border border-gray-200 text-xs font-medium text-gray-800 focus:outline-none focus:border-amber-500"
                                         placeholder="https://open.spotify.com/artist/..."
                                       />
                                    </div>
                                    <div className="sm:col-span-2">
                                       <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Official Website URL</label>
                                       <input 
                                         type="url"
                                         value={artistProfile.website}
                                         onChange={(e) => setArtistProfile({ ...artistProfile, website: e.target.value })}
                                         className="w-full h-10 px-3 rounded-xl bg-white border border-gray-200 text-xs font-medium text-gray-800 focus:outline-none focus:border-amber-500"
                                         placeholder="https://artistwebsite.com"
                                       />
                                    </div>
                                 </div>
                              </div>

                              <div className="p-5 bg-amber-500/5 border border-amber-200/50 rounded-2xl">
                                 <h4 className="text-xs font-black text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <AlertTriangle className="w-4 h-4 text-amber-600" /> Important: Mobile Money Registration (payouts phone)
                                 </h4>
                                 <p className="text-[11px] text-gray-500 font-bold leading-relaxed mb-4">
                                    Changing your phone number or disbursement MoMo details triggers an immediate status lock, requiring manual master approval before future revenue withdrawal processing can resume.
                                 </p>
                                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                       <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Disbursement Provider</label>
                                       <select 
                                         value={artistProfile.momo_provider}
                                         onChange={(e) => setArtistProfile({ ...artistProfile, momo_provider: e.target.value })}
                                         className="w-full h-11 px-3 rounded-xl bg-white border border-gray-150 text-xs font-bold text-gray-800 focus:outline-none"
                                       >
                                          <option value="MTN">MTN Rwandacell</option>
                                          <option value="Airtel">Airtel Rwanda</option>
                                       </select>
                                    </div>
                                    <div>
                                       <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">MoMo Recipient Phone</label>
                                       <input 
                                         type="text" 
                                         value={artistProfile.phone}
                                         onChange={(e) => setArtistProfile({ ...artistProfile, phone: e.target.value })}
                                         className="w-full h-11 px-3 rounded-xl bg-white border border-gray-150 text-xs font-bold text-gray-800 focus:outline-none focus:border-amber-500"
                                         placeholder="e.g. 0788112233"
                                         required
                                       />
                                    </div>
                                    <div>
                                       <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Disbursement Code</label>
                                       <input 
                                         type="text" 
                                         value={artistProfile.momo_code}
                                         onChange={(e) => setArtistProfile({ ...artistProfile, momo_code: e.target.value })}
                                         className="w-full h-11 px-3 rounded-xl bg-white border border-gray-150 text-xs font-bold text-gray-800 focus:outline-none focus:border-amber-500"
                                         placeholder="e.g. *182*8*1*2233#"
                                         required
                                       />
                                    </div>
                                 </div>
                              </div>

                              <div className="h-px bg-gray-100 my-6" />

                              <div>
                                 <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-4 flex items-center gap-2">
                                    <Bell className="w-4 h-4 text-amber-500" />
                                    Studio Smart Notifications
                                 </h3>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className="flex items-center gap-3 cursor-pointer">
                                       <input 
                                         type="checkbox" 
                                         checked={artistProfile.active_notifications.purchase}
                                         onChange={(e) => setArtistProfile({
                                            ...artistProfile,
                                            active_notifications: { ...artistProfile.active_notifications, purchase: e.target.checked }
                                         })}
                                         className="rounded border-gray-100 text-amber-500 focus:ring-amber-500 w-4 h-4"
                                       />
                                       <span className="text-xs text-gray-600 font-bold uppercase tracking-wider">Email me on new purchases / sales</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                       <input 
                                         type="checkbox" 
                                         checked={artistProfile.active_notifications.subscriber}
                                         onChange={(e) => setArtistProfile({
                                            ...artistProfile,
                                            active_notifications: { ...artistProfile.active_notifications, subscriber: e.target.checked }
                                         })}
                                         className="rounded border-gray-100 text-amber-500 focus:ring-amber-500 w-4 h-4"
                                       />
                                       <span className="text-xs text-gray-600 font-bold uppercase tracking-wider">Email me on new followers</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                       <input 
                                         type="checkbox" 
                                         checked={artistProfile.active_notifications.comment}
                                         onChange={(e) => setArtistProfile({
                                            ...artistProfile,
                                            active_notifications: { ...artistProfile.active_notifications, comment: e.target.checked }
                                         })}
                                         className="rounded border-gray-100 text-amber-500 focus:ring-amber-500 w-4 h-4"
                                       />
                                       <span className="text-xs text-gray-600 font-bold uppercase tracking-wider">Notify on new comments</span>
                                    </label>
                                    <label className="flex items-center gap-3 cursor-pointer">
                                       <input 
                                         type="checkbox" 
                                         checked={artistProfile.active_notifications.payout}
                                         onChange={(e) => setArtistProfile({
                                            ...artistProfile,
                                            active_notifications: { ...artistProfile.active_notifications, payout: e.target.checked }
                                         })}
                                         className="rounded border-gray-100 text-amber-500 focus:ring-amber-500 w-4 h-4"
                                       />
                                       <span className="text-xs text-gray-600 font-bold uppercase tracking-wider">Alert status of processed payout withdrawals</span>
                                    </label>
                                 </div>
                              </div>

                              <div className="pt-4">
                                 <Button 
                                   type="submit" 
                                   disabled={saving}
                                   className="bg-yellow-500 text-white hover:bg-yellow-600 font-black text-[11px] uppercase tracking-wider py-4 px-10 h-12 rounded-xl shadow-lg shadow-yellow-10 shadow-amber-100 border-none flex items-center gap-2"
                                 >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Persist Artist Parameters
                                 </Button>
                              </div>
                           </form>
                        </CardContent>
                     </Card>
                  </motion.div>
               )}

               {activeSegment === "master" && (
                  <motion.div
                     key="master"
                     initial={{ opacity: 0, x: -10 }}
                     animate={{ opacity: 1, x: 0 }}
                     exit={{ opacity: 0, x: 10 }}
                     className="space-y-8"
                  >
                     {/* Master Administrator Profile Card */}
                     <Card className="bg-white border-rose-150 rounded-[32px] shadow-sm overflow-hidden border">
                        <CardContent className="p-8">
                           <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                              <div>
                                 <h2 className="text-xl font-black text-rose-600 uppercase tracking-tighter flex items-center gap-2 font-mono">
                                    <ShieldCheck className="w-5 h-5 text-rose-600" />
                                    Master Administrator Profile
                                 </h2>
                                 <p className="text-xs text-gray-400 font-medium mt-0.5">
                                    Update platform owner identity and administrative credentials.
                                 </p>
                              </div>
                              <span className="bg-rose-50 text-rose-600 text-[10px] font-mono font-black uppercase px-3 py-1.5 rounded-full">
                                 MASTER ROOT ACCESS
                              </span>
                           </div>

                           <form onSubmit={handleSaveMasterProfile} className="space-y-6">
                              {/* Master Profile Picture Upload */}
                              <div className="p-5 bg-rose-50/50 border border-rose-100 rounded-2xl">
                                 <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
                                    Administrator Avatar / Photo
                                 </label>
                                 <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
                                    <div className="relative shrink-0">
                                       <div className="w-20 h-20 rounded-full overflow-hidden bg-rose-100 border-2 border-rose-300 flex items-center justify-center text-rose-600 font-black text-xl shadow-inner">
                                          {masterProfile.avatar_url ? (
                                             <img 
                                               src={masterProfile.avatar_url} 
                                               alt="Master Avatar" 
                                               className="w-full h-full object-cover"
                                               referrerPolicy="no-referrer"
                                             />
                                          ) : (
                                             <ShieldCheck className="w-8 h-8 text-rose-500" />
                                          )}
                                       </div>
                                       <button
                                         type="button"
                                         onClick={() => masterAvatarRef.current?.click()}
                                         disabled={uploadingMasterAvatar}
                                         className="absolute bottom-0 right-0 p-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full shadow-md border-2 border-white transition-all cursor-pointer"
                                         title="Upload administrator photo"
                                       >
                                          {uploadingMasterAvatar ? (
                                             <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                          ) : (
                                             <Camera className="w-3.5 h-3.5" />
                                          )}
                                       </button>
                                    </div>

                                    <div className="flex-1 w-full space-y-2">
                                       <div className="flex items-center gap-2">
                                          <input 
                                            type="file"
                                            ref={masterAvatarRef}
                                            accept="image/*"
                                            className="hidden"
                                            onChange={(e) => {
                                               const file = e.target.files?.[0];
                                               if (file) {
                                                  handleFileUpload(
                                                     file,
                                                     'avatar',
                                                     (url) => setMasterProfile({ ...masterProfile, avatar_url: url }),
                                                     setUploadingMasterAvatar
                                                  );
                                               }
                                            }}
                                          />
                                          <Button
                                            type="button"
                                            onClick={() => masterAvatarRef.current?.click()}
                                            disabled={uploadingMasterAvatar}
                                            variant="outline"
                                            className="rounded-xl font-black text-xs uppercase tracking-wider h-10 px-4 border-gray-200 hover:bg-gray-100 flex items-center gap-1.5"
                                          >
                                             {uploadingMasterAvatar ? (
                                                <>
                                                   <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                   Uploading...
                                                </>
                                             ) : (
                                                <>
                                                   <Upload className="w-3.5 h-3.5 text-rose-500" />
                                                   Upload Photo
                                                </>
                                             )}
                                          </Button>
                                       </div>
                                       <input 
                                         type="url"
                                         value={masterProfile.avatar_url}
                                         onChange={(e) => setMasterProfile({ ...masterProfile, avatar_url: e.target.value })}
                                         className="w-full h-10 px-3 rounded-xl bg-white border border-gray-200 text-xs font-medium text-gray-800 focus:outline-none focus:border-rose-500"
                                         placeholder="Or direct image URL (https://...)"
                                       />
                                    </div>
                                 </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                                       Administrator Full Name
                                    </label>
                                    <input 
                                      type="text" 
                                      value={masterProfile.full_name}
                                      onChange={(e) => setMasterProfile({ ...masterProfile, full_name: e.target.value })}
                                      className="w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-100 text-sm font-bold text-gray-800 focus:outline-none focus:border-rose-400"
                                      placeholder="PAYTUNE Master Administrator"
                                      required
                                    />
                                 </div>
                                 <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                                       Master Authentication Email
                                    </label>
                                    <input 
                                      type="email" 
                                      value={masterProfile.email}
                                      disabled
                                      className="w-full h-12 px-4 rounded-xl bg-gray-100 border border-gray-100 text-sm font-bold text-gray-400 cursor-not-allowed focus:outline-none"
                                    />
                                    <span className="text-[10px] text-gray-400 font-bold mt-1 block">Root master credential is tied to system master account.</span>
                                 </div>
                              </div>

                              <div className="pt-2">
                                 <Button 
                                   type="submit" 
                                   disabled={savingMasterProf}
                                   className="bg-rose-500 text-white hover:bg-rose-600 font-black text-[11px] uppercase tracking-wider py-4 px-8 h-11 rounded-xl shadow-lg shadow-rose-200 border-none flex items-center gap-2 font-mono"
                                 >
                                    {savingMasterProf && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Save Master Profile
                                 </Button>
                              </div>
                           </form>
                        </CardContent>
                     </Card>
                     <Card className="bg-white border-rose-100 rounded-[32px] shadow-sm overflow-hidden border">
                        <CardContent className="p-8">
                           <div className="flex items-center justify-between mb-8 pb-4 border-b border-gray-100">
                              <h2 className="text-xl font-black text-rose-600 uppercase tracking-tighter flex items-center gap-2 font-mono">
                                 Platform Configuration variables
                              </h2>
                              <span className="bg-rose-50 text-rose-600 text-[10px] font-mono font-black uppercase px-3 py-1.5 rounded-full">
                                 MASTER PERMISSION CONTROL
                              </span>
                           </div>

                           <form onSubmit={handleSaveMaster} className="space-y-6 font-sans">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                 <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Platform Name</label>
                                    <input 
                                      type="text" 
                                      value={masterSettings.platform_name}
                                      onChange={(e) => setMasterSettings({ ...masterSettings, platform_name: e.target.value })}
                                      className="w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-100 text-sm font-bold text-gray-800 focus:outline-none focus:border-rose-400 font-mono"
                                      placeholder="PAYTUNE"
                                      required
                                    />
                                 </div>
                                 <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">MTN MoMo Collector Wallet Phone</label>
                                    <input 
                                      type="text" 
                                      value={masterSettings.momo_number}
                                      onChange={(e) => setMasterSettings({ ...masterSettings, momo_number: e.target.value })}
                                      className="w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-100 text-sm font-bold text-gray-800 focus:outline-none focus:border-rose-400 font-mono"
                                      placeholder="1922331"
                                      required
                                    />
                                    <span className="text-[9px] text-gray-400 font-bold block mt-1">Full collection wallet for P2P routing.</span>
                                 </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                 <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">VAT Percentage Deduction (%)</label>
                                    <input 
                                      type="number" 
                                      value={masterSettings.vat_percentage}
                                      onChange={(e) => setMasterSettings({ ...masterSettings, vat_percentage: Number(e.target.value) })}
                                      className="font-mono w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-100 text-sm font-bold text-gray-800 focus:outline-none focus:border-rose-400"
                                      min={0}
                                      max={100}
                                      required
                                    />
                                 </div>
                                 <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">VAT-Deducted Commission Split (%)</label>
                                    <input 
                                      type="number" 
                                      value={masterSettings.commission_percentage}
                                      onChange={(e) => setMasterSettings({ ...masterSettings, commission_percentage: Number(e.target.value) })}
                                      className="font-mono w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-100 text-sm font-bold text-gray-800 focus:outline-none focus:border-rose-400"
                                      min={0}
                                      max={100}
                                      required
                                    />
                                    <span className="text-[9px] text-gray-400 font-bold block mt-1">Split distributed to the owner (Default 30%).</span>
                                 </div>
                                 <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Min. Withdrawal Threshold (RWF)</label>
                                    <input 
                                      type="number" 
                                      value={masterSettings.min_withdrawal}
                                      onChange={(e) => setMasterSettings({ ...masterSettings, min_withdrawal: Number(e.target.value) })}
                                      className="font-mono w-full h-12 px-4 rounded-xl bg-gray-50 border border-gray-100 text-sm font-bold text-gray-800 focus:outline-none focus:border-rose-400"
                                      min={100}
                                      required
                                    />
                                 </div>
                              </div>

                              <div className="h-px bg-gray-100 my-6" />

                              <div>
                                 <h3 className="text-xs font-black text-rose-800 uppercase tracking-widest mb-4 font-mono">
                                    📩 GLOBAL TRANSACTION EMAIL TEMPLATES
                                 </h3>
                                 <p className="text-xs text-gray-400 font-bold mb-4">Edit formatting body used by Resend service triggers on transaction updates.</p>
                                 <div className="space-y-4">
                                    <div>
                                       <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Welcome Template (Sign-up Email)</label>
                                       <textarea 
                                         value={masterSettings.welcome_template}
                                         onChange={(e) => setMasterSettings({ ...masterSettings, welcome_template: e.target.value })}
                                         rows={3}
                                         className="w-full p-4 rounded-xl bg-gray-50 border border-gray-100 text-xs font-bold text-gray-800 focus:outline-none focus:border-rose-400"
                                         placeholder="Welcome back template body..."
                                       />
                                    </div>
                                    <div>
                                       <label className="block text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1.5">Purchase Receipt Template (with smart triggers)</label>
                                       <textarea 
                                         value={masterSettings.receipt_template}
                                         onChange={(e) => setMasterSettings({ ...masterSettings, receipt_template: e.target.value })}
                                         rows={3}
                                         className="w-full p-4 rounded-xl bg-gray-50 border border-gray-100 text-xs font-bold text-gray-800 focus:outline-none focus:border-rose-400"
                                         placeholder="Use placeholder e.g. {{video_title}} for dynamic song information mapping"
                                       />
                                       <span className="text-[10px] text-gray-400 font-bold mt-1 block">Placeholder supported: <code className="bg-gray-100 text-rose-500 font-mono text-[9px] px-1 rounded">{"{{video_title}}"}</code>, <code className="bg-gray-100 text-rose-500 font-mono text-[9px] px-1 rounded">{"{{amount}}"}</code>, <code className="bg-gray-100 text-rose-500 font-mono text-[9px] px-1 rounded">{"{{receipt_number}}"}</code></span>
                                    </div>
                                 </div>
                              </div>

                              <div className="h-px bg-rose-100 opacity-30 my-6" />

                              <div className="p-5 bg-rose-500/5 border border-rose-200/50 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                                 <div>
                                    <h4 className="text-xs font-black text-rose-700 uppercase tracking-wider mb-1 flex items-center gap-1.5 font-mono">
                                       <AlertTriangle className="w-4 h-4 text-rose-600 animate-pulse" /> Platform Emergency Maintenance Mode
                                    </h4>
                                    <p className="text-[11px] text-gray-500 font-bold">
                                       Locks entire application navigation behind a platform static alert fallback page. Use only in severe database migrations.
                                    </p>
                                 </div>
                                 <div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                      <input 
                                        type="checkbox" 
                                        checked={masterSettings.maintenance_mode}
                                        onChange={(e) => setMasterSettings({ ...masterSettings, maintenance_mode: e.target.checked })}
                                        className="sr-only peer"
                                      />
                                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500"></div>
                                      <span className="ml-2 text-xs font-mono font-black text-rose-700 uppercase">
                                         {masterSettings.maintenance_mode ? "ACTIVE" : "STANDBY"}
                                      </span>
                                    </label>
                                 </div>
                              </div>

                              <div className="pt-4">
                                 <Button 
                                   type="submit" 
                                   disabled={saving}
                                   className="bg-rose-500 text-white hover:bg-rose-600 font-black text-[11px] uppercase tracking-wider py-4 px-10 h-12 rounded-xl shadow-lg shadow-rose-200 border-none flex items-center gap-2 font-mono"
                                 >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    SYNCHRONIZE MASTER PARAMETERS
                                 </Button>
                              </div>
                           </form>
                        </CardContent>
                     </Card>
                  </motion.div>
               )}
            </AnimatePresence>
         </div>

         {/* Sideline Actions sidebar */}
         <div className="space-y-8">
            {/* Password security update */}
            <Card className="bg-white border-gray-100 rounded-[30px] shadow-sm">
               <CardContent className="p-6">
                  <h3 className="text-sm font-black text-gray-900 uppercase tracking-tight mb-4 flex items-center gap-2">
                     <Lock className="w-4.5 h-4.5 text-amber-500" />
                     Security Update
                  </h3>
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                     <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Current Password</label>
                        <input 
                          type="password" 
                          value={passwordState.currentPassword}
                          onChange={(e) => setPasswordState({ ...passwordState, currentPassword: e.target.value })}
                          className="w-full h-10 px-3 rounded-lg bg-gray-50 border border-gray-100 text-xs font-bold text-gray-800 focus:outline-none focus:border-amber-500"
                          placeholder="••••••••"
                          required
                        />
                     </div>
                     <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">New Secure Password</label>
                        <input 
                          type="password" 
                          value={passwordState.newPassword}
                          onChange={(e) => setPasswordState({ ...passwordState, newPassword: e.target.value })}
                          className="w-full h-10 px-3 rounded-lg bg-gray-50 border border-gray-100 text-xs font-bold text-gray-800 focus:outline-none focus:border-amber-500"
                          placeholder="minLength 6 chars"
                          required
                        />
                     </div>
                     <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1">Repeat Security Code</label>
                        <input 
                          type="password" 
                          value={passwordState.confirmPassword}
                          onChange={(e) => setPasswordState({ ...passwordState, confirmPassword: e.target.value })}
                          className="w-full h-10 px-3 rounded-lg bg-gray-50 border border-gray-100 text-xs font-bold text-gray-800 focus:outline-none focus:border-amber-500"
                          placeholder="match new code"
                          required
                        />
                     </div>
                     <Button 
                       type="submit" 
                       disabled={changingPass}
                       className="w-full bg-gray-900 text-white hover:bg-black font-black text-[10px] uppercase tracking-wider h-11 rounded-xl shadow-md border-none flex items-center justify-center gap-1.5"
                     >
                        {changingPass && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Commit Security Update
                     </Button>
                  </form>
               </CardContent>
            </Card>

            {/* Account Danger Area */}
            <Card className="bg-rose-50/50 border border-rose-100 rounded-[30px] p-2">
               <CardContent className="p-5">
                  <h3 className="text-sm font-black text-rose-800 uppercase tracking-tight flex items-center gap-2 mb-2">
                     <Trash2 className="w-4.5 h-4.5 text-rose-500 animate-pulse" />
                     Danger Zone
                  </h3>
                  <p className="text-[11px] text-gray-500 leading-relaxed font-bold mb-4">
                     Once you delete your fan account, your lifetime purchases are permanently cleared. There is no refund or data recovery path.
                  </p>
                  <Button 
                     onClick={() => {
                       setErrorMsg(null);
                       setShowDeleteModal(true);
                     }}
                     className="w-full bg-rose-500 text-white hover:bg-rose-600 font-black text-[10px] uppercase tracking-wider h-11 rounded-xl shadow-lg shadow-rose-100 border-none flex items-center justify-center gap-2"
                  >
                     <Trash2 className="w-4 h-4" />
                     Delete Account & Library
                  </Button>
               </CardContent>
            </Card>
         </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
         {showDeleteModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
               <motion.div 
                 initial={{ scale: 0.9, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 exit={{ scale: 0.9, opacity: 0 }}
                 className="bg-white rounded-[40px] border border-rose-100 p-8 max-w-md w-full shadow-2xl relative"
               >
                  <button 
                    onClick={() => setShowDeleteModal(false)}
                    className="absolute top-6 right-6 p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-900 transition-colors"
                  >
                     <X className="w-5 h-5" />
                  </button>
                  <div className="text-center mb-6">
                     <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-100">
                        <Trash2 className="w-8 h-8 text-rose-500" />
                     </div>
                     <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">Are you absolutely sure?</h3>
                     <p className="text-xs text-rose-600 font-bold mt-2 uppercase tracking-wide">This action is permanent and irreversible.</p>
                  </div>
                  
                  <p className="text-xs text-gray-500 leading-relaxed font-bold text-center mb-6">
                     All bought premium licenses for video catalogs, saved playlists, watch history logs, and subscription connections will be immediately purged from global database schemas.
                  </p>

                  <div className="space-y-4">
                     <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-gray-400 text-center mb-2">
                           Type <code className="bg-rose-50 text-rose-600 font-mono text-[10px] px-1.5 py-0.5 rounded font-black border border-rose-100">DELETE</code> to authorize account removal
                        </label>
                        <input 
                          type="text" 
                          value={deleteConfirmationText}
                          onChange={(e) => setDeleteConfirmationText(e.target.value)}
                          className="w-full h-11 px-4 rounded-xl bg-gray-50 border border-gray-150 text-center text-xs font-black text-rose-600 uppercase focus:outline-none focus:border-rose-500"
                          placeholder="type delete here"
                        />
                     </div>

                     <div className="flex gap-3">
                        <Button 
                          onClick={() => setShowDeleteModal(false)}
                          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-black uppercase h-12"
                        >
                           Go Back
                        </Button>
                        <Button 
                          onClick={handleDeleteAccount}
                          disabled={deleteConfirmationText !== "DELETE"}
                          className="flex-1 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-xs font-black uppercase h-12 border-none shadow-lg shadow-rose-100"
                        >
                           Delete Forever
                        </Button>
                     </div>
                  </div>
               </motion.div>
            </div>
         )}
      </AnimatePresence>
    </div>
  );
}
