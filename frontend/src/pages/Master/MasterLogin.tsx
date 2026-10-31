import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function MasterLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('master@paytune.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      
      // ✅ Check if the user is actually a master
      if (res.data.user.role !== 'master' && res.data.user.role !== 'MASTER_ADMIN') {
        throw new Error('This account does not have Master privileges.');
      }

      // ✅ Save the token for the Master Dashboard
      localStorage.setItem('master_token', res.data.token);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('role', 'master');
      localStorage.setItem('master', JSON.stringify(res.data.user));

      // Redirect to Master Dashboard
      navigate('/master', { replace: true });
      
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F0F0F] px-4">
      <div className="bg-[#1A1A1A] p-8 rounded-2xl w-full max-w-md border border-red-500/30">
        <h1 className="text-2xl font-bold text-red-500 text-center mb-6">Master Admin Login</h1>
        
        {error && <div className="bg-red-500/20 text-red-400 p-3 rounded mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700 focus:border-red-500 outline-none"
            placeholder="Master Email"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-3 rounded-lg bg-[#2A2A2A] text-white border border-gray-700 focus:border-red-500 outline-none"
            placeholder="Password"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Access Master Panel'}
          </button>
        </form>
      </div>
    </div>
  );
}
