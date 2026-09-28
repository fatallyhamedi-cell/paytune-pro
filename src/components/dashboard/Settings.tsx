import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { User, Lock, Bell, Trash2, CheckCircle2, AlertTriangle, ShieldCheck, DollarSign, Calendar, Camera, Upload, Loader2 } from 'lucide-react';
import { useUser } from '../../hooks/useUser';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export const Settings: React.FC = () => {
  const { profile, loading, updateProfile, changePassword, deleteAccount, refreshUser } = useUser();
  const { signOut, logout } = useAuth();
  const navigate = useNavigate();

  // Profile Form State
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const userAvatarInputRef = useRef<HTMLInputElement>(null);

  // Notification toggles
  const [notifyReleases, setNotifyReleases] = useState(true);
  const [notifyLive, setNotifyLive] = useState(true);
  const [notifyReceipts, setNotifyReceipts] = useState(true);

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Modals & Feedback
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setUsername(profile.username || '');
      setPhone(profile.phone || '');
      setAvatarUrl(profile.avatar_url || '');
      setNotifyReleases(profile.notify_releases !== false);
      setNotifyLive(profile.notify_live !== false);
      setNotifyReceipts(profile.notify_receipts !== false);
    }
  }, [profile]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setErrorMessage(null);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const showError = (msg: string) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 4000);
  };

  const handleDeviceAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'].includes(file.type)) {
      showError('Please select a valid image file (PNG, JPEG, GIF, WEBP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showError('Image size exceeds 5MB limit.');
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await axios.post('/api/upload/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (res.data?.url) {
        setAvatarUrl(res.data.url);
        // Persist to user profile immediately
        await updateProfile({
          avatar_url: res.data.url
        });
        await refreshUser();
        showToast('Profile picture uploaded from device and saved successfully!');
      } else {
        throw new Error('Upload failed - no URL returned.');
      }
    } catch (err: any) {
      showError(err.response?.data?.error || err.message || 'Failed to upload profile picture.');
    } finally {
      setUploadingAvatar(false);
      if (userAvatarInputRef.current) {
        userAvatarInputRef.current.value = '';
      }
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    try {
      await updateProfile({
        full_name: fullName,
        username,
        phone,
        avatar_url: avatarUrl,
        notify_releases: notifyReleases,
        notify_live: notifyLive,
        notify_receipts: notifyReceipts
      });
      showToast('Profile and preferences updated successfully!');
    } catch (err: any) {
      showError(err.message || 'Failed to update profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      showError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showError('New passwords do not match.');
      return;
    }

    setPasswordSaving(true);
    try {
      const res = await changePassword(currentPassword, newPassword);
      if (res.success) {
        showToast('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        showError(res.message || 'Failed to change password');
      }
    } catch (err: any) {
      showError(err.message || 'Failed to change password');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      if (signOut) await signOut();
      else if (logout) await logout();
      navigate('/');
    } catch (err: any) {
      showError(err.message || 'Failed to delete account');
      setDeleting(false);
    }
  };

  if (loading && !profile) {
    return (
      <div className="space-y-6">
        <div className="h-48 bg-[#161616] rounded-2xl animate-pulse" />
        <div className="h-48 bg-[#161616] rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8" id="user-settings-section">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {toastMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {errorMessage}
        </div>
      )}

      {/* Account Overview Card */}
      <div className="p-6 bg-[#161616] border border-white/5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          {/* Hidden File Input for Device Upload */}
          <input
            type="file"
            ref={userAvatarInputRef}
            onChange={handleDeviceAvatarUpload}
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
            className="hidden"
          />

          <div
            onClick={() => userAvatarInputRef.current?.click()}
            className="relative cursor-pointer group shrink-0"
            title="Click to change avatar from device"
          >
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#FFB300] bg-neutral-800 flex items-center justify-center shadow-lg">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="w-full h-full object-cover group-hover:opacity-75 transition-opacity"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-black font-black text-2xl">
                  {fullName ? fullName.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
            </div>
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingAvatar ? (
                <Loader2 className="w-5 h-5 text-[#FFB300] animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-white" />
              )}
            </div>
            <span className="absolute bottom-0 right-0 p-1 bg-[#FFB300] text-black rounded-full shadow border border-black">
              {uploadingAvatar ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">{fullName || 'PAYTUNE Fan'}</h3>
              <button
                type="button"
                onClick={() => userAvatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-[#FFB300] text-xs font-semibold border border-white/10 transition-colors flex items-center gap-1.5"
              >
                {uploadingAvatar ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3 h-3" />
                    <span>Change Avatar</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-400">{profile?.email}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="text-[10px] px-2 py-0.5 bg-[#FFB300]/10 text-[#FFB300] font-semibold rounded-full border border-[#FFB300]/20">
                PAYTUNE PATRON
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="flex items-center gap-6 border-t sm:border-t-0 sm:border-l border-white/5 pt-4 sm:pt-0 sm:pl-6 w-full sm:w-auto">
          <div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider block flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-[#FFB300]" />
              Total Supporting
            </span>
            <span className="text-base font-bold text-white font-mono">
              {(profile?.total_spent || 0).toLocaleString()} RWF
            </span>
          </div>

          <div>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider block flex items-center gap-1">
              <Calendar className="w-3 h-3 text-gray-400" />
              Member Since
            </span>
            <span className="text-xs font-semibold text-gray-300">
              {new Date(profile?.join_date || Date.now()).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className="p-6 bg-[#161616] border border-white/5 rounded-3xl space-y-5">
        <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
          <User className="w-5 h-5 text-[#FFB300]" />
          <h3 className="text-base font-bold text-white">Profile Information</h3>
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                id="settings-fullname-input"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-[#111] border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#FFB300]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Username
              </label>
              <input
                type="text"
                id="settings-username-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-[#111] border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#FFB300]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Email Address (Read Only)
              </label>
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                className="w-full px-3.5 py-2.5 bg-[#1a1a1a] border border-white/5 rounded-xl text-gray-400 text-xs cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                id="settings-phone-input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="078XXXXXXX"
                className="w-full px-3.5 py-2.5 bg-[#111] border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#FFB300]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Profile Picture
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <button
                  type="button"
                  onClick={() => userAvatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-amber-400 font-bold text-xs rounded-xl border border-amber-500/20 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  {uploadingAvatar ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                      <span>Uploading from device...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-amber-500" />
                      <span>Upload Avatar from Device</span>
                    </>
                  )}
                </button>
                <input
                  type="url"
                  id="settings-avatar-input"
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  placeholder="https://... (or upload from device)"
                  className="flex-1 px-3.5 py-2.5 bg-[#111] border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#FFB300]"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">Supports PNG, JPEG, GIF, or WebP up to 5MB.</p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              id="save-profile-btn"
              disabled={profileSaving}
              className="px-5 py-2.5 bg-[#FFB300] hover:bg-[#ffc107] text-black font-bold text-xs rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              {profileSaving ? 'Saving...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Notification Preferences */}
      <div className="p-6 bg-[#161616] border border-white/5 rounded-3xl space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
          <Bell className="w-5 h-5 text-[#FFB300]" />
          <h3 className="text-base font-bold text-white">Notification Preferences</h3>
        </div>

        <div className="space-y-3 pt-1">
          <label className="flex items-center justify-between p-3 rounded-xl bg-[#111] hover:bg-[#141414] transition-colors cursor-pointer">
            <div>
              <span className="text-xs font-semibold text-white block">New Video Releases</span>
              <span className="text-[11px] text-gray-400">Receive alerts when followed artists drop new songs or music videos.</span>
            </div>
            <input
              type="checkbox"
              id="notify-releases-toggle"
              checked={notifyReleases}
              onChange={(e) => {
                setNotifyReleases(e.target.checked);
                updateProfile({ notify_releases: e.target.checked });
              }}
              className="w-4 h-4 rounded text-[#FFB300] focus:ring-[#FFB300] bg-black border-white/20 ml-4 shrink-0"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-[#111] hover:bg-[#141414] transition-colors cursor-pointer">
            <div>
              <span className="text-xs font-semibold text-white block">Live Stream Broadcasts</span>
              <span className="text-[11px] text-gray-400">Instant alerts when an artist you follow goes live.</span>
            </div>
            <input
              type="checkbox"
              id="notify-live-toggle"
              checked={notifyLive}
              onChange={(e) => {
                setNotifyLive(e.target.checked);
                updateProfile({ notify_live: e.target.checked });
              }}
              className="w-4 h-4 rounded text-[#FFB300] focus:ring-[#FFB300] bg-black border-white/20 ml-4 shrink-0"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-[#111] hover:bg-[#141414] transition-colors cursor-pointer">
            <div>
              <span className="text-xs font-semibold text-white block">Purchase Receipts & Gifts</span>
              <span className="text-[11px] text-gray-400">Receive payment confirmation receipts and notifications when someone gifts you a video.</span>
            </div>
            <input
              type="checkbox"
              id="notify-receipts-toggle"
              checked={notifyReceipts}
              onChange={(e) => {
                setNotifyReceipts(e.target.checked);
                updateProfile({ notify_receipts: e.target.checked });
              }}
              className="w-4 h-4 rounded text-[#FFB300] focus:ring-[#FFB300] bg-black border-white/20 ml-4 shrink-0"
            />
          </label>
        </div>
      </div>

      {/* Security & Password */}
      <div className="p-6 bg-[#161616] border border-white/5 rounded-3xl space-y-4">
        <div className="flex items-center gap-2.5 pb-2 border-b border-white/5">
          <Lock className="w-5 h-5 text-[#FFB300]" />
          <h3 className="text-base font-bold text-white">Security & Password</h3>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Current Password
              </label>
              <input
                type="password"
                id="current-password-input"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 bg-[#111] border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#FFB300]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                New Password
              </label>
              <input
                type="password"
                id="new-password-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                required
                className="w-full px-3.5 py-2.5 bg-[#111] border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#FFB300]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                id="confirm-password-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                className="w-full px-3.5 py-2.5 bg-[#111] border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-[#FFB300]"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              id="change-password-submit-btn"
              disabled={passwordSaving}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white font-semibold text-xs rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              {passwordSaving ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="p-6 bg-red-950/20 border border-red-500/20 rounded-3xl space-y-4">
        <div className="flex items-center gap-2.5 text-red-400">
          <Trash2 className="w-5 h-5" />
          <h3 className="text-base font-bold text-white">Danger Zone</h3>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-semibold text-white">Delete or Deactivate Account</h4>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Permanently delete your profile and library record. This action cannot be reversed.
            </p>
          </div>
          <button
            id="delete-account-btn"
            onClick={() => setDeleteModalOpen(true)}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white border border-red-500/30 font-semibold text-xs rounded-xl transition-all shrink-0"
          >
            Delete Account
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-[#181818] border border-red-500/30 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Permanently Delete Account?</h3>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed">
              Are you completely certain? You will lose access to all your purchased music videos, playlists, and settings.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 text-xs text-gray-400 hover:text-white"
              >
                Keep Account
              </button>
              <button
                id="confirm-delete-account-submit"
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md transition-all disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
