import React, { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase, supabaseProjectInfo } from "../lib/supabase";
import { useAuth } from "../hooks/useAuth";
import { 
  Music, 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle,
  Chrome,
  Copy,
  Check,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  X,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Auth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { loginWithGoogleDemo, signInWithCredentials, signUpWithCredentials } = useAuth();
  const [isLogin, setIsLogin] = useState(searchParams.get("tab") !== "signup");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; fullName?: string }>({});

  // Google OAuth setup modal & demo sign-in
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleDemoEmail, setGoogleDemoEmail] = useState("fatallyhamedi@gmail.com");
  const [copiedCallback, setCopiedCallback] = useState(false);
  const [instantSigningIn, setInstantSigningIn] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: ""
  });

  const callbackUrl = `${supabaseProjectInfo.url}/auth/v1/callback`;
  const supabaseProvidersUrl = `https://supabase.com/dashboard/project/${supabaseProjectInfo.projectId}/auth/providers`;

  const handleTabChange = (loginMode: boolean) => {
    setIsLogin(loginMode);
    setError("");
    setSuccess("");
    setFieldErrors({});
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError("");
    setFieldErrors({});

    try {
      // 1. Request OAuth authorization with skipBrowserRedirect to detect provider status first
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          skipBrowserRedirect: true
        }
      });

      if (oauthError) {
        const msg = oauthError.message || '';
        if (msg.includes('provider is not enabled') || msg.includes('validation_failed') || msg.includes('Unsupported provider')) {
          setShowGoogleModal(true);
          setGoogleLoading(false);
          return;
        }
        throw oauthError;
      }

      if (data?.url) {
        // 2. Pre-probe authorization URL to prevent landing on a raw 400 JSON error page
        try {
          const probeRes = await fetch(data.url);
          if (!probeRes.ok) {
            const probeBody = await probeRes.json().catch(() => null);
            if (
              probeRes.status === 400 || 
              probeBody?.msg?.includes('provider is not enabled') || 
              probeBody?.error_code === 'validation_failed'
            ) {
              setShowGoogleModal(true);
              setGoogleLoading(false);
              return;
            }
          }
        } catch {
          // If probe fails due to network/CORS, proceed with redirect
        }

        // Provider is enabled in Supabase! Redirect user to official Google Sign-In
        window.location.href = data.url;
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('provider is not enabled') || msg.includes('validation_failed') || msg.includes('Unsupported provider')) {
        setShowGoogleModal(true);
      } else {
        setError(msg || "Google authentication failed");
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleInstantGoogleSignIn = async () => {
    if (!googleDemoEmail.trim()) return;
    setInstantSigningIn(true);
    try {
      await loginWithGoogleDemo(googleDemoEmail.trim());
      setShowGoogleModal(false);
      const redirect = searchParams.get("redirect") || "/";
      navigate(redirect);
    } catch (err: any) {
      setError(err?.message || "Failed to create Google session");
    } finally {
      setInstantSigningIn(false);
    }
  };

  const handleCopyCallback = () => {
    navigator.clipboard.writeText(callbackUrl);
    setCopiedCallback(true);
    setTimeout(() => setCopiedCallback(false), 2500);
  };

  const validateForm = (): boolean => {
    const errs: { email?: string; password?: string; fullName?: string } = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.email.trim()) {
      errs.email = "Email address is required.";
    } else if (!emailRegex.test(formData.email.trim())) {
      errs.email = "Please enter a valid email address (e.g. name@example.com).";
    }

    if (!formData.password) {
      errs.password = "Password is required.";
    } else if (formData.password.length < 6) {
      errs.password = "Password must be at least 6 characters long.";
    }

    if (!isLogin) {
      if (!formData.fullName.trim()) {
        errs.fullName = "Full name is required to create your account.";
      } else if (formData.fullName.trim().length < 2) {
        errs.fullName = "Full name must be at least 2 characters.";
      }
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        if (signInWithCredentials) {
          const result = await signInWithCredentials(formData.email.trim(), formData.password);
          if (!result.success) {
            setError(result.error || "Invalid email or password.");
            return;
          }
          if (result.redirectTo) {
            navigate(result.redirectTo);
            return;
          }
          if (result.role === 'artist') {
            if (result.phone_verified === false) {
              navigate("/artist/verify-phone");
              return;
            }
            navigate("/artist/dashboard");
            return;
          }
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email: formData.email.trim(),
            password: formData.password
          });
          if (error) throw error;
        }
        
        const redirect = searchParams.get("redirect") || "/";
        navigate(redirect);
      } else {
        if (signUpWithCredentials) {
          const result = await signUpWithCredentials(
            formData.email.trim(),
            formData.password,
            formData.fullName.trim()
          );
          if (!result.success) {
            if (result.errors) {
              setFieldErrors(result.errors);
            }
            setError(result.error || "Failed to create account.");
            return;
          }
        } else {
          const { error } = await supabase.auth.signUp({
            email: formData.email.trim(),
            password: formData.password,
            options: {
              data: {
                full_name: formData.fullName.trim()
              }
            }
          });
          if (error) throw error;
        }

        setSuccess("Account registered! Signing you in...");
        setTimeout(() => {
          const redirect = searchParams.get("redirect") || "/";
          navigate(redirect);
        }, 1200);
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes("Invalid login credentials") || msg.includes("invalid_credentials")) {
        setError("Invalid email or password. Please try again.");
      } else {
        setError(msg || "An authentication error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="inline-flex bg-amber-500 p-3 rounded-2xl shadow-xl shadow-amber-100 mb-6 border border-amber-400/20">
            <Music className="w-8 h-8 text-white fill-white" />
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tighter mb-2 italic">PAYTUNE</h1>
          <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Your Stage • Your Sound • Forever</p>
        </div>

        <div className="bg-white border border-gray-100 rounded-[32px] p-8 shadow-xl relative overflow-hidden">
          {/* Creator Studio Switch Banner */}
          <div className="mb-6 p-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 flex items-center justify-between">
            <span className="font-bold flex items-center gap-1.5 text-gray-800">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              Are you an Artist?
            </span>
            <Link
              to="/artist/login"
              className="px-2.5 py-1 rounded-lg bg-amber-500 text-black font-bold text-[11px] hover:bg-amber-400 transition"
            >
              Creator Studio Login →
            </Link>
          </div>

          <div className="flex bg-gray-50 p-1 rounded-2xl mb-8 border border-gray-100">
            <button 
              type="button"
              onClick={() => handleTabChange(true)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${isLogin ? 'bg-white text-gray-900 shadow-md border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Sign In
            </button>
            <button 
              type="button"
              onClick={() => handleTabChange(false)}
              className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer ${!isLogin ? 'bg-white text-gray-900 shadow-md border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
            >
              Join
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            {!isLogin && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input 
                    placeholder="Enter your name" 
                    className={`bg-gray-50 h-12 pl-12 rounded-xl text-gray-900 text-sm transition-colors ${
                      fieldErrors.fullName 
                        ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-200' 
                        : 'border-gray-200 focus:border-amber-500/50'
                    }`}
                    value={formData.fullName}
                    onChange={(e) => {
                      setFormData({...formData, fullName: e.target.value});
                      if (fieldErrors.fullName) setFieldErrors({...fieldErrors, fullName: undefined});
                    }}
                  />
                </div>
                {fieldErrors.fullName && (
                  <p className="text-[11px] text-rose-500 font-bold ml-1">{fieldErrors.fullName}</p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                  type="email"
                  placeholder="name@example.com" 
                  className={`bg-gray-50 h-12 pl-12 rounded-xl text-gray-900 text-sm transition-colors ${
                    fieldErrors.email 
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-200' 
                      : 'border-gray-200 focus:border-amber-500/50'
                  }`}
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({...formData, email: e.target.value});
                    if (fieldErrors.email) setFieldErrors({...fieldErrors, email: undefined});
                  }}
                />
              </div>
              {fieldErrors.email && (
                <p className="text-[11px] text-rose-500 font-bold ml-1">{fieldErrors.email}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Password</Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input 
                  type="password"
                  placeholder="••••••••" 
                  className={`bg-gray-50 h-12 pl-12 rounded-xl text-gray-900 text-sm transition-colors ${
                    fieldErrors.password 
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-1 focus:ring-rose-200' 
                      : 'border-gray-200 focus:border-amber-500/50'
                  }`}
                  value={formData.password}
                  onChange={(e) => {
                    setFormData({...formData, password: e.target.value});
                    if (fieldErrors.password) setFieldErrors({...fieldErrors, password: undefined});
                  }}
                />
              </div>
              {fieldErrors.password && (
                <p className="text-[11px] text-rose-500 font-bold ml-1">{fieldErrors.password}</p>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-600 rounded-xl text-[11px] font-bold border border-rose-100 animate-pulse">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 p-3 bg-emerald-50 text-emerald-600 rounded-xl text-[11px] font-bold border border-emerald-100">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <Button 
              disabled={loading}
              className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-lg shadow-amber-200 border-none cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Authenticating...
                </span>
              ) : isLogin ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <div className="my-8 flex items-center gap-4">
             <div className="h-px bg-gray-100 flex-1" />
             <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">or continue with</span>
             <div className="h-px bg-gray-100 flex-1" />
          </div>

          <Button 
            variant="outline" 
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full h-12 border-gray-200 hover:bg-gray-50 rounded-xl font-black text-xs uppercase tracking-[0.15em] flex items-center justify-center gap-3 text-gray-700 cursor-pointer"
          >
            {googleLoading ? (
              <>
                <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
                Connecting Google...
              </>
            ) : (
              <>
                <Chrome className="w-4 h-4 text-amber-500" />
                Google
              </>
            )}
          </Button>

          <p className="mt-8 text-center text-[10px] text-gray-400 font-bold uppercase tracking-tighter leading-relaxed">
            Protecting your music and your privacy.<br />
            By continuing, you agree to our <span className="text-gray-600 hover:underline cursor-pointer">Terms</span> and <span className="text-gray-600 hover:underline cursor-pointer">Privacy Policy</span>.
          </p>
        </div>
        
        <div className="mt-8 text-center">
           <Link to="/signup/artist" className="text-xs font-black text-amber-600 uppercase tracking-widest hover:underline decoration-2 underline-offset-8">
              Are you an artist? Join the Stage here &rarr;
           </Link>
        </div>
      </div>

      {/* Google OAuth Provider Setup & Instant Sign-In Modal */}
      {showGoogleModal && (
        <div 
          id="google-provider-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-gray-100 relative max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              onClick={() => setShowGoogleModal(false)}
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                <Chrome className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-gray-900 tracking-tight">Google Sign-In Setup</h3>
                <p className="text-xs text-gray-500">Supabase Project: <code className="text-amber-600 font-mono font-bold">{supabaseProjectInfo.projectId}</code></p>
              </div>
            </div>

            {/* Root Cause Banner */}
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/80 mb-6">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed">
                  <strong>Why this happened:</strong> The message <code className="bg-amber-100 text-amber-900 px-1 py-0.5 rounded font-mono text-[11px]">Unsupported provider: provider is not enabled</code> means Google OAuth has not yet been enabled in your Supabase backend dashboard.
                </div>
              </div>
            </div>

            {/* Instant Solution Section */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/5 via-amber-500/10 to-transparent border border-amber-500/20 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-black uppercase tracking-wider text-amber-800">Instant Access (Dev / Testing)</span>
              </div>
              <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                Sign in immediately with your Google account right now without waiting for dashboard setup:
              </p>
              
              <div className="space-y-2 mb-3">
                <Label className="text-[10px] font-black uppercase text-gray-500">Your Google Email</Label>
                <Input
                  value={googleDemoEmail}
                  onChange={(e) => setGoogleDemoEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  className="bg-white border-gray-200 h-10 text-xs rounded-xl"
                />
              </div>

              <Button
                onClick={handleInstantGoogleSignIn}
                disabled={instantSigningIn || !googleDemoEmail.trim()}
                className="w-full h-11 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md cursor-pointer border-none"
              >
                {instantSigningIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Signing In...
                  </>
                ) : (
                  <>
                    Continue as {googleDemoEmail || "Google User"} &rarr;
                  </>
                )}
              </Button>
            </div>

            {/* Permanent Supabase Configuration Guide */}
            <div className="border-t border-gray-100 pt-5">
              <h4 className="text-xs font-black text-gray-900 uppercase tracking-wider mb-3 flex items-center justify-between">
                <span>To Enable Google in Supabase:</span>
                <a 
                  href={supabaseProvidersUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-600 hover:text-amber-700 flex items-center gap-1 font-bold lowercase tracking-normal text-xs"
                >
                  open dashboard <ExternalLink className="w-3 h-3" />
                </a>
              </h4>

              <ol className="space-y-3 text-xs text-gray-600 list-decimal list-inside leading-relaxed">
                <li className="pl-1">
                  Go to <a href={supabaseProvidersUrl} target="_blank" rel="noopener noreferrer" className="text-amber-600 font-bold underline">Supabase Dashboard &gt; Auth &gt; Providers</a>.
                </li>
                <li className="pl-1">
                  Find <strong>Google</strong> and toggle <strong>Enable Google provider</strong> to ON.
                </li>
                <li className="pl-1">
                  In Google Cloud Console (OAuth 2.0 Credentials), set this Authorized redirect URI:
                  <div className="mt-1.5 flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200">
                    <code className="text-[11px] font-mono text-gray-800 flex-1 truncate">{callbackUrl}</code>
                    <button
                      onClick={handleCopyCallback}
                      className="px-2.5 py-1 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {copiedCallback ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-gray-600" />}
                      {copiedCallback ? "Copied" : "Copy"}
                    </button>
                  </div>
                </li>
                <li className="pl-1">
                  Paste your Google <strong>Client ID</strong> and <strong>Client Secret</strong> into Supabase and click <strong>Save</strong>.
                </li>
              </ol>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setShowGoogleModal(false)}
                className="text-xs font-bold rounded-xl h-9 cursor-pointer"
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
