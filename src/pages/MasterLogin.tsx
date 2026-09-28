import React, { useState } from "react";
import axios from "axios";
import { ShieldCheck, Lock, Mail, ArrowRight, Sparkles, AlertCircle } from "lucide-react";

interface MasterLoginProps {
  onSuccess: (token: string, user: any) => void;
}

export const MasterLogin: React.FC<MasterLoginProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState("master@paytune.com");
  const [password, setPassword] = useState("Paytune2025!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await axios.post("/api/admin/login", {
        email,
        password
      });

      if (res.data && res.data.token) {
        localStorage.setItem("master_token", res.data.token);
        localStorage.setItem("admin_token", res.data.token);
        localStorage.setItem("user_role", "master");
        localStorage.setItem("user_email", email);
        onSuccess(res.data.token, res.data.user);
      } else {
        setError("Invalid master authorization credentials.");
      }
    } catch (err: any) {
      console.error("Master login error:", err);
      // Fallback for demo resilience
      if (email === "master@paytune.com" && password === "Paytune2025!") {
        localStorage.setItem("master_token", "master_token");
        localStorage.setItem("user_role", "master");
        onSuccess("master_token", { email, role: "master" });
      } else {
        setError(err.response?.data?.message || "Invalid administrative credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col justify-center items-center p-4 text-white">
      {/* Background ambient glow */}
      <div className="absolute w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md p-8 rounded-3xl bg-[#141414] border border-neutral-800 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-2">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <span>PAYTUNE</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500 text-neutral-950 font-black">
              MASTER
            </span>
          </h1>
          <p className="text-xs text-neutral-400 max-w-xs mx-auto">
            Super Administrator Authorization Portal for platform monitoring, financial splits & creator oversight.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-neutral-400 mb-1.5 font-medium">Administrator Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-neutral-500" />
              <input
                id="input-master-email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 text-xs"
                placeholder="master@paytune.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-neutral-400 mb-1.5 font-medium">Master Security Key</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-neutral-500" />
              <input
                id="input-master-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:border-amber-500 text-xs"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          <button
            id="btn-submit-master-login"
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs shadow-lg shadow-amber-500/10 transition-all cursor-pointer disabled:opacity-50"
          >
            <span>{loading ? "Verifying Authorization..." : "Access Master Console"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Demo Quick-Fill Credentials Card */}
        <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 text-[11px] space-y-1.5">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="font-semibold flex items-center gap-1 text-amber-400">
              <Sparkles className="w-3.5 h-3.5" /> Master Clearance:
            </span>
            <button
              id="btn-prefill-master"
              type="button"
              onClick={() => {
                setEmail("master@paytune.com");
                setPassword("Paytune2025!");
              }}
              className="text-amber-400 hover:underline cursor-pointer font-bold"
            >
              Fill Credentials
            </button>
          </div>
          <div className="text-neutral-400 font-mono text-[10px]">
            User: <span className="text-white">master@paytune.com</span> | Pass: <span className="text-white">Paytune2025!</span>
          </div>
        </div>
      </div>
    </div>
  );
};
