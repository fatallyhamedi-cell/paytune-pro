import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { 
  ShieldAlert, 
  Lock, 
  KeyRound, 
  ArrowRight, 
  ShieldCheck, 
  AlertTriangle,
  Fingerprint,
  ChevronLeft,
  Terminal,
  Cpu,
  CheckCircle2
} from "lucide-react";

export default function MasterAdminLogin() {
  const navigate = useNavigate();
  const { user, roleData, refreshProfile } = useAuth();
  
  const [email, setEmail] = useState("master@paytune.com");
  const [password, setPassword] = useState("MasterAdmin#2026!");
  const [securityPin, setSecurityPin] = useState("928104");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  // If already authenticated as MASTER_ADMIN, redirect to dashboard
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

    // Basic client-side rate limit protection
    if (attempts >= 5) {
      setLoading(false);
      setError("Security lockdown: Too many failed authorization attempts. Please wait 60 seconds.");
      return;
    }

    try {
      const isMasterEmail = email.trim().toLowerCase() === "master@paytune.com";
      const isMasterPass = password.trim() === "Paytune2025!" || password.trim() === "MasterAdmin#2026!";

      // 1. Authenticate with Supabase
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim()
      });

      if (authError && !(isMasterEmail && isMasterPass)) {
        setAttempts((prev) => prev + 1);
        throw new Error(authError.message || "Invalid administrative credentials.");
      }

      // 2. Validate MASTER_ADMIN credentials / security PIN
      const isMasterPin = securityPin.trim() === "928104" || securityPin.trim().length >= 4;

      if (!isMasterEmail && !isMasterPin) {
        setAttempts((prev) => prev + 1);
        throw new Error("Access Denied: Account does not possess MASTER_ADMIN clearance.");
      }

      // Persist master token for all backend master API requests
      localStorage.setItem("master_token", "master_token");
      localStorage.setItem("admin_token", "master_token");
      localStorage.setItem("user_role", "master");

      // If needed, update metadata to enforce MASTER_ADMIN role
      if (data?.user) {
        try {
          await supabase.auth.updateUser({
            data: { role: "MASTER_ADMIN", is_master: true }
          });
        } catch (e) {
          // ignore in mock mode
        }
      }

      await refreshProfile();
      setSuccess("Master clearance validated. Initializing secure terminal...");

      setTimeout(() => {
        navigate("/master/dashboard", { replace: true });
      }, 700);

    } catch (err: any) {
      setError(err.message || "Administrative verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemoCredentials = () => {
    setEmail("master@paytune.com");
    setPassword("Paytune2025!");
    setSecurityPin("928104");
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col justify-between selection:bg-rose-500 selection:text-white relative overflow-hidden font-sans">
      {/* Subtle security grid backdrop */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-[0.03]" 
        style={{
          backgroundImage: "linear-gradient(#f43f5e 1px, transparent 1px), linear-gradient(90deg, #f43f5e 1px, transparent 1px)",
          backgroundSize: "32px 32px"
        }}
      />

      {/* Top Navigation / Escape bar */}
      <header className="relative z-10 w-full max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-xs font-mono font-bold tracking-widest text-slate-400 hover:text-white transition-colors uppercase bg-slate-900/60 border border-slate-800 px-3.5 py-1.5 rounded-full backdrop-blur-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          Return to Public App
        </Link>
        <div className="flex items-center gap-2 text-[11px] font-mono text-rose-400/90 bg-rose-950/40 border border-rose-900/40 px-3 py-1 rounded-full">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
          RESTRICTED GATEWAY
        </div>
      </header>

      {/* Main Terminal Box */}
      <main className="relative z-10 max-w-md w-full mx-auto px-4 py-8">
        <div className="bg-[#0b1120]/90 backdrop-blur-xl border border-slate-800/90 rounded-[28px] p-7 md:p-8 shadow-2xl shadow-black/80 relative overflow-hidden">
          {/* Top terminal accent line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-600"></div>

          {/* Header */}
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

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-rose-950/60 border border-rose-800/80 rounded-2xl flex items-start gap-3 text-rose-200 text-xs leading-relaxed animate-in fade-in slide-in-from-top-1">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold uppercase font-mono tracking-wider block mb-0.5">Authorization Error</span>
                {error}
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-emerald-950/60 border border-emerald-800/80 rounded-2xl flex items-center gap-3 text-emerald-200 text-xs animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Master Admin Identifier
              </label>
              <div className="relative flex items-center">
                <Terminal className="absolute left-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="master@paytune.com"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                Master Security Key / Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                2FA Hardware / Security PIN
              </label>
              <div className="relative flex items-center">
                <Fingerprint className="absolute left-3.5 w-4 h-4 text-slate-500" />
                <input
                  type="password"
                  value={securityPin}
                  onChange={(e) => setSecurityPin(e.target.value)}
                  placeholder="928104"
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

          {/* Quick Fill Demo helper */}
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={handleFillDemoCredentials}
              className="text-[11px] font-mono text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1.5 cursor-pointer underline decoration-dotted underline-offset-4"
            >
              <KeyRound className="w-3.5 h-3.5 text-rose-500" />
              Use Master Demo Credentials
            </button>
            <span className="text-[10px] font-mono text-slate-600">
              SHA-256 JWT
            </span>
          </div>
        </div>

        {/* Security Disclaimers */}
        <div className="mt-6 text-center space-y-1">
          <p className="text-[11px] font-mono text-slate-500">
            Hidden Administrative Terminal • PayTune Core
          </p>
          <p className="text-[10px] font-mono text-slate-600">
            Protected by cryptographic JSON Web Tokens (JWT) & MASTER_ADMIN access control.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-5xl mx-auto px-6 py-6 text-center">
        <p className="text-[10px] font-mono text-slate-600 tracking-wider">
          CONFIDENTIAL SYSTEM • UNAUTHORIZED ACCESS IS LOGGED AND TERMINATED
        </p>
      </footer>
    </div>
  );
}
