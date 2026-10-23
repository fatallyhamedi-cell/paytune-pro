import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useArtistAuth } from '../../contexts/ArtistAuthContext';

export default function ArtistLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useArtistAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('verified') === '1') {
      setInfoMessage('Phone verified successfully! You can now log in to your artist dashboard.');
    }
    const prefillEmail = params.get('email');
    if (prefillEmail) {
      setEmail(prefillEmail);
    }
  }, [location.search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (!email.trim() || !password) {
      return setError('Please enter both email and password');
    }

    setLoading(true);
    try {
      const res = await login(email.trim().toLowerCase(), password);

      if (res?.requiresPhoneVerification) {
        return setError('Please verify your phone number before logging in.');
      }
      if (res?.isRejected) {
        return setError(`Application Rejected: ${res.artist?.rejection_reason || 'Please contact support@paytune.com'}`);
      }

      navigate('/artist/dashboard', { replace: true });
    } catch (err: any) {
      console.warn('Artist login attempt failed:', err.response?.data?.error || err.message);
      setError(err.response?.data?.error || err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail = 'artist@paytune.com', demoPass = 'password') => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError('');
    setInfoMessage('');
    setLoading(true);
    try {
      await login(demoEmail, demoPass);
      navigate('/artist/dashboard', { replace: true });
    } catch (err: any) {
      console.warn('Demo login attempt failed:', err.response?.data?.error || err.message);
      setError(err.response?.data?.error || err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F0F0F] px-4 py-8">
      <div className="bg-[#1A1A1A] p-8 rounded-2xl w-full max-w-md border border-gray-700 shadow-2xl">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-amber-500 font-black text-2xl tracking-wider">PAYTUNE</span>
          <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded font-mono">
            CREATOR
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white text-center mb-1">Artist Studio Login</h1>
        <p className="text-xs text-gray-400 text-center mb-6">
          Access your revenue, analytics, uploaded music videos, and MoMo payouts
        </p>

        {infoMessage && (
          <div className="bg-emerald-500/20 border border-emerald-500 text-emerald-300 p-3 rounded-lg mb-4 text-sm">
            {infoMessage}
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Artist Email</label>
            <input
              type="email"
              placeholder="artist@paytune.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700 focus:border-amber-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-400">Password</label>
            </div>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700 focus:border-amber-500 focus:outline-none"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3.5 rounded-lg disabled:opacity-50 transition-colors shadow-lg cursor-pointer"
          >
            {loading ? 'Logging in...' : 'Log In to Studio'}
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-gray-800"></div>
            <span className="flex-shrink mx-3 text-xs uppercase tracking-wider text-gray-500 font-medium">Or Quick Access</span>
            <div className="flex-grow border-t border-gray-800"></div>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => handleDemoLogin('artist@paytune.com', 'password')}
            className="w-full bg-[#2A2A2A] hover:bg-[#333333] border border-amber-500/40 hover:border-amber-500 text-amber-400 font-semibold py-2.5 px-4 rounded-lg text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>⚡ Instant Demo Studio Login</span>
            <span className="text-xs text-gray-400 font-mono">(artist@paytune.com)</span>
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-800 text-center space-y-2">
          <p className="text-gray-400 text-sm">
            New artist on PAYTUNE?{' '}
            <Link to="/artist/signup" className="text-amber-500 hover:underline font-semibold">
              Create an artist account
            </Link>
          </p>
          <p className="text-xs text-gray-500">
            Fan or viewer?{' '}
            <Link to="/auth" className="text-gray-400 hover:text-white underline">
              Sign in as User
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
