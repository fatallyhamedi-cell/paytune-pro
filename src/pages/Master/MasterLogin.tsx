import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useMasterAuth } from '../../contexts/MasterAuthContext';

export default function MasterLogin({ onSuccess }: { onSuccess?: () => void } = {}) {
  const navigate = useNavigate();
  const { loginMaster } = useMasterAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const submittedEmail = email.trim();
    const submittedPassword = password;
    setPassword('');
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email: submittedEmail, password: submittedPassword });

      const userRole = String(res.data?.user?.role || '').toLowerCase();
      if (userRole !== 'master' && userRole !== 'master_admin' && userRole !== 'admin') {
        throw new Error('This account does not have Master privileges.');
      }

      const token = res.data?.token || res.data?.access_token;
      if (!token) {
        throw new Error('Authentication server did not return an access token.');
      }

      loginMaster(token, {
        id: res.data?.user?.id || 'master-admin',
        email: res.data?.user?.email || submittedEmail,
        role: 'MASTER_ADMIN',
        full_name: res.data?.user?.fullName || res.data?.user?.full_name || 'Platform Master Administrator',
      });
      localStorage.setItem('token', token);
      localStorage.setItem('paytune_auth_token', token);

      if (onSuccess) {
        onSuccess();
      }

      navigate('/master', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F0F0F] px-4">
      <div className="bg-[#1A1A1A] p-8 rounded-2xl w-full max-w-md border border-red-500/30 shadow-2xl">
        <h1 className="text-2xl font-bold text-red-500 text-center mb-6">Master Admin Login</h1>
        
        {error && <div className="bg-red-500/20 text-red-400 p-3 rounded-lg mb-4 text-sm font-medium">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Master Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700 focus:border-red-500 outline-none text-sm transition-colors"
              placeholder="Master Email"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 mb-1.5">Security Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700 focus:border-red-500 outline-none text-sm transition-colors"
              placeholder="Enter Master password"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg disabled:opacity-50 transition-colors shadow-lg cursor-pointer"
          >
            {loading ? 'Authenticating...' : 'Access Master Panel'}
          </button>
        </form>
      </div>
    </div>
  );
}

export { MasterLogin };
