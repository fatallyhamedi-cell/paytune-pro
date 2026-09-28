import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useArtistAuth } from '../../contexts/ArtistAuthContext';

export default function ArtistRegister() {
  const navigate = useNavigate();
  const { register, verifyPhone, resendOTP } = useArtistAuth();

  const [step, setStep] = useState<'form' | 'verify'>('form');
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    momo_code: '',
    momo_provider: 'MTN',
  });
  const [artistId, setArtistId] = useState('');
  const [otp, setOtp] = useState('');
  const [devCode, setDevCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendStatus, setResendStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 6) {
      return setError('Password must be at least 6 characters');
    }
    if (form.password !== form.confirmPassword) {
      return setError('Passwords do not match');
    }
    const cleanPhone = form.phone.trim();
    if (!cleanPhone.startsWith('+')) {
      return setError('Phone number must start with + and country code (e.g., +250...)');
    }

    setLoading(true);
    try {
      const res = await register({
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        phone: cleanPhone,
        momo_code: form.momo_code.trim() || cleanPhone,
        momo_provider: form.momo_provider,
      });

      if (res?.success) {
        setArtistId(res.artistId);
        setDevCode(res.devCode || '123456');
        if (res.devCode) {
          console.log(`📱 OTP for ${cleanPhone}: ${res.devCode}`);
        }
        setStep('verify');
      } else {
        setError(res?.error || 'Registration failed');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Registration failed. Please check your details.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      return setError('Enter the 6-digit verification code');
    }

    setLoading(true);
    try {
      const res = await verifyPhone(artistId, cleanOtp);
      if (res?.success) {
        navigate(`/artist/login?verified=1&email=${encodeURIComponent(form.email)}`);
      } else {
        setError(res?.error || 'Invalid code');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Verification failed. Please check the code.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResendStatus('');
    try {
      const r = await resendOTP(artistId);
      if (r.devCode) {
        setDevCode(r.devCode);
        setResendStatus(`New code sent: ${r.devCode}`);
      } else {
        setResendStatus('Verification code resent successfully!');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to resend code');
    }
  };

  if (step === 'verify') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F0F0F] px-4">
        <div className="bg-[#1A1A1A] p-8 rounded-2xl w-full max-w-md border border-gray-700 shadow-2xl">
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-center mx-auto mb-4 text-amber-500 text-xl">
            📱
          </div>
          <h1 className="text-2xl font-bold text-white text-center mb-2">Verify Your Phone</h1>
          <p className="text-gray-400 text-sm text-center mb-6">
            Code sent to <b className="text-white">{form.phone}</b>
          </p>

          {error && (
            <div className="bg-red-500/20 border border-red-500 text-red-400 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {devCode && (
            <div className="bg-amber-500/20 border border-amber-500/40 text-amber-300 p-3 rounded-lg mb-4 text-sm flex items-center justify-between">
              <span>Dev / Sandbox OTP: <b>{devCode}</b></span>
              <button
                type="button"
                onClick={() => setOtp(devCode)}
                className="text-xs bg-amber-500 text-black px-2 py-1 rounded font-semibold hover:bg-amber-400"
              >
                Use Code
              </button>
            </div>
          )}

          {resendStatus && (
            <div className="bg-green-500/20 border border-green-500/40 text-green-300 p-3 rounded-lg mb-4 text-sm">
              {resendStatus}
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1 text-center">
                Enter 6-Digit Code
              </label>
              <input
                type="text"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="w-full p-4 text-center text-2xl tracking-widest rounded-lg bg-[#2A2A2A] text-white border border-gray-700 font-mono focus:border-amber-500 focus:outline-none"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3 rounded-lg disabled:opacity-50 transition-colors shadow-lg cursor-pointer"
            >
              {loading ? 'Verifying...' : 'Verify Phone & Continue'}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={handleResend}
              className="text-amber-500 hover:text-amber-400 font-medium cursor-pointer"
            >
              Resend code
            </button>
            <button
              type="button"
              onClick={() => setStep('form')}
              className="text-gray-400 hover:text-gray-300"
            >
              Change phone
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F0F0F] py-8 px-4">
      <div className="bg-[#1A1A1A] p-8 rounded-2xl w-full max-w-md border border-gray-700 shadow-2xl">
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="text-amber-500 font-black text-2xl tracking-wider">PAYTUNE</span>
          <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/40 px-2 py-0.5 rounded font-mono">
            ARTIST
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white text-center mb-1">Create Artist Account</h1>
        <p className="text-xs text-gray-400 text-center mb-6">
          Publish your music videos, set prices in RWF/USD, and receive MoMo payouts directly
        </p>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-400 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Full Name / Stage Name</label>
            <input
              type="text"
              placeholder="e.g. Bruce Melodie"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              className="w-full p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700 focus:border-amber-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Email Address</label>
            <input
              type="email"
              placeholder="artist@paytune.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700 focus:border-amber-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Password</label>
              <input
                type="password"
                placeholder="Min 6 chars"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700 focus:border-amber-500 focus:outline-none text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Confirm</label>
              <input
                type="password"
                placeholder="Re-type password"
                value={form.confirmPassword}
                onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                className="w-full p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700 focus:border-amber-500 focus:outline-none text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Phone Number (with country code)</label>
            <input
              type="tel"
              placeholder="+250788123456"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="w-full p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700 focus:border-amber-500 focus:outline-none font-mono"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">MoMo Provider</label>
              <select
                value={form.momo_provider}
                onChange={(e) => setForm({ ...form, momo_provider: e.target.value })}
                className="w-full p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700 focus:border-amber-500 focus:outline-none"
              >
                <option value="MTN">MTN MoMo</option>
                <option value="Airtel">Airtel Money</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Payout MoMo Number</label>
              <input
                type="tel"
                placeholder="0788123456"
                value={form.momo_code}
                onChange={(e) => setForm({ ...form, momo_code: e.target.value })}
                className="w-full p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700 focus:border-amber-500 focus:outline-none font-mono"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-400 text-black font-bold py-3.5 rounded-lg disabled:opacity-50 transition-colors shadow-lg cursor-pointer mt-2"
          >
            {loading ? 'Creating Artist Account...' : 'Create Artist Account'}
          </button>
        </form>

        <p className="text-gray-400 text-sm mt-6 text-center">
          Already registered as an artist?{' '}
          <Link to="/artist/login" className="text-amber-500 hover:underline font-semibold">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
