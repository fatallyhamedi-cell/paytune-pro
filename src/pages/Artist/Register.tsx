import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Lock,
  AtSign,
  Phone,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Loader2,
  Music2,
  Sparkles,
  FileText,
} from 'lucide-react';
import { useArtistAuth } from '../../contexts/ArtistAuthContext';
import { useAuth } from '../../hooks/useAuth';

export default function ArtistRegister() {
  const navigate = useNavigate();
  const { register, artist } = useArtistAuth();
  const { user, refreshProfile } = useAuth();

  const [form, setForm] = useState({
    owner_name: '',
    artist_name: '',
    artist_handle: '',
    artist_type: 'solo',
    bio: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    momo_provider: 'MTN',
    momo_code: '',
  });
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (artist) {
      navigate('/artist/dashboard', { replace: true });
    }
  }, [artist, navigate]);

  useEffect(() => {
    if (user) {
      const prefillOwner = String(
        (user as any)?.user_metadata?.full_name || user.email?.split('@')[0] || ''
      ).trim();
      if (prefillOwner) {
        setForm((prev) => (prev.owner_name ? prev : { ...prev, owner_name: prefillOwner }));
      }
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');

    const cleanOwnerName = form.owner_name.trim();
    const cleanArtistName = form.artist_name.trim();
    const cleanBio = form.bio.trim();
    const cleanEmail = form.email.trim().toLowerCase();
    const cleanPhone = form.phone.trim();
    const cleanHandle = form.artist_handle.trim().replace(/^@/, '').toLowerCase();

    if (cleanOwnerName.length < 2) {
      setError('Account owner full name must be at least 2 characters.');
      return;
    }

    if (cleanArtistName.length < 2) {
      setError('Artist or stage display name must be at least 2 characters.');
      return;
    }

    if (cleanBio.length < 10) {
      setError('Artist biography must be at least 10 characters so listeners can learn about your sound.');
      return;
    }

    if (!user) {
      if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        setError('Please enter a valid email address.');
        return;
      }
      if (form.password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (form.password !== form.confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    if (cleanHandle && !/^[a-z0-9_]{3,60}$/.test(cleanHandle)) {
      setError('Handle must be 3–60 lowercase letters, numbers, or underscores.');
      return;
    }

    if (!termsAccepted) {
      setError('You must accept the Terms of Service, Privacy Policy, and Originality Declaration.');
      return;
    }

    const submittedPassword = form.password;
    setForm((prev) => ({ ...prev, password: '', confirmPassword: '' }));
    setLoading(true);

    try {
      const payload: Record<string, any> = {
        owner_name: cleanOwnerName,
        ownerName: cleanOwnerName,
        full_name: cleanOwnerName,
        artist_name: cleanArtistName,
        artistName: cleanArtistName,
        artist_type: form.artist_type,
        bio: cleanBio,
        termsAccepted: true,
      };
      if (cleanHandle) payload.artist_handle = cleanHandle;
      if (cleanPhone) payload.phone = cleanPhone;
      if (form.momo_code.trim()) {
        payload.momo_code = form.momo_code.trim();
        payload.momo_provider = form.momo_provider;
      } else if (cleanPhone) {
        payload.momo_code = cleanPhone;
        payload.momo_provider = form.momo_provider;
      }

      if (!user) {
        payload.email = cleanEmail;
        payload.password = submittedPassword;
      }

      const res = await register(payload);

      if (res?.success) {
        await refreshProfile().catch(() => {});
        navigate(res.redirectTo || '/artist/dashboard', { replace: true });
      } else {
        setError(res?.message || res?.error || 'Could not complete artist registration.');
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Registration failed. Please review your details and try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0F0F0F] text-gray-900 dark:text-white flex items-center justify-center px-4 py-10 transition-colors">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-purple-600 text-white font-black tracking-tight shadow-md shadow-purple-600/20 hover:bg-purple-700 transition-colors mb-5"
          >
            <Music2 className="w-5 h-5" />
            <span className="text-base tracking-wide">PAYTUNE</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 dark:text-white">
            Join PAYTUNE as an Artist
          </h1>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            Publish music videos, audio &amp; shorts, track analytics, and receive 70/30 payouts
          </p>
        </div>

        <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/10 rounded-2xl p-6 sm:p-8 shadow-xl shadow-black/5 dark:shadow-black/40">
          {user && (
            <div className="mb-5 p-3.5 rounded-xl bg-purple-50 dark:bg-purple-600/10 border border-purple-200 dark:border-purple-600/30 text-xs text-purple-900 dark:text-purple-200">
              Signed in as <strong className="font-semibold">{user.email}</strong>. Completing this form will create and link your unique artist studio profile.
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-2.5"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="artist-reg-owner"
                  className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5"
                >
                  Account Owner Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="artist-reg-owner"
                    type="text"
                    autoComplete="name"
                    placeholder="Your legal / full name"
                    value={form.owner_name}
                    onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-gray-50 dark:bg-[#222222] text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 focus:outline-none text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="artist-reg-name"
                  className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5"
                >
                  Artist / Stage Name
                </label>
                <div className="relative">
                  <Sparkles className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="artist-reg-name"
                    type="text"
                    placeholder="e.g. Bruce Melodie"
                    value={form.artist_name}
                    onChange={(e) => setForm({ ...form, artist_name: e.target.value })}
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-gray-50 dark:bg-[#222222] text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 focus:outline-none text-sm"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label
                  htmlFor="artist-reg-type"
                  className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5"
                >
                  Artist Type
                </label>
                <select
                  id="artist-reg-type"
                  value={form.artist_type}
                  onChange={(e) => setForm({ ...form, artist_type: e.target.value })}
                  className="w-full h-11 px-3.5 rounded-xl bg-gray-50 dark:bg-[#222222] text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 focus:outline-none text-sm"
                >
                  <option value="solo">Solo Artist</option>
                  <option value="group">Group / Duo</option>
                  <option value="band">Band</option>
                  <option value="orchestra">Orchestra</option>
                  <option value="other">Label / Other</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="artist-reg-handle"
                  className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5"
                >
                  Studio Handle <span className="font-normal lowercase text-gray-400">(optional)</span>
                </label>
                <div className="relative">
                  <AtSign className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="artist-reg-handle"
                    type="text"
                    placeholder="auto-generated if blank"
                    value={form.artist_handle}
                    onChange={(e) => setForm({ ...form, artist_handle: e.target.value })}
                    className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-gray-50 dark:bg-[#222222] text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 focus:outline-none text-sm font-mono"
                  />
                </div>
              </div>
            </div>

            <div>
              <label
                htmlFor="artist-reg-bio"
                className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5"
              >
                Artist Biography
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-gray-400 absolute left-3.5 top-3 pointer-events-none" />
                <textarea
                  id="artist-reg-bio"
                  rows={3}
                  maxLength={1000}
                  placeholder="Describe your musical style, story, and what fans can expect on your channel..."
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-[#222222] text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 focus:outline-none text-sm resize-y"
                  required
                />
              </div>
            </div>

            {!user && (
              <>
                <div>
                  <label
                    htmlFor="artist-reg-email"
                    className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="artist-reg-email"
                      type="email"
                      autoComplete="email"
                      placeholder="artist@example.com"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-gray-50 dark:bg-[#222222] text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 focus:outline-none text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label
                      htmlFor="artist-reg-password"
                      className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5"
                    >
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="artist-reg-password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Min 6 characters"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className="w-full h-11 pl-10 pr-9 rounded-xl bg-gray-50 dark:bg-[#222222] text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 focus:outline-none text-sm"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 cursor-pointer"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="artist-reg-confirm"
                      className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5"
                    >
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="artist-reg-confirm"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Repeat password"
                        value={form.confirmPassword}
                        onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                        className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-gray-50 dark:bg-[#222222] text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 focus:outline-none text-sm"
                        required
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="pt-2 border-t border-gray-200 dark:border-white/10">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                Payout Preferences <span className="font-normal lowercase text-gray-400">(optional)</span>
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="artist-reg-provider"
                    className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1"
                  >
                    Provider
                  </label>
                  <select
                    id="artist-reg-provider"
                    value={form.momo_provider}
                    onChange={(e) => setForm({ ...form, momo_provider: e.target.value })}
                    className="w-full h-10 px-3 rounded-xl bg-gray-50 dark:bg-[#222222] text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:border-purple-600 focus:outline-none text-sm"
                  >
                    <option value="MTN">MTN MoMo</option>
                    <option value="Airtel">Airtel Money</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="artist-reg-phone"
                    className="block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1"
                  >
                    Mobile / MoMo Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="artist-reg-phone"
                      type="tel"
                      placeholder="+250788123456"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value, momo_code: e.target.value })}
                      className="w-full h-10 pl-9 pr-3 rounded-xl bg-gray-50 dark:bg-[#222222] text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:border-purple-600 focus:outline-none text-sm font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-2.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer select-none">
                <input
                  id="artist-reg-terms"
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500 shrink-0"
                  required
                />
                <span className="leading-relaxed">
                  I accept the{' '}
                  <Link to="/legal?tab=terms" className="text-purple-600 dark:text-purple-400 font-semibold hover:underline">
                    Terms of Service
                  </Link>
                  ,{' '}
                  <Link to="/legal?tab=privacy" className="text-purple-600 dark:text-purple-400 font-semibold hover:underline">
                    Privacy Policy
                  </Link>
                  , and{' '}
                  <Link to="/legal?tab=artist-agreement" className="text-purple-600 dark:text-purple-400 font-semibold hover:underline">
                    Artist Agreement
                  </Link>
                  , and confirm that uploaded music and video works are original or properly licensed.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md shadow-purple-600/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating Artist Studio...</span>
                </>
              ) : (
                <>
                  <span>Create Artist Account</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-200 dark:border-white/10 text-center space-y-2 text-sm">
            <p className="text-gray-600 dark:text-gray-400">
              Already have an artist studio?{' '}
              <Link to="/artist/login" className="text-purple-600 dark:text-purple-400 font-semibold hover:underline">
                Log in
              </Link>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Looking for ordinary listener sign in?{' '}
              <Link to="/auth" className="text-gray-700 dark:text-gray-300 hover:underline font-medium">
                User Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
