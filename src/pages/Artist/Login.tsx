import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2, Loader2, Music2 } from 'lucide-react';
import { useArtistAuth } from '../../contexts/ArtistAuthContext';

export default function ArtistLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, artist } = useArtistAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (artist) {
      navigate('/artist/dashboard', { replace: true });
      return;
    }
    const params = new URLSearchParams(location.search);
    const prefillEmail = params.get('email');
    if (prefillEmail) {
      setEmail(prefillEmail);
    }
    const stateMsg = (location.state as any)?.message;
    if (stateMsg) {
      setInfoMessage(String(stateMsg));
    }
  }, [artist, location.search, location.state, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    setInfoMessage('');

    const cleanEmail = email.trim().toLowerCase();
    const submittedPassword = password;
    if (!cleanEmail || !submittedPassword) {
      setError('Please enter both your email address and password.');
      return;
    }

    setPassword('');
    setLoading(true);
    try {
      const res = await login(cleanEmail, submittedPassword);
      if (res?.isRejected) {
        setError(`Application Rejected: ${res.artist?.rejection_reason || 'Please contact support@paytune.com'}`);
        return;
      }
      navigate(res?.redirectTo || '/artist/dashboard', { replace: true });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Invalid email or password.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0F0F0F] text-gray-900 dark:text-white flex flex-col justify-center items-center px-4 py-10 transition-colors">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-purple-600 text-white font-black tracking-tight shadow-md shadow-purple-600/20 hover:bg-purple-700 transition-colors mb-5"
          >
            <Music2 className="w-5 h-5" />
            <span className="text-base tracking-wide">PAYTUNE</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900 dark:text-white">
            Creator Studio Login
          </h1>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            Manage releases, analytics, and creator payouts
          </p>
        </div>

        <div className="bg-white dark:bg-[#161616] border border-gray-200 dark:border-white/10 rounded-2xl p-6 sm:p-8 shadow-xl shadow-black/5 dark:shadow-black/40">
          {infoMessage && (
            <div
              role="status"
              className="mb-5 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-sm flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
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
            <div>
              <label
                htmlFor="artist-login-email"
                className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400 mb-1.5"
              >
                Artist Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="artist-login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="artist@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-gray-50 dark:bg-[#222222] text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 focus:outline-none text-sm transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="artist-login-password"
                  className="block text-xs font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-400"
                >
                  Password
                </label>
                <Link
                  to="/auth?mode=forgot"
                  className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="artist-login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-11 pl-10 pr-10 rounded-xl bg-gray-50 dark:bg-[#222222] text-gray-900 dark:text-white border border-gray-200 dark:border-white/10 focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 focus:outline-none text-sm transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 mt-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md shadow-purple-600/20 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Log In to Studio</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-200 dark:border-white/10 text-center space-y-2 text-sm">
            <p className="text-gray-600 dark:text-gray-400">
              New artist on PAYTUNE?{' '}
              <Link to="/artist/register" className="text-purple-600 dark:text-purple-400 font-semibold hover:underline">
                Join as an Artist
              </Link>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Listener account?{' '}
              <Link to="/auth" className="text-gray-700 dark:text-gray-300 hover:underline font-medium">
                Sign in as User
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
