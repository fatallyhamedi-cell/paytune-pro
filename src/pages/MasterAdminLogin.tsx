import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { useMasterAuth } from "../contexts/MasterAuthContext";
import {
  ShieldAlert,
  Lock,
  ArrowRight,
  AlertTriangle,
  Fingerprint,
  ChevronLeft,
  Terminal,
  Cpu,
  CheckCircle2,
} from "lucide-react";

export default function MasterAdminLogin() {
  const navigate = useNavigate();
  const { user, roleData, refreshProfile } = useAuth();
  const { loginMaster } = useMasterAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [securityPin, setSecurityPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    const isMaster =
      roleData?.role === "MASTER_ADMIN" ||
      roleData?.role === "master" ||
      roleData?.is_master === true ||
      user?.user_metadata?.role === "MASTER_ADMIN";

    if (user && isMaster) {
      navigate("/master/dashboard", { replace: true });
    }
  }, [user, roleData, navigate]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (attempts >= 5) {
      setLoading(false);
      setError("Security lockdown: Too many failed authorization attempts. Please wait 60 seconds.");
      return;
    }

    const submittedEmail = email.trim();
    const submittedPassword = password.trim();
    setPassword("");
    setSecurityPin("");

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: submittedEmail,
        password: submittedPassword,
      });

      if (authError || !data?.session || !data?.user) {
        setAttempts((prev) => prev + 1);
        throw new Error(authError?.message || "Invalid administrative credentials.");
      }

      const verifyRes = await fetch("/api/master/stats", {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
      });

      if (!verifyRes.ok) {
        await supabase.auth.signOut();
        setAttempts((prev) => prev + 1);
        throw new Error("Access Denied: Account does not possess MASTER_ADMIN clearance.");
      }

      loginMaster(data.session.access_token, {
        id: data.user.id,
        email: data.user.email || submittedEmail,
        role: "MASTER_ADMIN",
        full_name: data.user.user_metadata?.full_name || "Platform Master Administrator",
      });

      await refreshProfile();
      setSuccess("Master clearance validated. Redirecting to secure console...");

      setTimeout(() => {
        navigate("/master/dashboard", { replace: true });
      }, 500);
    } catch (err: any) {
      setError(err.message || "Administrative verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-between selection:bg-rose-500 selection:text-white relative overflow-hidden font-sans">
      <div className="absolute inset-0 pointer-events-none opacity-[0.04] bg-[radial-gradient(#f43f5e_1px,transparent_1px)] [background-size:32px_32px]" />

      {/* Top Navigation */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs font-mono font-bold tracking-widest text-slate-400 hover:text-white transition-colors uppercase bg-slate-900/60 border border-slate-800 px-3.5 py-1.5 rounded-full backdrop-blur-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          Return to Public App
        </Link>
        <div className="flex items-center gap-2 text-[11px] font-mono text-rose-400/90 bg-rose-950/40 border border-rose-900/40 px-3 py-1 rounded-md">
          RESTRICTED GATEWAY
        </div>
      </header>

      {/* Main Terminal Box */}
      <main className="relative z-10 max-w-md w-full mx-auto px-4 py-8">
        <div className="bg-[#0b1120]/90 backdrop-blur-xl border border-slate-800/90 rounded-[28px] p-7 md:p-8 shadow-2xl shadow-black/80 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-purple-600 to-rose-600" />

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mb-4 shadow-inner">
              <ShieldAlert className="w-7 h-7 stroke-[2.2]" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white uppercase font-mono">
              Master Admin Access
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-mono tracking-wide">
              Role Verification: <span className="text-rose-400 font-bold">MASTER_ADMIN</span>
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-950/60 border border-rose-800/80 rounded-2xl flex items-start gap-3 text-rose-200 text-xs leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold uppercase font-mono tracking-wider block mb-0.5">Authorization Error</span>
                {error}
              </div>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-emerald-950/60 border border-emerald-800/80 rounded-2xl flex items-center gap-3 text-emerald-200 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Master Admin Email
              </label>
              <div className="relative flex items-center">
                <Terminal className="absolute left-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@yourdomain.com"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter administrator password"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Security PIN (Optional)
              </label>
              <div className="relative flex items-center">
                <Fingerprint className="absolute left-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={securityPin}
                  onChange={(e) => setSecurityPin(e.target.value)}
                  placeholder="Enter security PIN"
                  maxLength={10}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none tracking-widest transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-mono font-black text-xs uppercase tracking-widest py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-rose-950/40 hover:shadow-rose-900/60 transition-all duration-200 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Cpu className="w-4 h-4 animate-spin" />
                  <span>Verifying Master Credentials...</span>
                </>
              ) : (
                <>
                  <span>Authenticate Master Session</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center space-y-1">
          <p className="text-[11px] font-mono text-slate-500">
            Administrative Terminal • PayTune Core
          </p>
        </div>
      </main>

      <footer className="relative z-10 w-full max-w-5xl mx-auto px-6 py-6 text-center">
        <p className="text-[10px] font-mono text-slate-600 tracking-wider">
          UNAUTHORIZED ACCESS ATTEMPTS ARE LOGGED
        </p>
      </footer>
    </div>
  );
}
